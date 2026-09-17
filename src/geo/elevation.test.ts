import { describe, expect, it } from 'vitest';

import { decodeElevationPixel, elevationToWorldHeight } from './elevation';

describe('decodeElevationPixel', () => {
  it('decodes zero elevation', () => {
    expect(decodeElevationPixel(0, 0, 0)).toBe(0);
  });

  it('decodes a positive elevation', () => {
    expect(decodeElevationPixel(0, 233, 252)).toBeCloseTo(599.0, 2);
  });

  it('returns null for the no-data value', () => {
    expect(decodeElevationPixel(128, 0, 0)).toBeNull();
  });

  it('decodes a negative elevation', () => {
    expect(decodeElevationPixel(255, 252, 24)).toBeCloseTo(-10.0, 2);
  });
});

describe('elevationToWorldHeight', () => {
  it.each([
    [599, 1.0, 599],
    [599, 0.5, 299.5],
    [-10, 2, -20],
  ])('converts %s meters at scale %s to %s', (elevation, scale, expected) => {
    expect(elevationToWorldHeight(elevation, scale)).toBe(expected);
  });
});
