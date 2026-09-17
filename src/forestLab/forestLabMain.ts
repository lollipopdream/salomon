import * as THREE from 'three';

import { resolveAppearanceId } from './appearance/appearanceModel';
import { createCandidateController } from './candidates/candidateController';
import { resolveCameraPose, type LabCameraPose } from './camera/labCameras';
import { buildConfigDump } from './configDump';
import { CAPTURE_HEIGHT, CAPTURE_WIDTH } from './labConstants';
import type { AppearanceId, CameraId, CandidateId, PatchId } from './labTypes';
import {
  createForestLabHook,
  type ForestLabHook,
  type ForestLayerVisibilityToken,
} from './labHook';
import { patchSpecFromManifest } from './patch/patchManifest';
import { parseR10Config, setR10Config } from './r10/r10LabConfig';
import { PATCH_MANIFEST_JSON } from './scene/labDataSources';
import { createLabRenderer } from './scene/labRenderer';
import {
  createPatchRouteLine,
  createPatchTerrainMesh,
  loadLabTerrainData,
} from './scene/labTerrain';
import { loadDetailAssets } from './hybrid/detailMeshes';
import { attachLabOrbit } from './ui/labOrbit';
import { createLabUi } from './ui/labUi';

function candidateFromQuery(value: string | null): CandidateId {
  const parsed = Number(value);
  return parsed === 1 || parsed === 2 || parsed === 3 || parsed === 4 || parsed === 5
    ? parsed
    : 0;
}

function cameraFromQuery(value: string | null): CameraId {
  return value === 'OVERVIEW' || value === 'CLOSE' ? value : 'PRIMARY';
}

function patchFromQuery(value: string | null, available: readonly PatchId[]): PatchId {
  return value === 'B' && available.includes('B') ? 'B' : 'A';
}

function disposeCommon(object: THREE.Mesh | THREE.Line | null): void {
  if (!object) return;
  object.removeFromParent();
  object.geometry.dispose();
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  for (const material of materials) material.dispose();
}

export async function startForestLab(): Promise<ForestLabHook> {
  const container = document.querySelector<HTMLElement>('#lab');
  if (!container) throw new Error('Forest Lab requires a #lab container.');
  const query = new URLSearchParams(window.location.search);
  setR10Config(parseR10Config(query));
  const capture = query.get('capture') === '1';
  const manifest = PATCH_MANIFEST_JSON;
  const availablePatches = manifest.patches.map((entry) => entry.id);
  let patchId = patchFromQuery(query.get('patch'), availablePatches);
  let candidateId = candidateFromQuery(query.get('candidate'));
  let appearanceId: AppearanceId = resolveAppearanceId(query.get('appearance'));
  let cameraId = cameraFromQuery(query.get('camera'));

  if (capture) {
    container.style.width = `${CAPTURE_WIDTH}px`;
    container.style.height = `${CAPTURE_HEIGHT}px`;
  }
  const { renderer, camera, scene } = createLabRenderer(container, { capture });
  const resize = (): void => {
    const width = container.clientWidth || 1280;
    const height = container.clientHeight || 720;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  if (!capture) {
    resize();
    window.addEventListener('resize', resize);
  }

  const assetStarted = performance.now();
  const [sharedTerrain, detailAssets] = await Promise.all([
    loadLabTerrainData(renderer.capabilities.getMaxAnisotropy()),
    loadDetailAssets(),
  ]);
  const assetMs = performance.now() - assetStarted;

  let terrainMesh: ReturnType<typeof createPatchTerrainMesh>;
  let routeLine: ReturnType<typeof createPatchRouteLine>;
  let controller: ReturnType<typeof createCandidateController>;
  const makePatchObjects = (id: PatchId): ReturnType<typeof createCandidateController> => {
    const spec = patchSpecFromManifest(manifest, id);
    const manifestPatch = manifest.patches.find((entry) => entry.id === id)!;
    terrainMesh = createPatchTerrainMesh(
      sharedTerrain.grid,
      spec,
      sharedTerrain.vertexColors,
      sharedTerrain.texture,
    );
    routeLine = createPatchRouteLine(sharedTerrain.grid, spec);
    scene.add(terrainMesh);
    if (routeLine) scene.add(routeLine);
    return createCandidateController({
      scene,
      sharedData: { ...sharedTerrain, detailAssets },
      patch: {
        ...spec,
        detailMaxCount: manifest.derived.detailMaxCount,
        forestFraction: manifestPatch.metrics.forestFraction,
        Lt: manifest.globalStats.Lt,
      },
      initialAppearance: appearanceId,
    });
  };
  controller = makePatchObjects(patchId);

  let selectedPose: LabCameraPose = resolveCameraPose(cameraId, manifest) as LabCameraPose;
  let renderedTarget = { ...selectedPose.target };
  const applyPose = (pose: Pick<LabCameraPose, 'position' | 'target'>): void => {
    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    renderedTarget = { ...pose.target };
    camera.lookAt(renderedTarget.x, renderedTarget.y, renderedTarget.z);
    controller.onCameraChanged?.({
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      fovDegrees: camera.fov,
    });
  };
  const applyPreset = (id: CameraId): void => {
    cameraId = id;
    selectedPose = resolveCameraPose(id, manifest) as LabCameraPose;
    camera.fov = selectedPose.fov;
    camera.near = selectedPose.near ?? camera.near;
    camera.far = selectedPose.far ?? camera.far;
    camera.updateProjectionMatrix();
    // applyPose 自身が末尾で controller.onCameraChanged() を呼ぶ。fov は
    // その前に確定させてあるので、ここで重ねて呼ばない(visibility 再評価は
    // 2,713 cluster + 195,336 instance の詰め直しを伴うため二重実行は無駄)。
    applyPose(selectedPose);
  };
  applyPreset(cameraId);

  const orbit = attachLabOrbit({
    canvas: renderer.domElement,
    getPose: () => ({
      position: { ...selectedPose.position },
      target: { ...selectedPose.target },
    }),
    applyPose,
  });

  let hook: ForestLabHook;
  const ui = createLabUi({
    container,
    patches: availablePatches,
    onCandidate: async (id) => {
      await hook.setCandidate(id);
    },
    onCamera: (id) => hook.setCamera(id),
    onPatch: async (id) => {
      await hook.setPatch(id);
    },
    onReset: () => hook.resetCamera(),
  });

  let frameHandle = 0;
  let stopped = false;
  const renderFrame = (): void => {
    camera.lookAt(renderedTarget.x, renderedTarget.y, renderedTarget.z);
    renderer.render(scene, camera);
  };
  const frame = (): void => {
    if (stopped) return;
    renderFrame();
    frameHandle = window.requestAnimationFrame(frame);
  };
  frameHandle = window.requestAnimationFrame(frame);

  const hiddenLayerVisibility = new Map<THREE.Object3D, boolean>();
  const matchesLayer = (
    name: string,
    tokens: ReadonlySet<ForestLayerVisibilityToken>,
  ): boolean => {
    if (tokens.has('ALLFOREST')) return name === 'forest-lab-far-canopy'
      || name.startsWith('forest-lab-cluster-')
      || name.startsWith('forest-lab-detail-')
      || name.startsWith('forest-lab-shell');
    return (tokens.has('FARCANOPY') && name === 'forest-lab-far-canopy')
      || (tokens.has('CLUSTERS') && name.startsWith('forest-lab-cluster-'))
      || (tokens.has('DETAIL') && name.startsWith('forest-lab-detail-'))
      || (tokens.has('SHELL') && name.startsWith('forest-lab-shell'));
  };
  const setLayerVisibilityValue = (
    tokens: readonly ForestLayerVisibilityToken[],
  ): void => {
    if (tokens[0] === 'NONE') {
      for (const [object, visible] of hiddenLayerVisibility) object.visible = visible;
      hiddenLayerVisibility.clear();
      return;
    }
    const selected = new Set(tokens);
    scene.traverse((object) => {
      if (!matchesLayer(object.name, selected)) return;
      if (!hiddenLayerVisibility.has(object)) hiddenLayerVisibility.set(object, object.visible);
      object.visible = false;
    });
  };

  hook = createForestLabHook({
    renderer,
    controller,
    initialPatch: patchId,
    initialCandidate: candidateId,
    initialAppearance: appearanceId,
    initialCamera: cameraId,
    async replacePatch(id) {
      disposeCommon(terrainMesh);
      disposeCommon(routeLine);
      patchId = id;
      controller = makePatchObjects(id);
      applyPreset(cameraId);
      orbit.reset();
      return controller;
    },
    applyCamera(id) {
      applyPreset(id);
      orbit.reset();
    },
    resetCameraPose: () => orbit.reset(),
    setOrbitEnabledValue: (enabled) => orbit.setEnabled(enabled),
    isOrbitApplied: () => orbit.isApplied(),
    hideUi: () => ui.hide(),
    showUi: () => ui.show(),
    setLayerVisibilityValue,
    getCameraSnapshot: () => ({
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      target: { ...renderedTarget },
      fov: camera.fov,
    }),
    getConfigDumpValue: () => buildConfigDump(manifest),
    renderFrame,
    assetMs,
    stateChanged(controllerState, nextPatch, nextCamera) {
      candidateId = controllerState.candidate;
      appearanceId = controllerState.appearance;
      patchId = nextPatch;
      cameraId = nextCamera;
      ui.setStatus({
        candidate: controllerState.candidate,
        camera: nextCamera,
        patch: nextPatch,
        shellTriangleCount: controllerState.shellTriangleCount,
        detailCount: controllerState.detailCount,
        buildMs: controllerState.buildMs,
        clusterCount: controllerState.cluster?.clusterAcceptedCount,
        memberCount: controllerState.cluster?.memberPlacedCount,
        visibleInstanceCount: controllerState.cluster?.visibleInstanceCount,
      });
    },
    disposeLab() {
      stopped = true;
      window.cancelAnimationFrame(frameHandle);
      if (!capture) window.removeEventListener('resize', resize);
      orbit.detach();
      ui.dispose();
      disposeCommon(terrainMesh);
      disposeCommon(routeLine);
      detailAssets.dispose();
      sharedTerrain.texture.dispose();
      renderer.dispose();
      if (window.__forestLab === hook) delete window.__forestLab;
    },
  });
  window.__forestLab = hook;
  await hook.ready;
  return hook;
}

if (typeof document !== 'undefined') {
  startForestLab().catch((error) => console.error('[forest-lab]', error));
}
