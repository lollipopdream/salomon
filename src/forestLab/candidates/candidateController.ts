import * as THREE from 'three';

import { defaultSettings } from '../../config/settings';
import { sampleMaskCoverageV2 } from '../../forest/impostorV2/forestMaskV2';
import type { ImpostorAssets } from '../../forest/impostorV2/impostorAssets';
import type { ForestMaskV2Data } from '../../forest/impostorV2/types';
import { createTerrainHeightSampler } from '../../forest/terrainHeightSampler';
import type { ElevationGrid } from '../../types';
import {
  createAppearanceModel,
  type AppearanceId,
} from '../appearance/appearanceModel';
import {
  R5_FAR_CANOPY_OPACITY_FAR_METERS,
  R5_FAR_CANOPY_OPACITY_MAX,
  R5_FAR_CANOPY_OPACITY_MIN,
  R5_FAR_CANOPY_OPACITY_NEAR_METERS,
} from '../appearance/appearanceConstants';
import {
  cellWidthOf,
  groveCellSlot,
  loadClusterAssets,
  treeCellSlot,
} from '../cluster/clusterAssets';
import { createClusterMeshes, type ClusterMeshSet } from '../cluster/clusterMeshes';

/** R7 で per-plane view pairing を適用する grove config。G4 のみ。 */
const R7_BI_VIEW_GROVE_CONFIGS: ReadonlySet<string> = new Set(['G4']);
import { buildClusterPlacement } from '../cluster/clusterPlacement';
import type { ClusterPlacementResult } from '../cluster/clusterTypes';
import { evaluateClusterVisibility } from '../cluster/clusterVisibility';
import {
  createFarCanopyOverlay,
  loadFarCanopyTexture,
} from '../cluster/farCanopyLayer';
import {
  CROWN_SPACING_METERS,
  MASK_THRESHOLD,
  PRIMARY_CAMERA,
  SEED,
  SHELL_SUBDIVISION,
} from '../labConstants';
import type {
  CandidateId,
  ClusterRuntimeStats,
  FarCanopyRuntimeStats,
  PatchSpec,
  Vec3Record,
} from '../labTypes';
import { setActiveConfigDumpRuntimeState } from '../configDump';
import { sampleGridBilinear } from '../patch/patchGrid';
import { getR10Config } from '../r10/r10LabConfig';
import { PATCH_MANIFEST_JSON } from '../scene/labDataSources';
import {
  assignDetailAttributes,
  computeDetailMaxCount,
  scoreDetailSites,
  selectDetailPlacements,
} from '../hybrid/detailPlacement';
import { createDetailMeshes } from '../hybrid/detailMeshes';
import { createShellVertexColors } from '../scene/labTerrain';
import { enumerateCrowns } from '../shell/crownField';
import { buildMaskDistanceFieldTexels, sampleDistanceMeters } from '../shell/maskDistanceField';
import {
  buildCanopyHeightFieldA,
  buildCanopyHeightFieldB,
  buildShellTaperField,
  buildShellTerrainYField,
  buildShellYField,
} from '../shell/shellHeightField';
import { buildShellGeometry, createShellMaterial } from '../shell/shellMesh';

export type { CandidateId } from '../labTypes';

export interface CandidateControllerPatch extends PatchSpec {
  detailMaxCount?: number;
  forestFraction?: number;
  Lt?: number;
  worldBbox?: { xMin: number; xMax: number; zMin: number; zMax: number };
}

export interface CandidateSharedData {
  grid: ElevationGrid;
  texture: THREE.Texture;
  mask: ForestMaskV2Data;
  vertexColors: Float32Array;
  detailAssets: ImpostorAssets;
}

export interface CandidateControllerState {
  candidate: CandidateId;
  appearance: AppearanceId;
  crownCount?: number;
  shellVertexCount: number;
  shellTriangleCount: number;
  detailCount: number;
  buildMs: number;
  cluster?: ClusterRuntimeStats;
  farCanopy?: FarCanopyRuntimeStats;
}

export interface CandidateController {
  setCandidate(id: CandidateId): Promise<void>;
  setAppearance(id: AppearanceId): Promise<void>;
  onCameraChanged?(camera: { position: Vec3Record; fovDegrees: number }): void;
  getState(): CandidateControllerState;
  dispose(): void;
}

interface ControllerDependencies {
  now: () => number;
  subdivision: number;
  loadClusterAssets?: (appearance?: AppearanceId) => Promise<ImpostorAssets>;
  loadFarCanopyTexture?: (appearance?: AppearanceId) => Promise<{
    texture: THREE.Texture;
    sha256: string | null;
    width: number;
    height: number;
  }>;
}

const defaultDependencies: ControllerDependencies = {
  now: () => performance.now(),
  subdivision: SHELL_SUBDIVISION,
  loadClusterAssets,
  loadFarCanopyTexture,
};

export interface FarCanopyOpacityParams {
  readonly nearDistanceMeters: number;
  readonly farDistanceMeters: number;
  readonly minOpacity: number;
  readonly maxOpacity: number;
}

/** R5 限定の FAR 距離ゲート既定値(design §T4 / appearanceConstants.ts の実測根拠を参照)。 */
export const DEFAULT_FAR_CANOPY_OPACITY_PARAMS: FarCanopyOpacityParams = {
  nearDistanceMeters: R5_FAR_CANOPY_OPACITY_NEAR_METERS,
  farDistanceMeters: R5_FAR_CANOPY_OPACITY_FAR_METERS,
  minOpacity: R5_FAR_CANOPY_OPACITY_MIN,
  maxOpacity: R5_FAR_CANOPY_OPACITY_MAX,
};

function smoothstep01(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * R5 限定の純関数: FAR canopy overlay までの距離(meters)から material.opacity へ渡す値を返す。
 * `nearDistanceMeters` 以下は `minOpacity`、`farDistanceMeters` 以上は `maxOpacity`、
 * その間は smoothstep で単調に補間する(design §T4: CLOSE で大きく抑制、OVERVIEW で十分表示、
 * PRIMARY は自然な遷移)。R3/R4/R2/R1/BASELINE の FAR はこの関数を一切呼ばない(常時不変)。
 */
export function farCanopyOpacityAtDistance(
  distanceMeters: number,
  params: FarCanopyOpacityParams = DEFAULT_FAR_CANOPY_OPACITY_PARAMS,
): number {
  const { nearDistanceMeters, farDistanceMeters, minOpacity, maxOpacity } = params;
  if (distanceMeters <= nearDistanceMeters) return minOpacity;
  if (distanceMeters >= farDistanceMeters) return maxOpacity;
  const t = (distanceMeters - nearDistanceMeters) / (farDistanceMeters - nearDistanceMeters);
  return minOpacity + (maxOpacity - minOpacity) * smoothstep01(t);
}

function buildLaplacianField(grid: ElevationGrid): Float32Array {
  const values = new Float32Array(grid.rows * grid.cols);
  for (let row = 0; row < grid.rows; row += 1) {
    const north = Math.max(0, row - 1);
    const south = Math.min(grid.rows - 1, row + 1);
    for (let col = 0; col < grid.cols; col += 1) {
      const west = Math.max(0, col - 1);
      const east = Math.min(grid.cols - 1, col + 1);
      const center = grid.values[row * grid.cols + col];
      values[row * grid.cols + col] = 4 * center
        - grid.values[north * grid.cols + col]
        - grid.values[south * grid.cols + col]
        - grid.values[row * grid.cols + west]
        - grid.values[row * grid.cols + east];
    }
  }
  return values;
}

function disposeObject(object: THREE.Mesh | THREE.InstancedMesh): void {
  object.removeFromParent();
  object.geometry.dispose();
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  for (const material of materials) material.dispose();
}

export function createCandidateController({
  scene,
  sharedData,
  patch,
  dependencies,
  initialAppearance = 'BASELINE',
}: {
  scene: THREE.Scene;
  sharedData: CandidateSharedData;
  patch: CandidateControllerPatch;
  dependencies?: Partial<ControllerDependencies>;
  initialAppearance?: AppearanceId;
}): CandidateController {
  const deps = {
    now: dependencies?.now ?? defaultDependencies.now,
    subdivision: dependencies?.subdivision ?? defaultDependencies.subdivision,
    loadClusterAssets: dependencies?.loadClusterAssets ?? loadClusterAssets,
    loadFarCanopyTexture: dependencies?.loadFarCanopyTexture ?? loadFarCanopyTexture,
  };
  const sizeCells = patch.rowEnd - patch.rowStart;
  if (sizeCells !== patch.colEnd - patch.colStart) {
    throw new RangeError('Candidate patch must be square.');
  }

  let disposed = false;
  let state: CandidateControllerState = {
    candidate: 0,
    appearance: initialAppearance,
    crownCount: 0,
    shellVertexCount: 0,
    shellTriangleCount: 0,
    detailCount: 0,
    buildMs: 0,
  };
  let distanceField: Float32Array | undefined;
  let terrainY: Float32Array | undefined;
  let taper: Float32Array | undefined;
  let shellColors: Float32Array | undefined;
  let laplacian: Float32Array | undefined;
  let crowns: ReturnType<typeof enumerateCrowns> | undefined;
  let shellA: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | undefined;
  let shellB: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | undefined;
  let details: THREE.InstancedMesh[] | undefined;
  let detailCount = 0;
  let clusterAssets: ImpostorAssets | undefined;
  let clusterPlacement: ClusterPlacementResult | undefined;
  let meshSet: ClusterMeshSet | undefined;
  let clusterPromise: Promise<ClusterMeshSet> | undefined;
  let visibilityOut: Uint8Array | undefined;
  let lastCamera: { position: Vec3Record; fovDegrees: number } | undefined;
  let farOverlay: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined;
  let farTexture: THREE.Texture | undefined;
  let farStats: FarCanopyRuntimeStats | undefined;
  let farPromise: Promise<typeof farOverlay> | undefined;
  let appearance: AppearanceId = initialAppearance;

  const worldBbox = (): { xMin: number; xMax: number; zMin: number; zMax: number } => {
    if (patch.worldBbox) return patch.worldBbox;
    const manifestPatch = PATCH_MANIFEST_JSON.patches.find((entry) =>
      String(entry.id) === patch.id
    );
    if (!manifestPatch) {
      throw new RangeError(`Missing world bbox for patch ${patch.id}.`);
    }
    return manifestPatch.worldBbox;
  };

  const ensureCluster = (): Promise<ClusterMeshSet> => {
    clusterPromise ??= (async () => {
      clusterAssets = await deps.loadClusterAssets(appearance);
      const placementArgs = {
        worldBbox: worldBbox(),
        seed: SEED,
        maskThreshold: MASK_THRESHOLD,
        sampleCoverage: (x: number, z: number) => sampleMaskCoverageV2(sharedData.mask, x, z),
        terrainYAt: createTerrainHeightSampler(
          sharedData.grid,
          defaultSettings.elevationScale,
        ),
        cellWidthOf: (slot: number) => cellWidthOf(clusterAssets!, slot),
        groveCellSlot,
        treeCellSlot,
      };
      clusterPlacement = buildClusterPlacement({
        ...placementArgs,
        appearance: createAppearanceModel(appearance, SEED),
        macroShade: getR10Config().macroShade,
      });
      // R7 bi-view: G4 only. Each crossed plane samples the baked view that belongs
      // to ITS own orientation instead of both showing one picture twice, which is
      // what produced the large card / X silhouette at CLOSE in R7-G4 v1.
      // No extra plane, vertex, triangle, instance or draw call -- only plane B's UV.
      meshSet = createClusterMeshes({
        assets: clusterAssets,
        placement: clusterPlacement,
        ...(appearance === 'R7' ? { biViewConfigs: R7_BI_VIEW_GROVE_CONFIGS } : {}),
      });
      return meshSet;
    })();
    return clusterPromise;
  };

  const ensureFarLayer = (): Promise<typeof farOverlay> => {
    farPromise ??= (async () => {
      const loaded = await deps.loadFarCanopyTexture(appearance);
      farTexture = loaded.texture;
      farOverlay = createFarCanopyOverlay({
        grid: sharedData.grid,
        patch,
        vertexColors: sharedData.vertexColors,
        texture: farTexture,
        worldBbox: worldBbox(),
        macroShade: getR10Config().macroShade,
        terrainYAt: createTerrainHeightSampler(
          sharedData.grid,
          defaultSettings.elevationScale,
        ),
      });
      farStats = {
        textureSha256: loaded.sha256,
        textureWidth: loaded.width,
        textureHeight: loaded.height,
        overlayVertexCount: farOverlay.geometry.getAttribute('position').count,
        overlayTriangleCount: farOverlay.geometry.getIndex()!.count / 3,
      };
      return farOverlay;
    })();
    return farPromise;
  };

  // R5 限定の FAR distance gate。R3/R4/R2/R1/BASELINE ではこの関数は何もしない(material.opacity
  // は createFarCanopyOverlay が設定した既定値 1 のまま、従来どおり常時表示)。
  const applyFarCanopyOpacityGate = (): void => {
    if (!farOverlay || appearance !== 'R5' || !lastCamera) return;
    const bbox = worldBbox();
    const centerX = (bbox.xMin + bbox.xMax) / 2;
    const centerZ = (bbox.zMin + bbox.zMax) / 2;
    const dx = lastCamera.position.x - centerX;
    const dz = lastCamera.position.z - centerZ;
    const distanceMeters = Math.sqrt(dx * dx + dz * dz);
    farOverlay.material.opacity = farCanopyOpacityAtDistance(distanceMeters);
  };

  const applyLatestClusterVisibility = (): number | undefined => {
    if (!meshSet || !clusterPlacement || !lastCamera) return undefined;
    visibilityOut ??= new Uint8Array(clusterPlacement.clusterCount);
    const visibility = evaluateClusterVisibility({
      clusterX: clusterPlacement.clusterX,
      clusterY: clusterPlacement.clusterY,
      clusterZ: clusterPlacement.clusterZ,
      clusterCount: clusterPlacement.clusterCount,
      cameraPosition: lastCamera.position,
      fovDegrees: lastCamera.fovDegrees,
      out: visibilityOut,
    });
    return meshSet.applyVisibility(visibility);
  };

  const ensureFields = (): void => {
    distanceField ??= buildMaskDistanceFieldTexels(
      sharedData.mask.coverage,
      sharedData.mask.size,
      MASK_THRESHOLD,
    );
    terrainY ??= buildShellTerrainYField(
      sharedData.grid,
      patch,
      deps.subdivision,
      defaultSettings,
    );
    taper ??= buildShellTaperField(
      distanceField,
      sharedData.mask.size,
      patch,
      deps.subdivision,
    );
    shellColors ??= createShellVertexColors(
      sharedData.vertexColors,
      patch,
      deps.subdivision,
    );
  };

  const ensureCrowns = (): ReturnType<typeof enumerateCrowns> => {
    if (!crowns) {
      const latticeCols = Math.ceil(
        sizeCells * sharedData.grid.cellSizeMeters / CROWN_SPACING_METERS,
      );
      crowns = enumerateCrowns({
        xMin: patch.colStart * sharedData.grid.cellSizeMeters,
        zMin: patch.rowStart * sharedData.grid.cellSizeMeters,
        latticeCols,
        spacing: CROWN_SPACING_METERS,
        seed: SEED,
        sampleCoverage: (x, z) => sampleMaskCoverageV2(sharedData.mask, x, z),
      });
    }
    return crowns;
  };

  const makeShell = (candidate: 1 | 2): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> => {
    ensureFields();
    const canopy = candidate === 1
      ? buildCanopyHeightFieldA(terrainY!.length)
      : buildCanopyHeightFieldB(ensureCrowns(), patch, deps.subdivision);
    const geometry = buildShellGeometry({
      shellY: buildShellYField(terrainY!, taper!, canopy),
      taper: taper!,
      patch,
      subdivision: deps.subdivision,
      shellColors: shellColors!,
    });
    const mesh = new THREE.Mesh(geometry, createShellMaterial(sharedData.texture));
    mesh.name = candidate === 1 ? 'forest-lab-shell-base' : 'forest-lab-shell-crown-field';
    mesh.frustumCulled = true;
    return mesh;
  };

  const ensureShellA = (): typeof shellA => {
    shellA ??= makeShell(1);
    return shellA;
  };

  const ensureShellB = (): typeof shellB => {
    shellB ??= makeShell(2);
    return shellB;
  };

  const ensureDetails = (): THREE.InstancedMesh[] => {
    if (details) return details;
    ensureFields();
    laplacian ??= buildLaplacianField(sharedData.grid);
    const laplacianGrid = {
      cols: sharedData.grid.cols,
      rows: sharedData.grid.rows,
      values: laplacian,
    };
    const crownSites = ensureCrowns();
    let lmaxPatch = Number.NEGATIVE_INFINITY;
    for (let row = patch.rowStart; row <= patch.rowEnd; row += 1) {
      for (let col = patch.colStart; col <= patch.colEnd; col += 1) {
        lmaxPatch = Math.max(lmaxPatch, laplacian[row * sharedData.grid.cols + col]);
      }
    }
    const scored = scoreDetailSites(crownSites, {
      laplacianAt: (x, z) => sampleGridBilinear(
        laplacianGrid,
        x / sharedData.grid.cellSizeMeters,
        z / sharedData.grid.cellSizeMeters,
      ),
      Lt: patch.Lt ?? 0,
      LmaxPatch: lmaxPatch,
      primaryPosXZ: { x: PRIMARY_CAMERA.position[0], z: PRIMARY_CAMERA.position[2] },
      distanceMetersAt: (x, z) => sampleDistanceMeters(
        distanceField!,
        sharedData.mask.size,
        x,
        z,
      ),
    });
    const patchArea = (sizeCells * sharedData.grid.cellSizeMeters) ** 2;
    const maxCount = patch.detailMaxCount ?? computeDetailMaxCount(
      patchArea * (patch.forestFraction ?? 1),
    );
    const placements = assignDetailAttributes(
      selectDetailPlacements(scored, maxCount),
      SEED,
    );
    details = createDetailMeshes({
      assets: sharedData.detailAssets,
      placements,
      terrainYAt: createTerrainHeightSampler(sharedData.grid, defaultSettings.elevationScale),
    });
    detailCount = placements.length;
    return details;
  };

  const removeActive = (): void => {
    shellA?.removeFromParent();
    shellB?.removeFromParent();
    for (const mesh of details ?? []) mesh.removeFromParent();
    for (const mesh of meshSet?.meshes ?? []) mesh.removeFromParent();
    farOverlay?.removeFromParent();
  };

  return {
    async setCandidate(id) {
      if (disposed) throw new Error('Candidate controller is disposed.');
      const started = deps.now();
      removeActive();
      let shell: THREE.Mesh | undefined;
      if (id === 1) shell = ensureShellA();
      if (id === 2 || id === 3) shell = ensureShellB();
      if (shell) scene.add(shell);
      const activeDetails = id === 3 ? ensureDetails() : [];
      for (const mesh of activeDetails) scene.add(mesh);
      if (id === 4) {
        const activeMeshSet = await ensureCluster();
        applyLatestClusterVisibility();
        for (const mesh of activeMeshSet.meshes) scene.add(mesh);
      }
      if (id === 5) {
        const activeFarOverlay = await ensureFarLayer();
        const activeMeshSet = await ensureCluster();
        applyLatestClusterVisibility();
        scene.add(activeFarOverlay!);
        for (const mesh of activeMeshSet.meshes) scene.add(mesh);
        applyFarCanopyOpacityGate();
      }
      const geometry = shell?.geometry;
      state = {
        candidate: id,
        appearance,
        crownCount: id === 2 || id === 3 ? ensureCrowns().length : 0,
        shellVertexCount: geometry?.getAttribute('position').count ?? 0,
        shellTriangleCount: geometry?.getIndex()
          ? geometry.getIndex()!.count / 3
          : 0,
        detailCount: id === 3 ? detailCount : 0,
        buildMs: deps.now() - started,
        ...(id === 4 || id === 5 ? { cluster: { ...meshSet!.stats } } : {}),
        ...(id === 5 ? { farCanopy: { ...farStats! } } : {}),
      };
      if (id === 4 || id === 5) {
        setActiveConfigDumpRuntimeState({
          appearance,
          crownCount: state.crownCount ?? 0,
          shellVertexCount: state.shellVertexCount,
          shellTriangleCount: state.shellTriangleCount,
          detailCount: state.detailCount,
          cluster: state.cluster,
          farCanopy: state.farCanopy,
        });
      } else {
        setActiveConfigDumpRuntimeState({
          appearance,
          crownCount: state.crownCount ?? 0,
          shellVertexCount: state.shellVertexCount,
          shellTriangleCount: state.shellTriangleCount,
          detailCount: state.detailCount,
        });
      }
    },
    async setAppearance(id) {
      if (disposed) throw new Error('Candidate controller is disposed.');
      if (id === appearance) return;
      const started = deps.now();
      const activeCandidate = state.candidate;
      for (const mesh of meshSet?.meshes ?? []) mesh.removeFromParent();
      farOverlay?.removeFromParent();
      meshSet?.dispose();
      clusterAssets?.dispose();
      if (farOverlay) disposeObject(farOverlay);
      farTexture?.dispose();
      clusterAssets = undefined;
      clusterPlacement = undefined;
      meshSet = undefined;
      clusterPromise = undefined;
      visibilityOut = undefined;
      farOverlay = undefined;
      farTexture = undefined;
      farStats = undefined;
      farPromise = undefined;
      appearance = id;

      if (activeCandidate === 4) {
        const activeMeshSet = await ensureCluster();
        applyLatestClusterVisibility();
        for (const mesh of activeMeshSet.meshes) scene.add(mesh);
      }
      if (activeCandidate === 5) {
        const activeFarOverlay = await ensureFarLayer();
        const activeMeshSet = await ensureCluster();
        applyLatestClusterVisibility();
        scene.add(activeFarOverlay!);
        for (const mesh of activeMeshSet.meshes) scene.add(mesh);
        applyFarCanopyOpacityGate();
      }
      state = {
        ...state,
        appearance,
        buildMs: deps.now() - started,
        ...(activeCandidate === 4 || activeCandidate === 5
          ? { cluster: { ...meshSet!.stats } }
          : { cluster: undefined }),
        ...(activeCandidate === 5
          ? { farCanopy: { ...farStats! } }
          : { farCanopy: undefined }),
      };
      setActiveConfigDumpRuntimeState({
        appearance,
        crownCount: state.crownCount ?? 0,
        shellVertexCount: state.shellVertexCount,
        shellTriangleCount: state.shellTriangleCount,
        detailCount: state.detailCount,
        cluster: state.cluster,
        farCanopy: state.farCanopy,
      });
    },
    onCameraChanged(camera) {
      lastCamera = {
        position: { ...camera.position },
        fovDegrees: camera.fovDegrees,
      };
      applyFarCanopyOpacityGate();
      const visibleInstanceCount = applyLatestClusterVisibility();
      if (visibleInstanceCount === undefined || !state.cluster) return;
      state = {
        ...state,
        cluster: { ...state.cluster, visibleInstanceCount },
      };
      // config dump も同時に更新する。これを省くと getConfigDump() の
      // visibleInstanceCount が「1 つ前の camera」の値のまま成果物へ出てしまう
      // (描画自体は正しいが、forest-cluster-config.json が誤った数値を報告する)。
      setActiveConfigDumpRuntimeState({
        appearance,
        crownCount: state.crownCount ?? 0,
        shellVertexCount: state.shellVertexCount,
        shellTriangleCount: state.shellTriangleCount,
        detailCount: state.detailCount,
        cluster: state.cluster,
        farCanopy: state.farCanopy,
      });
    },
    getState() {
      return { ...state };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (shellA) disposeObject(shellA);
      if (shellB) disposeObject(shellB);
      for (const mesh of details ?? []) disposeObject(mesh);
      meshSet?.dispose();
      clusterAssets?.dispose();
      if (farOverlay) disposeObject(farOverlay);
      farTexture?.dispose();
      distanceField = undefined;
      terrainY = undefined;
      taper = undefined;
      shellColors = undefined;
      laplacian = undefined;
      crowns = undefined;
      details = undefined;
      clusterPlacement = undefined;
      visibilityOut = undefined;
      lastCamera = undefined;
    },
  };
}
