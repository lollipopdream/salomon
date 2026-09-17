import { describe, expect, it } from 'vitest';

import {
  GROVE_VISIBLE_MAX_DISTANCE_M,
  TREE_VISIBLE_MAX_DISTANCE_M,
} from './clusterConstants';
import {
  VISIBILITY_GROVE_BIT,
  VISIBILITY_TREE_BIT,
  evaluateClusterVisibility,
  isFeatureVisible,
  metersPerPixel,
} from './clusterVisibility';

describe('cluster visibility', () => {
  it('uses the perspective meters-per-pixel formula and increases with distance', () => {
    expect(metersPerPixel(1000, 45, 1080)).toBeCloseTo(
      2 * 1000 * Math.tan(Math.PI / 8) / 1080,
      12,
    );
    expect(metersPerPixel(100, 45, 1080)).toBeLessThan(metersPerPixel(101, 45, 1080));
  });

  it('keeps zero-distance features visible and respects grove/tree boundaries', () => {
    expect(isFeatureVisible(1, 0)).toBe(true);
    expect(isFeatureVisible(17.995624688694, GROVE_VISIBLE_MAX_DISTANCE_M - 1e-6)).toBe(true);
    expect(isFeatureVisible(17.995624688694, GROVE_VISIBLE_MAX_DISTANCE_M + 1e-3)).toBe(false);
    expect(isFeatureVisible(5.958943906782151, TREE_VISIBLE_MAX_DISTANCE_M - 1e-6)).toBe(true);
    expect(isFeatureVisible(5.958943906782151, TREE_VISIBLE_MAX_DISTANCE_M + 1e-3)).toBe(false);
  });

  it('evaluates deterministically and reuses a provided output buffer', () => {
    const args = {
      clusterX: new Float32Array([0, TREE_VISIBLE_MAX_DISTANCE_M + 10]),
      clusterY: new Float32Array([0, 0]),
      clusterZ: new Float32Array([0, 0]),
      clusterCount: 2,
      cameraPosition: { x: 0, y: 0, z: 0 },
    };
    const first = evaluateClusterVisibility(args);
    const second = evaluateClusterVisibility(args);
    expect([...second]).toEqual([...first]);

    const output = new Uint8Array(args.clusterCount);
    expect(evaluateClusterVisibility({ ...args, out: output })).toBe(output);
    expect(output[0]).toBe(VISIBILITY_GROVE_BIT | VISIBILITY_TREE_BIT);
    expect(output[1]).toBe(VISIBILITY_GROVE_BIT);
  });
});
