import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { RouteFollowConfig, Vec3 } from '../types';
import { routeFollowDefaults } from '../config/defaults/cameraFollow';
import { cameraGuidanceDefaults } from '../config/defaults/cameraGuidance';
import { computeCameraGuidancePath } from '../route/routeGuidance';
// Arc-length sampling is intentionally imported from the existing Phase 2
// implementation; route-follow must not maintain its own distance calculation.
import {
  computeCumulativeDistances,
  getPartialRoutePoints,
} from '../route/routeProgress';
import {
  lengthVec3,
  normalizeVec3,
  subtractVec3,
} from '../utils/vecMath';
import {
  computeRouteDirection,
  computeRouteFollowAnchor,
  computeRouteFollowCameraPosition,
  computeRouteFollowLookAtTarget,
  computeSmoothedRouteHeading,
} from './routeFollowCamera';

const worldRoutePoints: Vec3[] = [
  { x: 0, y: 10, z: 0 },
  { x: 4, y: 12, z: 3 },
  { x: 7, y: 18, z: 27 },
  { x: 24, y: 21, z: 39 },
  { x: 32, y: 27, z: 58 },
];
const cumulativeDistances = computeCumulativeDistances(worldRoutePoints);
const curvedRoutePoints: Vec3[] = [
  { x: 0, y: 0, z: 0 },
  { x: 0, y: 0, z: 160 },
  { x: 20, y: 0, z: 300 },
  { x: 80, y: 0, z: 430 },
  { x: 180, y: 0, z: 530 },
  { x: 310, y: 0, z: 590 },
  { x: 460, y: 0, z: 610 },
];
const curvedRouteDistances = computeCumulativeDistances(curvedRoutePoints);
// A compressed switchback cluster with repeated 90-degree turns, bracketed by
// straight approach/departure segments so endpoint behavior does not dominate
// the measurements. Its dense core packs the bends into roughly 150 m, on the
// same order as the 186 m Yakuoin cluster.
const hairpinClusterPoints: Vec3[] = [
  { x: 0, y: 0, z: 0 },
  { x: 0, y: 8, z: 150 },
  { x: 45, y: 10, z: 150 },
  { x: 45, y: 12, z: 165 },
  { x: 15, y: 14, z: 165 },
  { x: 15, y: 16, z: 180 },
  { x: 45, y: 18, z: 180 },
  { x: 45, y: 20, z: 195 },
  { x: 15, y: 22, z: 195 },
  { x: 15, y: 24, z: 210 },
  { x: 75, y: 28, z: 210 },
  { x: 75, y: 36, z: 360 },
];
const hairpinClusterDistances = computeCumulativeDistances(
  hairpinClusterPoints,
);
const hairpinGuidance = computeCameraGuidancePath(
  hairpinClusterPoints,
  hairpinClusterDistances,
  cameraGuidanceDefaults,
);
const config: RouteFollowConfig = {
  behindMeters: 6,
  heightMeters: 8,
  directionSampleDeltaProgress: 0.04,
  headingSmoothingProgress: 0.15,
  headingLagProgress: 0.08,
  lateralOffsetMeters: 40,
  lookAheadProgress: 0.08,
  targetLiftMeters: 2,
};

function angleBetweenDegrees(a: Vec3, b: Vec3): number {
  const normalizedA = normalizeVec3(a);
  const normalizedB = normalizeVec3(b);
  const dot = normalizedA.x * normalizedB.x
    + normalizedA.y * normalizedB.y
    + normalizedA.z * normalizedB.z;

  return Math.acos(Math.min(1, Math.max(-1, dot))) * 180 / Math.PI;
}

function cameraHeading(
  points: Vec3[],
  distances: number[],
  progress: number,
  followConfig: RouteFollowConfig,
): Vec3 {
  const position = computeRouteFollowCameraPosition(
    points,
    distances,
    progress,
    followConfig,
  );
  const target = computeRouteFollowLookAtTarget(
    points,
    distances,
    progress,
    followConfig,
  );

  return subtractVec3(target, position);
}

describe('route-follow camera', () => {
  it.each([0.1, 0.3, 0.5, 0.7, 0.9])(
    'keeps the current route anchor in frame at progress %s',
    (progress) => {
      const position = computeRouteFollowCameraPosition(
        worldRoutePoints,
        cumulativeDistances,
        progress,
        routeFollowDefaults,
      );
      const target = computeRouteFollowLookAtTarget(
        worldRoutePoints,
        cumulativeDistances,
        progress,
        routeFollowDefaults,
      );
      const anchor = computeRouteFollowAnchor(
        worldRoutePoints,
        cumulativeDistances,
        progress,
      );
      const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100_000);

      camera.position.set(position.x, position.y, position.z);
      camera.lookAt(target.x, target.y, target.z);
      camera.updateMatrixWorld();

      const projectedAnchor = new THREE.Vector3(
        anchor.x,
        anchor.y,
        anchor.z,
      ).project(camera);

      expect(projectedAnchor.x).toBeGreaterThanOrEqual(-1);
      expect(projectedAnchor.x).toBeLessThanOrEqual(1);
      expect(projectedAnchor.y).toBeGreaterThanOrEqual(-1);
      expect(projectedAnchor.y).toBeLessThanOrEqual(1);
      expect(projectedAnchor.z).toBeGreaterThanOrEqual(-1);
      expect(projectedAnchor.z).toBeLessThanOrEqual(1);
    },
  );

  it('moves continuously when progress is scanned in small increments', () => {
    let previous = computeRouteFollowCameraPosition(
      worldRoutePoints,
      cumulativeDistances,
      0,
      config,
    );

    for (let step = 1; step <= 1_000; step += 1) {
      const current = computeRouteFollowCameraPosition(
        worldRoutePoints,
        cumulativeDistances,
        step / 1_000,
        config,
      );
      const movement = lengthVec3(subtractVec3(current, previous));

      expect(movement).toBeLessThan(0.5);
      previous = current;
    }
  });

  it('clamps look-ahead sampling at the route end without divergence', () => {
    const nearEndTarget = computeRouteFollowLookAtTarget(
      worldRoutePoints,
      cumulativeDistances,
      0.99,
      config,
    );
    const endTarget = computeRouteFollowLookAtTarget(
      worldRoutePoints,
      cumulativeDistances,
      1,
      config,
    );

    expect(nearEndTarget).toEqual(endTarget);
    expect(endTarget).toEqual({
      ...worldRoutePoints[worldRoutePoints.length - 1],
      y: worldRoutePoints[worldRoutePoints.length - 1].y
        + config.targetLiftMeters,
    });
    expect(Object.values(endTarget).every(Number.isFinite)).toBe(true);
  });

  it('limits heading change through a guidance-smoothed hairpin cluster', () => {
    let previousHeading = cameraHeading(
      hairpinGuidance.points,
      hairpinGuidance.cumulativeDistances,
      0,
      routeFollowDefaults,
    );
    let maximumHeadingChangeDegrees = 0;
    const legacyConfig: RouteFollowConfig = {
      ...routeFollowDefaults,
      directionSampleDeltaProgress: 0.04,
      headingSmoothingProgress: 0.15,
      headingLagProgress: 0.12,
      lookAheadProgress: 0.07,
    };
    let previousLegacyHeading = cameraHeading(
      hairpinClusterPoints,
      hairpinClusterDistances,
      0,
      legacyConfig,
    );
    let maximumLegacyHeadingChangeDegrees = 0;

    for (let step = 1; step <= 1_000; step += 1) {
      const currentHeading = cameraHeading(
        hairpinGuidance.points,
        hairpinGuidance.cumulativeDistances,
        step / 1_000,
        routeFollowDefaults,
      );
      maximumHeadingChangeDegrees = Math.max(
        maximumHeadingChangeDegrees,
        angleBetweenDegrees(previousHeading, currentHeading),
      );
      const currentLegacyHeading = cameraHeading(
        hairpinClusterPoints,
        hairpinClusterDistances,
        step / 1_000,
        legacyConfig,
      );
      maximumLegacyHeadingChangeDegrees = Math.max(
        maximumLegacyHeadingChangeDegrees,
        angleBetweenDegrees(previousLegacyHeading, currentLegacyHeading),
      );
      previousHeading = currentHeading;
      previousLegacyHeading = currentLegacyHeading;
    }

    // The tuned guidance path measures 0.531 degrees at 0.001 progress steps.
    // A 0.75-degree cap rejects visible snaps while retaining margin for
    // deterministic floating-point variation and reaction to each hairpin.
    expect(maximumHeadingChangeDegrees).toBeLessThan(0.75);
    expect(maximumHeadingChangeDegrees).toBeLessThan(
      maximumLegacyHeadingChangeDegrees,
    );
  });

  it('keeps guidance-based position and target movement free of spikes', () => {
    let previousPosition = computeRouteFollowCameraPosition(
      hairpinGuidance.points,
      hairpinGuidance.cumulativeDistances,
      0,
      routeFollowDefaults,
    );
    let previousTarget = computeRouteFollowLookAtTarget(
      hairpinGuidance.points,
      hairpinGuidance.cumulativeDistances,
      0,
      routeFollowDefaults,
    );
    let previousPositionMovement = 0;
    let previousTargetMovement = 0;
    let maximumPositionMovement = 0;
    let maximumTargetMovement = 0;
    let maximumPositionMovementChange = 0;
    let maximumTargetMovementChange = 0;

    for (let step = 1; step <= 1_000; step += 1) {
      const progress = step / 1_000;
      const position = computeRouteFollowCameraPosition(
        hairpinGuidance.points,
        hairpinGuidance.cumulativeDistances,
        progress,
        routeFollowDefaults,
      );
      const target = computeRouteFollowLookAtTarget(
        hairpinGuidance.points,
        hairpinGuidance.cumulativeDistances,
        progress,
        routeFollowDefaults,
      );
      const positionMovement = lengthVec3(
        subtractVec3(position, previousPosition),
      );
      const targetMovement = lengthVec3(subtractVec3(target, previousTarget));

      maximumPositionMovement = Math.max(
        maximumPositionMovement,
        positionMovement,
      );
      maximumTargetMovement = Math.max(maximumTargetMovement, targetMovement);
      if (step > 1) {
        maximumPositionMovementChange = Math.max(
          maximumPositionMovementChange,
          Math.abs(positionMovement - previousPositionMovement),
        );
        maximumTargetMovementChange = Math.max(
          maximumTargetMovementChange,
          Math.abs(targetMovement - previousTargetMovement),
        );
      }

      previousPosition = position;
      previousTarget = target;
      previousPositionMovement = positionMovement;
      previousTargetMovement = targetMovement;
    }

    // The measured maxima are 3.135 m for position and 0.446 m for target.
    // The 300 m chase distance magnifies heading changes at the camera, so the
    // caps retain modest margin while rejecting abrupt multi-step spikes.
    expect(maximumPositionMovement).toBeLessThan(3.5);
    expect(maximumTargetMovement).toBeLessThan(0.75);
    expect(maximumPositionMovementChange).toBeLessThan(1);
    expect(maximumTargetMovementChange).toBeLessThan(0.5);
  });

  it('keeps tuned look-ahead finite and clamped at the guidance route end', () => {
    const endTarget = computeRouteFollowLookAtTarget(
      hairpinGuidance.points,
      hairpinGuidance.cumulativeDistances,
      1,
      routeFollowDefaults,
    );
    const afterEndTarget = computeRouteFollowLookAtTarget(
      hairpinGuidance.points,
      hairpinGuidance.cumulativeDistances,
      1 + routeFollowDefaults.lookAheadProgress,
      routeFollowDefaults,
    );

    for (const progress of [0.94, 0.97, 0.99, 1]) {
      const target = computeRouteFollowLookAtTarget(
        hairpinGuidance.points,
        hairpinGuidance.cumulativeDistances,
        progress,
        routeFollowDefaults,
      );
      expect(Object.values(target).every(Number.isFinite)).toBe(true);
    }
    expect(afterEndTarget).toEqual(endTarget);
    expect(endTarget).toEqual({
      ...hairpinGuidance.points[hairpinGuidance.points.length - 1],
      y: hairpinGuidance.points[hairpinGuidance.points.length - 1].y
        + routeFollowDefaults.targetLiftMeters,
    });
  });

  it.each([0, 1])(
    'falls back to +Z for a degenerate direction sample at progress %s',
    (progress) => {
      expect(
        computeRouteDirection(
          worldRoutePoints,
          cumulativeDistances,
          progress,
          0,
        ),
      ).toEqual({ x: 0, y: 0, z: 1 });
    },
  );

  it('falls back to +Z when a finite endpoint window has no displacement', () => {
    const stationaryPoints: Vec3[] = [
      { x: 3, y: 4, z: 5 },
      { x: 3, y: 4, z: 5 },
    ];

    expect(
      computeRouteDirection(
        stationaryPoints,
        computeCumulativeDistances(stationaryPoints),
        1,
        0.05,
      ),
    ).toEqual({ x: 0, y: 0, z: 1 });
  });

  it('keeps position height within the neighboring route y range plus lift', () => {
    const totalDistance = cumulativeDistances[cumulativeDistances.length - 1];

    for (let step = 0; step <= 100; step += 1) {
      const progress = step / 100;
      const targetDistance = progress * totalDistance;
      const upperIndex = Math.min(
        cumulativeDistances.findIndex((distance) => distance >= targetDistance),
        worldRoutePoints.length - 1,
      );
      const lowerIndex = Math.max(0, upperIndex - 1);
      const lowerY = Math.min(
        worldRoutePoints[lowerIndex].y,
        worldRoutePoints[upperIndex].y,
      );
      const upperY = Math.max(
        worldRoutePoints[lowerIndex].y,
        worldRoutePoints[upperIndex].y,
      );
      const position = computeRouteFollowCameraPosition(
        worldRoutePoints,
        cumulativeDistances,
        progress,
        config,
      );

      expect(position.y).toBeGreaterThanOrEqual(lowerY + config.heightMeters);
      expect(position.y).toBeLessThanOrEqual(upperY + config.heightMeters);
    }
  });

  it('smooths a sharp local turn differently from the raw tangent', () => {
    const sharpTurnPoints: Vec3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 50 },
      { x: 80, y: 0, z: 50 },
    ];
    const sharpTurnDistances = computeCumulativeDistances(sharpTurnPoints);
    const progressJustAfterTurn = 52 / 130;
    const rawDirection = computeRouteDirection(
      sharpTurnPoints,
      sharpTurnDistances,
      progressJustAfterTurn,
      0.01,
    );
    const smoothedHeading = computeSmoothedRouteHeading(
      sharpTurnPoints,
      sharpTurnDistances,
      progressJustAfterTurn,
      config.headingSmoothingProgress,
    );
    const alignment = rawDirection.x * smoothedHeading.x
      + rawDirection.y * smoothedHeading.y
      + rawDirection.z * smoothedHeading.z;

    expect(alignment).toBeLessThan(0.9);
  });

  it('breaks current-anchor fixation while traversing a curved section', () => {
    const structuralConfig: RouteFollowConfig = {
      ...routeFollowDefaults,
      heightMeters: 0,
      targetLiftMeters: 0,
    };
    const progressSamples = [0.28, 0.34, 0.4, 0.46, 0.52, 0.58, 0.64, 0.7];
    const anchorAngles = progressSamples.map((progress) => {
      const anchor = computeRouteFollowAnchor(
        curvedRoutePoints,
        curvedRouteDistances,
        progress,
      );
      const position = computeRouteFollowCameraPosition(
        curvedRoutePoints,
        curvedRouteDistances,
        progress,
        structuralConfig,
      );
      const target = computeRouteFollowLookAtTarget(
        curvedRoutePoints,
        curvedRouteDistances,
        progress,
        structuralConfig,
      );

      return angleBetweenDegrees(
        subtractVec3(target, position),
        subtractVec3(anchor, position),
      );
    });
    const minimumCurvedAngle = Math.min(...anchorAngles);
    const maximumCurvedAngle = Math.max(...anchorAngles);
    const angleSpread = Math.max(...anchorAngles) - minimumCurvedAngle;

    expect(minimumCurvedAngle).toBeGreaterThan(1);
    expect(maximumCurvedAngle).toBeGreaterThan(1.75);
    expect(angleSpread).toBeGreaterThan(0.5);
  });

  it('increases lateral parallax on a curve while retaining a straight baseline', () => {
    const lateralOnlyConfig: RouteFollowConfig = {
      ...routeFollowDefaults,
      behindMeters: 0,
      heightMeters: 0,
    };
    const effectiveLateralOffsetAt = (progress: number) => {
      const anchor = computeRouteFollowAnchor(
        curvedRoutePoints,
        curvedRouteDistances,
        progress,
      );
      const position = computeRouteFollowCameraPosition(
        curvedRoutePoints,
        curvedRouteDistances,
        progress,
        lateralOnlyConfig,
      );

      return Math.hypot(position.x - anchor.x, position.z - anchor.z);
    };
    const straightOffset = effectiveLateralOffsetAt(0.1);
    const curvedOffset = effectiveLateralOffsetAt(0.55);

    expect(straightOffset).toBeGreaterThan(0);
    expect(straightOffset).toBeLessThan(lateralOnlyConfig.lateralOffsetMeters);
    // The narrower tuned trend window still restores clear curve parallax;
    // it measures 1.215x the straight baseline on this structural fixture.
    expect(curvedOffset).toBeGreaterThan(straightOffset * 1.15);
  });

  it('keeps the current anchor within a conservative angular field of view', () => {
    const progressSamples = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
    const anchorAngles = progressSamples.map((progress) => {
      const anchor = computeRouteFollowAnchor(
        curvedRoutePoints,
        curvedRouteDistances,
        progress,
      );
      const position = computeRouteFollowCameraPosition(
        curvedRoutePoints,
        curvedRouteDistances,
        progress,
        routeFollowDefaults,
      );
      const target = computeRouteFollowLookAtTarget(
        curvedRoutePoints,
        curvedRouteDistances,
        progress,
        routeFollowDefaults,
      );

      return angleBetweenDegrees(
        subtractVec3(target, position),
        subtractVec3(anchor, position),
      );
    });

    expect(Math.max(...anchorAngles)).toBeLessThan(20);
  });

  it('composes curved-route aim from the route anchor and smoothed heading', () => {
    const sharpTurnPoints: Vec3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 50 },
      { x: 80, y: 0, z: 50 },
    ];
    const sharpTurnDistances = computeCumulativeDistances(sharpTurnPoints);
    const progress = 0.36;
    const target = computeRouteFollowLookAtTarget(
      sharpTurnPoints,
      sharpTurnDistances,
      progress,
      config,
    );
    const routeOnlyTarget = computeRouteFollowAnchor(
      sharpTurnPoints,
      sharpTurnDistances,
      progress + config.lookAheadProgress,
    );

    expect(
      Math.hypot(
        target.x - routeOnlyTarget.x,
        target.z - routeOnlyTarget.z,
      ),
    ).toBeGreaterThan(0.1);
  });

  it('uses the terminal point returned by Phase 2 getPartialRoutePoints unchanged', () => {
    const progress = 0.43;
    const partialRoute = getPartialRoutePoints(
      worldRoutePoints,
      cumulativeDistances,
      progress,
    );

    expect(
      computeRouteFollowAnchor(
        worldRoutePoints,
        cumulativeDistances,
        progress,
      ),
    ).toStrictEqual(partialRoute[partialRoute.length - 1]);
  });
});
