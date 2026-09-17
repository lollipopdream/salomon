import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import { forestDefaults } from '../config/defaults/forest';
import type { ForestPlacementResult } from './forestPlacement';
import { createInstancedTreeForest } from './instancedTreeForest';

function createPlacement(count: number): ForestPlacementResult {
  const positions = new Float32Array(count * 3);
  const rotationsY = new Float32Array(count);
  const sizeUnits = new Float32Array(count);
  const colorUnits = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = -600 + index * 25;
    positions[index * 3 + 1] = index % 4;
    positions[index * 3 + 2] = 400 - index * 15;
    rotationsY[index] = index * 0.13;
    sizeUnits[index] = index / (count - 1);
    colorUnits[index] = (index % 11) / 10;
  }
  return {
    count,
    positions,
    rotationsY,
    sizeUnits,
    colorUnits,
    stats: {
      candidateCells: count,
      accepted: count,
      kept: count,
      maxInstances: count,
      thinned: false,
      aabb: { minX: -600, minZ: -335, maxX: 625, maxZ: 400 },
      elapsedMs: 0,
    },
  };
}

describe('createInstancedTreeForest', () => {
  it('builds normalized transforms, colors, material, bounds, and stats', () => {
    const placement = createPlacement(50);
    const build = createInstancedTreeForest(placement, forestDefaults.tree, () => 100);
    const mesh = build.object3D as THREE.InstancedMesh;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    expect(mesh.isInstancedMesh).toBe(true);
    expect(mesh.count).toBe(placement.count);
    for (let index = 0; index < placement.count; index += 1) {
      mesh.getMatrixAt(index, matrix);
      matrix.decompose(position, rotation, scale);
      expect(position.x).toBeCloseTo(placement.positions[index * 3], 5);
      expect(position.y).toBeCloseTo(placement.positions[index * 3 + 1], 5);
      expect(position.z).toBeCloseTo(placement.positions[index * 3 + 2], 5);
      expect(scale.x).toBeGreaterThanOrEqual(forestDefaults.tree.minHeightMeters - 1e-5);
      expect(scale.x).toBeLessThanOrEqual(forestDefaults.tree.maxHeightMeters + 1e-5);
      expect(scale.x).toBeCloseTo(scale.y, 5);
      expect(scale.x).toBeCloseTo(scale.z, 5);
      expect(rotation.x).toBeCloseTo(0, 5);
      expect(rotation.z).toBeCloseTo(0, 5);
      const rotationDelta = 2 * Math.atan2(rotation.y, rotation.w) - placement.rotationsY[index];
      expect(Math.atan2(Math.sin(rotationDelta), Math.cos(rotationDelta))).toBeCloseTo(0, 5);
    }
    expect(mesh.instanceColor).not.toBeNull();
    for (const component of mesh.instanceColor!.array) {
      expect(component).toBeGreaterThanOrEqual(0);
      expect(component).toBeLessThanOrEqual(1);
    }
    expect(mesh.boundingSphere).not.toBeNull();
    expect(mesh.boundingSphere!.radius).toBeGreaterThan(500);
    const material = mesh.material as THREE.MeshStandardMaterial;
    expect(material.flatShading).toBe(true);
    expect(material.vertexColors).toBe(true);
    const meshFlags = mesh as unknown as Record<string, boolean>;
    expect(meshFlags['cast' + 'Shadow']).toBe(false);
    expect(meshFlags['receive' + 'Shadow']).toBe(false);
    expect(build.stats).toMatchObject({
      variantId: 'instanced',
      instanceCount: placement.count,
      trianglesPerInstance: 30,
      totalTriangles: placement.count * 30,
      drawCalls: 1,
      instanceMatrixBytes: placement.count * 64,
      textureBytes: 0,
      buildElapsedMs: 0,
    });
  });

  it('removes and disposes resources exactly once', () => {
    const build = createInstancedTreeForest(createPlacement(2), forestDefaults.tree, () => 1);
    const mesh = build.object3D as THREE.InstancedMesh;
    const geometryDispose = vi.spyOn(mesh.geometry, 'dispose');
    const materialDispose = vi.spyOn(mesh.material as THREE.Material, 'dispose');
    const scene = new THREE.Scene();
    scene.add(mesh);

    expect(() => { build.dispose(); build.dispose(); }).not.toThrow();
    expect(scene.children).not.toContain(mesh);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
  });
});
