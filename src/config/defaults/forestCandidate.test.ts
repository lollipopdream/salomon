import { describe, expect, it } from 'vitest';

import { forestCandidateDefaults } from './forestCandidate';

describe('forestCandidateDefaults', () => {
  it('keeps asset and placement invariants valid', () => {
    const config = forestCandidateDefaults;
    const urls = [
      config.mask.url,
      config.foliage.conifer.diffUrl,
      config.foliage.conifer.alphaUrl,
      config.foliage.broadleaf.diffUrl,
      config.foliage.broadleaf.alphaUrl,
    ];

    expect(urls.every((url) => url.startsWith('/data/forest/'))).toBe(true);
    expect(config.placement.spacingMeters).toBeGreaterThan(0);
    expect(config.placement.maxInstances).toBeGreaterThan(0);
    expect(config.placement.slopeFullDeg).toBeLessThan(config.placement.slopeZeroDeg);
    expect(config.atlas.variantsPerSpecies).toBeLessThanOrEqual(config.atlas.columns);
    expect(config.placement.coniferFraction).toBeGreaterThan(0);
    expect(config.placement.coniferFraction).toBeLessThan(1);
    // reviewer 指摘 7: 未使用の dead config を持たない。mask の meta JSON は
    // 生成側の記録用 artifact であり runtime からは fetch しない。
    expect('metaUrl' in config.mask).toBe(false);
  });
});
