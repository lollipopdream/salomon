import type {
  RouteHeadMarkerConfig,
  RouteVisualConfig,
} from '../../types';

export const routeVisualDefaults: RouteVisualConfig = {
  // C2 hero-line treatment: the full-route context uses a stronger warm brand
  // accent while its partial opacity keeps the active white core distinct.
  baseLayer: { color: 0xf7c56b, opacity: 0.9, widthPx: 2 },
  coreColor: 0xffffff,
  // Keep the established base + core + two-halo layer contract while giving
  // the route enough weight to serve as the composition's hero line.
  coreWidthPx: 3.6,
  haloLayers: [
    { widthPx: 7.0, opacity: 0.32, color: 0xffb84d },
    { widthPx: 11, opacity: 0.14, color: 0xffb84d },
  ],
};

export const routeHeadMarkerDefaults: RouteHeadMarkerConfig = {
  enabled: true,
  radiusMeters: 1.8,
  color: 0xffffff,
  glowRadiusMeters: 3.2,
  glowOpacity: 0.28,
  directionCue: {
    dashCount: 3,
    spacingMeters: 15,
    radiusMeters: 0.7,
    minOpacity: 0.12,
    maxOpacity: 0.48,
    pulsePeriodMs: 1_800,
    phaseStep: 0.22,
  },
};
