import { computeRouteFollowProgress } from '../animation/progress';
import type {
  AnimationConfig,
  CameraTimelineConfig,
  RouteFollowTimelineSegment,
} from '../types';
import { smoothstep } from '../utils/vecMath';

export type CameraPhaseResult =
  | { kind: 'high-overview-hold'; t: number }
  | { kind: 'descend-to-overview'; t: number }
  | { kind: 'overview' }
  | { kind: 'transition-in'; t: number }
  | { kind: 'route-follow'; progress: number }
  | { kind: 'transition-to-summit'; t: number }
  | { kind: 'summit-hold' }
  | { kind: 'return-to-overview'; t: number }
  | { kind: 'ascend-to-high-overview'; t: number };

export function computeRouteFollowStartMs(
  timeline: CameraTimelineConfig,
): number {
  return (
    timeline.highOverviewHoldMs
    + timeline.descendToOverviewMs
    + timeline.overviewHoldMs
    + timeline.transitionInMs
  );
}

export function computeCameraPhase(
  elapsedMs: number,
  animationConfig: AnimationConfig,
  timeline: CameraTimelineConfig,
  routeFollowTimeline?: RouteFollowTimelineSegment[],
): CameraPhaseResult {
  const descendStartMs = timeline.highOverviewHoldMs;
  const overviewStartMs = descendStartMs + timeline.descendToOverviewMs;
  const transitionInStartMs = overviewStartMs + timeline.overviewHoldMs;
  const routeFollowStartMs = computeRouteFollowStartMs(timeline);
  const transitionToSummitStartMs = animationConfig.playDurationMs;
  const summitHoldStartMs =
    transitionToSummitStartMs + timeline.transitionToSummitMs;
  const returnToOverviewStartMs = summitHoldStartMs + timeline.summitHoldMs;
  const ascendStartMs = returnToOverviewStartMs + timeline.returnToOverviewMs;

  if (elapsedMs < descendStartMs) {
    return {
      kind: 'high-overview-hold',
      t: smoothstep(elapsedMs / timeline.highOverviewHoldMs),
    };
  }

  if (elapsedMs < overviewStartMs) {
    return {
      kind: 'descend-to-overview',
      t: smoothstep((elapsedMs - descendStartMs) / timeline.descendToOverviewMs),
    };
  }

  if (elapsedMs < transitionInStartMs) {
    return { kind: 'overview' };
  }

  if (elapsedMs < routeFollowStartMs) {
    return {
      kind: 'transition-in',
      t: smoothstep(
        (elapsedMs - transitionInStartMs) / timeline.transitionInMs,
      ),
    };
  }

  if (elapsedMs < transitionToSummitStartMs) {
    return {
      kind: 'route-follow',
      progress: computeRouteFollowProgress(
        elapsedMs,
        routeFollowStartMs,
        animationConfig.playDurationMs,
        routeFollowTimeline,
      ),
    };
  }

  if (elapsedMs < summitHoldStartMs) {
    return {
      kind: 'transition-to-summit',
      t: smoothstep(
        (elapsedMs - transitionToSummitStartMs) /
          timeline.transitionToSummitMs,
      ),
    };
  }

  if (elapsedMs < returnToOverviewStartMs) {
    return { kind: 'summit-hold' };
  }

  if (elapsedMs < ascendStartMs) {
    return {
      kind: 'return-to-overview',
      t: smoothstep(
        (elapsedMs - returnToOverviewStartMs) / timeline.returnToOverviewMs,
      ),
    };
  }

  return {
    kind: 'ascend-to-high-overview',
    t: smoothstep(
      (elapsedMs - ascendStartMs) / timeline.ascendToHighOverviewMs,
    ),
  };
}
