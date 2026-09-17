import type { LabelDistanceScalingConfig } from '../types';

export interface LabelScaleSmoothingState {
  scale: number;
  initialized: boolean;
}

export const DEFAULT_LABEL_SCALE_SMOOTHING_TAU_MS = 150;

export function createInitialLabelScaleSmoothingState(): LabelScaleSmoothingState {
  return { scale: 1, initialized: false };
}

export function computeSmoothedLabelScale(
  targetScale: number,
  previous: LabelScaleSmoothingState,
  deltaMs: number,
  tauMs: number = DEFAULT_LABEL_SCALE_SMOOTHING_TAU_MS,
): { scale: number; nextState: LabelScaleSmoothingState } {
  if (!previous.initialized) {
    const nextState = { scale: targetScale, initialized: true };
    return { scale: targetScale, nextState };
  }

  const alpha = deltaMs <= 0 ? 0 : 1 - Math.exp(-deltaMs / tauMs);
  const scale = previous.scale + (targetScale - previous.scale) * alpha;
  const nextState = { scale, initialized: true };

  return { scale, nextState };
}

export function computeLabelScale(
  distanceMeters: number,
  config: LabelDistanceScalingConfig,
): number {
  if (distanceMeters <= config.nearDistanceMeters) {
    return 1;
  }

  if (distanceMeters >= config.farDistanceMeters) {
    return config.minScale;
  }

  const progress =
    (distanceMeters - config.nearDistanceMeters) /
    (config.farDistanceMeters - config.nearDistanceMeters);

  return 1 + (config.minScale - 1) * progress;
}

export function computeLabelHidden(
  distanceMeters: number,
  config: LabelDistanceScalingConfig,
): boolean {
  return distanceMeters > config.hideBeyondMeters;
}
