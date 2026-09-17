import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import type { PatchSpec } from '../labTypes';
import {
  buildShellGeometry,
  createShellMaterial,
  createShellMesh,
  disposeShell,
} from './shellMesh';

const patch: PatchSpec = { id: 'A', rowStart: 0, rowEnd: 2, colStart: 0, colEnd: 2 };
const subdivision = 2;
const vertexCount = 25;

function options(taper: Float32Array) {
  return {
    patch,
    subdivision,
    taper,
    shellY: new Float32Array(vertexCount),
    shellColors: new Float32Array(vertexCount * 3).fill(1),
  };
}

describe('shell mesh', () => {
  it('creates exactly one mesh and culls all-zero triangles', () => {
    const mesh = createShellMesh(options(new Float32Array(vertexCount)), new THREE.Texture());
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.children).toHaveLength(0);
    expect(mesh.geometry.getIndex()!.count).toBe(0);
    expect(mesh.geometry.getAttribute('position').count).toBe(0);
    disposeShell(mesh);
  });

  it('culls deterministically and compacts unreferenced vertices', () => {
    const taper = new Float32Array(vertexCount);
    taper[12] = 1;
    const geometry = buildShellGeometry(options(taper));
    expect(geometry.getIndex()!.count).toBe(6 * 3);
    expect(geometry.getAttribute('position').count).toBe(7);
    for (const index of geometry.getIndex()!.array) {
      expect(index).toBeLessThan(7);
    }
    geometry.dispose();
  });

  it('shares the aerial texture and fixes the standard material parameters', () => {
    const texture = new THREE.Texture();
    const material = createShellMaterial(texture);
    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(material.map).toBe(texture);
    expect(material.color.getHex()).toBe(0xffffff);
    expect(material.polygonOffset).toBe(true);
    expect(material.polygonOffsetFactor).toBe(-1);
    expect(material.polygonOffsetUnits).toBe(-1);
    material.dispose();
  });

  it('disposes the generated geometry and material', () => {
    const mesh = createShellMesh(options(new Float32Array(vertexCount).fill(1)), new THREE.Texture());
    const geometryDispose = vi.spyOn(mesh.geometry, 'dispose');
    const materialDispose = vi.spyOn(mesh.material, 'dispose');
    disposeShell(mesh);
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
  });
});
