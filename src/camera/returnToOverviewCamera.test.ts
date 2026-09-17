import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../types';
import { computeReturnCameraPose } from './returnToOverviewCamera';

const fromPosition: Vec3 = { x: 10, y: 100, z: -20 };
const fromTarget: Vec3 = { x: 5, y: 40, z: 15 };
const toPosition: Vec3 = { x: 210, y: 100, z: 180 };
const toTarget: Vec3 = { x: 105, y: 60, z: 115 };
const arcLiftMeters = 80;

describe('computeReturnCameraPose', () => {
  it('returns the SUMMIT pose at t=0', () => {
    const pose = computeReturnCameraPose(
      0,
      fromPosition,
      fromTarget,
      toPosition,
      toTarget,
      arcLiftMeters,
    );

    expect(pose.position).toEqual(fromPosition);
    expect(pose.target).toEqual(fromTarget);
  });

  it('returns the OVERVIEW pose at t=1', () => {
    const pose = computeReturnCameraPose(
      1,
      fromPosition,
      fromTarget,
      toPosition,
      toTarget,
      arcLiftMeters,
    );

    expect(pose.position).toEqual(toPosition);
    expect(pose.target).toEqual(toTarget);
  });

  it('lifts the camera above both endpoints around t=0.5', () => {
    const start = computeReturnCameraPose(
      0,
      fromPosition,
      fromTarget,
      toPosition,
      toTarget,
      arcLiftMeters,
    );
    const midpoint = computeReturnCameraPose(
      0.5,
      fromPosition,
      fromTarget,
      toPosition,
      toTarget,
      arcLiftMeters,
    );
    const end = computeReturnCameraPose(
      1,
      fromPosition,
      fromTarget,
      toPosition,
      toTarget,
      arcLiftMeters,
    );

    expect(midpoint.position.y).toBeGreaterThan(start.position.y);
    expect(midpoint.position.y).toBeGreaterThan(end.position.y);
    expect(midpoint.position.y).toBeCloseTo(180);
  });

  it('returns only finite position and target components', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const pose = computeReturnCameraPose(
        t,
        fromPosition,
        fromTarget,
        toPosition,
        toTarget,
        arcLiftMeters,
      );

      expect([
        pose.position.x,
        pose.position.y,
        pose.position.z,
        pose.target.x,
        pose.target.y,
        pose.target.z,
      ].every(Number.isFinite)).toBe(true);
    }
  });
});
