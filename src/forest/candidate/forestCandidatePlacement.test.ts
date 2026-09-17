import { describe, expect, it } from 'vitest';

import { forestCandidateDefaults } from '../../config/defaults/forestCandidate';
import { createForestCandidatePlacement } from './forestCandidatePlacement';
import type { ForestCandidateConfig, ForestCandidateFlags, ForestMaskData } from './types';

const flags: ForestCandidateFlags = { enabled: true, densityScale: 1 };

function makeMask(values: readonly number[], extentMeters = 80): ForestMaskData {
  const size = Math.sqrt(values.length);
  if (!Number.isInteger(size)) throw new Error('Test mask must be square.');
  return { size, extentMeters, coverage: Uint8Array.from(values) };
}

function config(seed = 123): ForestCandidateConfig {
  return {
    ...forestCandidateDefaults,
    atlas: { ...forestCandidateDefaults.atlas, variantsPerSpecies: 4 },
    placement: {
      ...forestCandidateDefaults.placement,
      seed,
      spacingMeters: 8,
      jitterRatio: 0.2,
      maxInstances: 1000,
      routeClearanceMeters: 8,
      routeDistanceCellMeters: 1,
      minCoverage: 0.1,
    },
  };
}

function place(args: {
  mask?: ForestMaskData;
  sampleHeight?: (x: number, z: number) => number;
  routePointsXZ?: readonly { x: number; z: number }[];
  config?: ForestCandidateConfig;
  flags?: ForestCandidateFlags;
}) {
  return createForestCandidatePlacement({
    mask: args.mask ?? makeMask([255, 255, 255, 255]),
    sampleHeight: args.sampleHeight ?? (() => 100),
    routePointsXZ: args.routePointsXZ ?? [],
    config: args.config ?? config(),
    flags: args.flags ?? flags,
    now: () => 0,
  });
}

describe('createForestCandidatePlacement', () => {
  it('returns no instances for an all-zero mask', () => {
    expect(place({ mask: makeMask([0, 0, 0, 0]) }).count).toBe(0);
  });

  it('places full-mask instances within the terrain extent', () => {
    const result = place({});
    expect(result.count).toBeGreaterThan(0);
    for (let index = 0; index < result.count; index += 1) {
      expect(result.positions[index * 3]).toBeGreaterThanOrEqual(0);
      expect(result.positions[index * 3]).toBeLessThan(80);
      expect(result.positions[index * 3 + 2]).toBeGreaterThanOrEqual(0);
      expect(result.positions[index * 3 + 2]).toBeLessThan(80);
      expect(result.positions[index * 3 + 1]).toBeCloseTo(99.6);
    }
  });

  it('is deterministic and seed-sensitive', () => {
    const first = place({});
    const second = place({});
    expect(first.positions).toEqual(second.positions);
    expect(first.sizes).toEqual(second.sizes);
    expect(first.speciesIndices).toEqual(second.speciesIndices);
    expect(first.variantIndices).toEqual(second.variantIndices);
    expect(first.tintUnits).toEqual(second.tintUnits);
    expect(place({ config: config(124) }).positions).not.toEqual(first.positions);
  });

  it('keeps accepted points within the covered quadrant', () => {
    const result = place({ mask: makeMask([255, 0, 0, 0]) });
    expect(result.count).toBeGreaterThan(0);
    for (let index = 0; index < result.count; index += 1) {
      expect(result.positions[index * 3]).toBeLessThan(40);
      expect(result.positions[index * 3 + 2]).toBeLessThan(40);
    }
  });

  it('rejects route-clearance points', () => {
    const route = [{ x: 40, z: 40 }];
    const result = place({ routePointsXZ: route });
    for (let index = 0; index < result.count; index += 1) {
      const distance = Math.hypot(result.positions[index * 3] - 40, result.positions[index * 3 + 2] - 40);
      expect(distance).toBeGreaterThanOrEqual(7);
    }
  });

  it('uses deterministic spatial thinning to respect a small maximum', () => {
    const result = place({ flags: { ...flags, maxInstancesOverride: 5 } });
    expect(result.count).toBe(5);
    expect(result.stats.accepted).toBeGreaterThan(5);
    expect(result.stats.thinned).toBe(true);
  });

  it('rejects terrain steeper than slopeZeroDeg', () => {
    const slope = Math.tan(61 * Math.PI / 180);
    expect(place({ sampleHeight: (x) => x * slope }).count).toBe(0);
  });

  it('keeps species, variants, and sizes in configured ranges', () => {
    const candidateConfig = config();
    const result = place({ config: candidateConfig });
    for (let index = 0; index < result.count; index += 1) {
      const species = result.speciesIndices[index];
      const variant = result.variantIndices[index];
      const width = result.sizes[index * 2];
      const height = result.sizes[index * 2 + 1];
      const sizeConfig = species === 0 ? candidateConfig.size.conifer : candidateConfig.size.broadleaf;
      expect([0, 1]).toContain(species);
      expect(variant).toBeGreaterThanOrEqual(0);
      expect(variant).toBeLessThan(candidateConfig.atlas.variantsPerSpecies);
      expect(height).toBeGreaterThanOrEqual(sizeConfig.minHeightMeters);
      expect(height).toBeLessThanOrEqual(sizeConfig.maxHeightMeters);
      expect(width).toBeCloseTo(height * sizeConfig.widthRatio, 4);
    }
  });
});
