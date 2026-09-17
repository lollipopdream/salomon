import { describe, expect, it } from 'vitest';

import { applyShadeFactorsToImageData } from './terrainShadeComposite';

// applyDemShadeToTexture is intentionally not unit-tested: vitest uses the
// node environment where document is undefined, so it is verified only in Chrome.

describe('applyShadeFactorsToImageData', () => {
  it('leaves all image bytes unchanged when every factor is 1', () => {
    const data = new Uint8ClampedArray([
      10, 20, 30, 40,
      50, 60, 70, 80,
      90, 100, 110, 120,
      130, 140, 150, 160,
    ]);
    const before = Uint8ClampedArray.from(data);

    applyShadeFactorsToImageData(data, 2, 2, new Float32Array([1, 1, 1, 1]), 2, 2);

    expect(data).toEqual(before);
  });

  it('halves RGB values with rounding while leaving alpha unchanged', () => {
    const data = new Uint8ClampedArray([
      1, 3, 5, 7,
      100, 201, 255, 129,
    ]);

    applyShadeFactorsToImageData(data, 2, 1, new Float32Array([0.5]), 1, 1);

    expect(Array.from(data)).toEqual([
      1, 2, 3, 7,
      50, 101, 128, 129,
    ]);
  });

  it('clamps the four image corners to the corresponding corner factors', () => {
    const data = new Uint8ClampedArray(4 * 4 * 4);
    for (let offset = 0; offset < data.length; offset += 4) {
      data[offset] = 100;
      data[offset + 1] = 100;
      data[offset + 2] = 100;
      data[offset + 3] = 255;
    }

    applyShadeFactorsToImageData(
      data,
      4,
      4,
      new Float32Array([
        0.25, 0.5,
        0.75, 1,
      ]),
      2,
      2,
    );

    const topLeft = 0;
    const topRight = (4 - 1) * 4;
    const bottomLeft = ((4 - 1) * 4) * 4;
    const bottomRight = ((4 - 1) * 4 + (4 - 1)) * 4;
    expect(data[topLeft]).toBe(25);
    expect(data[topRight]).toBe(50);
    expect(data[bottomLeft]).toBe(75);
    expect(data[bottomRight]).toBe(100);
  });

  it('clamps multiplied RGB values to 255', () => {
    const data = new Uint8ClampedArray([200, 200, 200, 77]);

    applyShadeFactorsToImageData(data, 1, 1, new Float32Array([2]), 1, 1);

    expect(Array.from(data)).toEqual([255, 255, 255, 77]);
  });

  it('throws RangeError for either image-data or factor-grid length mismatches', () => {
    expect(() => applyShadeFactorsToImageData(
      new Uint8ClampedArray(3),
      1,
      1,
      new Float32Array([1]),
      1,
      1,
    )).toThrow(RangeError);

    expect(() => applyShadeFactorsToImageData(
      new Uint8ClampedArray(4),
      1,
      1,
      new Float32Array(0),
      1,
      1,
    )).toThrow(RangeError);
  });
});
