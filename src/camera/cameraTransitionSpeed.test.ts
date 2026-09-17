import { describe, expect, it } from 'vitest';

import { defaultSettings } from '../config/settings';
import { computeCumulativeDistances } from '../route/routeProgress';
import type { ElevationGrid, Vec3 } from '../types';
import { lengthVec3, subtractVec3 } from '../utils/vecMath';
import { computeCameraPose, type CameraPoseInput } from './cameraPose';
import type { CameraPhaseResult } from './cameraTimeline';

const grid: ElevationGrid = {
  cols: 5,
  rows: 4,
  values: new Float32Array([
    100, 105, 110, 115, 120,
    110, 120, 130, 140, 150,
    125, 140, 155, 170, 185,
    140, 160, 180, 200, 220,
  ]),
  cellSizeMeters: 25,
  bounds: {
    north: 35.64,
    south: 35.61,
    east: 139.26,
    west: 139.22,
  },
};

const worldRoutePoints: Vec3[] = [
  { x: 0, y: 100, z: 0 },
  { x: 25, y: 130, z: 20 },
  { x: 55, y: 165, z: 45 },
  { x: 90, y: 205, z: 75 },
];
const cumulativeDistances = computeCumulativeDistances(worldRoutePoints);

function poseForPhase(phase: CameraPhaseResult) {
  const input: CameraPoseInput = {
    phase,
    elapsedMs: 0,
    animationConfig: defaultSettings.routeAnimation,
    grid,
    settings: defaultSettings,
    worldRoutePoints,
    cumulativeDistances,
    cameraState: defaultSettings.cameraState,
  };

  return computeCameraPose(input);
}

const PRE_V3_BASELINE_MS = {
  transitionToSummitMs: 300,
  ascendToHighOverviewMs: 200,
} as const;

describe('camera transition speed guards', () => {
  it.each([
    ['transition-to-summit', 'transitionToSummitMs'],
    ['ascend-to-high-overview', 'ascendToHighOverviewMs'],
  ] as const)(
    '%s transition speed is meaningfully slower than the pre-v3 baseline (BUG-V3-01/02)',
    (kind, key) => {
      const from = poseForPhase({ kind, t: 0 });
      const to = poseForPhase({ kind, t: 1 });
      const distance = Math.max(
        lengthVec3(subtractVec3(to.position, from.position)),
        lengthVec3(subtractVec3(to.target, from.target)),
      );
      const newDurationMs = defaultSettings.cameraState.timeline[key];
      const baselineDurationMs = PRE_V3_BASELINE_MS[key];
      const newSpeed = distance / newDurationMs;
      const baselineSpeed = distance / baselineDurationMs;

      expect(newDurationMs).toBeGreaterThan(baselineDurationMs);
      expect(newSpeed).toBeLessThanOrEqual(baselineSpeed * 0.6);
    },
  );

  it('increases returnToOverviewMs from the pre-v3 baseline for arc-lift legibility (v3.7)', () => {
    expect(defaultSettings.cameraState.timeline.returnToOverviewMs).toBe(
      1800,
    );
  });
});
