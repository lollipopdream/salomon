import { describe, expect, it } from 'vitest';

import { computeTerrainUVs } from './terrainUv';

function uvAt(
  uvs: Float32Array,
  cols: number,
  row: number,
  col: number,
): [number, number] {
  const offset = (row * cols + col) * 2;
  return [uvs[offset], uvs[offset + 1]];
}

describe('computeTerrainUVs', () => {
  it('maps all four corners with north at v=1 and south at v=0', () => {
    const uvs = computeTerrainUVs({ cols: 3, rows: 3 });

    expect(uvAt(uvs, 3, 0, 0)).toEqual([0, 1]);
    expect(uvAt(uvs, 3, 0, 2)).toEqual([1, 1]);
    expect(uvAt(uvs, 3, 2, 0)).toEqual([0, 0]);
    expect(uvAt(uvs, 3, 2, 2)).toEqual([1, 0]);
  });

  it('maps the center vertex to the center of the texture', () => {
    const uvs = computeTerrainUVs({ cols: 3, rows: 3 });

    expect(uvAt(uvs, 3, 1, 1)).toEqual([0.5, 0.5]);
  });

  it('returns two components for every row-major grid vertex', () => {
    const grid = { cols: 4, rows: 3 };

    const uvs = computeTerrainUVs(grid);

    expect(uvs).toBeInstanceOf(Float32Array);
    expect(uvs.length).toBe(grid.rows * grid.cols * 2);
  });

  it.each([
    { cols: 0, rows: 3 },
    { cols: -1, rows: 3 },
    { cols: 1.5, rows: 3 },
    { cols: 3, rows: 0 },
    { cols: 3, rows: -1 },
    { cols: 3, rows: 1.5 },
  ])('rejects invalid dimensions: %o', (grid) => {
    expect(() => computeTerrainUVs(grid)).toThrow(RangeError);
  });

  it.each([
    {
      grid: { cols: 1, rows: 3 },
      expected: [0, 1, 0, 0.5, 0, 0],
    },
    {
      grid: { cols: 3, rows: 1 },
      expected: [0, 1, 0.5, 1, 1, 1],
    },
    {
      grid: { cols: 1, rows: 1 },
      expected: [0, 1],
    },
  ])('handles a degenerate $grid.cols x $grid.rows grid', ({ grid, expected }) => {
    const uvs = computeTerrainUVs(grid);

    expect(Array.from(uvs)).toEqual(expected);
    expect(Array.from(uvs).every(Number.isFinite)).toBe(true);
  });
});
