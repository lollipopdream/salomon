import type { CinematicRailConfig, Vec3 } from '../types';
import {
  addVec3,
  lengthVec3,
  lerpVec3,
  scaleVec3,
  subtractVec3,
} from '../utils/vecMath';
import { evaluateKeyPoseRail } from './cameraRailMath';
import {
  computeHorizontalRight,
  computeRouteFollowAnchor,
  computeSmoothedRouteHeading,
} from './routeFollowCamera';

const LOOK_AHEAD_ANCHOR_WEIGHT = 0.4;
const FORWARD_CONTEXT_WEIGHT = 0.3;
const YAKUOIN_ROUTE_PROGRESS = 0.780;

export function buildCameraRail(
  worldRoutePoints: Vec3[],
  cumulativeDistances: number[],
  guidancePoints: Vec3[],
  guidanceCumulativeDistances: number[],
  config: CinematicRailConfig,
): {
  keyProgressValues: number[];
  positionKeys: Vec3[];
  targetKeys: Vec3[];
} {
  const positionKeys: Vec3[] = [];
  const targetKeys: Vec3[] = [];

  for (const keyPose of config.keyPoses) {
    const targetAnchor = computeRouteFollowAnchor(
      guidancePoints,
      guidanceCumulativeDistances,
      keyPose.progress,
    );
    const positionAnchorProgress = keyPose.anchorReferenceProgress
      ?? keyPose.progress;
    const anchor = computeRouteFollowAnchor(
      guidancePoints,
      guidanceCumulativeDistances,
      positionAnchorProgress,
    );
    const headingSampleProgress = keyPose.headingReferenceProgress
      ?? keyPose.progress;
    const positionHeading = computeSmoothedRouteHeading(
      guidancePoints,
      guidanceCumulativeDistances,
      headingSampleProgress,
      keyPose.headingWindowProgress,
    );
    const right = computeHorizontalRight(positionHeading);

    positionKeys.push({
      x: anchor.x - positionHeading.x * keyPose.behindMeters
        + right.x * keyPose.lateralOffsetMeters,
      y: anchor.y + keyPose.heightMeters,
      z: anchor.z - positionHeading.z * keyPose.behindMeters
        + right.z * keyPose.lateralOffsetMeters,
    });

    const lookAheadProgressClamped = Math.min(
      1,
      keyPose.progress + keyPose.lookAheadProgress,
    );
    const lookAheadAnchor = computeRouteFollowAnchor(
      guidancePoints,
      guidanceCumulativeDistances,
      lookAheadProgressClamped,
    );
    const lookAheadDistance = lengthVec3(
      subtractVec3(lookAheadAnchor, targetAnchor),
    );
    const targetHeading = computeSmoothedRouteHeading(
      guidancePoints,
      guidanceCumulativeDistances,
      keyPose.progress,
      keyPose.headingWindowProgress,
    );
    const headingTarget = addVec3(
      targetAnchor,
      scaleVec3(targetHeading, lookAheadDistance),
    );
    const baseTarget = lerpVec3(
      headingTarget,
      lookAheadAnchor,
      LOOK_AHEAD_ANCHOR_WEIGHT,
    );
    const currentAwareTarget = lerpVec3(
      targetAnchor,
      baseTarget,
      FORWARD_CONTEXT_WEIGHT,
    );
    let landmarkPoint: Vec3 | undefined;

    if (keyPose.landmarkPoiId === 'yakuoin') {
      landmarkPoint = computeRouteFollowAnchor(
        worldRoutePoints,
        cumulativeDistances,
        YAKUOIN_ROUTE_PROGRESS,
      );
    } else if (keyPose.landmarkPoiId === 'summit') {
      landmarkPoint = worldRoutePoints[worldRoutePoints.length - 1];
    }

    const targetBeforeLift = keyPose.landmarkWeight > 0 && landmarkPoint
      ? lerpVec3(currentAwareTarget, landmarkPoint, keyPose.landmarkWeight)
      : currentAwareTarget;

    targetKeys.push(addVec3(targetBeforeLift, {
      x: 0,
      y: keyPose.targetLiftMeters,
      z: 0,
    }));
  }

  return {
    keyProgressValues: config.keyPoses.map((keyPose) => keyPose.progress),
    positionKeys,
    targetKeys,
  };
}

export function evaluateRailPosition(
  rail: { keyProgressValues: number[]; positionKeys: Vec3[] },
  progress: number,
): Vec3 {
  return evaluateKeyPoseRail(
    rail.keyProgressValues,
    rail.positionKeys,
    progress,
  );
}

export function evaluateRailTarget(
  rail: { keyProgressValues: number[]; targetKeys: Vec3[] },
  progress: number,
): Vec3 {
  return evaluateKeyPoseRail(
    rail.keyProgressValues,
    rail.targetKeys,
    progress,
  );
}
