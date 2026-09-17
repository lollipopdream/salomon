export function isAnchorOccluded(
  distanceToAnchor: number,
  terrainHitDistance: number | null,
  epsilonMeters: number,
): boolean {
  return (
    terrainHitDistance !== null &&
    terrainHitDistance < distanceToAnchor - epsilonMeters
  );
}

export function shouldRecomputeOcclusion(
  frameIndex: number,
  throttleFrames: number,
  entryOffset: number = 0,
): boolean {
  return (frameIndex + entryOffset) % throttleFrames === 0;
}

export interface OcclusionHysteresisState {
  occluded: boolean;
  pendingOccluded: boolean | null;
  pendingSinceFrame: number | null;
}

export const DEFAULT_OCCLUSION_HYSTERESIS_CONFIRM_FRAMES = 2;

export function createInitialOcclusionHysteresisState(
  initiallyOccluded: boolean,
): OcclusionHysteresisState {
  return {
    occluded: initiallyOccluded,
    pendingOccluded: null,
    pendingSinceFrame: null,
  };
}

export function computeHysteresisOcclusion(
  rawOccluded: boolean,
  previous: OcclusionHysteresisState,
  confirmFrames: number = DEFAULT_OCCLUSION_HYSTERESIS_CONFIRM_FRAMES,
): { occluded: boolean; nextState: OcclusionHysteresisState } {
  if (rawOccluded === previous.occluded) {
    const nextState: OcclusionHysteresisState = {
      occluded: previous.occluded,
      pendingOccluded: null,
      pendingSinceFrame: null,
    };

    return { occluded: nextState.occluded, nextState };
  }

  const pendingSinceFrame =
    previous.pendingOccluded === rawOccluded
      ? (previous.pendingSinceFrame ?? 0) + 1
      : 1;

  if (pendingSinceFrame >= confirmFrames) {
    const nextState: OcclusionHysteresisState = {
      occluded: rawOccluded,
      pendingOccluded: null,
      pendingSinceFrame: null,
    };

    return { occluded: nextState.occluded, nextState };
  }

  const nextState: OcclusionHysteresisState = {
    occluded: previous.occluded,
    pendingOccluded: rawOccluded,
    pendingSinceFrame,
  };

  return { occluded: nextState.occluded, nextState };
}
