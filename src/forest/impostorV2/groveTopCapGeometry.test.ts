import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import { createGroveTopCapGeometry } from './groveTopCapGeometry';
import type { GroveTopCapCell } from './groveTopCapMeta';
import type { ImpostorCellRef } from './types';

const side: ImpostorCellRef = {
  key: 'grove:G1:0', kind: 'grove', atlas: 'grove', groveConfig: 'G1', sourceVariant: null,
  yawDeg: 0, uv: { u0: 0, v0: 0, u1: 1, v1: 1 }, tightWorldWidth: 20,
  tightWorldHeight: 10, groundPivotInTight: { u: 0.5, v: 0 }, alphaCoverage: 0.5,
};
const top: GroveTopCapCell = {
  cellId: 'GTOP_G1_yaw0', matchingSideCellId: 'G1_yaw0', matchingSideCellIndex: 0,
  cellIndex: 0, row: 0, col: 0, groveConfig: 'G1', bakedYaw: 0,
  sourceCompositionDigest: 'sha256:g1', uvRect: { u0: 0, v0: 0.75, u1: 1 / 6, v1: 1 },
  alphaTightBoundsUV: { u0: 0.01, v0: 0.77, u1: 0.16, v1: 0.98 },
  capHeightWorld: 6, tightWorldWidth: 12, tightWorldDepth: 16,
  tightWorldBounds: { rightMin: -5, rightMax: 7, depthMin: -9, depthMax: 7 },
};

describe('createGroveTopCapGeometry', () => {
  it('builds the prescribed horizontal XZ quad with tight UVs and +Y normals', () => {
    const bounding = vi.spyOn(THREE.BufferGeometry.prototype, 'computeBoundingSphere');
    const geometry = createGroveTopCapGeometry(side, top);
    expect(Array.from(geometry.getAttribute('position').array)).toEqual([
      expect.closeTo(-0.25), expect.closeTo(0.6), expect.closeTo(0.45),
      expect.closeTo(0.35), expect.closeTo(0.6), expect.closeTo(0.45),
      expect.closeTo(0.35), expect.closeTo(0.6), expect.closeTo(-0.35),
      expect.closeTo(-0.25), expect.closeTo(0.6), expect.closeTo(-0.35),
    ]);
    expect(Array.from(geometry.getAttribute('uv').array)).toEqual([
      expect.closeTo(0.01), expect.closeTo(0.77), expect.closeTo(0.16), expect.closeTo(0.77),
      expect.closeTo(0.16), expect.closeTo(0.98), expect.closeTo(0.01), expect.closeTo(0.98),
    ]);
    expect(Array.from(geometry.getAttribute('normal').array)).toEqual([
      0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
    ]);
    expect(Array.from(geometry.index!.array)).toEqual([0, 1, 2, 0, 2, 3]);
    expect(geometry.name).toBe('forest-impostor-v2-top-cap-GTOP_G1_yaw0');
    expect(bounding).toHaveBeenCalledTimes(1);
  });
});
