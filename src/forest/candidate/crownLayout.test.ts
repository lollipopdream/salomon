import { describe, expect, it } from 'vitest';

import { computeCrownLayout, type CrownLayoutOptions } from './crownLayout';

const base: CrownLayoutOptions = {
  spriteCount: 300,
  spriteIndexCount: 7,
  seed: 42,
  baseScale: 0.2,
  scaleJitter: 0.3,
  envelopeExponent: 0.78,
  bottomFraction: 0.05,
  topFraction: 1,
  radiusRatio: 0.46,
  rotationJitterRad: 0.55,
  bottomBrightness: 0.4,
  topBrightness: 1,
  shape: 'cone',
};

describe('computeCrownLayout', () => {
  it('is deterministic for a seed and changes for a different seed', () => {
    expect(computeCrownLayout(base)).toEqual(computeCrownLayout(base));
    expect(computeCrownLayout({ ...base, seed: 43 })).not.toEqual(computeCrownLayout(base));
  });

  it('returns bounded, depth-sorted placements', () => {
    const result = computeCrownLayout(base);
    expect(result).toHaveLength(base.spriteCount);
    for (let index = 0; index < result.length; index += 1) {
      const placement = result[index];
      expect(placement.centerX).toBeGreaterThanOrEqual(0);
      expect(placement.centerX).toBeLessThanOrEqual(1);
      expect(placement.centerY).toBeGreaterThanOrEqual(0);
      expect(placement.centerY).toBeLessThanOrEqual(1);
      expect(placement.spriteIndex).toBeGreaterThanOrEqual(0);
      expect(placement.spriteIndex).toBeLessThan(base.spriteIndexCount);
      expect(placement.brightness).toBeGreaterThanOrEqual(0.15);
      expect(placement.brightness).toBeLessThanOrEqual(1.15);
      if (index > 0) expect(placement.depth).toBeGreaterThanOrEqual(result[index - 1].depth);
    }
  });

  it('makes the top third of a cone narrower than its bottom third', () => {
    const result = computeCrownLayout(base);
    const bottom = result.filter(({ depth }) => depth <= 1 / 3);
    const top = result.filter(({ depth }) => depth >= 2 / 3);
    const meanRadius = (items: typeof result): number => items.reduce(
      (sum, item) => sum + Math.abs(item.centerX - 0.5),
      0,
    ) / items.length;
    expect(meanRadius(top)).toBeLessThan(meanRadius(bottom));
  });
});
