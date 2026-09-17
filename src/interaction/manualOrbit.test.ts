import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MANUAL_ORBIT_OPTIONS,
  applyDragDelta,
  orbitPositionFromState,
  orbitStateFromPose,
} from './manualOrbit';

describe('manual orbit math', () => {
  it('round-trips a camera position through orbit state', () => {
    const position = { x: 12.5, y: -3.25, z: 48.75 };
    const target = { x: -7.5, y: 10.25, z: 4.5 };

    const restored = orbitPositionFromState(
      orbitStateFromPose(position, target),
    );

    expect(restored.x).toBeCloseTo(position.x, 9);
    expect(restored.y).toBeCloseTo(position.y, 9);
    expect(restored.z).toBeCloseTo(position.z, 9);
  });

  it('changes only azimuth for a horizontal drag', () => {
    const state = orbitStateFromPose(
      { x: 10, y: 10, z: 10 },
      { x: 0, y: 0, z: 0 },
    );

    const next = applyDragDelta(state, 20, 0, DEFAULT_MANUAL_ORBIT_OPTIONS);

    expect(next.azimuthRad).toBeCloseTo(
      state.azimuthRad + 20 * DEFAULT_MANUAL_ORBIT_OPTIONS.yawPerPixelRad,
      12,
    );
    expect(next.elevationRad).toBe(state.elevationRad);
  });

  it('changes only elevation for a vertical drag', () => {
    const state = orbitStateFromPose(
      { x: 10, y: 10, z: 10 },
      { x: 0, y: 0, z: 0 },
    );

    const next = applyDragDelta(state, 0, 10, DEFAULT_MANUAL_ORBIT_OPTIONS);

    expect(next.azimuthRad).toBe(state.azimuthRad);
    expect(next.elevationRad).toBeCloseTo(
      state.elevationRad - 10 * DEFAULT_MANUAL_ORBIT_OPTIONS.pitchPerPixelRad,
      12,
    );
  });

  it('clamps elevation at both limits', () => {
    const state = orbitStateFromPose(
      { x: 10, y: 10, z: 10 },
      { x: 0, y: 0, z: 0 },
    );

    const above = applyDragDelta(
      state,
      0,
      -100_000,
      DEFAULT_MANUAL_ORBIT_OPTIONS,
    );
    const below = applyDragDelta(
      state,
      0,
      100_000,
      DEFAULT_MANUAL_ORBIT_OPTIONS,
    );

    expect(above.elevationRad).toBe(DEFAULT_MANUAL_ORBIT_OPTIONS.maxElevationRad);
    expect(below.elevationRad).toBe(DEFAULT_MANUAL_ORBIT_OPTIONS.minElevationRad);
  });

  it('preserves radius and target while dragging', () => {
    const state = orbitStateFromPose(
      { x: 10, y: 10, z: 10 },
      { x: 1, y: 2, z: 3 },
    );

    const next = applyDragDelta(state, 8, -12, DEFAULT_MANUAL_ORBIT_OPTIONS);

    expect(next.radius).toBe(state.radius);
    expect(next.target).toBe(state.target);
  });

  it('returns the unchanged state for a zero delta', () => {
    const state = orbitStateFromPose(
      { x: 10, y: 10, z: 10 },
      { x: 1, y: 2, z: 3 },
    );

    expect(applyDragDelta(state, 0, 0, DEFAULT_MANUAL_ORBIT_OPTIONS)).toBe(state);
  });
});
