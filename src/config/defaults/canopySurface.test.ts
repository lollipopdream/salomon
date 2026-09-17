import { describe, expect, it } from 'vitest';
import { canopySurfaceDefaults, canopySurfaceQuerySpec } from './canopySurface';
import { terrainSurfaceDefaults } from './terrainSurface';

describe('canopy surface defaults contract', () => {
  it('leaves production off and existing terrain at c3', () => {
    expect(canopySurfaceDefaults.defaultVariant).toBe('off');
    expect(terrainSurfaceDefaults.defaultVariant).toBe('c3');
    expect(terrainSurfaceDefaults.canopy.resolution).toBe(1536);
  });
  it('has a unique query name and bounded default for every parameter', () => {
    const specs = Object.values(canopySurfaceQuerySpec);
    expect(new Set(specs.map((s) => s.query)).size).toBe(specs.length);
    for (const [key, spec] of Object.entries(canopySurfaceQuerySpec)) {
      expect(spec.default).toBeGreaterThanOrEqual(spec.min);
      expect(spec.default).toBeLessThanOrEqual(spec.max);
      expect(canopySurfaceDefaults.parameters[key as keyof typeof canopySurfaceDefaults.parameters]).toBe(spec.default);
    }
  });
  it('keeps haze near/far ordered even at query limits', () => {
    expect(canopySurfaceQuerySpec.hazeNearMeters.max).toBeLessThan(canopySurfaceQuerySpec.hazeFarMeters.min);
  });
  it('uses the recovered forest defaults and safe shadow-lift ceiling', () => {
    expect(canopySurfaceDefaults.parameters).toMatchObject({
      exposure: 4.2, shoulder: 0.5, toe: 0.02, saturation: 1.6, warmth: 0.25,
      shadowLift: 0, gapContrast: 1, detailStrength: 1.6, patchStrength: 0.6,
      clumpStrength: 1.2, clumpScaleMeters: 48, autumnStrength: 0.25,
    });
    expect(canopySurfaceQuerySpec.shadowLift.max).toBe(0.01);
  });
});
