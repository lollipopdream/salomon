// @ts-expect-error This project intentionally has no Node type dependency.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import type { ImpostorAssets } from '../../forest/impostorV2/impostorAssets';
import type { ImpostorCellRef } from '../../forest/impostorV2/types';
import type { ElevationGrid } from '../../types';
import {
  R5_FAR_CANOPY_OPACITY_FAR_METERS,
  R5_FAR_CANOPY_OPACITY_MAX,
  R5_FAR_CANOPY_OPACITY_MIN,
  R5_FAR_CANOPY_OPACITY_NEAR_METERS,
} from '../appearance/appearanceConstants';
import { buildConfigDump } from '../configDump';
import { loadDetailAssets } from '../hybrid/detailMeshes';
import { CANONICAL_CELL_SIZE_METERS, CANONICAL_COLS, CANONICAL_ROWS } from '../labConstants';
import { PATCH_MANIFEST_JSON } from '../scene/labDataSources';
import { createCandidateController, farCanopyOpacityAtDistance } from './candidateController';

function grid(): ElevationGrid {
  return {
    rows: CANONICAL_ROWS,
    cols: CANONICAL_COLS,
    cellSizeMeters: CANONICAL_CELL_SIZE_METERS,
    values: new Float32Array(CANONICAL_ROWS * CANONICAL_COLS).fill(300),
    bounds: { north: 1, south: 0, west: 0, east: 1 },
  };
}

async function detailAssets() {
  const meta = JSON.parse(readFileSync(
    new URL('../../../public/data/forest/impostor-v2/impostor-atlas-meta.json', import.meta.url),
    'utf8',
  )) as unknown;
  return loadDetailAssets({
    fetchJson: async () => meta,
    loadTexture: async () => new THREE.Texture(),
  });
}

function clusterAssets(): ImpostorAssets {
  const cells: ImpostorCellRef[] = Array.from({ length: 56 }, (_, slot) => {
    const grove = slot < 24;
    return {
      key: `cluster-${slot}`,
      kind: grove ? 'grove' : 'tree',
      atlas: grove ? 'grove' : 'tree',
      groveConfig: grove ? `G${Math.floor(slot / 4) + 1}` : null,
      sourceVariant: grove ? null : ['FIR_A', 'FIR_B', 'FIR_C', 'BL'][Math.floor((slot - 24) / 8)],
      yawDeg: grove ? (slot % 4) * 90 : ((slot - 24) % 8) * 45,
      uv: { u0: 0, v0: 0, u1: 1, v1: 1 },
      tightWorldWidth: grove ? 18 : 6,
      tightWorldHeight: grove ? 12 : 20,
      groundPivotInTight: { u: 0.5, v: 0 },
      alphaCoverage: 1,
    };
  });
  const groveTexture = new THREE.Texture();
  const treeTexture = new THREE.Texture();
  let disposed = false;
  return {
    meta: {
      schemaVersion: 1,
      pitchDeg: 0,
      atlases: {
        grove: {
          id: 'grove', file: 'grove.png', width: 1, height: 1,
          cellWidth: 1, cellHeight: 1, cols: 1, rows: 1, sha256: 'grove',
        },
        tree: {
          id: 'tree', file: 'tree.png', width: 1, height: 1,
          cellWidth: 1, cellHeight: 1, cols: 1, rows: 1, sha256: 'tree',
        },
      },
      cells,
    },
    cells,
    textures: { grove: groveTexture, tree: treeTexture },
    dispose() {
      if (disposed) return;
      disposed = true;
      groveTexture.dispose();
      treeTexture.dispose();
    },
  };
}

function namedChildren(scene: THREE.Scene, prefix: string): THREE.Object3D[] {
  return scene.children.filter((child) => child.name.startsWith(prefix));
}

describe('candidate controller', () => {
  it('switches 0→1→2→3→0, reuses B geometry, and obeys disposal ownership', async () => {
    const scene = new THREE.Scene();
    const texture = new THREE.Texture();
    const textureDispose = vi.spyOn(texture, 'dispose');
    const assets = await detailAssets();
    const assetsDispose = vi.spyOn(assets, 'dispose');
    const controller = createCandidateController({
      scene,
      sharedData: {
        grid: grid(),
        texture,
        mask: { size: 8, extentMeters: 5940.950684, coverage: new Uint8Array(64).fill(255) },
        vertexColors: new Float32Array(CANONICAL_ROWS * CANONICAL_COLS * 3).fill(0.5),
        detailAssets: assets,
      },
      patch: {
        id: 'A', rowStart: 1, rowEnd: 3, colStart: 1, colEnd: 3,
        detailMaxCount: 2, forestFraction: 1, Lt: 0,
      },
      dependencies: { subdivision: 1, now: () => 10 },
    });

    await controller.setCandidate(0);
    expect(scene.children).toHaveLength(0);
    expect(controller.getState().crownCount).toBe(0);
    await controller.setCandidate(1);
    expect(scene.children).toHaveLength(1);
    expect(scene.children[0].name).toBe('forest-lab-shell-base');
    expect(controller.getState().crownCount).toBe(0);

    await controller.setCandidate(2);
    expect(scene.children).toHaveLength(1);
    const crownFieldCount = controller.getState().crownCount;
    expect(crownFieldCount).toBeGreaterThan(0);
    expect(buildConfigDump(PATCH_MANIFEST_JSON).runtime.crownCount).toBe(crownFieldCount);
    const candidateBGeometry = (scene.children[0] as THREE.Mesh).geometry;
    const geometryDispose = vi.spyOn(candidateBGeometry, 'dispose');
    const materialDispose = vi.spyOn((scene.children[0] as THREE.Mesh).material as THREE.Material, 'dispose');

    await controller.setCandidate(3);
    expect(scene.children.length).toBeGreaterThan(1);
    const hybridShell = scene.children.find((child) => child.name === 'forest-lab-shell-crown-field');
    expect((hybridShell as THREE.Mesh).geometry).toBe(candidateBGeometry);
    expect(controller.getState().crownCount).toBe(crownFieldCount);
    expect(controller.getState().detailCount).toBeGreaterThan(0);

    await controller.setCandidate(0);
    expect(scene.children).toHaveLength(0);
    controller.dispose();
    expect(scene.children).toHaveLength(0);
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(textureDispose).not.toHaveBeenCalled();
    expect(assetsDispose).not.toHaveBeenCalled();
    expect(() => controller.dispose()).not.toThrow();

    assets.dispose();
  });

  it('switches through cluster candidates, reuses resources, updates visibility, and disposes ownership', async () => {
    const scene = new THREE.Scene();
    const texture = new THREE.Texture();
    const textureDispose = vi.spyOn(texture, 'dispose');
    const sharedDetailAssets = await detailAssets();
    const detailAssetsDispose = vi.spyOn(sharedDetailAssets, 'dispose');
    const assets = clusterAssets();
    const assetsDispose = vi.spyOn(assets, 'dispose');
    const clusterTextureDisposes = Object.values(assets.textures).map((atlasTexture) =>
      vi.spyOn(atlasTexture!, 'dispose')
    );
    const farTexture = new THREE.Texture();
    const farTextureDispose = vi.spyOn(farTexture, 'dispose');
    const loadClusterAssets = vi.fn(async () => assets);
    const loadFarCanopyTexture = vi.fn(async () => ({
      texture: farTexture,
      sha256: 'far-stub-sha256',
      width: 64,
      height: 32,
    }));
    const controller = createCandidateController({
      scene,
      sharedData: {
        grid: grid(),
        texture,
        mask: { size: 8, extentMeters: 5940.950684, coverage: new Uint8Array(64).fill(255) },
        vertexColors: new Float32Array(CANONICAL_ROWS * CANONICAL_COLS * 3).fill(0.5),
        detailAssets: sharedDetailAssets,
      },
      patch: {
        id: 'A', rowStart: 1, rowEnd: 3, colStart: 1, colEnd: 3,
        detailMaxCount: 2, forestFraction: 1, Lt: 0,
        worldBbox: { xMin: 0, xMax: 120, zMin: 0, zMax: 120 },
      },
      dependencies: {
        subdivision: 1,
        now: () => 10,
        loadClusterAssets,
        loadFarCanopyTexture,
      },
    });

    await controller.setCandidate(0);
    expect(scene.children).toHaveLength(0);
    expect(controller.getState().cluster).toBeUndefined();
    expect(controller.getState().farCanopy).toBeUndefined();
    const beforeCamera = controller.getState();
    expect(() => controller.onCameraChanged!({
      position: { x: 100_000, y: 100_000, z: 100_000 },
      fovDegrees: 45,
    })).not.toThrow();
    expect(controller.getState()).toEqual(beforeCamera);

    await controller.setCandidate(1);
    expect(namedChildren(scene, 'forest-lab-shell-')).toHaveLength(1);
    expect(namedChildren(scene, 'forest-lab-cluster-')).toHaveLength(0);
    expect(controller.getState().cluster).toBeUndefined();
    await controller.setCandidate(2);
    expect(namedChildren(scene, 'forest-lab-shell-')).toHaveLength(1);
    expect(namedChildren(scene, 'forest-lab-cluster-')).toHaveLength(0);
    expect(controller.getState().cluster).toBeUndefined();
    await controller.setCandidate(3);
    expect(namedChildren(scene, 'forest-lab-shell-')).toHaveLength(1);
    expect(namedChildren(scene, 'forest-lab-detail-').length).toBeGreaterThan(0);
    expect(namedChildren(scene, 'forest-lab-cluster-')).toHaveLength(0);
    expect(controller.getState().cluster).toBeUndefined();

    await controller.setCandidate(4);
    const candidate4Meshes = namedChildren(scene, 'forest-lab-cluster-');
    expect(candidate4Meshes.length).toBeGreaterThan(0);
    expect(namedChildren(scene, 'forest-lab-far-canopy')).toHaveLength(0);
    expect(namedChildren(scene, 'forest-lab-shell-')).toHaveLength(0);
    expect(namedChildren(scene, 'forest-lab-detail-')).toHaveLength(0);
    expect(controller.getState().cluster).toBeDefined();
    expect(controller.getState().farCanopy).toBeUndefined();

    controller.onCameraChanged!({
      position: { x: 60, y: 300, z: 60 },
      fovDegrees: 45,
    });
    const nearVisible = controller.getState().cluster!.visibleInstanceCount;
    expect(nearVisible).toBe(controller.getState().cluster!.memberPlacedCount);
    controller.onCameraChanged!({
      position: { x: 100_000, y: 100_000, z: 100_000 },
      fovDegrees: 45,
    });
    const farVisible = controller.getState().cluster!.visibleInstanceCount;
    expect(farVisible).toBe(0);
    expect(farVisible).not.toBe(nearVisible);
    controller.onCameraChanged!({
      position: { x: 100_000, y: 100_000, z: 100_000 },
      fovDegrees: 45,
    });
    expect(controller.getState().cluster!.visibleInstanceCount).toBe(farVisible);

    await controller.setCandidate(5);
    const candidate5Meshes = namedChildren(scene, 'forest-lab-cluster-');
    expect(scene.children[0].name).toBe('forest-lab-far-canopy');
    expect(namedChildren(scene, 'forest-lab-far-canopy')).toHaveLength(1);
    expect(candidate5Meshes).toHaveLength(candidate4Meshes.length);
    candidate5Meshes.forEach((mesh, index) => {
      expect(mesh).toBe(candidate4Meshes[index]);
    });
    expect(loadClusterAssets).toHaveBeenCalledOnce();
    expect(loadClusterAssets).toHaveBeenCalledWith('BASELINE');
    expect(loadFarCanopyTexture).toHaveBeenCalledOnce();
    expect(controller.getState().cluster).toBeDefined();
    expect(controller.getState().farCanopy).toEqual({
      textureSha256: 'far-stub-sha256',
      textureWidth: 64,
      textureHeight: 32,
      overlayVertexCount: 9,
      overlayTriangleCount: 8,
    });

    const clusterGeometryDisposes = candidate5Meshes.map((mesh) =>
      vi.spyOn((mesh as THREE.InstancedMesh).geometry, 'dispose')
    );
    const clusterMaterialDisposes = candidate5Meshes.map((mesh) =>
      vi.spyOn((mesh as THREE.InstancedMesh).material as THREE.Material, 'dispose')
    );
    const overlay = scene.children[0] as THREE.Mesh;
    const overlayGeometryDispose = vi.spyOn(overlay.geometry, 'dispose');
    const overlayMaterialDispose = vi.spyOn(overlay.material as THREE.Material, 'dispose');

    await controller.setCandidate(0);
    expect(scene.children).toHaveLength(0);
    expect(controller.getState().cluster).toBeUndefined();
    expect(controller.getState().farCanopy).toBeUndefined();
    expect(() => {
      controller.dispose();
      controller.dispose();
    }).not.toThrow();
    expect(scene.children).toHaveLength(0);
    for (const dispose of clusterGeometryDisposes) expect(dispose).toHaveBeenCalledOnce();
    for (const dispose of clusterMaterialDisposes) expect(dispose).toHaveBeenCalledOnce();
    expect(overlayGeometryDispose).toHaveBeenCalledOnce();
    expect(overlayMaterialDispose).toHaveBeenCalledOnce();
    expect(assetsDispose).toHaveBeenCalledOnce();
    for (const dispose of clusterTextureDisposes) expect(dispose).toHaveBeenCalledOnce();
    expect(farTextureDispose).toHaveBeenCalledOnce();
    expect(textureDispose).not.toHaveBeenCalled();
    expect(detailAssetsDispose).not.toHaveBeenCalled();

    sharedDetailAssets.dispose();
  });

  it('passes the active appearance when rebuilding and disposes the replaced cluster assets', async () => {
    const scene = new THREE.Scene();
    const sharedDetailAssets = await detailAssets();
    const r2Assets = clusterAssets();
    const r3Assets = clusterAssets();
    const r2Dispose = vi.spyOn(r2Assets, 'dispose');
    const r3Dispose = vi.spyOn(r3Assets, 'dispose');
    const loadClusterAssets = vi.fn()
      .mockResolvedValueOnce(r2Assets)
      .mockResolvedValueOnce(r3Assets);
    const controller = createCandidateController({
      scene,
      sharedData: {
        grid: grid(),
        texture: new THREE.Texture(),
        mask: { size: 8, extentMeters: 5940.950684, coverage: new Uint8Array(64).fill(255) },
        vertexColors: new Float32Array(CANONICAL_ROWS * CANONICAL_COLS * 3).fill(0.5),
        detailAssets: sharedDetailAssets,
      },
      patch: {
        id: 'A', rowStart: 1, rowEnd: 3, colStart: 1, colEnd: 3,
        worldBbox: { xMin: 0, xMax: 120, zMin: 0, zMax: 120 },
      },
      initialAppearance: 'R2',
      dependencies: { subdivision: 1, now: () => 10, loadClusterAssets },
    });

    await controller.setCandidate(4);
    await controller.setAppearance('R3');
    expect(loadClusterAssets).toHaveBeenNthCalledWith(1, 'R2');
    expect(loadClusterAssets).toHaveBeenNthCalledWith(2, 'R3');
    expect(r2Dispose).toHaveBeenCalledOnce();
    expect(controller.getState().appearance).toBe('R3');

    controller.dispose();
    expect(r3Dispose).toHaveBeenCalledOnce();
    sharedDetailAssets.dispose();
  });

  it(
    'gates FAR opacity by distance only for R5, leaving R2/R3/R4 unaffected (design §T4)',
    async () => {
      const scene = new THREE.Scene();
      const sharedDetailAssets = await detailAssets();
      const assets = clusterAssets();
      const farTexture = new THREE.Texture();
      const loadClusterAssets = vi.fn(async () => assets);
      const loadFarCanopyTexture = vi.fn(async () => ({
        texture: farTexture,
        sha256: 'far-stub-sha256',
        width: 64,
        height: 32,
      }));
      const controller = createCandidateController({
        scene,
        sharedData: {
          grid: grid(),
          texture: new THREE.Texture(),
          mask: { size: 8, extentMeters: 5940.950684, coverage: new Uint8Array(64).fill(255) },
          vertexColors: new Float32Array(CANONICAL_ROWS * CANONICAL_COLS * 3).fill(0.5),
          detailAssets: sharedDetailAssets,
        },
        patch: {
          id: 'A', rowStart: 1, rowEnd: 3, colStart: 1, colEnd: 3,
          detailMaxCount: 2, forestFraction: 1, Lt: 0,
          worldBbox: { xMin: 0, xMax: 120, zMin: 0, zMax: 120 },
        },
        initialAppearance: 'R4',
        dependencies: { subdivision: 1, now: () => 10, loadClusterAssets, loadFarCanopyTexture },
      });

      await controller.setCandidate(5);
      const r4Overlay = scene.children.find((child) => child.name === 'forest-lab-far-canopy') as
        THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
      expect(r4Overlay.material.opacity).toBe(1);

      // Patch center is (60, 60); this is "on top of" the patch (distance 0) yet R4 is unaffected.
      controller.onCameraChanged!({ position: { x: 60, y: 300, z: 60 }, fovDegrees: 45 });
      expect(r4Overlay.material.opacity).toBe(1);
      controller.onCameraChanged!({
        position: { x: 100_000, y: 100_000, z: 100_000 },
        fovDegrees: 45,
      });
      expect(r4Overlay.material.opacity).toBe(1);

      await controller.setAppearance('R5');
      const r5Overlay = scene.children.find((child) => child.name === 'forest-lab-far-canopy') as
        THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
      expect(r5Overlay).not.toBe(r4Overlay);
      // lastCamera was already the far position when setAppearance ran; the gate is applied
      // immediately on overlay (re)creation, without waiting for the next onCameraChanged call.
      expect(r5Overlay.material.opacity).toBe(R5_FAR_CANOPY_OPACITY_MAX);

      controller.onCameraChanged!({ position: { x: 60, y: 300, z: 60 }, fovDegrees: 45 });
      expect(r5Overlay.material.opacity).toBe(R5_FAR_CANOPY_OPACITY_MIN);
      controller.onCameraChanged!({
        position: { x: 100_000, y: 100_000, z: 100_000 },
        fovDegrees: 45,
      });
      expect(r5Overlay.material.opacity).toBe(R5_FAR_CANOPY_OPACITY_MAX);

      controller.dispose();
      sharedDetailAssets.dispose();
    },
  );
});

describe('farCanopyOpacityAtDistance (R5 FAR distance gate pure function)', () => {
  it('clamps to minOpacity at/under nearDistanceMeters and maxOpacity at/over farDistanceMeters', () => {
    expect(farCanopyOpacityAtDistance(0)).toBe(R5_FAR_CANOPY_OPACITY_MIN);
    expect(farCanopyOpacityAtDistance(R5_FAR_CANOPY_OPACITY_NEAR_METERS))
      .toBe(R5_FAR_CANOPY_OPACITY_MIN);
    expect(farCanopyOpacityAtDistance(R5_FAR_CANOPY_OPACITY_FAR_METERS))
      .toBe(R5_FAR_CANOPY_OPACITY_MAX);
    expect(farCanopyOpacityAtDistance(1_000_000)).toBe(R5_FAR_CANOPY_OPACITY_MAX);
  });

  it('orders the measured CLOSE < PRIMARY < OVERVIEW distances to CLOSE <= PRIMARY <= OVERVIEW opacity', () => {
    // Measured 2026-09-14 XZ distance from each camera position (r4-canopy-continuity-capture-state.json)
    // to the far-canopy-r5-meta.json world-block patch center (1957.018987853849, 3261.6983130897484).
    const closeDistanceMeters = 654.7102801426402;
    const primaryDistanceMeters = 1900.1527291193827;
    const overviewDistanceMeters = 3336.664107132384;
    const close = farCanopyOpacityAtDistance(closeDistanceMeters);
    const primary = farCanopyOpacityAtDistance(primaryDistanceMeters);
    const overview = farCanopyOpacityAtDistance(overviewDistanceMeters);
    expect(close).toBe(R5_FAR_CANOPY_OPACITY_MIN);
    expect(overview).toBe(R5_FAR_CANOPY_OPACITY_MAX);
    expect(close).toBeLessThan(primary);
    expect(primary).toBeLessThan(overview);
  });

  it('is monotonically non-decreasing across an increasing distance sweep', () => {
    let previous = -Infinity;
    for (let distanceMeters = 0; distanceMeters <= 3000; distanceMeters += 25) {
      const opacity = farCanopyOpacityAtDistance(distanceMeters);
      expect(opacity).toBeGreaterThanOrEqual(previous);
      previous = opacity;
    }
  });

  it('supports custom params without mutating the shared default', () => {
    const custom = farCanopyOpacityAtDistance(500, {
      nearDistanceMeters: 0,
      farDistanceMeters: 1000,
      minOpacity: 0,
      maxOpacity: 1,
    });
    expect(custom).toBeCloseTo(0.5, 10);
    expect(farCanopyOpacityAtDistance(0)).toBe(R5_FAR_CANOPY_OPACITY_MIN);
  });
});
