import { describe, expect, it } from 'vitest';

import {
  parseIsolationVariant,
  resolveIsolationFlags,
  type IsolationVariant,
} from './binaryIsolation';

describe('binary isolation helpers', () => {
  it('falls back to baseline for null, invalid, and unknown variants', () => {
    expect(parseIsolationVariant(null)).toBe('baseline');
    expect(parseIsolationVariant('')).toBe('baseline');
    expect(parseIsolationVariant('invalid')).toBe('baseline');
    expect(parseIsolationVariant('no-route')).toBe('baseline');
  });

  it('parses every supported variant', () => {
    const variants: IsolationVariant[] = [
      'baseline',
      'no-route-update',
      'no-label-occlusion',
      'no-spot-animation',
      'no-route-and-labels',
    ];

    variants.forEach((variant) => {
      expect(parseIsolationVariant(variant)).toBe(variant);
    });
  });

  it('resolves flags for every variant', () => {
    expect(resolveIsolationFlags('baseline')).toEqual({
      skipRouteVisualUpdate: false,
      skipLabelOcclusion: false,
      skipSpotAnimation: false,
    });
    expect(resolveIsolationFlags('no-route-update')).toEqual({
      skipRouteVisualUpdate: true,
      skipLabelOcclusion: false,
      skipSpotAnimation: false,
    });
    expect(resolveIsolationFlags('no-label-occlusion')).toEqual({
      skipRouteVisualUpdate: false,
      skipLabelOcclusion: true,
      skipSpotAnimation: false,
    });
    expect(resolveIsolationFlags('no-spot-animation')).toEqual({
      skipRouteVisualUpdate: false,
      skipLabelOcclusion: false,
      skipSpotAnimation: true,
    });
    expect(resolveIsolationFlags('no-route-and-labels')).toEqual({
      skipRouteVisualUpdate: true,
      skipLabelOcclusion: true,
      skipSpotAnimation: false,
    });
  });
});
