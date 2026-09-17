import { describe, expect, it } from 'vitest';

import { computeLuminanceFromRgba } from './aerialLuminance';

// extractTextureLuminance is intentionally not unit-tested here because
// vitest runs in a Node environment where `document` is undefined.
describe('computeLuminanceFromRgba', () => {
  it('maps white to 1 and black to 0', () => {
    const result = computeLuminanceFromRgba(new Uint8ClampedArray([
      255, 255, 255, 255,
      0, 0, 0, 255,
    ]), 2);

    expect(result[0]).toBeCloseTo(1, 7);
    expect(result[1]).toBe(0);
  });

  it('uses the Rec.709 coefficients for red, green, and blue', () => {
    const result = computeLuminanceFromRgba(new Uint8ClampedArray([
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
    ]), 3);

    expect(result[0]).toBeCloseTo(0.2126, 4);
    expect(result[1]).toBeCloseTo(0.7152, 4);
    expect(result[2]).toBeCloseTo(0.0722, 4);
  });

  it('returns one value per pixel and rejects an inconsistent RGBA length', () => {
    const data = new Uint8ClampedArray(8);

    expect(computeLuminanceFromRgba(data, 2)).toHaveLength(2);
    expect(() => computeLuminanceFromRgba(data, 3)).toThrow(RangeError);
  });
});
