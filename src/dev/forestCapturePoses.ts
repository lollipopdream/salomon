import type { Vec3 } from '../types';

export const FOREST_CAPTURE_ELAPSED_MS = 18_000;

export interface CapturePoseSpec {
  id: string;
  routeFraction: number;
  offset: Vec3;
  fov: number;
}

export const FOREST_CAPTURE_POSES: readonly CapturePoseSpec[] = [
  { id: 'S1', routeFraction: 0.18, offset: { x: 170, y: 120, z: 210 }, fov: 45 },
  { id: 'S2', routeFraction: 0.5, offset: { x: 300, y: 210, z: 340 }, fov: 45 },
  { id: 'S3', routeFraction: 0.72, offset: { x: 250, y: 175, z: 300 }, fov: 45 },
  { id: 'S4', routeFraction: 0.95, offset: { x: 200, y: 150, z: 260 }, fov: 45 },
  { id: 'S5', routeFraction: 0.5, offset: { x: 1500, y: 1500, z: 1900 }, fov: 45 },
  { id: 'S5b', routeFraction: 0.5, offset: { x: 900, y: 1650, z: 1150 }, fov: 45 },
  { id: 'L-overview', routeFraction: 0.5, offset: { x: 1500, y: 1500, z: 1900 }, fov: 45 },
  { id: 'L-route-early', routeFraction: 0.15, offset: { x: 520, y: 330, z: 620 }, fov: 45 },
  { id: 'L-route-middle', routeFraction: 0.5, offset: { x: 560, y: 300, z: 560 }, fov: 45 },
  { id: 'L-yakuoin', routeFraction: 0.72, offset: { x: 430, y: 260, z: 520 }, fov: 45 },
  { id: 'L-summit-near', routeFraction: 0.97, offset: { x: 330, y: 190, z: 430 }, fov: 45 },
];

function targetAtRouteFraction(
  routeFraction: number,
  routePoints: readonly Vec3[],
): Vec3 {
  return routePoints[Math.round((routePoints.length - 1) * routeFraction)];
}

function addOffset(target: Vec3, offset: Vec3): Vec3 {
  return {
    x: target.x + offset.x,
    y: target.y + offset.y,
    z: target.z + offset.z,
  };
}

/** Resolves a camera position and target from a capture pose ID. */
export function resolveCapturePose(
  poseId: string,
  routePoints: readonly Vec3[],
): { position: Vec3; target: Vec3; fov: number } | undefined {
  const pose = FOREST_CAPTURE_POSES.find((candidate) => candidate.id === poseId);
  if (!pose) {
    return undefined;
  }

  const target = targetAtRouteFraction(pose.routeFraction, routePoints);
  return { position: addOffset(target, pose.offset), target, fov: pose.fov };
}

/** Resolves a fixed-direction camera position at a specified distance for popping checks. */
export function resolvePopSweepPose(
  routeFraction: number,
  distanceMeters: number,
  routePoints: readonly Vec3[],
): { position: Vec3; target: Vec3; fov: number } {
  const s2Offset = FOREST_CAPTURE_POSES.find((pose) => pose.id === 'S2')!.offset;
  const s2Length = Math.hypot(s2Offset.x, s2Offset.y, s2Offset.z);
  const target = targetAtRouteFraction(routeFraction, routePoints);
  const offset = {
    x: (s2Offset.x / s2Length) * distanceMeters,
    y: (s2Offset.y / s2Length) * distanceMeters,
    z: (s2Offset.z / s2Length) * distanceMeters,
  };

  return { position: addOffset(target, offset), target, fov: 45 };
}
