import { describe, expect, it } from 'vitest';

import type { LatLng } from '../types';
import { latLngToVec3 } from './coords';

const origin: LatLng = { lat: 35.6255, lng: 139.2432 };
const METERS_PER_DEGREE_LAT = 111320;

describe('latLngToVec3', () => {
  it('maps the origin to the world origin', () => {
    expect(latLngToVec3(origin, origin, 1.0)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('maps north to negative Z', () => {
    const point = { lat: origin.lat + 0.001, lng: origin.lng };
    const result = latLngToVec3(point, origin, 1.0);

    expect(result.x).toBeCloseTo(0, 10);
    expect(result.y).toBe(0);
    expect(result.z).toBeCloseTo(-111.32, 1);
  });

  it('maps east to positive X using the longitude scale at the origin', () => {
    const point = { lat: origin.lat, lng: origin.lng + 0.001 };
    const expectedX = 0.001
      * METERS_PER_DEGREE_LAT
      * Math.cos(origin.lat * Math.PI / 180);
    const result = latLngToVec3(point, origin, 1.0);

    expect(result.x).toBeCloseTo(expectedX, 8);
    expect(result.y).toBe(0);
    expect(result.z).toBeCloseTo(0, 10);
  });

  it('maps south to positive Z', () => {
    const point = { lat: origin.lat - 0.001, lng: origin.lng };
    const result = latLngToVec3(point, origin, 1.0);

    expect(result.z).toBeCloseTo(111.32, 1);
  });

  it('maps west to negative X', () => {
    const point = { lat: origin.lat, lng: origin.lng - 0.001 };
    const result = latLngToVec3(point, origin, 1.0);

    expect(result.x).toBeLessThan(0);
    expect(result.x).toBeCloseTo(
      -0.001 * METERS_PER_DEGREE_LAT * Math.cos(origin.lat * Math.PI / 180),
      8,
    );
  });

  it('scales every coordinate by metersPerUnit', () => {
    const point = { lat: origin.lat + 0.001, lng: origin.lng };
    const unitScaleResult = latLngToVec3(point, origin, 1.0);
    const doubleScaleResult = latLngToVec3(point, origin, 2.0);

    expect(doubleScaleResult.x).toBeCloseTo(unitScaleResult.x * 2, 10);
    expect(doubleScaleResult.y).toBeCloseTo(unitScaleResult.y * 2, 10);
    expect(doubleScaleResult.z).toBeCloseTo(unitScaleResult.z * 2, 10);
  });
});
