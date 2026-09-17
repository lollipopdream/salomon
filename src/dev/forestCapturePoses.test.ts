import { describe, expect, it } from 'vitest';

import {
  FOREST_CAPTURE_ELAPSED_MS,
  FOREST_CAPTURE_POSES,
  resolveCapturePose,
  resolvePopSweepPose,
} from './forestCapturePoses';

const routePoints = Array.from({ length: 101 }, (_, index) => ({
  x: index,
  y: index * 2,
  z: index * 3,
}));

describe('forest capture poses', () => {
  it('uses the fixed capture elapsed time', () => {
    expect(FOREST_CAPTURE_ELAPSED_MS).toBe(18_000);
  });

  it('has unique IDs and includes S1 through S5', () => {
    const ids = FOREST_CAPTURE_POSES.map((pose) => pose.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(['S1', 'S2', 'S3', 'S4', 'S5']));
  });

  it('preserves the literal legacy offsets', () => {
    const offsets = Object.fromEntries(
      FOREST_CAPTURE_POSES
        .filter((pose) => pose.id.startsWith('L-'))
        .map((pose) => [pose.id, pose.offset]),
    );

    expect(offsets).toEqual({
      'L-overview': { x: 1500, y: 1500, z: 1900 },
      'L-route-early': { x: 520, y: 330, z: 620 },
      'L-route-middle': { x: 560, y: 300, z: 560 },
      'L-yakuoin': { x: 430, y: 260, z: 520 },
      'L-summit-near': { x: 330, y: 190, z: 430 },
    });
  });

  it('keeps S5 and L-overview at the same offset', () => {
    const s5 = FOREST_CAPTURE_POSES.find((pose) => pose.id === 'S5');
    const overview = FOREST_CAPTURE_POSES.find((pose) => pose.id === 'L-overview');

    expect(s5?.offset).toEqual(overview?.offset);
  });

  it('keeps all fractions in range and fov fixed at 45', () => {
    for (const pose of FOREST_CAPTURE_POSES) {
      expect(pose.routeFraction).toBeGreaterThanOrEqual(0);
      expect(pose.routeFraction).toBeLessThanOrEqual(1);
      expect(pose.fov).toBe(45);
    }
  });

  it('resolves S2 against the rounded route point', () => {
    expect(resolveCapturePose('S2', routePoints)).toEqual({
      target: { x: 50, y: 100, z: 150 },
      position: { x: 350, y: 310, z: 490 },
      fov: 45,
    });
  });

  it('returns undefined for an unknown pose ID', () => {
    expect(resolveCapturePose('unknown', routePoints)).toBeUndefined();
  });

  it('is deterministic for identical inputs', () => {
    expect(resolveCapturePose('S3', routePoints)).toEqual(
      resolveCapturePose('S3', routePoints),
    );
  });

  it('sweeps distance along the same S2 direction', () => {
    const near = resolvePopSweepPose(0.5, 300, routePoints);
    const far = resolvePopSweepPose(0.5, 3400, routePoints);
    const distance = (pose: typeof near) => Math.hypot(
      pose.position.x - pose.target.x,
      pose.position.y - pose.target.y,
      pose.position.z - pose.target.z,
    );
    const direction = (pose: typeof near) => {
      const length = distance(pose);
      return {
        x: (pose.position.x - pose.target.x) / length,
        y: (pose.position.y - pose.target.y) / length,
        z: (pose.position.z - pose.target.z) / length,
      };
    };

    expect(near.target).toEqual(far.target);
    expect(distance(near)).toBeCloseTo(300);
    expect(distance(far)).toBeCloseTo(3400);
    const nearDirection = direction(near);
    const farDirection = direction(far);
    expect(nearDirection.x).toBeCloseTo(farDirection.x);
    expect(nearDirection.y).toBeCloseTo(farDirection.y);
    expect(nearDirection.z).toBeCloseTo(farDirection.z);
  });
});
