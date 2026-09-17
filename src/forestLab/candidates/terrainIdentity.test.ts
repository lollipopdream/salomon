// @ts-expect-error This project intentionally has no Node type dependency.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { ImpostorAssets } from '../../forest/impostorV2/impostorAssets';
import type { ImpostorCellRef } from '../../forest/impostorV2/types';
import type { ElevationGrid } from '../../types';
import { createFarCanopyOverlay } from '../cluster/farCanopyLayer';
import { loadDetailAssets } from '../hybrid/detailMeshes';
import { CANONICAL_CELL_SIZE_METERS, CANONICAL_COLS, CANONICAL_ROWS } from '../labConstants';
import type { CandidateId } from '../labTypes';
import { createPatchTerrainMesh } from '../scene/labTerrain';
import type { CandidateControllerPatch } from './candidateController';
import { createCandidateController } from './candidateController';

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

/**
 * Returns any object added to the scene whose position attribute has the same
 * vertex count as the terrain mesh but whose values differ (= a shell mesh).
 * The far canopy overlay shares the terrain vertices exactly, so it is never
 * reported here.
 */
function findMismatchedSameCountObjects(
  scene: THREE.Scene,
  expectedPositions: Float32Array,
): THREE.Object3D[] {
  const expectedCount = expectedPositions.length / 3;
  const mismatches: THREE.Object3D[] = [];
  for (const child of scene.children) {
    const geometry = (child as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
    const attribute = geometry?.getAttribute?.('position');
    if (!attribute) continue;
    if (attribute.count !== expectedCount) continue;
    const array = attribute.array;
    let identical = array.length === expectedPositions.length;
    if (identical) {
      for (let index = 0; index < expectedPositions.length; index += 1) {
        if (array[index] !== expectedPositions[index]) {
          identical = false;
          break;
        }
      }
    }
    if (!identical) mismatches.push(child);
  }
  return mismatches;
}

describe('terrain identity across candidate switches', () => {
  it('never displaces the terrain, and the FAR overlay shares terrain vertices exactly', async () => {
    const testGrid = grid();
    const patch: CandidateControllerPatch = {
      id: 'A', rowStart: 1, rowEnd: 3, colStart: 1, colEnd: 3,
      detailMaxCount: 2, forestFraction: 1, Lt: 0,
      worldBbox: { xMin: 0, xMax: 120, zMin: 0, zMax: 120 },
    };
    const vertexColors = new Float32Array(CANONICAL_ROWS * CANONICAL_COLS * 3).fill(0.5);
    const texture = new THREE.Texture();

    const terrainMesh = createPatchTerrainMesh(testGrid, patch, vertexColors, texture);
    const initialPosition = Float32Array.from(
      terrainMesh.geometry.getAttribute('position').array as Float32Array,
    );

    const scene = new THREE.Scene();
    const sharedDetailAssets = await detailAssets();
    const assets = clusterAssets();
    const farTexture = new THREE.Texture();
    const loadClusterAssets = async () => assets;
    const loadFarCanopyTexture = async () => ({
      texture: farTexture,
      sha256: 'stub-sha256',
      width: 64,
      height: 32,
    });

    const controller = createCandidateController({
      scene,
      sharedData: {
        grid: testGrid,
        texture,
        mask: { size: 8, extentMeters: 5940.950684, coverage: new Uint8Array(64).fill(255) },
        vertexColors,
        detailAssets: sharedDetailAssets,
      },
      patch,
      dependencies: {
        subdivision: 1,
        now: () => 10,
        loadClusterAssets,
        loadFarCanopyTexture,
      },
    });

    const order: CandidateId[] = [0, 1, 2, 3, 4, 5, 0];
    for (const id of order) {
      // eslint-disable-next-line no-await-in-loop
      await controller.setCandidate(id);

      const current = terrainMesh.geometry.getAttribute('position').array as Float32Array;
      expect(current.length).toBe(initialPosition.length);
      for (let index = 0; index < current.length; index += 1) {
        expect(current[index]).toBe(initialPosition[index]);
      }

      if (id === 4 || id === 5) {
        expect(findMismatchedSameCountObjects(scene, initialPosition)).toEqual([]);
      }
    }

    const overlay = createFarCanopyOverlay({
      grid: testGrid,
      patch,
      vertexColors,
      texture: farTexture,
      worldBbox: { xMin: 0, xMax: 120, zMin: 0, zMax: 120 },
    });
    const overlayPosition = overlay.geometry.getAttribute('position').array as Float32Array;
    expect(overlayPosition.length).toBe(initialPosition.length);
    for (let index = 0; index < overlayPosition.length; index += 1) {
      expect(overlayPosition[index]).toBe(initialPosition[index]);
    }
    overlay.geometry.dispose();
    overlay.material.dispose();

    controller.dispose();
    terrainMesh.geometry.dispose();
    terrainMesh.material.dispose();
    sharedDetailAssets.dispose();
  });
});
