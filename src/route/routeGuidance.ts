import type { CameraGuidanceConfig, Vec3 } from '../types';
import { computeCumulativeDistances } from './routeProgress';

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

export function resampleByArcLength(
  points: Vec3[],
  cumulativeDistances: number[],
  spacingMeters: number,
): Vec3[] {
  if (points.length <= 1) {
    return points;
  }

  const totalDistance = cumulativeDistances[cumulativeDistances.length - 1];
  const resampledPoints: Vec3[] = [points[0]];
  let segmentEndIndex = 1;

  for (
    let targetDistance = spacingMeters;
    targetDistance < totalDistance;
    targetDistance += spacingMeters
  ) {
    while (
      segmentEndIndex < cumulativeDistances.length - 1 &&
      cumulativeDistances[segmentEndIndex] < targetDistance
    ) {
      segmentEndIndex += 1;
    }

    const segmentStartIndex = segmentEndIndex - 1;
    const segmentStartDistance = cumulativeDistances[segmentStartIndex];
    const segmentDistance =
      cumulativeDistances[segmentEndIndex] - segmentStartDistance;
    const t = segmentDistance === 0
      ? 0
      : (targetDistance - segmentStartDistance) / segmentDistance;

    resampledPoints.push(
      lerpVec3(points[segmentStartIndex], points[segmentEndIndex], t),
    );
  }

  resampledPoints.push(points[points.length - 1]);
  return resampledPoints;
}

export function smoothByDistanceWindow(
  resampledPoints: Vec3[],
  resampledCumulativeDistances: number[],
  windowRadiusMeters: number,
  maxDeviationMeters: number,
): Vec3[] {
  if (resampledPoints.length <= 1) {
    return resampledPoints;
  }

  return resampledPoints.map((point, index) => {
    if (index === 0 || index === resampledPoints.length - 1) {
      return point;
    }

    const centerDistance = resampledCumulativeDistances[index];
    const minimumDistance = centerDistance - windowRadiusMeters;
    const maximumDistance = centerDistance + windowRadiusMeters;
    const distanceTolerance =
      Number.EPSILON *
      Math.max(
        1,
        resampledCumulativeDistances[
          resampledCumulativeDistances.length - 1
        ],
      ) *
      16;
    let sumX = 0;
    let sumY = 0;
    let sumZ = 0;
    let pointCount = 0;

    for (
      let candidateIndex = 0;
      candidateIndex < resampledPoints.length;
      candidateIndex += 1
    ) {
      const candidateDistance =
        resampledCumulativeDistances[candidateIndex];
      if (
        candidateDistance < minimumDistance - distanceTolerance ||
        candidateDistance > maximumDistance + distanceTolerance
      ) {
        continue;
      }

      const candidate = resampledPoints[candidateIndex];
      sumX += candidate.x;
      sumY += candidate.y;
      sumZ += candidate.z;
      pointCount += 1;
    }

    const smoothedPoint = {
      x: sumX / pointCount,
      y: sumY / pointCount,
      z: sumZ / pointCount,
    };
    const offsetX = smoothedPoint.x - point.x;
    const offsetY = smoothedPoint.y - point.y;
    const offsetZ = smoothedPoint.z - point.z;
    const deviation = Math.hypot(offsetX, offsetY, offsetZ);

    if (deviation <= maxDeviationMeters || deviation === 0) {
      return smoothedPoint;
    }

    const clampScale = maxDeviationMeters / deviation;
    return {
      x: point.x + offsetX * clampScale,
      y: point.y + offsetY * clampScale,
      z: point.z + offsetZ * clampScale,
    };
  });
}

export function computeCameraGuidancePath(
  points: Vec3[],
  cumulativeDistances: number[],
  config: CameraGuidanceConfig,
): { points: Vec3[]; cumulativeDistances: number[] } {
  const resampledPoints = resampleByArcLength(
    points,
    cumulativeDistances,
    config.resampleSpacingMeters,
  );
  const resampledCumulativeDistances =
    computeCumulativeDistances(resampledPoints);
  const smoothedPoints = smoothByDistanceWindow(
    resampledPoints,
    resampledCumulativeDistances,
    config.smoothingWindowRadiusMeters,
    config.maxDeviationMeters,
  );

  return {
    points: smoothedPoints,
    cumulativeDistances: computeCumulativeDistances(smoothedPoints),
  };
}
