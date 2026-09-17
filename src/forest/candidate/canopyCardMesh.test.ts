import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import { forestCandidateDefaults } from '../../config/defaults/forestCandidate';
import { createCanopyCardMeshes } from './canopyCardMesh';
import type { ForestCandidatePlacementResult } from './types';

function placement(species: readonly number[] = [0, 1, 0]): ForestCandidatePlacementResult {
  const count = species.length;
  return {
    count,
    positions: Float32Array.from(species.flatMap((_, index) => [index * 10 + 1, index + 2, -index - 3])),
    sizes: Float32Array.from(species.flatMap((_, index) => [5 + index, 10 + index])),
    speciesIndices: Uint8Array.from(species),
    variantIndices: Uint8Array.from(species.map((_, index) => index % 2)),
    tintUnits: Float32Array.from(species.map((_, index) => index / Math.max(1, count - 1))),
    stats: {
      candidateCells: count,
      accepted: count,
      kept: count,
      thinned: false,
      coniferCount: species.filter((value) => value === 0).length,
      broadleafCount: species.filter((value) => value === 1).length,
      elapsedMs: 0,
    },
  };
}

function build(species?: readonly number[]) {
  const texture = new THREE.Texture();
  const uvRects = Float32Array.from([
    0, 0.5, 0.25, 0.5,
    0.25, 0.5, 0.25, 0.5,
    0.5, 0.5, 0.25, 0.5,
    0.75, 0.5, 0.25, 0.5,
    0, 0, 0.25, 0.5,
    0.25, 0, 0.25, 0.5,
    0.5, 0, 0.25, 0.5,
    0.75, 0, 0.25, 0.5,
  ]);
  return {
    texture,
    result: createCanopyCardMeshes({
      placement: placement(species),
      atlas: { texture, uvRects, columns: 4 },
      config: forestCandidateDefaults,
    }),
  };
}

describe('createCanopyCardMeshes', () => {
  it('builds two species meshes with attributes, translations, and stats', () => {
    const { result } = build();
    expect(result.meshes).toHaveLength(2);
    expect(result.meshes.map((mesh) => mesh.count)).toEqual([2, 1]);
    const conifer = result.meshes[0];
    const broadleaf = result.meshes[1];
    expect([...conifer.geometry.getAttribute('aSize').array]).toEqual([5, 10, 7, 12]);
    expect([...broadleaf.geometry.getAttribute('aSize').array]).toEqual([6, 11]);
    expect([...conifer.geometry.getAttribute('aUvRect').array].slice(0, 4))
      .toEqual([0, 0.5, 0.25, 0.5]);
    expect([...broadleaf.geometry.getAttribute('aUvRect').array])
      .toEqual([0.25, 0, 0.25, 0.5]);

    const matrix = new THREE.Matrix4();
    conifer.getMatrixAt(1, matrix);
    expect(matrix.elements).toEqual(new THREE.Matrix4().makeTranslation(21, 4, -5).elements);
    expect(result.stats).toMatchObject({ instanceCount: 3, drawCalls: 2, triangles: 6 });
    expect(conifer.frustumCulled).toBe(false);
    expect(conifer.matrixAutoUpdate).toBe(false);
  });

  it('removes and disposes mesh resources without disposing the atlas texture', () => {
    const { texture, result } = build();
    const scene = new THREE.Scene();
    scene.add(result.object3D);
    const geometrySpies = result.meshes.map((mesh) => vi.spyOn(mesh.geometry, 'dispose'));
    const materialSpies = result.meshes.map((mesh) => vi.spyOn(mesh.material as THREE.Material, 'dispose'));
    const textureDispose = vi.spyOn(texture, 'dispose');

    result.dispose();
    result.dispose();
    expect(scene.children).not.toContain(result.object3D);
    for (const spy of [...geometrySpies, ...materialSpies]) expect(spy).toHaveBeenCalledTimes(1);
    expect(textureDispose).not.toHaveBeenCalled();
  });

  it('builds a valid zero-instance species mesh', () => {
    const { result } = build([0, 0]);
    expect(result.meshes).toHaveLength(2);
    expect(result.meshes[1].count).toBe(0);
    expect(result.meshes[1].geometry.getAttribute('aSize').count).toBe(0);
    expect(result.stats.drawCalls).toBe(2);
  });
});
