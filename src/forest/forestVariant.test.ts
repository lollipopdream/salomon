import { describe, expect, it } from 'vitest';

import { FOREST_VARIANT_IDS, resolveForestFlags } from './forestVariant';

describe('forestVariant', () => {
  it.each([
    ['none', { variantId: 'none', enabled: false, usesInstancedTrees: false, usesBillboardCards: false, usesCanopyClusters: false }],
    ['instanced', { variantId: 'instanced', enabled: true, usesInstancedTrees: true, usesBillboardCards: false, usesCanopyClusters: false }],
    ['billboard', { variantId: 'billboard', enabled: true, usesInstancedTrees: false, usesBillboardCards: true, usesCanopyClusters: false }],
    ['canopy', { variantId: 'canopy', enabled: true, usesInstancedTrees: false, usesBillboardCards: false, usesCanopyClusters: true }],
  ] as const)('resolves %s to its complete flag set', (variantId, expected) => {
    expect(resolveForestFlags(variantId, 'none')).toEqual(expected);
  });

  it.each([null, undefined, 'INSTANCED', 'hybrid', ''])(
    'falls back for %s',
    (raw) => {
      expect(resolveForestFlags(raw, 'none')).toEqual({
        variantId: 'none',
        enabled: false,
        usesInstancedTrees: false,
        usesBillboardCards: false,
        usesCanopyClusters: false,
      });
    },
  );

  it('keeps every none feature flag false', () => {
    const { enabled, usesInstancedTrees, usesBillboardCards, usesCanopyClusters } =
      resolveForestFlags('none', 'canopy');
    expect({ enabled, usesInstancedTrees, usesBillboardCards, usesCanopyClusters }).toEqual({
      enabled: false,
      usesInstancedTrees: false,
      usesBillboardCards: false,
      usesCanopyClusters: false,
    });
  });

  it('exports four unique IDs', () => {
    expect(FOREST_VARIANT_IDS).toHaveLength(4);
    expect(new Set(FOREST_VARIANT_IDS).size).toBe(4);
  });
});
