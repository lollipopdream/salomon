import { describe, expect, it } from 'vitest';

import { resolvePerfBypassFlags } from './perfBypass';

describe('resolvePerfBypassFlags', () => {
  it('returns both flags false when no bypass query is specified', () => {
    expect(resolvePerfBypassFlags(new URLSearchParams(), true)).toEqual({
      disableAntialias: false,
      terrainMaterialBasic: false,
    });
  });

  it('returns both flags false outside development regardless of query', () => {
    expect(
      resolvePerfBypassFlags(new URLSearchParams('aa=0&terrainMat=basic'), false),
    ).toEqual({
      disableAntialias: false,
      terrainMaterialBasic: false,
    });
  });

  it('enables only the antialias bypass for aa=0', () => {
    expect(resolvePerfBypassFlags(new URLSearchParams('aa=0'), true)).toEqual({
      disableAntialias: true,
      terrainMaterialBasic: false,
    });
  });

  it.each(['1', 'x'])('does not enable the antialias bypass for aa=%s', (value) => {
    expect(resolvePerfBypassFlags(new URLSearchParams(`aa=${value}`), true))
      .toEqual({ disableAntialias: false, terrainMaterialBasic: false });
  });

  it('enables only the terrain-material bypass for terrainMat=basic', () => {
    expect(
      resolvePerfBypassFlags(new URLSearchParams('terrainMat=basic'), true),
    ).toEqual({
      disableAntialias: false,
      terrainMaterialBasic: true,
    });
  });

  it.each(['standard', ''])('does not enable the material bypass for terrainMat=%j', (value) => {
    expect(resolvePerfBypassFlags(new URLSearchParams(`terrainMat=${value}`), true))
      .toEqual({ disableAntialias: false, terrainMaterialBasic: false });
  });

  it('enables both bypasses when both explicit queries are specified', () => {
    expect(
      resolvePerfBypassFlags(new URLSearchParams('aa=0&terrainMat=basic'), true),
    ).toEqual({
      disableAntialias: true,
      terrainMaterialBasic: true,
    });
  });
});
