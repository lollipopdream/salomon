import { describe, expect, it } from 'vitest';
import { canopySurfaceDefaults, canopySurfaceQuerySpec } from '../config/defaults/canopySurface';
import { resolveCanopySurfaceFlags } from './canopySurfaceVariant';

describe('DEV canopy surface query', () => {
  it.each(['off', 'base', 'a', 'b'])('resolves %s in DEV', (variant) => {
    expect(resolveCanopySurfaceFlags(new URLSearchParams({ canopySurface: variant }), true).variant).toBe(variant);
  });
  it.each(['', 'invalid', 'A'])('unknown %s defaults to off', (variant) => {
    expect(resolveCanopySurfaceFlags(new URLSearchParams({ canopySurface: variant }), true).variant).toBe('off');
  });
  it.each(['base', 'a', 'b', 'off'])('production ignores %s and all overrides', (variant) => {
    expect(resolveCanopySurfaceFlags(new URLSearchParams({ canopySurface: variant, csExposure: '3' }), false))
      .toEqual({ variant: 'off', parameters: canopySurfaceDefaults.parameters });
  });
  it('off ignores numeric overrides in DEV too', () => {
    expect(resolveCanopySurfaceFlags(new URLSearchParams('canopySurface=off&csExposure=3'), true).parameters)
      .toEqual(canopySurfaceDefaults.parameters);
  });
  it('accepts every documented numeric override without mutating defaults', () => {
    const query = new URLSearchParams('canopySurface=a');
    for (const spec of Object.values(canopySurfaceQuerySpec)) query.set(spec.query, String(spec.max));
    const selection = resolveCanopySurfaceFlags(query, true);
    for (const [key, spec] of Object.entries(canopySurfaceQuerySpec)) {
      expect(selection.parameters[key as keyof typeof selection.parameters]).toBe(spec.max);
    }
    expect(canopySurfaceDefaults.parameters.exposure).toBe(4.2);
  });
  it.each(['', ' ', 'NaN', 'Infinity', '-Infinity', 'oops'])('rejects invalid numeric %s', (value) => {
    expect(resolveCanopySurfaceFlags(new URLSearchParams({ canopySurface: 'a', csExposure: value }), true).parameters.exposure)
      .toBe(canopySurfaceDefaults.parameters.exposure);
  });
  it('clamps extremes, rounds integer fields, rejects unsupported resolutions', () => {
    const { parameters } = resolveCanopySurfaceFlags(new URLSearchParams(
      'canopySurface=b&csExposure=900&csHaze=-1&csBlurRadius=4.7&csResolution=4096&csTileRes=300',
    ), true);
    expect(parameters.exposure).toBe(6);
    expect(parameters.hazeStrength).toBe(0);
    expect(parameters.blurRadiusTexels).toBe(5);
    expect(parameters.aerialResolution).toBe(2048);
    expect(parameters.tileResolution).toBe(512);
  });
});
