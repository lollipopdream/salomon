import type {
  AnimationConfig,
  AppSettings,
  CameraStateConfig,
  ElevationGrid,
  Vec3,
} from '../types';
import { lerpVec3 } from '../utils/vecMath';
import {
  computeLookAtTarget,
  computeOverviewCameraPosition,
} from './cameraController';
import type { CameraPhaseResult } from './cameraTimeline';
import { computeHighOverviewCameraPosition } from './highOverviewCamera';
import { computeReturnCameraPose } from './returnToOverviewCamera';
import {
  buildCameraRail,
  evaluateRailPosition,
  evaluateRailTarget,
} from './routeFollowRail';
import {
  computeSummitCameraPosition,
  computeSummitLookAtTarget,
} from './summitCamera';

export interface CameraPoseInput {
  phase: CameraPhaseResult;
  elapsedMs: number;
  animationConfig: AnimationConfig;
  grid: ElevationGrid;
  settings: AppSettings;
  worldRoutePoints: Vec3[];
  cumulativeDistances: number[];
  routeGuidancePoints?: Vec3[];
  routeGuidanceCumulativeDistances?: number[];
  cameraRail?: ReturnType<typeof buildCameraRail>;
  cameraState: CameraStateConfig;
}

export interface CameraPose {
  position: Vec3;
  target: Vec3;
}

function computeOverviewPose(
  grid: ElevationGrid,
  settings: AppSettings,
): CameraPose {
  return {
    position: computeOverviewCameraPosition(grid, settings),
    target: computeLookAtTarget(grid, settings),
  };
}

function computeHighOverviewPose(
  grid: ElevationGrid,
  settings: AppSettings,
  cameraState: CameraStateConfig,
  orbitAngleDegrees: number,
  holdProgressT: number = 1,
): CameraPose {
  return {
    position: computeHighOverviewCameraPosition(
      grid,
      settings,
      cameraState.highOverview,
      orbitAngleDegrees,
      holdProgressT,
    ),
    target: computeLookAtTarget(grid, settings),
  };
}

function computeRouteFollowPose(
  cameraRail: ReturnType<typeof buildCameraRail>,
  progress: number,
): CameraPose {
  return {
    position: evaluateRailPosition(cameraRail, progress),
    target: evaluateRailTarget(cameraRail, progress),
  };
}

function computeSummitPose(
  summitWorldPoint: Vec3,
  grid: ElevationGrid,
  cameraState: CameraStateConfig,
): CameraPose {
  const terrainDiagonal = Math.hypot(
    grid.cols * grid.cellSizeMeters,
    grid.rows * grid.cellSizeMeters,
  );
  // Keep the look-at target below the camera to retain a downward view of the
  // summit and ridge instead of aiming nearly horizontally into the sky.
  const targetLiftMeters = terrainDiagonal * 0.006;

  return {
    position: computeSummitCameraPosition(
      summitWorldPoint,
      grid,
      cameraState.summit,
    ),
    target: computeSummitLookAtTarget(summitWorldPoint, targetLiftMeters),
  };
}

function lerpPose(from: CameraPose, to: CameraPose, t: number): CameraPose {
  return {
    position: lerpVec3(from.position, to.position, t),
    target: lerpVec3(from.target, to.target, t),
  };
}

export function computeCameraPose(input: CameraPoseInput): CameraPose {
  const {
    phase,
    grid,
    settings,
    worldRoutePoints,
    cumulativeDistances,
    routeGuidancePoints = worldRoutePoints,
    routeGuidanceCumulativeDistances = cumulativeDistances,
    cameraRail: providedCameraRail,
    cameraState,
  } = input;
  const cameraRail = providedCameraRail ?? buildCameraRail(
    worldRoutePoints,
    cumulativeDistances,
    routeGuidancePoints,
    routeGuidanceCumulativeDistances,
    cameraState.rail,
  );
  const overviewPose = computeOverviewPose(grid, settings);

  if (phase.kind === 'high-overview-hold') {
    return computeHighOverviewPose(
      grid,
      settings,
      cameraState,
      phase.t * cameraState.highOverview.orbitDegrees,
      phase.t,
    );
  }

  if (phase.kind === 'descend-to-overview') {
    const highOverviewEndPose = computeHighOverviewPose(
      grid,
      settings,
      cameraState,
      cameraState.highOverview.orbitDegrees,
      1,
    );

    return lerpPose(highOverviewEndPose, overviewPose, phase.t);
  }

  if (phase.kind === 'overview') {
    return overviewPose;
  }

  if (phase.kind === 'transition-in') {
    const routeStartPose = computeRouteFollowPose(
      cameraRail,
      0,
    );

    return computeReturnCameraPose(
      phase.t,
      overviewPose.position,
      overviewPose.target,
      routeStartPose.position,
      routeStartPose.target,
      cameraState.timeline.arcLiftMeters,
    );
  }

  if (phase.kind === 'route-follow') {
    return computeRouteFollowPose(
      cameraRail,
      phase.progress,
    );
  }

  const summitWorldPoint = worldRoutePoints[worldRoutePoints.length - 1];
  const summitPose = computeSummitPose(
    summitWorldPoint,
    grid,
    cameraState,
  );

  if (phase.kind === 'transition-to-summit') {
    const routeEndPose = computeRouteFollowPose(
      cameraRail,
      1,
    );

    return computeReturnCameraPose(
      phase.t,
      routeEndPose.position,
      routeEndPose.target,
      summitPose.position,
      summitPose.target,
      cameraState.timeline.arcLiftMeters,
    );
  }

  if (phase.kind === 'summit-hold') {
    return summitPose;
  }

  if (phase.kind === 'ascend-to-high-overview') {
    const highOverviewStartPose = computeHighOverviewPose(
      grid,
      settings,
      cameraState,
      0,
      0,
    );

    return lerpPose(overviewPose, highOverviewStartPose, phase.t);
  }

  return computeReturnCameraPose(
    phase.t,
    summitPose.position,
    summitPose.target,
    overviewPose.position,
    overviewPose.target,
    cameraState.timeline.arcLiftMeters,
  );
}
