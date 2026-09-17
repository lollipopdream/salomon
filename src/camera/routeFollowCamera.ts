import type { RouteFollowConfig, Vec3 } from '../types';
import { findRoutePointAtProgress } from '../route/routeProgress';
import {
  addVec3,
  lengthVec3,
  lerpVec3,
  normalizeVec3,
  scaleVec3,
  smoothstep,
  subtractVec3,
} from '../utils/vecMath';

const DIRECTION_FALLBACK: Vec3 = { x: 0, y: 0, z: 1 };
const RIGHT_DIRECTION_FALLBACK: Vec3 = { x: 1, y: 0, z: 0 };
const LOOK_AHEAD_ANCHOR_WEIGHT = 0.4;
const STRAIGHT_LATERAL_OFFSET_SCALE = 0.45;
const FULL_CURVATURE_RESPONSE_RADIANS = Math.PI / 4;

/**
 * Samples the route by arc length. Distance calculation intentionally remains
 * owned by src/route/routeProgress.ts.
 */
export function computeRouteFollowAnchor(
  points: Vec3[],
  cumulativeDistances: number[],
  progress: number,
): Vec3 {
  return findRoutePointAtProgress(points, cumulativeDistances, progress);
}

/** Estimates the local route direction from a finite progress window. */
export function computeRouteDirection(
  points: Vec3[],
  cumulativeDistances: number[],
  progress: number,
  deltaProgress: number,
): Vec3 {
  const behind = computeRouteFollowAnchor(
    points,
    cumulativeDistances,
    progress - deltaProgress,
  );
  const ahead = computeRouteFollowAnchor(
    points,
    cumulativeDistances,
    progress + deltaProgress,
  );

  return normalizeVec3(subtractVec3(ahead, behind), DIRECTION_FALLBACK);
}

/**
 * Estimates the chase-camera heading over a deliberately broad window.
 * Keeping this separate from the narrow local tangent makes camera placement
 * follow the overall route trend instead of snapping to each nearby bend.
 */
export function computeSmoothedRouteHeading(
  points: Vec3[],
  cumulativeDistances: number[],
  progress: number,
  headingSmoothingProgress: number,
): Vec3 {
  return computeRouteDirection(
    points,
    cumulativeDistances,
    progress,
    headingSmoothingProgress,
  );
}

/**
 * Samples the broad route trend at an earlier progress point. The explicit
 * clamp keeps the smoothing window anchored at the route start during the
 * initial lag interval instead of extrapolating to negative progress.
 */
export function computeLaggedRouteHeading(
  points: Vec3[],
  cumulativeDistances: number[],
  progress: number,
  config: RouteFollowConfig,
): Vec3 {
  const laggedProgress = Math.min(
    1,
    Math.max(0, progress - config.headingLagProgress),
  );

  return computeSmoothedRouteHeading(
    points,
    cumulativeDistances,
    laggedProgress,
    config.headingSmoothingProgress,
  );
}

/** Returns the horizontal right-hand side of the camera's route heading. */
export function computeHorizontalRight(heading: Vec3): Vec3 {
  return normalizeVec3(
    { x: heading.z, y: 0, z: -heading.x },
    RIGHT_DIRECTION_FALLBACK,
  );
}

/**
 * Retains a baseline side offset on straight sections, then smoothly restores
 * the configured offset as the local tangent turns away from the camera's
 * lagged route trend. Horizontal headings keep elevation changes from being
 * mistaken for lateral route curvature.
 */
function computeCurvatureResponsiveLateralOffset(
  points: Vec3[],
  cumulativeDistances: number[],
  progress: number,
  laggedHeading: Vec3,
  config: RouteFollowConfig,
): number {
  const localHeading = computeRouteDirection(
    points,
    cumulativeDistances,
    progress,
    config.directionSampleDeltaProgress,
  );
  const horizontalLocalHeading = normalizeVec3(
    { x: localHeading.x, y: 0, z: localHeading.z },
    DIRECTION_FALLBACK,
  );
  const horizontalLaggedHeading = normalizeVec3(
    { x: laggedHeading.x, y: 0, z: laggedHeading.z },
    DIRECTION_FALLBACK,
  );
  const alignment = horizontalLocalHeading.x * horizontalLaggedHeading.x
    + horizontalLocalHeading.z * horizontalLaggedHeading.z;
  const directionChangeRadians = Math.acos(
    Math.min(1, Math.max(-1, alignment)),
  );
  const curvatureResponse = smoothstep(
    directionChangeRadians / FULL_CURVATURE_RESPONSE_RADIANS,
  );
  const lateralOffsetScale = STRAIGHT_LATERAL_OFFSET_SCALE
    + (1 - STRAIGHT_LATERAL_OFFSET_SCALE) * curvatureResponse;

  return config.lateralOffsetMeters * lateralOffsetScale;
}

export function computeRouteFollowCameraPosition(
  points: Vec3[],
  cumulativeDistances: number[],
  progress: number,
  config: RouteFollowConfig,
): Vec3 {
  const anchor = computeRouteFollowAnchor(
    points,
    cumulativeDistances,
    progress,
  );
  const heading = computeLaggedRouteHeading(
    points,
    cumulativeDistances,
    progress,
    config,
  );
  const behindPosition = subtractVec3(
    anchor,
    scaleVec3(heading, config.behindMeters),
  );
  const lateralOffset = computeCurvatureResponsiveLateralOffset(
    points,
    cumulativeDistances,
    progress,
    heading,
    config,
  );
  // Stay on the right of travel with some parallax even on straight sections,
  // while opening the offset as the route turns away from the lagged heading.
  const position = addVec3(
    behindPosition,
    scaleVec3(computeHorizontalRight(heading), lateralOffset),
  );

  return {
    ...position,
    y: anchor.y + config.heightMeters,
  };
}

export function computeRouteFollowLookAtTarget(
  points: Vec3[],
  cumulativeDistances: number[],
  progress: number,
  config: RouteFollowConfig,
): Vec3 {
  const anchor = computeRouteFollowAnchor(
    points,
    cumulativeDistances,
    progress,
  );
  const lookAheadAnchor = computeRouteFollowAnchor(
    points,
    cumulativeDistances,
    progress + config.lookAheadProgress,
  );
  const laggedHeading = computeLaggedRouteHeading(
    points,
    cumulativeDistances,
    progress,
    config,
  );
  const lookAheadDistance = lengthVec3(subtractVec3(lookAheadAnchor, anchor));
  const headingTarget = addVec3(
    anchor,
    scaleVec3(laggedHeading, lookAheadDistance),
  );
  // Keep a minority contribution from the real route point for framing while
  // favoring the lagged trend so aim does not snap back to current progress.
  const target = lerpVec3(
    headingTarget,
    lookAheadAnchor,
    LOOK_AHEAD_ANCHOR_WEIGHT,
  );

  return addVec3(target, {
    x: 0,
    y: config.targetLiftMeters,
    z: 0,
  });
}
