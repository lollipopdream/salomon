import { describe, expect, it } from 'vitest';

import { TERRAIN_SURFACE_VARIANT_IDS } from '../../terrain/terrainVariant';
import { terrainSurfaceDefaults } from './terrainSurface';

describe('terrainSurfaceDefaults', () => {
  // A/B確定(2026-09-10)により既定を 'c3'(normal map + multi-scale hillshade)へ変更した。
  // 具体的なIDを固定すると今後のA/B再評価のたびにテストが壊れるため、
  // 「有効なvariantであること」を不変条件として検証する
  // (outputs/matsu-h01-reference-driven-terrain/decision.md 参照)。
  it('defaults to a valid terrain surface variant', () => {
    expect(TERRAIN_SURFACE_VARIANT_IDS).toContain(
      terrainSurfaceDefaults.defaultVariant,
    );
  });

  it('uses the three specified hillshade scales with normalized weights', () => {
    const { scales } = terrainSurfaceDefaults.hillshade;

    expect(scales).toHaveLength(3);
    expect(scales.map(({ stepPixels }) => stepPixels)).toEqual([12, 4, 1]);
    expect(scales.reduce((sum, { weight }) => sum + weight, 0)).toBeCloseTo(
      1,
      9,
    );
  });

  it('keeps neutral factor 1 within the hillshade range', () => {
    const { minFactor, maxFactor } = terrainSurfaceDefaults.hillshade;

    expect(minFactor).toBeLessThan(1);
    expect(maxFactor).toBeGreaterThan(1);
  });

  it('uses an allowed canopy resolution', () => {
    expect([768, 1536, 3072]).toContain(
      terrainSurfaceDefaults.canopy.resolution,
    );
  });

  it('uses a positive integer DEM normal coarse step', () => {
    const { coarseStepPixels } = terrainSurfaceDefaults.demNormal;

    expect(Number.isInteger(coarseStepPixels)).toBe(true);
    expect(coarseStepPixels).toBeGreaterThan(0);
  });

  it('orders hillshade scales coarse to fine for multi-scale composition', () => {
    // マルチスケール合成は coarse → fine の順序を前提とする。
    const { scales } = terrainSurfaceDefaults.hillshade;

    for (let index = 1; index < scales.length; index += 1) {
      expect(scales[index - 1].stepPixels).toBeGreaterThan(
        scales[index].stepPixels,
      );
    }
  });
});
