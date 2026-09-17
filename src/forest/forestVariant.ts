import type { ForestFlags, ForestVariantId } from '../types';

export const FOREST_VARIANT_IDS: readonly ForestVariantId[] = [
  'none',
  'instanced',
  'billboard',
  'canopy',
];

const VARIANT_FLAGS: Record<ForestVariantId, Omit<ForestFlags, 'variantId'>> = {
  none: {
    enabled: false,
    usesInstancedTrees: false,
    usesBillboardCards: false,
    usesCanopyClusters: false,
  },
  instanced: {
    enabled: true,
    usesInstancedTrees: true,
    usesBillboardCards: false,
    usesCanopyClusters: false,
  },
  billboard: {
    enabled: true,
    usesInstancedTrees: false,
    usesBillboardCards: true,
    usesCanopyClusters: false,
  },
  canopy: {
    enabled: true,
    usesInstancedTrees: false,
    usesBillboardCards: false,
    usesCanopyClusters: true,
  },
};

/** DEV query の生値を、browser state を読まずに variant flags へ解決する。 */
export function resolveForestFlags(
  raw: string | null | undefined,
  fallbackVariant: ForestVariantId,
): ForestFlags {
  const variantId = FOREST_VARIANT_IDS.includes(raw as ForestVariantId)
    ? raw as ForestVariantId
    : fallbackVariant;

  return { variantId, ...VARIANT_FLAGS[variantId] };
}
