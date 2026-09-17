import type { ForestPlacementConfig } from '../types';

export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (x <= edge0) {
    return 0;
  }

  if (x >= edge1) {
    return 1;
  }

  const progress = (x - edge0) / (edge1 - edge0);
  return progress * progress * (3 - 2 * progress);
}

export function computeCorridorFactor(
  distanceToRouteMeters: number,
  config: ForestPlacementConfig,
): number {
  const core = config.corridorCoreHalfWidthMeters;
  const outerEdge = core + config.corridorFeatherMeters;
  const corridorFactor = distanceToRouteMeters >= outerEdge
    ? 0
    : 1 - smoothstep(core, outerEdge, distanceToRouteMeters);
  const clearanceFactor = smoothstep(
    0,
    config.routeClearanceMeters,
    distanceToRouteMeters,
  );

  return corridorFactor * clearanceFactor;
}

export function computeSlopeFactor(
  slopeRadians: number,
  config: ForestPlacementConfig,
): number {
  const slopeDegrees = (slopeRadians * 180) / Math.PI;
  return 1 - smoothstep(
    config.slopeFalloffStartDeg,
    config.slopeZeroDeg,
    slopeDegrees,
  );
}

export function computeDensityFactor(
  distanceToRouteMeters: number,
  slopeRadians: number,
  config: ForestPlacementConfig,
): number {
  return computeCorridorFactor(distanceToRouteMeters, config) * computeSlopeFactor(slopeRadians, config);
}

export function computeSizeFromUnit(
  u01: number,
  minMeters: number,
  maxMeters: number,
): number {
  return minMeters + u01 * (maxMeters - minMeters);
}
