import { describe, expect, it } from 'vitest';

import type { DemFullResolution } from '../types';
import { computeDemDetailNormalField } from './demNormalMap';

function createDem(
  rows: number,
  cols: number,
  heightAt: (row: number, col: number) => number,
): DemFullResolution {
  const values = new Float32Array(rows * cols);

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      values[row * cols + col] = heightAt(row, col);
    }
  }

  return { rows, cols, values, cellSizeMeters: 1 };
}

function normalAt(
  values: Float32Array,
  cols: number,
  row: number,
  col: number,
): [number, number, number] {
  const offset = (row * cols + col) * 3;
  return [values[offset], values[offset + 1], values[offset + 2]];
}

describe('computeDemDetailNormalField', () => {
  it('returns neutral normals for a flat DEM', () => {
    const dem = createDem(7, 7, () => 0);

    const field = computeDemDetailNormalField(dem, {
      coarseStepPixels: 2,
      strength: 1,
    });

    for (let row = 0; row < dem.rows; row += 1) {
      for (let col = 0; col < dem.cols; col += 1) {
        expect(normalAt(field.values, dem.cols, row, col)).toEqual([0, 0, 1]);
      }
    }
  });

  it('removes a constant macro slope so mesh geometry is not counted twice', () => {
    const dem = createDem(9, 9, (_row, col) => 5 * col);
    const coarseStepPixels = 2;

    const field = computeDemDetailNormalField(dem, {
      coarseStepPixels,
      strength: 1,
    });

    // Fine and coarse gradients match for a constant slope. A neutral result
    // proves the macro slope already present in mesh geometry is not rebaked.
    for (let row = coarseStepPixels; row < dem.rows - coarseStepPixels; row += 1) {
      for (let col = coarseStepPixels; col < dem.cols - coarseStepPixels; col += 1) {
        expect(normalAt(field.values, dem.cols, row, col)).toEqual([0, 0, 1]);
      }
    }
  });

  it('points toward negative tangent x immediately west of a positive spike', () => {
    const dem = createDem(9, 9, (row, col) =>
      row === 4 && col === 4 ? 10 : 0,
    );

    const field = computeDemDetailNormalField(dem, {
      coarseStepPixels: 2,
      strength: 1,
    });

    expect(normalAt(field.values, dem.cols, 4, 3)[0]).toBeLessThan(0);
  });

  it('keeps every texel inside the coarse-step boundary strip neutral', () => {
    const dem = createDem(8, 9, (row, col) => row * row + col * col * col);
    const coarseStepPixels = 2;

    const field = computeDemDetailNormalField(dem, {
      coarseStepPixels,
      strength: 1,
    });

    for (let row = 0; row < dem.rows; row += 1) {
      for (let col = 0; col < dem.cols; col += 1) {
        const isBoundary =
          col < coarseStepPixels ||
          col >= dem.cols - coarseStepPixels ||
          row < coarseStepPixels ||
          row >= dem.rows - coarseStepPixels;
        if (isBoundary) {
          expect(normalAt(field.values, dem.cols, row, col)).toEqual([0, 0, 1]);
        }
      }
    }
  });

  it('normalizes every vector to unit length with a positive z component', () => {
    const dem = createDem(
      8,
      9,
      (row, col) => row * row * 0.75 - col * col * col * 0.25,
    );

    const field = computeDemDetailNormalField(dem, {
      coarseStepPixels: 2,
      strength: 1.5,
    });

    for (let index = 0; index < dem.rows * dem.cols; index += 1) {
      const offset = index * 3;
      const x = field.values[offset];
      const y = field.values[offset + 1];
      const z = field.values[offset + 2];
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6);
      expect(z).toBeGreaterThan(0);
    }
  });

  it('increases the absolute x component when strength is doubled', () => {
    const dem = createDem(9, 9, (row, col) =>
      row === 4 && col === 4 ? 10 : 0,
    );
    const base = computeDemDetailNormalField(dem, {
      coarseStepPixels: 2,
      strength: 1,
    });
    const doubled = computeDemDetailNormalField(dem, {
      coarseStepPixels: 2,
      strength: 2,
    });

    expect(Math.abs(normalAt(doubled.values, dem.cols, 4, 3)[0])).toBeGreaterThan(
      Math.abs(normalAt(base.values, dem.cols, 4, 3)[0]),
    );
  });

  it('returns only neutral normals for the degenerate coarse step of one', () => {
    const dem = createDem(7, 8, (row, col) => row * row + col * col * col);

    const field = computeDemDetailNormalField(dem, {
      coarseStepPixels: 1,
      strength: 3,
    });

    for (let row = 0; row < dem.rows; row += 1) {
      for (let col = 0; col < dem.cols; col += 1) {
        expect(normalAt(field.values, dem.cols, row, col)).toEqual([0, 0, 1]);
      }
    }
  });
});
