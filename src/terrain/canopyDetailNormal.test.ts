import { describe, expect, it } from 'vitest';

import type { CanopyDetailNormalConfig } from '../types';
import { computeCanopyDetailNormalField } from './canopyDetailNormal';

const config: CanopyDetailNormalConfig = {
  resolution: 7,
  blurRadiusTexels: 1,
  heightScale: 2,
  weight: 1,
};

function normalAt(
  values: Float32Array,
  cols: number,
  row: number,
  col: number,
): readonly [number, number, number] {
  const offset = (row * cols + col) * 3;
  return [values[offset], values[offset + 1], values[offset + 2]];
}

describe('computeCanopyDetailNormalField', () => {
  it('produces neutral normals for uniform luminance', () => {
    const luminance = new Float32Array(5 * 4).fill(0.4);
    const field = computeCanopyDetailNormalField(luminance, 5, 4, 1, config);

    for (let index = 0; index < luminance.length; index += 1) {
      expect(normalAt(field.values, 5, Math.floor(index / 5), index % 5))
        .toEqual([0, 0, 1]);
    }
  });

  it('removes a linear low-frequency ramp so interior normals stay neutral', () => {
    // This is the key high-pass proof: a symmetric box blur reproduces a
    // linear ramp in the interior, so it must contribute no detail normal.
    const cols = 9;
    const rows = 5;
    const luminance = Float32Array.from(
      { length: cols * rows },
      (_, index) => (index % cols) / cols,
    );
    const field = computeCanopyDetailNormalField(luminance, cols, rows, 1, config);

    for (let row = 1; row < rows - 1; row += 1) {
      for (let col = 2; col < cols - 2; col += 1) {
        const [x, y, z] = normalAt(field.values, cols, row, col);
        expect(x).toBeCloseTo(0, 3);
        expect(y).toBeCloseTo(0, 3);
        expect(z).toBeCloseTo(1, 3);
      }
    }
  });

  it('produces neutral normals when blurRadiusTexels is zero', () => {
    const luminance = Float32Array.from([
      0.1, 0.8, 0.3,
      0.7, 0.2, 1.0,
      0.4, 0.9, 0.0,
    ]);
    const field = computeCanopyDetailNormalField(luminance, 3, 3, 1, {
      ...config,
      blurRadiusTexels: 0,
    });

    for (let index = 0; index < luminance.length; index += 1) {
      expect(normalAt(field.values, 3, Math.floor(index / 3), index % 3))
        .toEqual([0, 0, 1]);
    }
  });

  it('tilts normals around one bright texel with the expected tangent-space signs', () => {
    const cols = 5;
    const rows = 5;
    const luminance = new Float32Array(cols * rows);
    luminance[2 * cols + 2] = 1;
    const field = computeCanopyDetailNormalField(luminance, cols, rows, 1, config);
    const west = normalAt(field.values, cols, 2, 1);
    const east = normalAt(field.values, cols, 2, 3);
    const north = normalAt(field.values, cols, 1, 2);
    const south = normalAt(field.values, cols, 3, 2);

    expect(west[0]).toBeLessThan(0);
    expect(east[0]).toBeGreaterThan(0);
    // Because +v is world -Z, the southward (+row) gradient maps to +normal.y.
    expect(north[1]).toBeGreaterThan(0);
    expect(south[1]).toBeLessThan(0);
    expect(west[2]).toBeLessThan(1);
    expect(north[2]).toBeLessThan(1);
  });

  it('normalizes every vector to unit length with a positive z component', () => {
    const cols = 7;
    const rows = 6;
    const luminance = Float32Array.from(
      { length: cols * rows },
      (_, index) => ((index * 17 + 5) % 31) / 30,
    );
    const field = computeCanopyDetailNormalField(luminance, cols, rows, 1.9416, config);

    for (let index = 0; index < luminance.length; index += 1) {
      const offset = index * 3;
      const x = field.values[offset];
      const y = field.values[offset + 1];
      const z = field.values[offset + 2];
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6);
      expect(z).toBeGreaterThan(0);
    }
  });
});
