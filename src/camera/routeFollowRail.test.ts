import { describe, expect, it } from 'vitest';

import { cameraGuidanceDefaults } from '../config/defaults/cameraGuidance';
import { cinematicRailDefaults } from '../config/defaults/cameraRail';
import { latLngToVec3 } from '../geo/coords';
import { computeCameraGuidancePath } from '../route/routeGuidance';
import type { CinematicRailConfig, Vec3 } from '../types';
import { computeCumulativeDistances } from '../route/routeProgress';
import { takaoTrail1Route } from '../route/takaoTrail1Route';
import {
  lengthVec3,
  normalizeVec3,
  subtractVec3,
} from '../utils/vecMath';
import { computeRouteFollowAnchor } from './routeFollowCamera';
import {
  buildCameraRail,
  evaluateRailPosition,
  evaluateRailTarget,
} from './routeFollowRail';

const worldRoutePoints: Vec3[] = [
  { x: 0, y: 40, z: 0 },
  { x: 50, y: 58, z: 180 },
  { x: 130, y: 82, z: 390 },
  { x: 250, y: 110, z: 610 },
  { x: 430, y: 138, z: 790 },
  { x: 650, y: 165, z: 900 },
  { x: 820, y: 190, z: 1_040 },
  { x: 930, y: 222, z: 1_250 },
  { x: 1_080, y: 260, z: 1_430 },
  { x: 1_260, y: 310, z: 1_580 },
];
const cumulativeDistances = computeCumulativeDistances(worldRoutePoints);
const guidancePoints: Vec3[] = [
  { x: 0, y: 40, z: 0 },
  { x: 80, y: 65, z: 250 },
  { x: 220, y: 100, z: 540 },
  { x: 440, y: 140, z: 800 },
  { x: 700, y: 175, z: 960 },
  { x: 900, y: 215, z: 1_220 },
  { x: 1_080, y: 260, z: 1_430 },
  { x: 1_260, y: 310, z: 1_580 },
];
const guidanceCumulativeDistances = computeCumulativeDistances(guidancePoints);
const takaoRouteOrigin = takaoTrail1Route.points[0];
const takaoWorldRoutePoints = takaoTrail1Route.points.map((point, index) => ({
  ...latLngToVec3(point, takaoRouteOrigin, 1),
  // DEMはこのrail診断の対象外なので、実routeの登高を線形標高で近似する。
  y: 200 + 400 * index / (takaoTrail1Route.points.length - 1),
}));
const takaoCumulativeDistances = computeCumulativeDistances(
  takaoWorldRoutePoints,
);
const takaoGuidance = computeCameraGuidancePath(
  takaoWorldRoutePoints,
  takaoCumulativeDistances,
  cameraGuidanceDefaults,
);
const takaoCameraRail = buildCameraRail(
  takaoWorldRoutePoints,
  takaoCumulativeDistances,
  takaoGuidance.points,
  takaoGuidance.cumulativeDistances,
  cinematicRailDefaults,
);
function buildFixtureRail(config: CinematicRailConfig = cinematicRailDefaults) {
  return buildCameraRail(
    worldRoutePoints,
    cumulativeDistances,
    guidancePoints,
    guidanceCumulativeDistances,
    config,
  );
}

function distanceBetween(a: Vec3, b: Vec3): number {
  return lengthVec3(subtractVec3(a, b));
}

function horizontalDistanceBetween(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function angleBetweenDegrees(a: Vec3, b: Vec3): number {
  const normalizedA = normalizeVec3(a);
  const normalizedB = normalizeVec3(b);
  const dot = normalizedA.x * normalizedB.x
    + normalizedA.y * normalizedB.y
    + normalizedA.z * normalizedB.z;

  return Math.acos(Math.min(1, Math.max(-1, dot))) * 180 / Math.PI;
}

function measureMaximumHeadingChange(
  rail: ReturnType<typeof buildCameraRail>,
  startProgress: number,
  endProgress: number,
): { degrees: number; progress: number } {
  const sampleStep = 0.001;
  const sampleCount = Math.round(
    (endProgress - startProgress) / sampleStep,
  );
  let previousPosition = evaluateRailPosition(rail, startProgress);
  let previousHeading: Vec3 | undefined;
  let maximum = { degrees: 0, progress: startProgress };

  for (let step = 1; step <= sampleCount; step += 1) {
    const progress = startProgress + step * sampleStep;
    const position = evaluateRailPosition(rail, progress);
    const heading = subtractVec3(position, previousPosition);

    if (previousHeading) {
      const degrees = angleBetweenDegrees(previousHeading, heading);
      if (degrees > maximum.degrees) {
        maximum = { degrees, progress };
      }
    }
    previousPosition = position;
    previousHeading = heading;
  }

  return maximum;
}

describe('route-follow cinematic rail', () => {
  it('builds one position and target key for each configured key pose', () => {
    const rail = buildFixtureRail();

    expect(cinematicRailDefaults.keyPoses).toHaveLength(13);
    expect(rail.keyProgressValues).toEqual(
      cinematicRailDefaults.keyPoses.map((keyPose) => keyPose.progress),
    );
    expect(rail.positionKeys).toHaveLength(
      cinematicRailDefaults.keyPoses.length,
    );
    expect(rail.targetKeys).toHaveLength(
      cinematicRailDefaults.keyPoses.length,
    );
  });

  it('pulls landmark-weighted targets toward Yakuoin and the summit', () => {
    const weightedRail = buildFixtureRail();
    const unweightedConfig: CinematicRailConfig = {
      keyPoses: cinematicRailDefaults.keyPoses.map((keyPose) => ({
        ...keyPose,
        landmarkWeight: 0,
      })),
    };
    const unweightedRail = buildFixtureRail(unweightedConfig);
    const yakuoin = computeRouteFollowAnchor(
      worldRoutePoints,
      cumulativeDistances,
      0.780,
    );
    const summit = worldRoutePoints[worldRoutePoints.length - 1];

    expect(
      horizontalDistanceBetween(weightedRail.targetKeys[7], yakuoin),
    ).toBeLessThan(
      horizontalDistanceBetween(unweightedRail.targetKeys[7], yakuoin),
    );
    expect(
      horizontalDistanceBetween(weightedRail.targetKeys[10], summit),
    ).toBeLessThan(
      horizontalDistanceBetween(unweightedRail.targetKeys[10], summit),
    );
    expect(distanceBetween(weightedRail.targetKeys[12], summit)).toBeLessThan(
      distanceBetween(weightedRail.targetKeys[9], summit),
    );
  });

  it('keeps position and target rails finite and free of extreme movement spikes', () => {
    const rail = buildFixtureRail();
    const positionMovements: number[] = [];
    const targetMovements: number[] = [];
    let previousPosition = evaluateRailPosition(rail, 0);
    let previousTarget = evaluateRailTarget(rail, 0);

    for (let step = 1; step <= 1_000; step += 1) {
      const progress = step / 1_000;
      const position = evaluateRailPosition(rail, progress);
      const target = evaluateRailTarget(rail, progress);

      expect(Object.values(position).every(Number.isFinite)).toBe(true);
      expect(Object.values(target).every(Number.isFinite)).toBe(true);
      positionMovements.push(distanceBetween(position, previousPosition));
      targetMovements.push(distanceBetween(target, previousTarget));
      previousPosition = position;
      previousTarget = target;
    }

    const averagePositionMovement = positionMovements.reduce(
      (sum, movement) => sum + movement,
      0,
    ) / positionMovements.length;
    const averageTargetMovement = targetMovements.reduce(
      (sum, movement) => sum + movement,
      0,
    ) / targetMovements.length;

    expect(Math.max(...positionMovements)).toBeLessThan(
      averagePositionMovement * 10,
    );
    expect(Math.max(...targetMovements)).toBeLessThan(
      averageTargetMovement * 10,
    );
  });

  it('limits movement heading changes through the real-route hairpin section', () => {
    const hairpinStartProgress = 0.68;
    const hairpinEndProgress = 0.88;
    const sampleStep = 0.001;
    const sampleCount = Math.round(
      (hairpinEndProgress - hairpinStartProgress) / sampleStep,
    );
    let previousPosition = evaluateRailPosition(
      takaoCameraRail,
      hairpinStartProgress,
    );
    let previousHeading: Vec3 | undefined;
    let maximumHeadingChangeDegrees = 0;

    for (let step = 1; step <= sampleCount; step += 1) {
      const progress = hairpinStartProgress + step * sampleStep;
      const position = evaluateRailPosition(takaoCameraRail, progress);
      const heading = subtractVec3(position, previousPosition);

      if (previousHeading) {
        const headingChangeDegrees = angleBetweenDegrees(
          previousHeading,
          heading,
        );
        maximumHeadingChangeDegrees = Math.max(
          maximumHeadingChangeDegrees,
          headingChangeDegrees,
        );
      }
      previousPosition = position;
      previousHeading = heading;
    }

    expect(maximumHeadingChangeDegrees).toBeLessThanOrEqual(1.0);
  });

  it('keeps every hairpin position key separated along a one-way pass', () => {
    const hairpinProgressValues = [0.68, 0.73, 0.78, 0.83, 0.88];
    const hairpinPositionKeys = hairpinProgressValues.map((progress) => {
      const keyIndex = takaoCameraRail.keyProgressValues.indexOf(progress);

      expect(keyIndex).toBeGreaterThanOrEqual(0);
      return takaoCameraRail.positionKeys[keyIndex];
    });

    for (let left = 0; left < hairpinPositionKeys.length; left += 1) {
      for (
        let right = left + 1;
        right < hairpinPositionKeys.length;
        right += 1
      ) {
        expect(
          distanceBetween(
            hairpinPositionKeys[left],
            hairpinPositionKeys[right],
          ),
        ).toBeGreaterThan(200);
      }
    }

    expect(
      distanceBetween(
        hairpinPositionKeys[0],
        hairpinPositionKeys[hairpinPositionKeys.length - 1],
      ),
    ).toBeGreaterThan(900);
  });

  it('limits heading changes in the transitions adjacent to the hairpin', () => {
    const entryTransition = measureMaximumHeadingChange(
      takaoCameraRail,
      0.45,
      0.68,
    );
    const exitTransition = measureMaximumHeadingChange(
      takaoCameraRail,
      0.88,
      0.97,
    );

    expect(entryTransition.degrees).toBeLessThanOrEqual(1.0);
    expect(exitTransition.degrees).toBeLessThanOrEqual(1.5);
  });

  it.each([
    0.10, 0.20, 0.30, 0.45, 0.68, 0.73, 0.78, 0.83, 0.88,
    0.97, 0.985,
  ])(
    'keeps movement continuous across the %.2f spline breakpoint',
    (breakpoint) => {
      const breakpointIndex = cinematicRailDefaults.keyPoses.findIndex(
        (keyPose) => keyPose.progress === breakpoint,
      );
      const leftIntervalWidth = breakpoint
        - cinematicRailDefaults.keyPoses[breakpointIndex - 1].progress;
      const rightIntervalWidth =
        cinematicRailDefaults.keyPoses[breakpointIndex + 1].progress
        - breakpoint;
      const sampleIntervalFraction = 0.04;
      const sampleProgressDelta = Math.min(
        leftIntervalWidth,
        rightIntervalWidth,
      ) * sampleIntervalFraction;
      const before = evaluateRailPosition(
        takaoCameraRail,
        breakpoint - sampleProgressDelta,
      );
      const atBreakpoint = evaluateRailPosition(takaoCameraRail, breakpoint);
      const after = evaluateRailPosition(
        takaoCameraRail,
        breakpoint + sampleProgressDelta,
      );
      const beforeMovement = distanceBetween(atBreakpoint, before);
      const afterMovement = distanceBetween(after, atBreakpoint);
      const movementRatio = Math.max(beforeMovement, afterMovement)
        / Math.min(beforeMovement, afterMovement);

      expect(beforeMovement).toBeGreaterThan(0);
      expect(afterMovement).toBeGreaterThan(0);
      // Compare equal absolute progress distances on either side of the breakpoint.
      expect(movementRatio).toBeLessThanOrEqual(2);
    },
  );

  it('keeps the rail above its guidance anchor in every key-pose interval', () => {
    for (
      let intervalIndex = 0;
      intervalIndex < cinematicRailDefaults.keyPoses.length - 1;
      intervalIndex += 1
    ) {
      const intervalStart =
        cinematicRailDefaults.keyPoses[intervalIndex].progress;
      const intervalEnd =
        cinematicRailDefaults.keyPoses[intervalIndex + 1].progress;
      const sampleCount = Math.ceil((intervalEnd - intervalStart) / 0.001);

      for (let step = 0; step <= sampleCount; step += 1) {
        const progress = intervalStart
          + (intervalEnd - intervalStart) * step / sampleCount;
        const position = evaluateRailPosition(takaoCameraRail, progress);
        const guidanceAnchor = computeRouteFollowAnchor(
          takaoGuidance.points,
          takaoGuidance.cumulativeDistances,
          progress,
        );

        expect(position.y).toBeGreaterThanOrEqual(guidanceAnchor.y);
      }
    }
  });

  it('evaluates both rails to their exact endpoint keys', () => {
    const rail = buildFixtureRail();

    expect(evaluateRailPosition(rail, 0)).toStrictEqual(rail.positionKeys[0]);
    expect(evaluateRailPosition(rail, 1)).toStrictEqual(rail.positionKeys[12]);
    expect(evaluateRailTarget(rail, 0)).toStrictEqual(rail.targetKeys[0]);
    expect(evaluateRailTarget(rail, 1)).toStrictEqual(rail.targetKeys[12]);
  });

  it('builds finite keys when zero-weight poses omit landmarkPoiId', () => {
    const config: CinematicRailConfig = {
      keyPoses: cinematicRailDefaults.keyPoses
        .filter((keyPose) => keyPose.landmarkWeight === 0)
        .map(({ landmarkPoiId: _landmarkPoiId, ...keyPose }) => keyPose),
    };
    const rail = buildFixtureRail(config);

    expect(rail.positionKeys).toHaveLength(config.keyPoses.length);
    expect(rail.targetKeys).toHaveLength(config.keyPoses.length);
    expect(
      [...rail.positionKeys, ...rail.targetKeys]
        .every((point) => Object.values(point).every(Number.isFinite)),
    ).toBe(true);
  });
});
