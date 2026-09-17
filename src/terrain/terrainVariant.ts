import type { TerrainSurfaceFlags, TerrainSurfaceVariantId } from '../types';

export const TERRAIN_SURFACE_VARIANT_IDS: readonly TerrainSurfaceVariantId[] = [
  'baseline',
  'c1',
  'c2',
  'c3',
  'c4',
];

const VARIANT_FLAGS: Record<TerrainSurfaceVariantId, Omit<TerrainSurfaceFlags, 'variantId'>> = {
  baseline: {
    multiScaleHillshade: false,
    demNormalMap: false,
    canopyDetailNormal: false,
  },
  c1: {
    multiScaleHillshade: true,
    demNormalMap: false,
    canopyDetailNormal: false,
  },
  c2: {
    multiScaleHillshade: false,
    demNormalMap: true,
    canopyDetailNormal: false,
  },
  c3: {
    multiScaleHillshade: true,
    demNormalMap: true,
    canopyDetailNormal: false,
  },
  c4: {
    multiScaleHillshade: true,
    demNormalMap: true,
    canopyDetailNormal: true,
  },
};

/** Resolve the terrain surface A/B variant without reading browser state. */
export function resolveTerrainSurfaceFlags(
  raw: string | null | undefined,
  fallbackVariant: TerrainSurfaceVariantId,
): TerrainSurfaceFlags {
  const variantId = TERRAIN_SURFACE_VARIANT_IDS.includes(raw as TerrainSurfaceVariantId)
    ? raw as TerrainSurfaceVariantId
    : fallbackVariant;

  return { variantId, ...VARIANT_FLAGS[variantId] };
}

/** Accept only the supported canopy-detail normal-map resolutions. */
export function resolveCanopyResolution(
  raw: string | null | undefined,
  fallback: number,
): number {
  return raw === '768' || raw === '1536' || raw === '3072'
    ? Number(raw)
    : fallback;
}
