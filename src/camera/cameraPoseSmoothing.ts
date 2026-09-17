import type { Vec3 } from '../types';

export type CameraDiagVariant =
  | 'baseline'
  | 'stable-orientation'
  | 'stable-position'
  | 'stable-both';

export interface CameraPoseSmoothingConfig {
  positionTauMs: number;
  targetTauMs: number;
}

export interface CameraPoseSmoothingState {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  initialized: boolean;
}

export function createInitialCameraPoseSmoothingState(): CameraPoseSmoothingState {
  return {
    position: { x: 0, y: 0, z: 0 },
    target: { x: 0, y: 0, z: 0 },
    initialized: false,
  };
}

export function computeExponentialSmoothingAlpha(
  deltaMs: number,
  tauMs: number,
): number {
  const alpha = 1 - Math.exp(
    -Math.max(0, deltaMs) / Math.max(1e-6, tauMs),
  );

  return Math.min(1, Math.max(0, alpha));
}

function copyVec3(value: Vec3): Vec3 {
  return { x: value.x, y: value.y, z: value.z };
}

function smoothVec3(previous: Vec3, raw: Vec3, alpha: number): Vec3 {
  return {
    x: previous.x + (raw.x - previous.x) * alpha,
    y: previous.y + (raw.y - previous.y) * alpha,
    z: previous.z + (raw.z - previous.z) * alpha,
  };
}

function createRawPoseResult(
  rawPose: { position: Vec3; target: Vec3 },
): { pose: { position: Vec3; target: Vec3 }; nextState: CameraPoseSmoothingState } {
  const pose = {
    position: copyVec3(rawPose.position),
    target: copyVec3(rawPose.target),
  };

  return {
    pose,
    nextState: {
      position: copyVec3(pose.position),
      target: copyVec3(pose.target),
      initialized: true,
    },
  };
}

export function applyCameraDiagVariant(
  rawPose: { position: Vec3; target: Vec3 },
  previousState: CameraPoseSmoothingState,
  deltaMs: number,
  variant: CameraDiagVariant,
  config: CameraPoseSmoothingConfig,
): { pose: { position: Vec3; target: Vec3 }; nextState: CameraPoseSmoothingState } {
  if (variant === 'baseline' || !previousState.initialized) {
    return createRawPoseResult(rawPose);
  }

  const smoothPosition = variant === 'stable-position' || variant === 'stable-both';
  const smoothTarget = variant === 'stable-orientation' || variant === 'stable-both';
  const position = smoothPosition
    ? smoothVec3(
      previousState.position,
      rawPose.position,
      computeExponentialSmoothingAlpha(deltaMs, config.positionTauMs),
    )
    : copyVec3(rawPose.position);
  const target = smoothTarget
    ? smoothVec3(
      previousState.target,
      rawPose.target,
      computeExponentialSmoothingAlpha(deltaMs, config.targetTauMs),
    )
    : copyVec3(rawPose.target);

  return {
    pose: { position, target },
    nextState: {
      position: copyVec3(position),
      target: copyVec3(target),
      initialized: true,
    },
  };
}
