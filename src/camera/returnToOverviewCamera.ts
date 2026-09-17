import type { Vec3 } from '../types';
import { lerpVec3 } from '../utils/vecMath';

export function computeReturnCameraPose(
  t: number,
  fromPosition: Vec3,
  fromTarget: Vec3,
  toPosition: Vec3,
  toTarget: Vec3,
  arcLiftMeters: number,
): { position: Vec3; target: Vec3 } {
  const position = lerpVec3(fromPosition, toPosition, t);
  const arcLift = t === 0 || t === 1
    ? 0
    : Math.sin(t * Math.PI) * arcLiftMeters;
  position.y += arcLift;

  return {
    position,
    target: lerpVec3(fromTarget, toTarget, t),
  };
}
