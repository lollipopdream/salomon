import { describe, expect, it } from 'vitest';

import {
  computeAngularDistanceRad,
  computePearsonCorrelation,
  detectSignReversals,
  summarizeCameraMotion,
} from './cameraMotionMetrics';

const identityQuaternion = { x: 0, y: 0, z: 0, w: 1 };

describe('camera motion metrics', () => {
  it('summarizes zero and one samples with finite default values', () => {
    const emptySummary = summarizeCameraMotion([]);
    const oneSampleSummary = summarizeCameraMotion([
      {
        timestampMs: 0,
        position: { x: 0, y: 0, z: 0 },
        quaternion: identityQuaternion,
        frameGapMs: 16.7,
      },
    ]);

    for (const summary of [emptySummary, oneSampleSummary]) {
      expect(summary.sampleCount).toBe(summary === emptySummary ? 0 : 1);
      expect(summary.linear.displacementPerFrame).toEqual({ avg: 0, max: 0, p95: 0 });
      expect(summary.angular.velocityRadPerMs).toEqual({ avg: 0, max: 0, p95: 0 });
      expect(summary.directionReversalCount).toEqual({
        linearAxisReversals: 0,
        angularReversals: 0,
      });
      expect(summary.longFrameJumpCorrelation).toEqual({
        sampleCount: 0,
        pearsonRLinear: 0,
        pearsonRAngular: 0,
      });
    }
  });

  it('computes quaternion angular distance for identical and 180-degree rotations', () => {
    expect(computeAngularDistanceRad(identityQuaternion, identityQuaternion)).toBe(0);
    expect(computeAngularDistanceRad(identityQuaternion, { x: 1, y: 0, z: 0, w: 0 }))
      .toBeCloseTo(Math.PI, 12);
  });

  it('calculates Pearson correlation for perfectly correlated and uncorrelated series', () => {
    expect(computePearsonCorrelation([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1, 12);
    expect(computePearsonCorrelation([1, 2, 3, 4], [1, -1, -1, 1])).toBeCloseTo(0, 12);
  });

  it('counts sign reversals while ignoring zero-valued samples', () => {
    expect(detectSignReversals([1, -1, 1])).toBe(2);
    expect(detectSignReversals([1, 0, -1, 0, 1])).toBe(2);
    expect(detectSignReversals([1, 2, 0])).toBe(0);
  });
});
