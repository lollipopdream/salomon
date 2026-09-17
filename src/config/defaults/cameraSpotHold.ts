import type { RouteFollowSpotsConfig } from '../../types';

export const ROUTE_FOLLOW_BASE_TRAVEL_MS = 16_000;

const YAKUOIN_CANONICAL_HOLD_TIMING = {
  decelMs: 300,
  midMs: 900,
  accelMs: 300,
};

export const routeFollowSpotsDefaults: RouteFollowSpotsConfig = {
  events: [
    { poiId: 'kiyotaki', kind: 'hold', ...YAKUOIN_CANONICAL_HOLD_TIMING },
    {
      poiId: 'takaosanguchi_kasumidai',
      kind: 'hold',
      ...YAKUOIN_CANONICAL_HOLD_TIMING,
    },
    {
      poiId: 'joshinmon',
      kind: 'hold',
      ...YAKUOIN_CANONICAL_HOLD_TIMING,
    },
    {
      poiId: 'otokozaka_onnazaka',
      kind: 'hold',
      ...YAKUOIN_CANONICAL_HOLD_TIMING,
    },
    { poiId: 'yakuoin', kind: 'hold', ...YAKUOIN_CANONICAL_HOLD_TIMING },
  ],
};
