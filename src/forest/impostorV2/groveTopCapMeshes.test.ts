import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import { createGroveTopCapMaterial, createGroveTopCapMeshes } from './groveTopCapMeshes';
import { createImpostorMeshes } from './impostorMeshes';
import type { GroveTopCapCell } from './groveTopCapMeta';
import type { ImpostorCellRef, ImpostorPlacementResult } from './types';

function side(key: string, kind: 'grove' | 'tree', yawDeg: number): ImpostorCellRef {
  return { key, kind, atlas: kind, groveConfig: kind === 'grove' ? key.split(':')[1] : null,
    sourceVariant: kind === 'tree' ? 'T1' : null, yawDeg,
    uv: { u0: 0, v0: 0, u1: 1, v1: 1 }, tightWorldWidth: 10, tightWorldHeight: 8,
    groundPivotInTight: { u: 0.5, v: 0 }, alphaCoverage: 0.5 };
}

function top(sideCell: ImpostorCellRef, cellIndex: number): GroveTopCapCell {
  return { cellId: `GTOP_${sideCell.groveConfig}_yaw${sideCell.yawDeg}`,
    matchingSideCellId: `${sideCell.groveConfig}_yaw${sideCell.yawDeg}`, matchingSideCellIndex: cellIndex,
    cellIndex, row: 0, col: cellIndex, groveConfig: sideCell.groveConfig!, bakedYaw: sideCell.yawDeg,
    sourceCompositionDigest: `sha256:${sideCell.groveConfig}`, uvRect: { u0: 0, v0: 0, u1: 1, v1: 1 },
    alphaTightBoundsUV: { u0: 0, v0: 0, u1: 1, v1: 1 }, capHeightWorld: 4,
    tightWorldWidth: 10, tightWorldDepth: 10,
    tightWorldBounds: { rightMin: -5, rightMax: 5, depthMin: -5, depthMax: 5 } };
}

const cells = [side('grove:G1:0', 'grove', 0), side('tree:T1:0', 'tree', 0), side('grove:G2:90', 'grove', 90)];
const placement: ImpostorPlacementResult = {
  count: 4,
  positions: new Float32Array([1, 2, 3, 10, 20, 30, -4, 5, -6, 7, 8, 9]),
  yawRadians: new Float32Array([0.25, 0.5, 1.25, -0.75]),
  widthMeters: new Float32Array([12, 3, 18, 14]),
  heightMeters: new Float32Array([9, 8, 13, 11]),
  mirrored: new Uint8Array([1, 0, 0, 1]),
  cellSlots: new Uint16Array([0, 1, 2, 0]),
  stats: { groveCount: 3, treeCount: 1, attempted: 4, accepted: 4, kept: 4, thinned: false,
    rejectedByMask: 0, rejectedByRoute: 0, rejectedBySpacing: 0, perCellCounts: {}, elapsedMs: 0 },
};

describe('grove top cap meshes', () => {
  it('uses the prescribed basic material with FrontSide and fixed alpha test', () => {
    const texture = new THREE.Texture();
    const material = createGroveTopCapMaterial(texture, 0.45);
    expect(material).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(material.map).toBe(texture);
    expect(material.alphaTest).toBe(0.45);
    expect(material.side).toBe(THREE.FrontSide);
    expect(material.transparent).toBe(false);
    expect(material.depthWrite).toBe(true);
    expect(material.depthTest).toBe(true);
    expect(material.vertexColors).toBe(false);
    expect(material.fog).toBe(true);
    expect(material.premultipliedAlpha).toBe(false);
    expect(material.name).toBe('forest-impostor-v2-grove-top-cap');
    expect(material.color.getHex()).toBe(0xffffff);
  });

  it('creates one static mesh per used grove slot and one primitive per grove placement', () => {
    const material = createGroveTopCapMaterial(new THREE.Texture(), 0.45);
    const mapping = new Map([[cells[0].key, top(cells[0], 0)], [cells[2].key, top(cells[2], 1)]]);
    const build = createGroveTopCapMeshes({ placement, cells, mapping, material });
    expect(build.object3D.name).toBe('forest-impostor-v2-top-cap');
    expect(build.meshes).toHaveLength(2);
    expect(build.stats).toMatchObject({ primitiveCount: 3, drawCalls: 2, triangles: 6, vertices: 12 });
    expect(build.meshes.every((mesh) => mesh.frustumCulled)).toBe(true);
    expect(build.meshes.reduce((sum, mesh) => sum + mesh.count, 0)).toBe(placement.stats.groveCount);
  });

  it('reuses position/yaw/scale sources while intentionally omitting the side mirror sign', () => {
    const material = createGroveTopCapMaterial(new THREE.Texture(), 0.45);
    const mapping = new Map([[cells[0].key, top(cells[0], 0)], [cells[2].key, top(cells[2], 1)]]);
    const build = createGroveTopCapMeshes({ placement, cells, mapping, material });
    const mesh = build.meshes.find((candidate) => candidate.name.endsWith(cells[0].key))!;
    const actual = new THREE.Matrix4();
    const expected = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    mesh.getMatrixAt(0, actual);
    rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), placement.yawRadians[0]);
    expected.compose(position.set(1, 2, 3), rotation, scale.set(12, 9, 12));
    expect(actual.elements).toEqual(expect.arrayContaining(expected.elements.map((value) => expect.closeTo(value))));
    expect(new THREE.Matrix3().setFromMatrix4(actual).determinant()).toBeGreaterThan(0);
  });

  it('disposes every generated geometry exactly once', () => {
    const material = createGroveTopCapMaterial(new THREE.Texture(), 0.45);
    const mapping = new Map([[cells[0].key, top(cells[0], 0)], [cells[2].key, top(cells[2], 1)]]);
    const build = createGroveTopCapMeshes({ placement, cells, mapping, material });
    const spies = build.meshes.map((mesh) => vi.spyOn(mesh.geometry, 'dispose'));
    build.dispose(); build.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
  });

  it('uses global shades after skipped trees and matches the side card at each placement index', () => {
    const material = createGroveTopCapMaterial(new THREE.Texture(), 0.45);
    const mapping = new Map([[cells[0].key, top(cells[0], 0)], [cells[2].key, top(cells[2], 1)]]);
    const shades = new Float32Array([0.2, 0.4, 0.6, 0.8]);
    const caps = createGroveTopCapMeshes({ placement, cells, mapping, material, shades });
    const sides = createImpostorMeshes({ placement, cells, materialFor: () => material, shades });
    const color = new THREE.Color();
    const colorAt = (mesh: THREE.InstancedMesh, index: number): number => {
      mesh.getColorAt(index, color);
      return color.r;
    };
    const capG1 = caps.meshes.find((mesh) => mesh.name.endsWith(cells[0].key))!;
    const sideG1 = sides.meshes.find((mesh) => mesh.name.endsWith(cells[0].key))!;
    const capG2 = caps.meshes.find((mesh) => mesh.name.endsWith(cells[2].key))!;
    const sideG2 = sides.meshes.find((mesh) => mesh.name.endsWith(cells[2].key))!;
    expect([colorAt(capG1, 0), colorAt(capG1, 1), colorAt(capG2, 0)])
      .toEqual([expect.closeTo(Math.fround(0.2), 6), expect.closeTo(Math.fround(0.8), 6),
        expect.closeTo(Math.fround(0.6), 6)]);
    expect(colorAt(capG1, 0)).toBeCloseTo(colorAt(sideG1, 0), 7);
    expect(colorAt(capG1, 1)).toBeCloseTo(colorAt(sideG1, 1), 7);
    expect(colorAt(capG2, 0)).toBeCloseTo(colorAt(sideG2, 0), 7);
  });
});
