import { describe, expect, it } from 'vitest';

import { resolveForestCandidateFlags } from './forestCandidateFlags';

describe('resolveForestCandidateFlags', () => {
  it.each(['', 'forestCandidate=0', 'forestCandidate=true', 'forestCandidate=', 'foo=1']) (
    'is disabled for %s',
    (query) => {
      expect(resolveForestCandidateFlags(new URLSearchParams(query)).enabled).toBe(false);
    },
  );

  it('enables only the exact value 1', () => {
    expect(resolveForestCandidateFlags(new URLSearchParams('forestCandidate=1')).enabled).toBe(true);
  });

  it('accepts inclusive finite spacing and density ranges', () => {
    expect(resolveForestCandidateFlags(new URLSearchParams(
      'forestCandidateSpacing=4&forestCandidateDensity=0',
    ))).toMatchObject({ spacingMetersOverride: 4, densityScale: 0 });
    expect(resolveForestCandidateFlags(new URLSearchParams(
      'forestCandidateSpacing=80&forestCandidateDensity=4',
    ))).toMatchObject({ spacingMetersOverride: 80, densityScale: 4 });
  });

  it.each([
    'forestCandidateSpacing=3.99',
    'forestCandidateSpacing=81',
    'forestCandidateSpacing=Infinity',
    'forestCandidateSpacing=nope',
    'forestCandidateSpacing=',
  ])('rejects invalid spacing in %s', (query) => {
    expect(resolveForestCandidateFlags(new URLSearchParams(query)).spacingMetersOverride)
      .toBeUndefined();
  });

  it.each(['forestCandidateDensity=-1', 'forestCandidateDensity=4.1', 'forestCandidateDensity=NaN']) (
    'defaults invalid density in %s',
    (query) => {
      expect(resolveForestCandidateFlags(new URLSearchParams(query)).densityScale).toBe(1);
    },
  );

  it('accepts only integer maximums in range', () => {
    expect(resolveForestCandidateFlags(new URLSearchParams('forestCandidateMax=1'))
      .maxInstancesOverride).toBe(1);
    expect(resolveForestCandidateFlags(new URLSearchParams('forestCandidateMax=2000000'))
      .maxInstancesOverride).toBe(2_000_000);
    for (const value of ['0', '2000001', '1.5', 'NaN']) {
      expect(resolveForestCandidateFlags(new URLSearchParams(`forestCandidateMax=${value}`))
        .maxInstancesOverride).toBeUndefined();
    }
  });

  it('parses overrides harmlessly while disabled', () => {
    expect(resolveForestCandidateFlags(new URLSearchParams(
      'forestCandidate=0&forestCandidateSpacing=20&forestCandidateDensity=2&forestCandidateMax=9',
    ))).toEqual({
      enabled: false,
      spacingMetersOverride: 20,
      densityScale: 2,
      maxInstancesOverride: 9,
    });
  });
});
