import { describe, expect, it } from 'vitest';

import { terrainSurfaceDefaults } from '../config/defaults/terrainSurface';
import type { DemFullResolution, MultiScaleHillshadeConfig } from '../types';
import { computeMultiScaleHillshadeFactors } from './multiScaleHillshade';

const defaultConfig = terrainSurfaceDefaults.hillshade;
const defaultLightDirection = { x: -3600, y: 3200, z: -2400 };

function createDem(
  cols: number,
  rows: number,
  elevationAt: (row: number, col: number) => number,
  cellSizeMeters = 1,
): DemFullResolution {
  const values = new Float32Array(cols * rows);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      values[row * cols + col] = elevationAt(row, col);
    }
  }
  return { cols, rows, values, cellSizeMeters };
}

function variance(values: Float32Array): number {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce(
    (sum, value) => sum + (value - mean) ** 2,
    0,
  ) / values.length;
}

describe('computeMultiScaleHillshadeFactors', () => {
  it('keeps flat terrain nearly pass-through (factor 1.0 ± 0.02) with the default light and config', () => {
    // Design intent: a flat +Y normal should preserve the aerial texture almost unchanged.
    const dem = createDem(5, 4, () => 321, 7.766);

    const factors = computeMultiScaleHillshadeFactors(
      dem,
      defaultLightDirection,
      defaultConfig,
    );

    for (const factor of factors) {
      expect(factor).toBeGreaterThanOrEqual(0.98);
      expect(factor).toBeLessThanOrEqual(1.02);
    }
  });

  it('returns one row-major factor per DEM texel within minFactor and maxFactor', () => {
    const dem = createDem(7, 5, (row, col) => row ** 2 - col * 3, 2);

    const factors = computeMultiScaleHillshadeFactors(
      dem,
      defaultLightDirection,
      defaultConfig,
    );

    expect(factors).toHaveLength(dem.cols * dem.rows);
    for (const factor of factors) {
      expect(factor).toBeGreaterThanOrEqual(defaultConfig.minFactor);
      expect(factor).toBeLessThanOrEqual(defaultConfig.maxFactor);
    }
  });

  it('makes a slope facing the light brighter than the opposite-facing slope', () => {
    const facingLight = createDem(25, 3, (_row, col) => col);
    const facingAway = createDem(25, 3, (_row, col) => -col);
    const light = { x: -1, y: 1, z: 0 };

    const litFactors = computeMultiScaleHillshadeFactors(
      facingLight,
      light,
      defaultConfig,
    );
    const shadowFactors = computeMultiScaleHillshadeFactors(
      facingAway,
      light,
      defaultConfig,
    );
    const center = facingLight.cols + 12;

    expect(litFactors[center]).toBeGreaterThan(shadowFactors[center]);
  });

  it('matches a hand-calculated central difference for a single 12-pixel scale', () => {
    const dem = createDem(25, 1, (_row, col) => col);
    const config: MultiScaleHillshadeConfig = {
      scales: [{ stepPixels: 12, weight: 1 }],
      slopeExaggeration: 1,
      minFactor: 0.5,
      maxFactor: 1.5,
    };

    const factors = computeMultiScaleHillshadeFactors(
      dem,
      { x: 0, y: 1, z: 0 },
      config,
    );

    // gx = (24 - 0) / (2 * 12 * 1) = 1, so n.y = 1 / sqrt(2).
    const expected = 0.5 + 1 / Math.sqrt(2);
    expect(factors[12]).toBeCloseTo(expected, 6);
  });

  it('throws RangeError when scales are empty or their total weight is zero', () => {
    const dem = createDem(2, 2, () => 0);

    expect(() => computeMultiScaleHillshadeFactors(
      dem,
      defaultLightDirection,
      { ...defaultConfig, scales: [] },
    )).toThrow(RangeError);
    expect(() => computeMultiScaleHillshadeFactors(
      dem,
      defaultLightDirection,
      {
        ...defaultConfig,
        scales: [
          { stepPixels: 1, weight: 1 },
          { stepPixels: 2, weight: -1 },
        ],
      },
    )).toThrow(RangeError);
  });

  it('produces no NaN values, including at clamped edge texels', () => {
    const dem = createDem(2, 2, (row, col) => row * 7 + col * 11, 7.766);

    const factors = computeMultiScaleHillshadeFactors(
      dem,
      defaultLightDirection,
      defaultConfig,
    );

    expect(Array.from(factors).every(Number.isFinite)).toBe(true);
  });

  it('increases slope-factor variance when slopeExaggeration is raised', () => {
    const heights = [0, 0, 0, 1, 3, 6, 10, 15, 21];
    const dem = createDem(heights.length, 3, (_row, col) => heights[col]);
    const baseConfig: MultiScaleHillshadeConfig = {
      ...defaultConfig,
      scales: [{ stepPixels: 1, weight: 1 }],
    };
    const lowExaggeration = computeMultiScaleHillshadeFactors(
      dem,
      { x: 0, y: 1, z: 0 },
      { ...baseConfig, slopeExaggeration: 0.25 },
    );
    const highExaggeration = computeMultiScaleHillshadeFactors(
      dem,
      { x: 0, y: 1, z: 0 },
      { ...baseConfig, slopeExaggeration: 2 },
    );

    expect(variance(highExaggeration)).toBeGreaterThan(variance(lowExaggeration));
  });
});
