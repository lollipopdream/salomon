import { describe, expect, it } from 'vitest';
import {
  resolveCanopyResolution,
  resolveTerrainSurfaceFlags,
  TERRAIN_SURFACE_VARIANT_IDS,
} from './terrainVariant';

describe('terrainVariant', () => {
  it('returns the specified flags for every terrain surface variant', () => {
    expect(resolveTerrainSurfaceFlags('baseline', 'c4')).toEqual({
      variantId: 'baseline',
      multiScaleHillshade: false,
      demNormalMap: false,
      canopyDetailNormal: false,
    });
    expect(resolveTerrainSurfaceFlags('c1', 'baseline')).toEqual({
      variantId: 'c1',
      multiScaleHillshade: true,
      demNormalMap: false,
      canopyDetailNormal: false,
    });
    expect(resolveTerrainSurfaceFlags('c2', 'baseline')).toEqual({
      variantId: 'c2',
      multiScaleHillshade: false,
      demNormalMap: true,
      canopyDetailNormal: false,
    });
    expect(resolveTerrainSurfaceFlags('c3', 'baseline')).toEqual({
      variantId: 'c3',
      multiScaleHillshade: true,
      demNormalMap: true,
      canopyDetailNormal: false,
    });
    expect(resolveTerrainSurfaceFlags('c4', 'baseline')).toEqual({
      variantId: 'c4',
      multiScaleHillshade: true,
      demNormalMap: true,
      canopyDetailNormal: true,
    });
  });

  it('falls back for absent, malformed, uppercase, and unknown variants', () => {
    for (const raw of [null, undefined, '', 'C3', 'unknown']) {
      expect(resolveTerrainSurfaceFlags(raw, 'c2').variantId).toBe('c2');
    }
  });

  it('keeps baseline feature flags all false', () => {
    const { multiScaleHillshade, demNormalMap, canopyDetailNormal } =
      resolveTerrainSurfaceFlags('baseline', 'c4');

    expect({ multiScaleHillshade, demNormalMap, canopyDetailNormal }).toEqual({
      multiScaleHillshade: false,
      demNormalMap: false,
      canopyDetailNormal: false,
    });
  });

  it('accepts only the supported canopy resolutions', () => {
    expect(resolveCanopyResolution('768', 1536)).toBe(768);
    expect(resolveCanopyResolution('1536', 768)).toBe(1536);
    expect(resolveCanopyResolution('3072', 768)).toBe(3072);

    for (const raw of ['1024', 'abc', null, undefined, '']) {
      expect(resolveCanopyResolution(raw, 1536)).toBe(1536);
    }
  });

  it('exports five unique terrain surface variant IDs', () => {
    expect(TERRAIN_SURFACE_VARIANT_IDS).toHaveLength(5);
    expect(new Set(TERRAIN_SURFACE_VARIANT_IDS).size).toBe(5);
  });
});
