import { describe, expect, it } from 'vitest';

import type { Vec3 } from '../types';
import { takaoTrail1Route } from './takaoTrail1Route';
import {
  computeApproximateRouteProgressForIndex,
  computeCumulativeDistances,
  computeRouteProgressForPoiId,
  findRoutePointAtProgress,
  getPartialRoutePoints,
} from './routeProgress';

describe('computeCumulativeDistances', () => {
  it('accumulates 3D euclidean distances starting from 0 at points[0]', () => {
    // (0,0,0) -> (3,0,4): 距離5 (3-4-5の直角三角形)
    // (3,0,4) -> (3,0,8): 距離4 (z方向のみの移動)
    const points: Vec3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 3, y: 0, z: 4 },
      { x: 3, y: 0, z: 8 },
    ];

    expect(computeCumulativeDistances(points)).toEqual([0, 5, 9]);
  });

  it('returns [0] for a single point', () => {
    expect(computeCumulativeDistances([{ x: 1, y: 2, z: 3 }])).toEqual([0]);
  });

  it('returns [] for an empty array', () => {
    expect(computeCumulativeDistances([])).toEqual([]);
  });
});

describe('getPartialRoutePoints', () => {
  // y方向のみを変化させたシンプルな4点。累積距離は [0, 10, 30, 50]。
  const linearPoints: Vec3[] = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 10, z: 0 },
    { x: 0, y: 30, z: 0 },
    { x: 0, y: 50, z: 0 },
  ];
  const linearDistances = computeCumulativeDistances(linearPoints);

  // x, y, zすべてが単調に増加する、麓→山頂を模した点列。
  const monotonicPoints: Vec3[] = [
    { x: 0, y: 0, z: 0 },
    { x: 5, y: 5, z: 5 },
    { x: 10, y: 15, z: 15 },
    { x: 15, y: 30, z: 20 },
    { x: 20, y: 40, z: 30 },
  ];
  const monotonicDistances = computeCumulativeDistances(monotonicPoints);

  it('returns only points[0] at progress 0', () => {
    expect(getPartialRoutePoints(linearPoints, linearDistances, 0)).toEqual([
      linearPoints[0],
    ]);
  });

  it('returns an empty array at progress 0 when points is empty', () => {
    expect(getPartialRoutePoints([], [0], 0)).toEqual([]);
  });

  it('returns all points, in the same order, at progress 1', () => {
    const result = getPartialRoutePoints(linearPoints, linearDistances, 1);
    expect(result).toEqual(linearPoints);
  });

  it('interpolates a point at the 50% cumulative-distance mark for progress 0.5', () => {
    // total = 50, target = 25。区間 [10, 30] (points[1] -> points[2]) の
    // 75%地点: y = 10 + (30 - 10) * 0.75 = 25
    const result = getPartialRoutePoints(linearPoints, linearDistances, 0.5);

    expect(result).toEqual([
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 10, z: 0 },
      { x: 0, y: 25, z: 0 },
    ]);

    const last = result[result.length - 1];
    expect(last.y).toBeGreaterThanOrEqual(linearPoints[1].y);
    expect(last.y).toBeLessThanOrEqual(linearPoints[2].y);
  });

  it('always returns points ordered from the foot (points[0]) toward the summit, never reversed', () => {
    const result = getPartialRoutePoints(
      monotonicPoints,
      monotonicDistances,
      0.6,
    );

    expect(result[0]).toEqual(monotonicPoints[0]);

    for (let i = 1; i < result.length; i += 1) {
      expect(result[i].y).toBeGreaterThanOrEqual(result[i - 1].y);
      expect(result[i].z).toBeGreaterThanOrEqual(result[i - 1].z);
    }
  });

  it('clamps out-of-range progress values instead of throwing', () => {
    expect(() =>
      getPartialRoutePoints(linearPoints, linearDistances, -0.5),
    ).not.toThrow();
    expect(() =>
      getPartialRoutePoints(linearPoints, linearDistances, 1.5),
    ).not.toThrow();

    expect(getPartialRoutePoints(linearPoints, linearDistances, -0.5)).toEqual(
      getPartialRoutePoints(linearPoints, linearDistances, 0),
    );
    expect(getPartialRoutePoints(linearPoints, linearDistances, 1.5)).toEqual(
      getPartialRoutePoints(linearPoints, linearDistances, 1),
    );
  });
});

describe('findRoutePointAtProgress', () => {
  // y方向のみを変化させた点列。累積距離は [0, 10, 30, 50]。
  const points: Vec3[] = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 10, z: 0 },
    { x: 0, y: 30, z: 0 },
    { x: 0, y: 50, z: 0 },
  ];
  const distances = computeCumulativeDistances(points);

  function findRoutePointByLinearSearch(progress: number): Vec3 {
    const clampedProgress = Math.min(Math.max(progress, 0), 1);
    if (points.length === 0) {
      return { x: 0, y: 0, z: 0 };
    }
    if (points.length === 1) {
      return { ...points[0] };
    }

    const totalDistance = distances[distances.length - 1];
    if (clampedProgress <= 0 || totalDistance <= 0) {
      return { ...points[0] };
    }
    if (clampedProgress >= 1) {
      return { ...points[points.length - 1] };
    }

    const targetDistance = clampedProgress * totalDistance;
    let upperIndex = 1;
    while (distances[upperIndex] < targetDistance) {
      upperIndex += 1;
    }

    const lowerIndex = upperIndex - 1;
    const segmentDistance = distances[upperIndex] - distances[lowerIndex];
    const t = segmentDistance === 0
      ? 0
      : (targetDistance - distances[lowerIndex]) / segmentDistance;

    return {
      x: points[lowerIndex].x
        + (points[upperIndex].x - points[lowerIndex].x) * t,
      y: points[lowerIndex].y
        + (points[upperIndex].y - points[lowerIndex].y) * t,
      z: points[lowerIndex].z
        + (points[upperIndex].z - points[lowerIndex].z) * t,
    };
  }

  it('returns exactly the terminal point of getPartialRoutePoints for fixed and random progress values', () => {
    let randomState = 0x1234_5678;
    const randomProgresses = Array.from({ length: 10 }, () => {
      randomState = (randomState * 1_664_525 + 1_013_904_223) >>> 0;
      return randomState / 0x1_0000_0000;
    });

    for (const progress of [
      0,
      0.001,
      0.25,
      0.5,
      0.75,
      0.999,
      1,
      ...randomProgresses,
    ]) {
      const partial = getPartialRoutePoints(points, distances, progress);
      expect(findRoutePointAtProgress(points, distances, progress)).toEqual(
        partial[partial.length - 1],
      );
    }
  });

  it('matches a simple linear search', () => {
    for (let step = 0; step <= 100; step += 1) {
      const progress = step / 100;
      expect(findRoutePointAtProgress(points, distances, progress)).toEqual(
        findRoutePointByLinearSearch(progress),
      );
    }
  });

  it('handles empty, single-point, and zero-total-distance routes', () => {
    expect(findRoutePointAtProgress([], [], 0.5)).toEqual({
      x: 0,
      y: 0,
      z: 0,
    });

    const singlePoint = { x: 1, y: 2, z: 3 };
    expect(findRoutePointAtProgress([singlePoint], [0], 0.5)).toEqual(
      singlePoint,
    );

    const stationaryPoints: Vec3[] = [
      { x: 3, y: 4, z: 5 },
      { x: 3, y: 4, z: 5 },
    ];
    const stationaryDistances = computeCumulativeDistances(stationaryPoints);
    const partial = getPartialRoutePoints(
      stationaryPoints,
      stationaryDistances,
      0.5,
    );
    expect(
      findRoutePointAtProgress(stationaryPoints, stationaryDistances, 0.5),
    ).toEqual(partial[partial.length - 1]);
  });
});

describe('route progress for route points of interest', () => {
  const poiIds = [
    'kiyotaki',
    'takaosanguchi_kasumidai',
    'joshinmon',
    'otokozaka_onnazaka',
    'yakuoin',
    'summit',
  ];

  it('returns 0 at the first index and 1 at the final index', () => {
    expect(computeApproximateRouteProgressForIndex(takaoTrail1Route, 0)).toBeCloseTo(0);
    expect(
      computeApproximateRouteProgressForIndex(
        takaoTrail1Route,
        takaoTrail1Route.points.length - 1,
      ),
    ).toBeCloseTo(1);
  });

  it('returns a finite 0..1 progress value for every known point of interest', () => {
    for (const poiId of poiIds) {
      const progress = computeRouteProgressForPoiId(takaoTrail1Route, poiId);

      expect(progress).toBeDefined();
      expect(progress).toSatisfy(
        (value) => Number.isFinite(value) && value >= 0 && value <= 1,
      );
    }
  });

  it('returns undefined for an unknown point of interest', () => {
    expect(
      computeRouteProgressForPoiId(takaoTrail1Route, 'nonexistent'),
    ).toBeUndefined();
  });

  it('returns progress values in the expected route order', () => {
    const progresses = poiIds.map((poiId) =>
      computeRouteProgressForPoiId(takaoTrail1Route, poiId),
    );

    for (let index = 1; index < progresses.length; index += 1) {
      expect(progresses[index]).toBeGreaterThan(progresses[index - 1]!);
    }
  });
});
