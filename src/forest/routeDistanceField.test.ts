import { describe, expect, it } from 'vitest';

import {
  buildRouteDistanceField,
  sampleRouteDistance,
} from './routeDistanceField';

const cellSizeMeters = 10;
const maxDistanceMeters = 50;
const marginMeters = 20;
const straightRoute = Array.from({ length: 100 }, (_, index) => ({
  x: index * 10,
  z: 0,
}));

describe('buildRouteDistanceField', () => {
  it('approximates the analytic distance to a straight, evenly sampled route', () => {
    const field = buildRouteDistanceField(
      straightRoute,
      cellSizeMeters,
      maxDistanceMeters,
      marginMeters,
    );
    const samples = [
      { x: 0, z: 17 },
      { x: 143, z: -19 },
      { x: 517, z: 19 },
      { x: 990, z: -14 },
    ];

    for (const sample of samples) {
      const distanceToSegment = Math.hypot(
        sample.z,
        Math.max(0, -sample.x, sample.x - 990),
      );
      expect(Math.abs(sampleRouteDistance(field, sample.x, sample.z) - distanceToSegment))
        .toBeLessThanOrEqual(cellSizeMeters + 10 / 2);
    }
  });

  it('returns the capped maximum outside the field', () => {
    const field = buildRouteDistanceField(
      straightRoute,
      cellSizeMeters,
      maxDistanceMeters,
      marginMeters,
    );

    expect(sampleRouteDistance(field, field.originX - 1, 0)).toBe(maxDistanceMeters);
    expect(sampleRouteDistance(field, 0, field.originZ - 1)).toBe(maxDistanceMeters);
  });

  it('is byte-for-byte deterministic for identical inputs', () => {
    const first = buildRouteDistanceField(
      straightRoute,
      cellSizeMeters,
      maxDistanceMeters,
      marginMeters,
    );
    const second = buildRouteDistanceField(
      straightRoute,
      cellSizeMeters,
      maxDistanceMeters,
      marginMeters,
    );

    expect(Array.from(first.values)).toEqual(Array.from(second.values));
  });

  it('covers the route AABB expanded by its margin', () => {
    const field = buildRouteDistanceField(
      straightRoute,
      cellSizeMeters,
      maxDistanceMeters,
      marginMeters,
    );

    expect(field.originX).toBe(-marginMeters);
    expect(field.originZ).toBe(-marginMeters);
    expect(field.cols).toBe(Math.ceil((990 + marginMeters - field.originX) / cellSizeMeters) + 1);
    expect(field.rows).toBe(Math.ceil((marginMeters - field.originZ) / cellSizeMeters) + 1);
  });

  it('has approximately zero distance at each route point', () => {
    const field = buildRouteDistanceField(
      straightRoute,
      cellSizeMeters,
      maxDistanceMeters,
      marginMeters,
    );

    for (const point of straightRoute) {
      expect(sampleRouteDistance(field, point.x, point.z)).toBeLessThanOrEqual(cellSizeMeters);
    }
  });
});
