import { describe, expect, it } from 'vitest';

import type { Vec3 } from '../types';
import {
  applyCameraDiagVariant,
  createInitialCameraPoseSmoothingState,
} from './cameraPoseSmoothing';

const rawPose = {
  position: { x: 10, y: 20, z: 30 } satisfies Vec3,
  target: { x: 40, y: 50, z: 60 } satisfies Vec3,
};

const previousState = {
  position: { x: 0, y: 0, z: 0 },
  target: { x: 0, y: 0, z: 0 },
  initialized: true,
};

const config = {
  positionTauMs: 120,
  targetTauMs: 120,
};

describe('applyCameraDiagVariant', () => {
  it('returns the raw pose unchanged for the baseline variant', () => {
    const result = applyCameraDiagVariant(
      rawPose,
      previousState,
      16,
      'baseline',
      config,
    );

    expect(result.pose).toEqual(rawPose);
    expect(result.nextState).toEqual({ ...rawPose, initialized: true });
  });

  it('keeps position raw for the stable-orientation variant', () => {
    const result = applyCameraDiagVariant(
      rawPose,
      previousState,
      16,
      'stable-orientation',
      config,
    );

    expect(result.pose.position).toEqual(rawPose.position);
    expect(result.pose.target).not.toEqual(rawPose.target);
  });

  it('keeps target raw for the stable-position variant', () => {
    const result = applyCameraDiagVariant(
      rawPose,
      previousState,
      16,
      'stable-position',
      config,
    );

    expect(result.pose.target).toEqual(rawPose.target);
    expect(result.pose.position).not.toEqual(rawPose.position);
  });

  it('converges according to the time-based exponential smoothing equation', () => {
    const deltaMs = 20;
    const tauMs = 100;
    const frameCount = 10;
    const stepPose = {
      position: { x: 100, y: 0, z: 0 },
      target: { x: 0, y: 50, z: 0 },
    };
    let state = {
      position: { x: 0, y: 0, z: 0 },
      target: { x: 0, y: 0, z: 0 },
      initialized: true,
    };

    for (let frame = 0; frame < frameCount; frame += 1) {
      const result = applyCameraDiagVariant(
        stepPose,
        state,
        deltaMs,
        'stable-both',
        { positionTauMs: tauMs, targetTauMs: tauMs },
      );
      state = result.nextState;
    }

    const expectedProgress = 1 - Math.exp(-(deltaMs * frameCount) / tauMs);
    expect(state.position.x).toBeCloseTo(100 * expectedProgress, 10);
    expect(state.target.y).toBeCloseTo(50 * expectedProgress, 10);
  });

  it('snaps to the raw pose before smoothing state has initialized', () => {
    const result = applyCameraDiagVariant(
      rawPose,
      createInitialCameraPoseSmoothingState(),
      16,
      'stable-both',
      config,
    );

    expect(result.pose).toEqual(rawPose);
    expect(result.nextState).toEqual({ ...rawPose, initialized: true });
  });
});
