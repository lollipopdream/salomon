import type {
  SpotArrivalTier,
  SpotArrivalTierTimingMs,
} from '../../route/spotArrival';

const YAKUOIN_CANONICAL_ARRIVAL_TIMING_MS: SpotArrivalTierTimingMs = {
  approachMs: 450,
  dwellMs: 950,
  departMs: 450,
};

export const SPOT_ARRIVAL_TIER_BY_POI_ID: Record<string, SpotArrivalTier> = {
  kiyotaki: 'secondary',
  takaosanguchi_kasumidai: 'secondary',
  joshinmon: 'secondary',
  otokozaka_onnazaka: 'primary',
  yakuoin: 'primary',
  summit: 'primary',
};

export const SPOT_ARRIVAL_TIMING_MS: Record<
  SpotArrivalTier,
  SpotArrivalTierTimingMs
> = {
  primary: YAKUOIN_CANONICAL_ARRIVAL_TIMING_MS,
  secondary: YAKUOIN_CANONICAL_ARRIVAL_TIMING_MS,
};

export const SPOT_ARRIVAL_VISUAL_DEFAULTS = {
  markerScalePeak: 1.15,
  labelEmphasisScale: 1.12,
  otherSpotDimOpacity: 0.65,
  ringPulsePeriodMs: 700,
  ringPulseAmplitude: 0.25,
};
