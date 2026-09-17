import { describe, expect, it } from 'vitest';

import type { TerrainEdgeFadeConfig } from '../types';
import { computeEdgeFadeFactors } from './terrainEdgeFade';

const enabledConfig: TerrainEdgeFadeConfig = {
  enabled: true,
  fadeStartFactor: 0.75,
  fadeColor: 0x0a1420,
};

describe('computeEdgeFadeFactors', () => {
  it('keeps the center of a 3x3 grid opaque and fades its corners', () => {
    const factors = computeEdgeFadeFactors(
      { cols: 3, rows: 3 },
      enabledConfig,
    );

    expect(factors).toHaveLength(9);
    expect(factors[4]).toBe(1);
    expect(factors[0]).toBeLessThan(enabledConfig.fadeStartFactor);
    expect(factors[2]).toBeLessThan(enabledConfig.fadeStartFactor);
    expect(factors[6]).toBeLessThan(enabledConfig.fadeStartFactor);
    expect(factors[8]).toBeLessThan(enabledConfig.fadeStartFactor);
  });

  it('keeps the center of a 5x5 grid opaque and fades its corners', () => {
    const factors = computeEdgeFadeFactors(
      { cols: 5, rows: 5 },
      enabledConfig,
    );

    expect(factors).toHaveLength(25);
    expect(factors[12]).toBe(1);
    expect(factors[0]).toBeLessThan(enabledConfig.fadeStartFactor);
    expect(factors[4]).toBeLessThan(enabledConfig.fadeStartFactor);
    expect(factors[20]).toBeLessThan(enabledConfig.fadeStartFactor);
    expect(factors[24]).toBeLessThan(enabledConfig.fadeStartFactor);
  });

  it('returns all-one factors when edge fade is disabled', () => {
    const factors = computeEdgeFadeFactors(
      { cols: 5, rows: 5 },
      { ...enabledConfig, enabled: false },
    );

    expect(Array.from(factors)).toEqual(Array.from({ length: 25 }, () => 1));
  });
});
