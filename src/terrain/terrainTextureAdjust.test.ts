import { describe, expect, it } from 'vitest';

import type { TerrainTextureColorAdjustConfig } from '../types';
import { adjustImageDataColor } from './terrainTextureAdjust';

function makePixels(pixels: ReadonlyArray<readonly [number, number, number, number]>): Uint8ClampedArray {
  const data = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach(([r, g, b, a], index) => {
    const offset = index * 4;
    data[offset] = r;
    data[offset + 1] = g;
    data[offset + 2] = b;
    data[offset + 3] = a;
  });
  return data;
}

describe('adjustImageDataColor', () => {
  it('leaves pixels unchanged when saturation/contrast/brightness are all 1', () => {
    const identity: TerrainTextureColorAdjustConfig = {
      saturation: 1,
      contrast: 1,
      brightness: 1,
    };
    const data = makePixels([
      [10, 20, 30, 255],
      [128, 128, 128, 200],
      [255, 0, 0, 128],
    ]);
    const before = Uint8ClampedArray.from(data);

    adjustImageDataColor(data, identity);

    expect(Array.from(data)).toEqual(Array.from(before));
  });

  it('leaves mid-gray unchanged and pushes pure colors further apart under increased contrast', () => {
    const highContrast: TerrainTextureColorAdjustConfig = {
      saturation: 1,
      contrast: 2,
      brightness: 1,
    };
    const data = makePixels([
      [128, 128, 128, 255],
      [255, 0, 0, 255],
    ]);

    adjustImageDataColor(data, highContrast);

    // Mid-gray (128/255 ~= 0.502) should stay ~unchanged (within 1 unit of rounding).
    expect(Math.abs(data[0] - 128)).toBeLessThanOrEqual(1);
    expect(Math.abs(data[1] - 128)).toBeLessThanOrEqual(1);
    expect(Math.abs(data[2] - 128)).toBeLessThanOrEqual(1);
    expect(data[3]).toBe(255);

    // Pure red channel (255) was already at max, contrast pushes it further from 0.5,
    // clamped at 255. Green/blue channels (0) are pushed further below 0.5, clamped at 0.
    expect(data[4]).toBe(255);
    expect(data[5]).toBe(0);
    expect(data[6]).toBe(0);
    expect(data[7]).toBe(255);
  });

  it('fully desaturates pixels to their luminance value when saturation is 0', () => {
    const grayscale: TerrainTextureColorAdjustConfig = {
      saturation: 0,
      contrast: 1,
      brightness: 1,
    };
    const data = makePixels([
      [255, 0, 0, 255],
    ]);

    adjustImageDataColor(data, grayscale);

    expect(data[0]).toBe(data[1]);
    expect(data[1]).toBe(data[2]);
    // Luminance of pure red (0.2126 * 1.0) * 255 ~= 54.2
    expect(data[0]).toBeCloseTo(54, 0);
    expect(data[3]).toBe(255);
  });

  it('multiplies channel values by brightness and clamps at 255', () => {
    const brighter: TerrainTextureColorAdjustConfig = {
      saturation: 1,
      contrast: 1,
      brightness: 1.5,
    };
    const data = makePixels([
      [100, 100, 100, 255],
      [200, 200, 200, 255],
    ]);

    adjustImageDataColor(data, brighter);

    expect(data[0]).toBe(150);
    expect(data[4]).toBe(255);
    expect(data[7]).toBe(255);
  });

  it('does not modify the alpha channel', () => {
    const config: TerrainTextureColorAdjustConfig = {
      saturation: 1.5,
      contrast: 1.3,
      brightness: 0.8,
    };
    const data = makePixels([
      [10, 20, 30, 77],
    ]);

    adjustImageDataColor(data, config);

    expect(data[3]).toBe(77);
  });
});
