const NO_DATA_VALUE = 2 ** 23;
const RGB_VALUE_RANGE = 2 ** 24;
const ELEVATION_UNIT_METERS = 0.01;

/** Decode a Geospatial Information Authority of Japan elevation-tile pixel. */
export function decodeElevationPixel(
  r: number,
  g: number,
  b: number,
): number | null {
  const x = r * 65536 + g * 256 + b;

  if (x < NO_DATA_VALUE) {
    return x * ELEVATION_UNIT_METERS;
  }

  if (x === NO_DATA_VALUE) {
    return null;
  }

  return (x - RGB_VALUE_RANGE) * ELEVATION_UNIT_METERS;
}

/** Convert an elevation in meters to the corresponding world-space height. */
export function elevationToWorldHeight(
  elevationMeters: number,
  scale: number,
): number {
  return elevationMeters * scale;
}
