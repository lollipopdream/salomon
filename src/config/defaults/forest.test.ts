import { describe, expect, it } from 'vitest';

import { defaultSettings, validateSettings } from '../settings';
import { forestDefaults } from './forest';

describe('forestDefaults', () => {
  it('keeps the production default disabled', () => {
    expect(forestDefaults.defaultVariant).toBe('none');
  });

  it('satisfies settings validation', () => {
    expect(validateSettings(defaultSettings)).toBe(true);
  });

  it('keeps every variant within the shared triangle budget', () => {
    expect(forestDefaults.tree.budget.maxInstances * 30).toBeLessThanOrEqual(400_000);
    expect(forestDefaults.billboard.budget.maxInstances * 6).toBeLessThanOrEqual(400_000);
    expect(forestDefaults.canopy.budget.maxInstances * 20).toBeLessThanOrEqual(400_000);
  });

  it('matches the route-distance limit to the corridor extent', () => {
    const placement = forestDefaults.placement;
    expect(placement.maxRouteDistanceMeters).toBe(
      placement.corridorCoreHalfWidthMeters + placement.corridorFeatherMeters,
    );
  });

  it('uses one shared placement seed across all variants', () => {
    expect(forestDefaults.placement.seed).toBe(20260910);
    expect(forestDefaults.tree).not.toHaveProperty('seed');
    expect(forestDefaults.billboard).not.toHaveProperty('seed');
    expect(forestDefaults.canopy).not.toHaveProperty('seed');
    expect(forestDefaults.billboard.textureSeed).toBe(20260911);
  });
});
