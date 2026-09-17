import { describe, expect, it } from 'vitest';

import { cameraGuidanceDefaults } from '../config/defaults/cameraGuidance';
import type { Vec3 } from '../types';
import {
  computeCameraGuidancePath,
  resampleByArcLength,
} from './routeGuidance';
import { computeCumulativeDistances } from './routeProgress';

function distanceBetween(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function pointAtProgress(
  points: Vec3[],
  cumulativeDistances: number[],
  progress: number,
): Vec3 {
  const targetDistance =
    progress * cumulativeDistances[cumulativeDistances.length - 1];
  let endIndex = 1;
  while (
    endIndex < cumulativeDistances.length - 1 &&
    cumulativeDistances[endIndex] < targetDistance
  ) {
    endIndex += 1;
  }

  const startIndex = endIndex - 1;
  const startDistance = cumulativeDistances[startIndex];
  const segmentDistance = cumulativeDistances[endIndex] - startDistance;
  const t = segmentDistance === 0
    ? 0
    : (targetDistance - startDistance) / segmentDistance;

  return {
    x: points[startIndex].x + (points[endIndex].x - points[startIndex].x) * t,
    y: points[startIndex].y + (points[endIndex].y - points[startIndex].y) * t,
    z: points[startIndex].z + (points[endIndex].z - points[startIndex].z) * t,
  };
}

function densifyPolyline(points: Vec3[], subdivisions: number): Vec3[] {
  const densePoints: Vec3[] = [];
  for (let segmentIndex = 1; segmentIndex < points.length; segmentIndex += 1) {
    const start = points[segmentIndex - 1];
    const end = points[segmentIndex];
    for (let step = 0; step < subdivisions; step += 1) {
      const t = step / subdivisions;
      densePoints.push({
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
        z: start.z + (end.z - start.z) * t,
      });
    }
  }
  densePoints.push(points[points.length - 1]);
  return densePoints;
}

function maxHeadingChange(points: Vec3[]): number {
  let maximumChange = 0;
  for (let index = 2; index < points.length; index += 1) {
    const previousHeading = Math.atan2(
      points[index - 1].z - points[index - 2].z,
      points[index - 1].x - points[index - 2].x,
    );
    const nextHeading = Math.atan2(
      points[index].z - points[index - 1].z,
      points[index].x - points[index - 1].x,
    );
    const wrappedDifference = Math.atan2(
      Math.sin(nextHeading - previousHeading),
      Math.cos(nextHeading - previousHeading),
    );
    maximumChange = Math.max(maximumChange, Math.abs(wrappedDifference));
  }
  return maximumChange;
}

describe('computeCameraGuidancePath', () => {
  it('pins both endpoints and returns strictly increasing cumulative distances', () => {
    const points: Vec3[] = [
      { x: 0, y: 10, z: 0 },
      { x: 50, y: 14, z: 0 },
      { x: 50, y: 18, z: 45 },
      { x: 100, y: 25, z: 45 },
    ];
    const guidancePath = computeCameraGuidancePath(
      points,
      computeCumulativeDistances(points),
      cameraGuidanceDefaults,
    );

    expect(guidancePath.points[0]).toEqual(points[0]);
    expect(guidancePath.points[guidancePath.points.length - 1]).toEqual(
      points[points.length - 1],
    );
    for (
      let index = 1;
      index < guidancePath.cumulativeDistances.length;
      index += 1
    ) {
      expect(guidancePath.cumulativeDistances[index]).toBeGreaterThan(
        guidancePath.cumulativeDistances[index - 1],
      );
    }
  });

  it('clamps every smoothed point to the configured deviation from its raw sample', () => {
    const points: Vec3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 45, y: 4, z: 0 },
      { x: 45, y: 8, z: 35 },
      { x: 5, y: 12, z: 35 },
      { x: 5, y: 16, z: 70 },
      { x: 55, y: 20, z: 70 },
    ];
    const cumulativeDistances = computeCumulativeDistances(points);
    const resampledPoints = resampleByArcLength(
      points,
      cumulativeDistances,
      cameraGuidanceDefaults.resampleSpacingMeters,
    );
    const guidancePath = computeCameraGuidancePath(
      points,
      cumulativeDistances,
      cameraGuidanceDefaults,
    );

    expect(guidancePath.points).toHaveLength(resampledPoints.length);
    guidancePath.points.forEach((point, index) => {
      expect(distanceBetween(point, resampledPoints[index])).toBeLessThanOrEqual(
        cameraGuidanceDefaults.maxDeviationMeters + 1e-9,
      );
    });
  });

  it('is nearly independent of source point density for the same polyline', () => {
    const coarsePoints: Vec3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 90, y: 9, z: 0 },
      { x: 90, y: 18, z: 70 },
      { x: 170, y: 27, z: 70 },
      { x: 170, y: 36, z: 150 },
    ];
    const densePoints = densifyPolyline(coarsePoints, 9);
    const coarseGuidance = computeCameraGuidancePath(
      coarsePoints,
      computeCumulativeDistances(coarsePoints),
      cameraGuidanceDefaults,
    );
    const denseGuidance = computeCameraGuidancePath(
      densePoints,
      computeCumulativeDistances(densePoints),
      cameraGuidanceDefaults,
    );

    for (const progress of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      const coarsePoint = pointAtProgress(
        coarseGuidance.points,
        coarseGuidance.cumulativeDistances,
        progress,
      );
      const densePoint = pointAtProgress(
        denseGuidance.points,
        denseGuidance.cumulativeDistances,
        progress,
      );
      expect(distanceBetween(coarsePoint, densePoint)).toBeLessThan(0.01);
    }
  });

  it('reduces heading changes through a dense synthetic hairpin cluster', () => {
    const hairpinPoints: Vec3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 80, y: 2, z: 0 },
      { x: 80, y: 4, z: 22 },
      { x: 20, y: 6, z: 22 },
      { x: 20, y: 8, z: 44 },
      { x: 80, y: 10, z: 44 },
      { x: 80, y: 12, z: 66 },
      { x: 20, y: 14, z: 66 },
      { x: 20, y: 16, z: 88 },
      { x: 120, y: 18, z: 88 },
    ];
    const guidancePath = computeCameraGuidancePath(
      hairpinPoints,
      computeCumulativeDistances(hairpinPoints),
      cameraGuidanceDefaults,
    );

    expect(maxHeadingChange(guidancePath.points)).toBeLessThan(
      maxHeadingChange(hairpinPoints),
    );
  });
});
