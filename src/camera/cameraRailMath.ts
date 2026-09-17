import type { Vec3 } from '../types';

const SEGMENT_WIDTH_EPSILON = 1e-12;

function catmullRomComponent(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number,
): number {
  const tSquared = t * t;
  const tCubed = tSquared * t;

  return 0.5 * (
    2 * p1
    + (-p0 + p2) * t
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * tSquared
    + (-p0 + 3 * p1 - 3 * p2 + p3) * tCubed
  );
}

export function catmullRomVec3(
  p0: Vec3,
  p1: Vec3,
  p2: Vec3,
  p3: Vec3,
  t: number,
): Vec3 {
  if (t === 0) {
    return { ...p1 };
  }
  if (t === 1) {
    return { ...p2 };
  }

  return {
    x: catmullRomComponent(p0.x, p1.x, p2.x, p3.x, t),
    y: catmullRomComponent(p0.y, p1.y, p2.y, p3.y, t),
    z: catmullRomComponent(p0.z, p1.z, p2.z, p3.z, t),
  };
}

function interpolateAtKnot(
  startValue: number,
  endValue: number,
  startKnot: number,
  endKnot: number,
  progress: number,
): number {
  const width = endKnot - startKnot;

  if (Math.abs(width) <= SEGMENT_WIDTH_EPSILON) {
    return progress <= startKnot ? startValue : endValue;
  }

  return (
    ((endKnot - progress) / width) * startValue
    + ((progress - startKnot) / width) * endValue
  );
}

function nonUniformCatmullRomComponent(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t0: number,
  t1: number,
  t2: number,
  t3: number,
  progress: number,
): number {
  const a1 = interpolateAtKnot(p0, p1, t0, t1, progress);
  const a2 = interpolateAtKnot(p1, p2, t1, t2, progress);
  const a3 = interpolateAtKnot(p2, p3, t2, t3, progress);
  const b1 = interpolateAtKnot(a1, a2, t0, t2, progress);
  const b2 = interpolateAtKnot(a2, a3, t1, t3, progress);

  return interpolateAtKnot(b1, b2, t1, t2, progress);
}

function nonUniformCatmullRomVec3(
  p0: Vec3,
  p1: Vec3,
  p2: Vec3,
  p3: Vec3,
  t0: number,
  t1: number,
  t2: number,
  t3: number,
  localT: number,
): Vec3 {
  if (localT === 0) {
    return { ...p1 };
  }
  if (localT === 1) {
    return { ...p2 };
  }

  const progress = t1 + (t2 - t1) * localT;

  return {
    x: nonUniformCatmullRomComponent(
      p0.x, p1.x, p2.x, p3.x, t0, t1, t2, t3, progress,
    ),
    y: nonUniformCatmullRomComponent(
      p0.y, p1.y, p2.y, p3.y, t0, t1, t2, t3, progress,
    ),
    z: nonUniformCatmullRomComponent(
      p0.z, p1.z, p2.z, p3.z, t0, t1, t2, t3, progress,
    ),
  };
}

export function evaluateKeyPoseRail(
  keyProgressValues: number[],
  keyPoints: Vec3[],
  progress: number,
): Vec3 {
  const usableLength = Math.min(keyProgressValues.length, keyPoints.length);

  if (usableLength <= 1) {
    return keyPoints[0] ?? { x: 0, y: 0, z: 0 };
  }

  const lastProgressIndex = usableLength - 1;
  const clampedProgress = Math.min(
    keyProgressValues[lastProgressIndex],
    Math.max(keyProgressValues[0], progress),
  );

  let segmentIndex = usableLength - 2;
  if (clampedProgress !== keyProgressValues[lastProgressIndex]) {
    for (let index = 0; index < usableLength - 1; index += 1) {
      if (clampedProgress <= keyProgressValues[index + 1]) {
        segmentIndex = index;
        break;
      }
    }
  }

  const segmentStart = keyProgressValues[segmentIndex];
  const segmentWidth = keyProgressValues[segmentIndex + 1] - segmentStart;
  const localT = Math.abs(segmentWidth) <= SEGMENT_WIDTH_EPSILON
    ? 0
    : (clampedProgress - segmentStart) / segmentWidth;
  const lastPointIndex = keyPoints.length - 1;
  const p0 = keyPoints[Math.max(0, segmentIndex - 1)];
  const p1 = keyPoints[segmentIndex];
  const p2 = keyPoints[segmentIndex + 1];
  const p3 = keyPoints[Math.min(lastPointIndex, segmentIndex + 2)];
  const t1 = segmentStart;
  const t2 = keyProgressValues[segmentIndex + 1];
  const t0 = segmentIndex === 0
    ? t1 - (t2 - t1)
    : keyProgressValues[segmentIndex - 1];
  const t3 = segmentIndex + 2 >= usableLength
    ? t2 + (t2 - t1)
    : keyProgressValues[segmentIndex + 2];

  return nonUniformCatmullRomVec3(
    p0,
    p1,
    p2,
    p3,
    t0,
    t1,
    t2,
    t3,
    localT,
  );
}
