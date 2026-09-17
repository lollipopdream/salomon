import { describe, expect, it } from 'vitest';

import { decodeForestMaskFromRgba, sampleForestCoverage } from './forestMask';
import type { ForestMaskData } from './types';

function mask(values: readonly number[]): ForestMaskData {
  return { size: 2, extentMeters: 20, coverage: Uint8Array.from(values) };
}

describe('forestMask', () => {
  it('samples pixel centres and exact pixel boundaries with nearest inverse mapping', () => {
    const data = mask([0, 64, 128, 255]);
    expect(sampleForestCoverage(data, 5, 5)).toBe(0);
    expect(sampleForestCoverage(data, 15, 5)).toBeCloseTo(64 / 255);
    expect(sampleForestCoverage(data, 5, 15)).toBeCloseTo(128 / 255);
    expect(sampleForestCoverage(data, 15, 15)).toBe(1);
    expect(sampleForestCoverage(data, 10, 0)).toBeCloseTo(64 / 255);
    expect(sampleForestCoverage(data, 0, 10)).toBeCloseTo(128 / 255);
  });

  it.each([[-0.001, 1], [1, -0.001], [20, 1], [1, 20]])(
    'returns zero outside the half-open terrain at (%s, %s)',
    (x, z) => expect(sampleForestCoverage(mask([255, 255, 255, 255]), x, z)).toBe(0),
  );

  it('decodes the red channel only', () => {
    const decoded = decodeForestMaskFromRgba(Uint8Array.from([
      9, 200, 201, 202, 18, 210, 211, 212,
      27, 220, 221, 222, 36, 230, 231, 232,
    ]), 2, 20);
    expect([...decoded.coverage]).toEqual([9, 18, 27, 36]);
  });

  it('returns zero throughout a fully-zero mask', () => {
    const data = mask([0, 0, 0, 0]);
    for (const [x, z] of [[0, 0], [5, 5], [19.999, 19.999]]) {
      expect(sampleForestCoverage(data, x, z)).toBe(0);
    }
  });
});
