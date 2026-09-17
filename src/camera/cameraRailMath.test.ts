import { describe, expect, it } from 'vitest';

import type { Vec3 } from '../types';
import { catmullRomVec3, evaluateKeyPoseRail } from './cameraRailMath';

const KEY_PROGRESS_VALUES = [0, 0.2, 0.45, 0.68, 0.78, 0.88, 0.97, 1];
const KEY_POINTS: Vec3[] = [
  { x: 0, y: 420, z: 0 },
  { x: 120, y: 470, z: 80 },
  { x: 290, y: 560, z: 170 },
  { x: 430, y: 650, z: 310 },
  { x: 500, y: 720, z: 390 },
  { x: 580, y: 780, z: 470 },
  { x: 650, y: 830, z: 540 },
  { x: 675, y: 850, z: 565 },
];

function distanceBetween(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function maximumBoundaryMovementRatio(
  progressValues: number[],
  evaluate: (progress: number) => Vec3,
  epsilon = 1e-5,
): number {
  return Math.max(...progressValues.slice(1, -1).map((boundary) => {
    const before = evaluate(boundary - epsilon);
    const atBoundary = evaluate(boundary);
    const after = evaluate(boundary + epsilon);
    const movementBefore = distanceBetween(before, atBoundary);
    const movementAfter = distanceBetween(atBoundary, after);

    return Math.max(movementBefore, movementAfter)
      / Math.min(movementBefore, movementAfter);
  }));
}

function evaluateWithUniformCatmullRom(
  progressValues: number[],
  points: Vec3[],
  progress: number,
): Vec3 {
  const lastIndex = progressValues.length - 1;
  const clampedProgress = Math.min(
    progressValues[lastIndex],
    Math.max(progressValues[0], progress),
  );
  let segmentIndex = lastIndex - 1;

  if (clampedProgress !== progressValues[lastIndex]) {
    segmentIndex = progressValues.findIndex(
      (value, index) => index > 0 && clampedProgress <= value,
    ) - 1;
  }

  const segmentStart = progressValues[segmentIndex];
  const localT = (clampedProgress - segmentStart)
    / (progressValues[segmentIndex + 1] - segmentStart);

  return catmullRomVec3(
    points[Math.max(0, segmentIndex - 1)],
    points[segmentIndex],
    points[segmentIndex + 1],
    points[Math.min(points.length - 1, segmentIndex + 2)],
    localT,
  );
}

describe('catmullRomVec3', () => {
  it('returns p1 at t=0 and p2 at t=1 exactly', () => {
    const p0 = { x: -130, y: 415, z: 72 };
    const p1 = { x: 18, y: 490, z: -44 };
    const p2 = { x: 205, y: 635, z: 133 };
    const p3 = { x: 370, y: 810, z: 296 };

    expect(catmullRomVec3(p0, p1, p2, p3, 0)).toEqual(p1);
    expect(catmullRomVec3(p0, p1, p2, p3, 1)).toEqual(p2);
  });

  it('moves monotonically along evenly spaced collinear points', () => {
    const p0 = { x: 0, y: 0, z: 0 };
    const p1 = { x: 10, y: 0, z: 0 };
    const p2 = { x: 20, y: 0, z: 0 };
    const p3 = { x: 30, y: 0, z: 0 };
    let previousX = p1.x;

    for (let step = 0; step <= 100; step += 1) {
      const point = catmullRomVec3(p0, p1, p2, p3, step / 100);

      expect(point.y).toBe(0);
      expect(point.z).toBe(0);
      expect(point.x).toBeGreaterThanOrEqual(previousX);
      previousX = point.x;
    }
  });
});

describe('evaluateKeyPoseRail', () => {
  it('returns both endpoint key poses exactly', () => {
    expect(evaluateKeyPoseRail(KEY_PROGRESS_VALUES, KEY_POINTS, 0)).toEqual(
      KEY_POINTS[0],
    );
    expect(evaluateKeyPoseRail(KEY_PROGRESS_VALUES, KEY_POINTS, 1)).toEqual(
      KEY_POINTS[KEY_POINTS.length - 1],
    );
  });

  it('clamps progress outside the rail range to its endpoint poses', () => {
    expect(evaluateKeyPoseRail(KEY_PROGRESS_VALUES, KEY_POINTS, -0.25)).toEqual(
      KEY_POINTS[0],
    );
    expect(evaluateKeyPoseRail(KEY_PROGRESS_VALUES, KEY_POINTS, 1.4)).toEqual(
      KEY_POINTS[KEY_POINTS.length - 1],
    );
  });

  it('returns safe results for empty and single-key rails', () => {
    expect(evaluateKeyPoseRail([], [], 0.5)).toEqual({ x: 0, y: 0, z: 0 });

    const onlyPoint = { x: 15, y: 25, z: 35 };
    expect(evaluateKeyPoseRail([0.4], [onlyPoint], 0.9)).toEqual(onlyPoint);
    expect(evaluateKeyPoseRail([], [onlyPoint], 0.9)).toEqual(onlyPoint);
  });

  it('avoids division by zero for a near-zero progress segment', () => {
    const progressValues = [0, 0.5, 0.5 + 1e-13, 1];
    const points: Vec3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 20, z: 30 },
      { x: 20, y: 40, z: 60 },
      { x: 30, y: 60, z: 90 },
    ];

    expect(evaluateKeyPoseRail(progressValues, points, 0.5 + 5e-14)).toEqual(
      points[1],
    );
  });

  it('has no sharp movement spikes across a fine scan of the eight-key rail', () => {
    const movements: number[] = [];
    let previousPoint = evaluateKeyPoseRail(
      KEY_PROGRESS_VALUES,
      KEY_POINTS,
      0,
    );

    for (let step = 1; step <= 1000; step += 1) {
      const point = evaluateKeyPoseRail(
        KEY_PROGRESS_VALUES,
        KEY_POINTS,
        step / 1000,
      );
      movements.push(distanceBetween(previousPoint, point));
      previousPoint = point;
    }

    const averageMovement = movements.reduce((sum, value) => sum + value, 0)
      / movements.length;
    const maximumMovement = Math.max(...movements);

    expect(maximumMovement).toBeLessThan(averageMovement * 10);
  });

  it('keeps movement changes below 2x across internal segment boundaries', () => {
    const epsilon = 1e-4;

    for (const boundary of KEY_PROGRESS_VALUES.slice(1, -1)) {
      const before = evaluateKeyPoseRail(
        KEY_PROGRESS_VALUES,
        KEY_POINTS,
        boundary - epsilon,
      );
      const atBoundary = evaluateKeyPoseRail(
        KEY_PROGRESS_VALUES,
        KEY_POINTS,
        boundary,
      );
      const after = evaluateKeyPoseRail(
        KEY_PROGRESS_VALUES,
        KEY_POINTS,
        boundary + epsilon,
      );
      const movementBefore = distanceBetween(before, atBoundary);
      const movementAfter = distanceBetween(atBoundary, after);
      const movementRatio = Math.max(movementBefore, movementAfter)
        / Math.min(movementBefore, movementAfter);

      expect(movementRatio).toBeLessThan(2);
    }
  });

  it('improves boundary movement continuity for extremely uneven progress intervals', () => {
    const progressValues = [0, 0.02, 0.05, 0.9, 0.95, 1];
    const points = progressValues.map((value) => ({
      x: value * 100,
      y: value * 40,
      z: value * -20,
    }));
    const oldUniformRatio = maximumBoundaryMovementRatio(
      progressValues,
      (progress) => evaluateWithUniformCatmullRom(
        progressValues,
        points,
        progress,
      ),
    );
    const nonUniformRatio = maximumBoundaryMovementRatio(
      progressValues,
      (progress) => evaluateKeyPoseRail(progressValues, points, progress),
    );

    // Measured max ratio: uniform 28.3149, non-uniform 1.00025.
    expect(nonUniformRatio).toBeLessThan(oldUniformRatio / 10);
    expect(nonUniformRatio).toBeLessThan(2);
  });
});
