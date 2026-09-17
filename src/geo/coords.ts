import type { LatLng, Vec3 } from '../types';

const METERS_PER_DEGREE_LAT = 111320;

/**
 * Converts a geographic point to local Three.js world coordinates using an
 * equirectangular approximation. X points east, Y is elevation, and Z points
 * south, so locations north of the origin have a negative Z coordinate.
 */
export function latLngToVec3(
  point: LatLng,
  origin: LatLng,
  metersPerUnit: number,
): Vec3 {
  const originLatitudeRadians = origin.lat * Math.PI / 180;
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos(originLatitudeRadians);
  const deltaLat = point.lat - origin.lat;
  const deltaLng = point.lng - origin.lng;
  const z = deltaLat === 0
    ? 0
    : -deltaLat * METERS_PER_DEGREE_LAT * metersPerUnit;

  return {
    x: deltaLng * metersPerDegreeLng * metersPerUnit,
    y: 0,
    z,
  };
}
