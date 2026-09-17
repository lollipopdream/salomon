import type { Vec3 } from '../types';

const NORMALIZE_EPSILON = 1e-9;
const DEFAULT_NORMALIZE_FALLBACK: Vec3 = { x: 0, y: 0, z: 1 };

export function addVec3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function subtractVec3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scaleVec3(v: Vec3, scalar: number): Vec3 {
  return { x: v.x * scalar, y: v.y * scalar, z: v.z * scalar };
}

export function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

export function lengthVec3(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

export function normalizeVec3(
  v: Vec3,
  fallback: Vec3 = DEFAULT_NORMALIZE_FALLBACK,
): Vec3 {
  const length = lengthVec3(v);

  if (length < NORMALIZE_EPSILON) {
    return { ...fallback };
  }

  return scaleVec3(v, 1 / length);
}

export function rotateAroundY(
  point: Vec3,
  center: Vec3,
  angleRadians: number,
): Vec3 {
  const offsetX = point.x - center.x;
  const offsetZ = point.z - center.z;
  const cosine = Math.cos(angleRadians);
  const sine = Math.sin(angleRadians);

  return {
    x: center.x + offsetX * cosine + offsetZ * sine,
    y: point.y,
    z: center.z - offsetX * sine + offsetZ * cosine,
  };
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function smoothstep(t: number): number {
  const clamped = clamp01(t);
  return 3 * clamped ** 2 - 2 * clamped ** 3;
}

export function smootherstep(t: number): number {
  const clamped = clamp01(t);
  return 6 * clamped ** 5 - 15 * clamped ** 4 + 10 * clamped ** 3;
}

/** 終盤ほど速度が0へ収束するイーズアウト(4次)。t=0で傾き最大、t=1で傾き0。 */
export function easeOutQuart(t: number): number {
  const clamped = clamp01(t);
  return 1 - (1 - clamped) ** 4;
}
