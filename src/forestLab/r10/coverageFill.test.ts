import { describe, expect, it } from 'vitest';

import {
  buildOccupancyRaster,
  DEFAULT_COVERAGE_FILL_CONFIG,
  sampleGapCoverageRatio,
  type WorldBbox,
} from './coverageFill';

const bbox: WorldBbox = { xMin: 0, xMax: 100, zMin: 0, zMax: 100 };

describe('DEFAULT_COVERAGE_FILL_CONFIG', () => {
  it('defaults to disabled', () => {
    expect(DEFAULT_COVERAGE_FILL_CONFIG.enabled).toBe(false);
  });
});

describe('buildOccupancyRaster / sampleGapCoverageRatio', () => {
  it('reports full occupancy at a member center and zero occupancy far away', () => {
    const memberX = new Float32Array([50]);
    const memberZ = new Float32Array([50]);
    const memberRadius = new Float32Array([10]);
    const raster = buildOccupancyRaster(bbox, 2, 1, memberX, memberZ, memberRadius);

    const atCenter = sampleGapCoverageRatio(raster, 50, 50, 3);
    expect(atCenter).toBeCloseTo(1, 5);

    const farAway = sampleGapCoverageRatio(raster, 5, 5, 3);
    expect(farAway).toBe(0);
  });

  it('is deterministic for identical inputs', () => {
    const memberX = new Float32Array([20, 60]);
    const memberZ = new Float32Array([30, 70]);
    const memberRadius = new Float32Array([5, 8]);
    const first = buildOccupancyRaster(bbox, 4, 2, memberX, memberZ, memberRadius);
    const second = buildOccupancyRaster(bbox, 4, 2, memberX, memberZ, memberRadius);
    expect(first.occupied).toEqual(second.occupied);

    const ratioA = sampleGapCoverageRatio(first, 40, 40, 22);
    const ratioB = sampleGapCoverageRatio(second, 40, 40, 22);
    expect(ratioA).toBe(ratioB);
  });

  it('ignores non-finite or non-positive member entries safely', () => {
    const memberX = new Float32Array([NaN, 50, Infinity]);
    const memberZ = new Float32Array([50, 50, 50]);
    const memberRadius = new Float32Array([5, 0, 5]);
    expect(() => buildOccupancyRaster(bbox, 4, 3, memberX, memberZ, memberRadius))
      .not.toThrow();
    const raster = buildOccupancyRaster(bbox, 4, 3, memberX, memberZ, memberRadius);
    // member index 1 has radius 0, so it never marks any cell.
    expect(sampleGapCoverageRatio(raster, 50, 50, 1)).toBe(0);
  });

  it('returns a raster with the expected cell-count shape', () => {
    const raster = buildOccupancyRaster(
      bbox,
      10,
      0,
      new Float32Array(0),
      new Float32Array(0),
      new Float32Array(0),
    );
    expect(raster.cols).toBe(10);
    expect(raster.rows).toBe(10);
    expect(raster.occupied.length).toBe(100);
    expect(raster.occupied.every((value) => value === 0)).toBe(true);
  });

  it('treats a sample point fully outside the raster as an unresolved gap (ratio 0)', () => {
    const raster = buildOccupancyRaster(
      bbox,
      4,
      0,
      new Float32Array(0),
      new Float32Array(0),
      new Float32Array(0),
    );
    expect(sampleGapCoverageRatio(raster, 10000, 10000, 5)).toBe(0);
  });
});
