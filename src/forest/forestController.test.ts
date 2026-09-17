import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { forestDefaults } from '../config/defaults/forest';
import type { ForestConfig, ForestFlags } from '../types';
import { createForestController } from './forestController';
import type { TerrainGridLike } from './terrainHeightSampler';

const grid: TerrainGridLike = {
  values: new Float32Array(64 * 64).fill(120),
  cols: 64,
  rows: 64,
  cellSizeMeters: 24,
};
const routePointsXZ = [
  { x: 180, z: 600 },
  { x: 420, z: 600 },
  { x: 660, z: 600 },
];
const noForest: ForestFlags = {
  variantId: 'none', enabled: false, usesInstancedTrees: false,
  usesBillboardCards: false, usesCanopyClusters: false,
};
const variants: readonly [ForestFlags, number][] = [
  [{ variantId: 'instanced', enabled: true, usesInstancedTrees: true, usesBillboardCards: false, usesCanopyClusters: false }, 30],
  [{ variantId: 'billboard', enabled: true, usesInstancedTrees: false, usesBillboardCards: true, usesCanopyClusters: false }, 6],
  [{ variantId: 'canopy', enabled: true, usesInstancedTrees: false, usesBillboardCards: false, usesCanopyClusters: true }, 20],
];

function createConfig(budget = { spacingMeters: 32, maxInstances: 16 }): ForestConfig {
  return {
    ...forestDefaults,
    tree: { ...forestDefaults.tree, budget: { ...budget } },
    billboard: { ...forestDefaults.billboard, budget: { ...budget } },
    canopy: { ...forestDefaults.canopy, budget: { ...budget } },
  };
}

function createController(scene: THREE.Scene, flags: ForestFlags, config = createConfig()) {
  return createForestController({
    scene, grid, routePointsXZ, elevationScale: 1, config, flags, now: () => 10,
  });
}

function instancePositions(mesh: THREE.InstancedMesh): number[][] {
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const positions: number[][] = [];
  for (let index = 0; index < mesh.count; index += 1) {
    mesh.getMatrixAt(index, matrix);
    matrix.decompose(position, rotation, scale);
    positions.push([position.x, position.y, position.z]);
  }
  return positions;
}

describe('createForestController', () => {
  it('leaves the scene untouched when disabled and has an empty no-op controller', () => {
    const scene = new THREE.Scene();
    const before = scene.children.length;
    const controller = createController(scene, noForest);

    expect(scene.children).toHaveLength(before);
    expect(controller.summary).toMatchObject({ instanceCount: 0, variantId: 'none', enabled: false });
    expect(controller.summary.placement).toBeUndefined();
    expect(() => controller.dispose()).not.toThrow();
  });

  it.each(variants)('adds and summarizes the %s variant', (flags, trianglesPerInstance) => {
    const scene = new THREE.Scene();
    const before = scene.children.length;
    const controller = createController(scene, flags);

    expect(scene.children).toHaveLength(before + 1);
    expect((scene.children[scene.children.length - 1] as THREE.InstancedMesh).isInstancedMesh).toBe(true);
    expect(controller.summary.variantId).toBe(flags.variantId);
    expect(controller.summary.trianglesPerInstance).toBe(trianglesPerInstance);
    expect(controller.summary.drawCalls).toBe(1);
    expect(controller.summary.totalTriangles).toBe(
      controller.summary.instanceCount * controller.summary.trianglesPerInstance,
    );
    expect(controller.summary.placement!.accepted).toBeGreaterThanOrEqual(
      controller.summary.placement!.kept,
    );
    expect(controller.summary.placement!.kept).toBe(controller.summary.instanceCount);
    expect(controller.summary.placement!.candidateCells).toBeGreaterThan(0);

    controller.dispose();
    expect(scene.children).toHaveLength(before);
    expect(() => controller.dispose()).not.toThrow();
  });

  it('uses identical placement points for equal tree and canopy budgets', () => {
    const config = createConfig({ spacingMeters: 32, maxInstances: 16 });
    const treeScene = new THREE.Scene();
    const canopyScene = new THREE.Scene();
    const tree = createController(treeScene, variants[0][0], config);
    const canopy = createController(canopyScene, variants[2][0], config);

    expect(instancePositions(treeScene.children[0] as THREE.InstancedMesh)).toEqual(
      instancePositions(canopyScene.children[0] as THREE.InstancedMesh),
    );

    tree.dispose();
    canopy.dispose();
  });
});
