// @ts-expect-error This project intentionally has no Node type dependency.
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  CANDIDATE_B_BASE_METERS,
  CROWN_RADIUS_MAX_METERS,
  CROWN_RADIUS_MEDIAN_METERS,
  CROWN_RADIUS_MIN_METERS,
  CROWN_RELIEF_AMPLITUDE_METERS,
} from '../labConstants';
import type { PatchSpec } from '../labTypes';
import {
  crownProfile,
  crownRadiusInvCdf,
  enumerateCrowns,
  smax,
  type Crown,
} from './crownField';
import { buildCanopyHeightFieldB } from './shellHeightField';

function floatBits(values: Float32Array): Uint32Array {
  return new Uint32Array(values.buffer, values.byteOffset, values.length);
}

describe('crown field', () => {
  it('returns exactly the lattice sites that pass mask sampling', () => {
    let sampledSites = 0;
    const crowns = enumerateCrowns({
      xMin: 0,
      zMin: 0,
      latticeCols: 2,
      spacing: 10,
      seed: 20260913,
      sampleCoverage: (x) => {
        sampledSites += 1;
        return x < 10 ? 1 : 0;
      },
    });
    expect(sampledSites).toBe(2 * 2);
    expect(crowns).toHaveLength(2);
    expect(crowns.map((crown) => crown.n)).toEqual([0, 2]);
  });

  it('enumerates crowns deterministically in ascending site-index order', () => {
    const options = {
      xMin: 100,
      zMin: 200,
      latticeCols: 12,
      spacing: 7,
      seed: 20260913,
      sampleCoverage: (x: number, z: number) => (Math.floor(x + z) % 3 === 0 ? 0 : 1),
    };
    const first = enumerateCrowns(options);
    const second = enumerateCrowns(options);
    expect(first).toEqual(second);
    expect(first.every((crown, index) => index === 0 || first[index - 1].n < crown.n)).toBe(true);
    for (const crown of first) {
      expect(crown.h).toBe(CROWN_RELIEF_AMPLITUDE_METERS * crown.r / CROWN_RADIUS_MEDIAN_METERS);
    }
  });

  it('uses the fixed two-segment inverse CDF and remains monotone', () => {
    expect(crownRadiusInvCdf(0)).toBe(CROWN_RADIUS_MIN_METERS);
    expect(crownRadiusInvCdf(0.5)).toBe(CROWN_RADIUS_MEDIAN_METERS);
    expect(crownRadiusInvCdf(1)).toBe(CROWN_RADIUS_MAX_METERS);
    let previous = Number.NEGATIVE_INFINITY;
    for (let step = 0; step <= 100; step += 1) {
      const radius = crownRadiusInvCdf(step / 100);
      expect(radius).toBeGreaterThanOrEqual(previous);
      previous = radius;
    }
  });

  it('uses the shared inverse-smoothstep crown profile', () => {
    expect(crownProfile(0)).toBe(1);
    expect(crownProfile(1)).toBe(0);
    expect(crownProfile(2)).toBe(0);
    expect(crownProfile(0.5)).toBe(0.5);
  });

  it('implements a commutative smooth max above max that converges as k tends to zero', () => {
    for (const [a, b, k] of [[1, 2, 0.5], [-3, -2.9, 1], [7, 7, 2]]) {
      expect(smax(a, b, k)).toBe(smax(b, a, k));
      expect(smax(a, b, k)).toBeGreaterThanOrEqual(Math.max(a, b));
    }
    expect(Math.abs(smax(1, 2, 1e-12) - 2)).toBeLessThanOrEqual(1e-12);
  });

  it('does not change zero-contribution vertices after 100,000 irrelevant crowns (L2)', () => {
    const patch: PatchSpec = { id: 'A', rowStart: 0, rowEnd: 1, colStart: 0, colEnd: 1 };
    const expected = buildCanopyHeightFieldB([], patch, 1);
    const irrelevant: Crown[] = Array.from({ length: 100_000 }, (_, n) => ({
      n,
      cx: 1_000_000 + n,
      cz: 1_000_000,
      r: 1,
      h: 1,
    }));
    const actual = buildCanopyHeightFieldB(irrelevant, patch, 1);
    const roundedBase = new Float32Array([CANDIDATE_B_BASE_METERS])[0];
    expect(actual.every((height) => height === roundedBase)).toBe(true);
    expect(Array.from(floatBits(actual))).toEqual(Array.from(floatBits(expected)));
  });

  it('uses a lone crown contribution directly without smooth-max uplift (L2)', () => {
    const patch: PatchSpec = { id: 'A', rowStart: 0, rowEnd: 1, colStart: 0, colEnd: 1 };
    const crown: Crown = { n: 0, cx: 0, cz: 0, r: 5, h: 2 };
    const field = buildCanopyHeightFieldB([crown], patch, 1);
    const expected = new Float32Array([CANDIDATE_B_BASE_METERS + crown.h])[0];
    expect(field[0]).toBe(expected);
  });

  it('does not use the ambient random generator', () => {
    // @ts-expect-error This project intentionally has no Node type dependency.
    const source = readFileSync(`${process.cwd()}/src/forestLab/shell/crownField.ts`, 'utf8');
    expect(source).not.toContain(['Math', 'random'].join('.'));
  });
});
