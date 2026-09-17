import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import type { ForestBuildStats } from './forestBuild';
import { createSingleMeshBuild } from './forestBuild';

describe('createSingleMeshBuild', () => {
  it('removes and disposes every owned resource exactly once', () => {
    const scene = new THREE.Scene();
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial();
    const texture = new THREE.Texture();
    const mesh = new THREE.InstancedMesh(geometry, material, 12);
    const stats: ForestBuildStats = {
      variantId: 'instanced',
      instanceCount: 12,
      trianglesPerInstance: 30,
      totalTriangles: 12 * 30,
      drawCalls: 1,
      instanceMatrixBytes: 12 * 64,
      textureBytes: 0,
      buildElapsedMs: 2,
    };
    const geometryDispose = vi.spyOn(geometry, 'dispose');
    const materialDispose = vi.spyOn(material, 'dispose');
    const textureDispose = vi.spyOn(texture, 'dispose');
    scene.add(mesh);

    const build = createSingleMeshBuild({ mesh, stats, textures: [texture] });
    expect(build.object3D).toBe(mesh);
    expect(build.stats.drawCalls).toBe(1);
    expect(build.stats.totalTriangles).toBe(stats.instanceCount * stats.trianglesPerInstance);
    expect(build.stats.instanceMatrixBytes).toBe(stats.instanceCount * 64);
    expect(() => { build.dispose(); build.dispose(); }).not.toThrow();
    expect(scene.children).not.toContain(mesh);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(textureDispose).toHaveBeenCalledTimes(1);
  });
});
