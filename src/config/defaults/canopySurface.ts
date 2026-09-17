import type { CanopySurfaceConfig, CanopySurfaceParameters } from '../../types';

/** Parameters added by MP-FR-T4 without changing the frozen shared types file. */
export interface CanopySurfaceT4Parameters {
  toe: number;
  clumpStrength: number;
  clumpScaleMeters: number;
  autumnStrength: number;
}

export type ExtendedCanopySurfaceParameters = CanopySurfaceParameters & CanopySurfaceT4Parameters;

/** DEV sweep contract: finite values outside these bounds are clamped. */
export const canopySurfaceQuerySpec = {
  // Starting values for leader capture; screen-space targets are not CPU metrics.
  exposure: { query: 'csExposure', default: 4.2, min: 0.5, max: 6 },
  saturation: { query: 'csSaturation', default: 1.6, min: 0, max: 2 },
  shadowLift: { query: 'csShadowLift', default: 0, min: 0, max: 0.01 },
  warmth: { query: 'csWarmth', default: 0.25, min: -1, max: 1 },
  shoulder: { query: 'csShoulder', default: 0.5, min: 0.04, max: 0.5 },
  toe: { query: 'csToe', default: 0.02, min: 0, max: 0.2 },
  detailStrength: { query: 'csDetailStrength', default: 1.6, min: 0, max: 3 },
  detailScale: { query: 'csDetailScale', default: 1, min: 0.2, max: 2 },
  crownSizeMeters: { query: 'csCrownSize', default: 5.5, min: 2, max: 10 },
  crownDensity: { query: 'csCrownDensity', default: 1.3, min: 0.5, max: 2.5 },
  gapContrast: { query: 'csGapContrast', default: 1, min: 0, max: 1 },
  detailFade: { query: 'csDetailFade', default: 0.6, min: 0, max: 1 },
  detailNearMeters: { query: 'csDetailNear', default: 2000, min: 0, max: 2500 },
  detailFarMeters: { query: 'csDetailFar', default: 5000, min: 2600, max: 8000 },
  hazeStrength: { query: 'csHaze', default: 0.12, min: 0, max: 1 },
  hazeNearMeters: { query: 'csHazeNear', default: 900, min: 0, max: 1500 },
  hazeFarMeters: { query: 'csHazeFar', default: 5000, min: 1600, max: 6000 },
  patchStrength: { query: 'csPatchStrength', default: 0.6, min: 0, max: 0.8 },
  patchScaleMeters: { query: 'csPatchScale', default: 320, min: 100, max: 800 },
  autumnStrength: { query: 'csAutumnStrength', default: 0.25, min: 0, max: 1 },
  clumpStrength: { query: 'csClumpStrength', default: 1.2, min: 0, max: 4 },
  clumpScaleMeters: { query: 'csClumpScale', default: 48, min: 20, max: 80 },
  tilePeriodMeters: { query: 'csTilePeriod', default: 96, min: 16, max: 256 },
  tileResolution: { query: 'csTileRes', default: 512, min: 256, max: 1024, choices: [256, 512, 1024] },
  seed: { query: 'csSeed', default: 73129, min: 0, max: 4294967295, integer: true },
  aerialResolution: { query: 'csResolution', default: 2048, min: 2048, max: 3072, choices: [2048, 3072] },
  heightScale: { query: 'csHeightScale', default: 28, min: 0, max: 64 },
  weight: { query: 'csWeight', default: 1.1, min: 0, max: 2 },
  blurRadiusTexels: { query: 'csBlurRadius', default: 3, min: 1, max: 12, integer: true },
} satisfies Record<keyof ExtendedCanopySurfaceParameters, {
  query: string; default: number; min: number; max: number;
  choices?: readonly number[]; integer?: boolean;
}>;

export const canopySurfaceDefaults = {
  defaultVariant: 'off',
  parameters: Object.fromEntries(
    Object.entries(canopySurfaceQuerySpec).map(([key, spec]) => [key, spec.default]),
  ) as unknown as ExtendedCanopySurfaceParameters,
} satisfies CanopySurfaceConfig;
