import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { forestDefaults } from '../config/defaults/forest';
import { computeSizeFromUnit } from './forestDensity';
import type { ForestPlacementResult } from './forestPlacement';
import { createBillboardForest } from './billboardForest';

function placement(count: number): ForestPlacementResult {
  const positions = new Float32Array(count * 3); const rotationsY = new Float32Array(count);
  const sizeUnits = new Float32Array(count); const colorUnits = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    positions.set([i * 3 - 40, i % 5, 60 - i], i * 3); rotationsY[i] = i * 0.11;
    sizeUnits[i] = i / (count - 1); colorUnits[i] = (i % 9) / 8;
  }
  return { count, positions, rotationsY, sizeUnits, colorUnits, stats: {
    candidateCells: count, accepted: count, kept: count, maxInstances: count, thinned: false,
    aabb: { minX: -40, minZ: 11, maxX: 107, maxZ: 60 }, elapsedMs: 0,
  } };
}

describe('billboard forest', () => {
  it('builds six-triangle normalized cross-quads with transforms and bounds', () => {
    const source = placement(50); const config = forestDefaults.billboard;
    const build = createBillboardForest(source, config, () => 20); const mesh = build.object3D as THREE.InstancedMesh;
    expect(mesh.count).toBe(source.count); expect(build.stats.trianglesPerInstance).toBe(6);
    const normals = mesh.geometry.getAttribute('normal');
    for (let i = 0; i < normals.count; i += 1) expect([normals.getX(i), normals.getY(i), normals.getZ(i)]).toEqual([0, 1, 0]);
    const material = mesh.material as THREE.MeshStandardMaterial;
    expect(material.transparent).toBe(false); expect(material.alphaTest).toBe(config.alphaTest); expect(material.side).toBe(THREE.DoubleSide);
    const flags = mesh as unknown as Record<string, boolean>;
    expect(flags['cast' + 'Shadow']).toBe(false); expect(flags['receive' + 'Shadow']).toBe(false);
    expect(mesh.boundingSphere).not.toBeNull();
    const matrix = new THREE.Matrix4(); const position = new THREE.Vector3(); const rotation = new THREE.Quaternion(); const scale = new THREE.Vector3();
    for (let i = 0; i < source.count; i += 1) {
      mesh.getMatrixAt(i, matrix); matrix.decompose(position, rotation, scale);
      expect(position.toArray()).toEqual(Array.from(source.positions.slice(i * 3, i * 3 + 3)));
      const height = computeSizeFromUnit(source.sizeUnits[i], config.minHeightMeters, config.maxHeightMeters);
      expect(scale.x).toBeCloseTo(height, 5); expect(scale.y).toBeCloseTo(height, 5); expect(scale.z).toBeCloseTo(height, 5);
      const delta = 2 * Math.atan2(rotation.y, rotation.w) - source.rotationsY[i];
      expect(Math.atan2(Math.sin(delta), Math.cos(delta))).toBeCloseTo(0, 5);
    }
    expect(build.stats.textureBytes).toBe(config.textureSize * config.textureSize * 4);
  });

  it('removes and disposes all owned resources exactly once', () => {
    const build = createBillboardForest(placement(2), forestDefaults.billboard, () => 1);
    const mesh = build.object3D as THREE.InstancedMesh; const material = mesh.material as THREE.MeshStandardMaterial;
    const geometryDispose = vi.spyOn(mesh.geometry, 'dispose'); const materialDispose = vi.spyOn(material, 'dispose');
    const textureDispose = vi.spyOn(material.map!, 'dispose'); const scene = new THREE.Scene(); scene.add(mesh);
    build.dispose(); build.dispose();
    expect(scene.children).not.toContain(mesh); expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1); expect(textureDispose).toHaveBeenCalledTimes(1);
  });
});
