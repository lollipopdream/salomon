import { describe, expect, it } from 'vitest';

import {
  TAKAO_LOCAL_POSES,
  resolveTakaoLocalPose,
  resolveTakaoLocalPoseSpec,
  type TakaoLocalPoseSpec,
} from './takaoLocalPoses';

const routePoints = Array.from({ length: 101 }, (_, index) => ({
  x: index,
  y: index * 2,
  z: index * 3,
}));

const baseSpec = (overrides: Partial<TakaoLocalPoseSpec>): TakaoLocalPoseSpec => ({
  id: 'test',
  targetFraction: 0.5,
  azimuthDeg: 0,
  pitchDeg: 0,
  distanceMeters: 1000,
  fov: 45,
  ...overrides,
});

describe('takao local poses', () => {
  it('azimuth 0 places offset south-negative (z negative), x ~ 0', () => {
    const spec = baseSpec({ azimuthDeg: 0, pitchDeg: 0 });
    const resolved = resolveTakaoLocalPoseSpec(spec, routePoints);
    const dx = resolved.position.x - resolved.target.x;
    const dz = resolved.position.z - resolved.target.z;
    expect(dx).toBeCloseTo(0, 6);
    expect(dz).toBeCloseTo(-1000, 6);
  });

  it('azimuth 90 places offset x positive, z ~ 0', () => {
    const spec = baseSpec({ azimuthDeg: 90, pitchDeg: 0 });
    const resolved = resolveTakaoLocalPoseSpec(spec, routePoints);
    const dx = resolved.position.x - resolved.target.x;
    const dz = resolved.position.z - resolved.target.z;
    expect(dx).toBeCloseTo(1000, 6);
    expect(dz).toBeCloseTo(0, 6);
  });

  it('azimuth 180 places offset z positive', () => {
    const spec = baseSpec({ azimuthDeg: 180, pitchDeg: 0 });
    const resolved = resolveTakaoLocalPoseSpec(spec, routePoints);
    const dz = resolved.position.z - resolved.target.z;
    expect(dz).toBeCloseTo(1000, 6);
  });

  it('azimuth 270 places offset x negative', () => {
    const spec = baseSpec({ azimuthDeg: 270, pitchDeg: 0 });
    const resolved = resolveTakaoLocalPoseSpec(spec, routePoints);
    const dx = resolved.position.x - resolved.target.x;
    expect(dx).toBeCloseTo(-1000, 6);
  });

  it('pitch 0 keeps offset.y ~ 0', () => {
    const spec = baseSpec({ azimuthDeg: 45, pitchDeg: 0 });
    const resolved = resolveTakaoLocalPoseSpec(spec, routePoints);
    expect(resolved.position.y - resolved.target.y).toBeCloseTo(0, 6);
  });

  it('pitch 90 keeps horizontal components ~ 0', () => {
    const spec = baseSpec({ azimuthDeg: 45, pitchDeg: 90 });
    const resolved = resolveTakaoLocalPoseSpec(spec, routePoints);
    const dx = resolved.position.x - resolved.target.x;
    const dz = resolved.position.z - resolved.target.z;
    expect(dx).toBeCloseTo(0, 6);
    expect(dz).toBeCloseTo(0, 6);
    expect(resolved.position.y - resolved.target.y).toBeCloseTo(1000, 6);
  });

  it('offset length equals distanceMeters', () => {
    const spec = baseSpec({ azimuthDeg: 37, pitchDeg: 24, distanceMeters: 843.5 });
    const resolved = resolveTakaoLocalPoseSpec(spec, routePoints);
    const dx = resolved.position.x - resolved.target.x;
    const dy = resolved.position.y - resolved.target.y;
    const dz = resolved.position.z - resolved.target.z;
    expect(Math.hypot(dx, dy, dz)).toBeCloseTo(843.5, 6);
  });

  it('targetFraction 0 corresponds to routePoints[0]', () => {
    const spec = baseSpec({ targetFraction: 0 });
    const resolved = resolveTakaoLocalPoseSpec(spec, routePoints);
    expect(resolved.target.x).toBeCloseTo(routePoints[0].x, 6);
    expect(resolved.target.y).toBeCloseTo(routePoints[0].y, 6);
    expect(resolved.target.z).toBeCloseTo(routePoints[0].z, 6);
  });

  it('targetFraction 1 corresponds to the last route point', () => {
    const spec = baseSpec({ targetFraction: 1 });
    const resolved = resolveTakaoLocalPoseSpec(spec, routePoints);
    const last = routePoints[routePoints.length - 1];
    expect(resolved.target.x).toBeCloseTo(last.x, 6);
    expect(resolved.target.y).toBeCloseTo(last.y, 6);
    expect(resolved.target.z).toBeCloseTo(last.z, 6);
  });

  it('targetLiftMeters is added to target.y and reflected in position.y', () => {
    const withoutLift = baseSpec({ targetFraction: 0.5, pitchDeg: 0 });
    const withLift = baseSpec({ targetFraction: 0.5, pitchDeg: 0, targetLiftMeters: 55 });
    const resolvedWithout = resolveTakaoLocalPoseSpec(withoutLift, routePoints);
    const resolvedWith = resolveTakaoLocalPoseSpec(withLift, routePoints);
    expect(resolvedWith.target.y - resolvedWithout.target.y).toBeCloseTo(55, 6);
    expect(resolvedWith.position.y - resolvedWithout.position.y).toBeCloseTo(55, 6);
  });

  it('returns undefined for an unknown pose id', () => {
    expect(resolveTakaoLocalPose('unknown', routePoints)).toBeUndefined();
  });

  it('returns undefined when routePoints is empty', () => {
    expect(resolveTakaoLocalPose('T-overview', [])).toBeUndefined();
  });

  it('includes all four expected ids', () => {
    const ids = TAKAO_LOCAL_POSES.map((pose) => pose.id);
    expect(new Set(ids).size).toBe(4);
    expect(ids).toEqual(
      expect.arrayContaining(['T-overview', 'T-route-early', 'T-route-middle', 'T-summit']),
    );
  });

  it('keeps all pitch values strictly between 0 and 90, and fov within 10..120', () => {
    for (const pose of TAKAO_LOCAL_POSES) {
      expect(pose.pitchDeg).toBeGreaterThan(0);
      expect(pose.pitchDeg).toBeLessThan(90);
      expect(pose.fov).toBeGreaterThanOrEqual(10);
      expect(pose.fov).toBeLessThanOrEqual(120);
    }
  });

  it('resolves each registered pose deterministically via resolveTakaoLocalPose', () => {
    for (const pose of TAKAO_LOCAL_POSES) {
      const resolved = resolveTakaoLocalPose(pose.id, routePoints);
      expect(resolved).toEqual(resolveTakaoLocalPoseSpec(pose, routePoints));
    }
  });
});
