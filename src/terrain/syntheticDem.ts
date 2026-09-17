import type { ElevationGrid } from '../types';

const TAKAO_ORIGIN = { lat: 35.6255, lng: 139.2432 };
const RADIUS_METERS = 1_800;
const METERS_PER_DEGREE_LATITUDE = 111_320;
const BASE_ELEVATION_METERS = 200;
const GAUSSIAN_FALLOFF = 4;

/** Generate non-official placeholder terrain for PoC fallback use only. */
export function generateSyntheticElevationGrid(
  cols: number,
  rows: number,
  peakElevation: number,
): ElevationGrid {
  if (
    !Number.isInteger(cols) ||
    !Number.isInteger(rows) ||
    cols <= 0 ||
    rows <= 0
  ) {
    throw new RangeError('Synthetic DEM dimensions must be positive integers.');
  }
  if (!Number.isFinite(peakElevation)) {
    throw new RangeError('Synthetic DEM peak elevation must be finite.');
  }

  const centerX = (cols - 1) / 2;
  const centerY = (rows - 1) / 2;
  const scaleX = Math.max(centerX, 1);
  const scaleY = Math.max(centerY, 1);
  const nearestCenterDx = cols % 2 === 0 ? 0.5 / scaleX : 0;
  const nearestCenterDy = rows % 2 === 0 ? 0.5 / scaleY : 0;
  const minimumRadiusSquared =
    nearestCenterDx * nearestCenterDx + nearestCenterDy * nearestCenterDy;
  const baseElevation = Math.min(BASE_ELEVATION_METERS, peakElevation * 0.5);
  const values = new Float32Array(cols * rows);

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const dx = (col - centerX) / scaleX;
      const dy = (row - centerY) / scaleY;
      const radiusSquared = Math.max(
        0,
        dx * dx + dy * dy - minimumRadiusSquared,
      );
      const elevation =
        baseElevation +
        (peakElevation - baseElevation) *
          Math.exp(-GAUSSIAN_FALLOFF * radiusSquared);
      values[row * cols + col] = elevation;
    }
  }

  const latitudeDelta = RADIUS_METERS / METERS_PER_DEGREE_LATITUDE;
  const longitudeDelta =
    RADIUS_METERS /
    (METERS_PER_DEGREE_LATITUDE *
      Math.cos((TAKAO_ORIGIN.lat * Math.PI) / 180));

  return {
    cols,
    rows,
    values,
    // Approximate the real DEM's roughly 6 km square coverage.
    cellSizeMeters: 6_000 / Math.max(cols, rows),
    bounds: {
      north: TAKAO_ORIGIN.lat + latitudeDelta,
      south: TAKAO_ORIGIN.lat - latitudeDelta,
      east: TAKAO_ORIGIN.lng + longitudeDelta,
      west: TAKAO_ORIGIN.lng - longitudeDelta,
    },
  };
}
