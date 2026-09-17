import { describe, expect, it } from 'vitest';

import {
  computeHysteresisOcclusion,
  createInitialOcclusionHysteresisState,
  isAnchorOccluded,
  shouldRecomputeOcclusion,
} from './labelOcclusion';

describe('isAnchorOccluded', () => {
  it('returns false when terrain is not hit', () => {
    expect(isAnchorOccluded(100, null, 1)).toBe(false);
  });

  it('returns true when terrain is more than epsilon in front of the anchor', () => {
    expect(isAnchorOccluded(100, 98, 1)).toBe(true);
  });

  it('returns false when terrain is exactly epsilon in front of the anchor', () => {
    expect(isAnchorOccluded(100, 99, 1)).toBe(false);
  });

  it('returns false when terrain is within epsilon of the anchor', () => {
    expect(isAnchorOccluded(100, 99.5, 1)).toBe(false);
  });
});

describe('shouldRecomputeOcclusion', () => {
  it.each([
    [0, true],
    [4, false],
    [5, true],
    [10, true],
  ])(
    'for frame index %s returns %s with a five-frame throttle',
    (frameIndex, expected) => {
      expect(shouldRecomputeOcclusion(frameIndex, 5)).toBe(expected);
    },
  );

  it.each([
    [0, 0, true],
    [6, 0, true],
    [12, 0, true],
    [4, 1, false],
    [5, 1, true],
    [11, 1, true],
    [17, 1, true],
  ])(
    'for frame index %s and entry offset %s returns %s with a six-frame throttle',
    (frameIndex, entryOffset, expected) => {
      expect(
        shouldRecomputeOcclusion(frameIndex, 6, entryOffset),
      ).toBe(expected);
    },
  );
});

describe('computeHysteresisOcclusion', () => {
  it('does not switch when a one-observation change returns to the current value', () => {
    const initial = createInitialOcclusionHysteresisState(false);
    const pending = computeHysteresisOcclusion(true, initial, 2);
    const restored = computeHysteresisOcclusion(false, pending.nextState, 2);

    expect(pending).toEqual({
      occluded: false,
      nextState: {
        occluded: false,
        pendingOccluded: true,
        pendingSinceFrame: 1,
      },
    });
    expect(restored).toEqual({
      occluded: false,
      nextState: {
        occluded: false,
        pendingOccluded: null,
        pendingSinceFrame: null,
      },
    });
  });

  it('switches after the new value is observed for confirmFrames consecutive calls', () => {
    const initial = createInitialOcclusionHysteresisState(false);
    const first = computeHysteresisOcclusion(true, initial, 2);
    const confirmed = computeHysteresisOcclusion(true, first.nextState, 2);

    expect(confirmed).toEqual({
      occluded: true,
      nextState: {
        occluded: true,
        pendingOccluded: null,
        pendingSinceFrame: null,
      },
    });
  });

  it('switches immediately when confirmFrames is one', () => {
    const result = computeHysteresisOcclusion(
      true,
      createInitialOcclusionHysteresisState(false),
      1,
    );

    expect(result).toEqual({
      occluded: true,
      nextState: {
        occluded: true,
        pendingOccluded: null,
        pendingSinceFrame: null,
      },
    });
  });
});
