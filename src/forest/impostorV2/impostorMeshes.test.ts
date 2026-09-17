// @ts-expect-error This project deliberately has no Node type dependency.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import { createImpostorMeshes } from './impostorMeshes';
import type { ImpostorCellRef, ImpostorPlacementResult } from './types';

function cell(key: string, kind: 'grove' | 'tree'): ImpostorCellRef {
  return { key, kind, atlas: kind, groveConfig: kind === 'grove' ? key : null,
    sourceVariant: kind === 'tree' ? key : null, yawDeg: 0,
    uv: { u0: 0, v0: 0, u1: 1, v1: 1 }, tightWorldWidth: 1, tightWorldHeight: 1,
    groundPivotInTight: { u: 0.5, v: 0 }, alphaCoverage: 1 };
}

function placement(slots: readonly number[] = [0, 1, 0]): ImpostorPlacementResult {
  const count = slots.length;
  return {
    count, positions: Float32Array.from(slots.flatMap((_, i) => [10 + i, 20 + i, 30 + i])),
    yawRadians: Float32Array.from(slots.map((_, i) => i * 0.3)),
    widthMeters: Float32Array.from(slots.map((_, i) => 2 + i)),
    heightMeters: Float32Array.from(slots.map((_, i) => 5 + i)),
    mirrored: Uint8Array.from(slots.map((_, i) => i === 1 ? 1 : 0)), cellSlots: Uint16Array.from(slots),
    stats: { groveCount: 0, treeCount: 0, attempted: count, accepted: count, kept: count, thinned: false,
      rejectedByMask: 0, rejectedByRoute: 0, rejectedBySpacing: 0, perCellCounts: {}, elapsedMs: 0 },
  };
}

describe('createImpostorMeshes', () => {
  it('groups only used cells with correct matrix transforms, materials, and statistics', () => {
    const cells = [cell('a', 'grove'), cell('b', 'tree'), cell('unused', 'grove')];
    const materials = { grove: new THREE.MeshLambertMaterial(), tree: new THREE.MeshLambertMaterial() };
    const result = createImpostorMeshes({ placement: placement(), cells,
      materialFor: (value) => materials[value.kind] });
    expect(result.object3D.name).toBe('forest-impostor-v2');
    expect(result.meshes).toHaveLength(2);
    expect(result.stats).toMatchObject({ instanceCount: 3, drawCalls: 2, triangles: 12, vertices: 24, instanceBytes: 192,
      perCell: [{ key: 'a', count: 2 }, { key: 'b', count: 1 }] });
    expect(result.meshes.map((mesh) => mesh.count)).toEqual([2, 1]);
    expect(result.meshes[0].material).toBe(materials.grove);
    expect(result.meshes[1].material).toBe(materials.tree);
    expect(result.meshes.every((mesh) => mesh.frustumCulled && mesh.instanceColor === null)).toBe(true);
    expect(result.meshes.map((mesh) => mesh.name)).toEqual(expect.arrayContaining(['forest-impostor-v2-a', 'forest-impostor-v2-b']));

    const matrix = new THREE.Matrix4(); const translation = new THREE.Vector3();
    const rotation = new THREE.Quaternion(); const scale = new THREE.Vector3();
    result.meshes[1].getMatrixAt(0, matrix); matrix.decompose(translation, rotation, scale);
    expect(translation.toArray()).toEqual([11, 21, 31]);
    expect(scale.x).toBeCloseTo(-3); expect(scale.y).toBeCloseTo(6); expect(scale.z).toBeCloseTo(3);
    expect(rotation.x).toBeCloseTo(0); expect(rotation.z).toBeCloseTo(0);
    expect(matrix.determinant()).toBeLessThan(0);
  });

  it('disposes only owned geometries once and cleans up after a partial build', () => {
    const cells = [cell('a', 'grove'), cell('b', 'tree')];
    const material = new THREE.MeshLambertMaterial();
    const result = createImpostorMeshes({ placement: placement([0, 1]), cells, materialFor: () => material });
    const scene = new THREE.Scene(); scene.add(result.object3D);
    const geometrySpies = result.meshes.map((mesh) => vi.spyOn(mesh.geometry, 'dispose'));
    const materialSpy = vi.spyOn(material, 'dispose');
    result.dispose(); result.dispose();
    expect(result.object3D.parent).toBeNull();
    for (const spy of geometrySpies) expect(spy).toHaveBeenCalledTimes(1);
    expect(materialSpy).not.toHaveBeenCalled();

    const prototypeSpy = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
    expect(() => createImpostorMeshes({ placement: placement([0, 1]), cells,
      materialFor: (value) => { if (value.key === 'b') throw new Error('expected'); return material; } })).toThrow('expected');
    expect(prototypeSpy).toHaveBeenCalledTimes(2);
    prototypeSpy.mockRestore();
  });

  it('returns an empty group for an empty placement', () => {
    const result = createImpostorMeshes({ placement: placement([]), cells: [cell('a', 'grove')],
      materialFor: () => new THREE.MeshLambertMaterial() });
    expect(result.meshes).toEqual([]);
    expect(result.stats.drawCalls).toBe(0);
    expect(result.object3D.children).toEqual([]);
  });

  it('assigns supplied shades by global placement index across interleaved atlas cells', () => {
    const cells = [cell('a', 'grove'), cell('b', 'tree')];
    const material = new THREE.MeshBasicMaterial();
    const build = createImpostorMeshes({
      placement: placement([0, 1, 0, 1]),
      cells,
      materialFor: () => material,
      shades: new Float32Array([0.2, 0.4, 0.7, 0.9]),
    });
    const color = new THREE.Color();
    const colorsFor = (mesh: THREE.InstancedMesh): number[] => Array.from({ length: mesh.count }, (_, index) => {
      mesh.getColorAt(index, color);
      return color.r;
    });
    expect(colorsFor(build.meshes[0])).toEqual([
      expect.closeTo(Math.fround(0.2), 6),
      expect.closeTo(Math.fround(0.7), 6),
    ]);
    expect(colorsFor(build.meshes[1])).toEqual([
      expect.closeTo(Math.fround(0.4), 6),
      expect.closeTo(Math.fround(0.9), 6),
    ]);
  });

  it('contains none of the disallowed source APIs', () => {
    // @ts-expect-error This project deliberately has no Node type dependency.
    const root = process.cwd();
    const source = readFileSync(`${root}/src/forest/impostorV2/impostorMeshes.ts`, 'utf8');
    for (const term of ['on' + 'BeforeCompile', 'Shader' + 'Material', 'Raw' + 'Shader' + 'Material',
      'cast' + 'Shadow', 'receive' + 'Shadow', 'shadow' + 'Map', 'Math.' + 'random',
      'forest' + 'Candidate', 'set' + 'AnimationLoop', 'request' + 'AnimationFrame']) {
      expect(source).not.toContain(term);
    }
  });
});
