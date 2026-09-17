import { describe, expect, it } from 'vitest';

import type { LabelDistanceScalingConfig } from '../types';
import {
  computeLabelHidden,
  computeLabelScale,
  computeSmoothedLabelScale,
  createInitialLabelScaleSmoothingState,
} from './labelDistanceScaling';

const config: LabelDistanceScalingConfig = {
  nearDistanceMeters: 1_500,
  farDistanceMeters: 6_000,
  minScale: 0.5,
  hideBeyondMeters: 9_000,
};

describe('computeLabelScale', () => {
  it.each([0, 1_500])(
    'returns full scale at or below the near distance (%s m)',
    (distanceMeters) => {
      expect(computeLabelScale(distanceMeters, config)).toBe(1);
    },
  );

  it.each([6_000, 12_000])(
    'returns minimum scale at or beyond the far distance (%s m)',
    (distanceMeters) => {
      expect(computeLabelScale(distanceMeters, config)).toBe(0.5);
    },
  );

  it('linearly interpolates between the near and far distances', () => {
    expect(computeLabelScale(3_750, config)).toBeCloseTo(0.75);
  });
});

describe('computeLabelHidden', () => {
  it('keeps a label visible at the hide threshold', () => {
    expect(computeLabelHidden(9_000, config)).toBe(false);
  });

  it('hides a label beyond the hide threshold', () => {
    expect(computeLabelHidden(9_001, config)).toBe(true);
  });
});

describe('computeSmoothedLabelScale', () => {
  it('snaps directly to the target scale when the state is uninitialized', () => {
    const result = computeSmoothedLabelScale(
      0.6,
      createInitialLabelScaleSmoothingState(),
      16,
    );

    expect(result.scale).toBe(0.6);
    expect(result.nextState).toEqual({ scale: 0.6, initialized: true });
  });

  it('converges according to the time-based exponential curve', () => {
    const initialScale = 1;
    const targetScale = 0.5;
    const deltaMs = 15;
    const tauMs = 150;
    const steps = 10;
    let state = { scale: initialScale, initialized: true };

    for (let step = 0; step < steps; step += 1) {
      state = computeSmoothedLabelScale(
        targetScale,
        state,
        deltaMs,
        tauMs,
      ).nextState;
    }

    const expectedScale =
      targetScale +
      (initialScale - targetScale) * Math.exp(-(deltaMs * steps) / tauMs);
    expect(state.scale).toBeCloseTo(expectedScale, 10);
  });

  it.each([0, -16])(
    'keeps the current scale when deltaMs is %s',
    (deltaMs) => {
      const previous = { scale: 0.8, initialized: true };
      const result = computeSmoothedLabelScale(0.5, previous, deltaMs);

      expect(result.scale).toBe(0.8);
      expect(result.nextState).toEqual(previous);
    },
  );

  it('nearly reaches the target for an extremely large delta', () => {
    const targetScale = 0.5;
    const initialDifference = 1 - targetScale;
    const result = computeSmoothedLabelScale(
      targetScale,
      { scale: 1, initialized: true },
      1_000,
      150,
    );

    expect(Math.abs(result.scale - targetScale) / initialDifference).toBeLessThan(
      0.01,
    );
  });
});
