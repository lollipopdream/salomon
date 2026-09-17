import { describe, expect, it } from 'vitest';

import { computeTerrainRaycastDrawRange } from './terrainRaycastRange';

describe('computeTerrainRaycastDrawRange', () => {
  const rows = 10;
  const cols = 5;
  const cellSizeMeters = 10;
  const indicesPerRow = (cols - 1) * 6;
  const fullCount = (rows - 1) * indicesPerRow;

  it('limits a ray within one terrain row to that row plus the default margin', () => {
    expect(
      computeTerrainRaycastDrawRange(25, 29, cellSizeMeters, rows, cols),
    ).toEqual({
      start: indicesPerRow,
      count: indicesPerRow * 3,
      useFullTerrainRaycast: false,
    });
  });

  it('returns the full range for a ray spanning the complete terrain depth', () => {
    expect(
      computeTerrainRaycastDrawRange(-10, 100, cellSizeMeters, rows, cols),
    ).toEqual({
      start: 0,
      count: fullCount,
      useFullTerrainRaycast: false,
    });
  });

  it('clamps a partially negative z range without dropping row zero', () => {
    expect(
      computeTerrainRaycastDrawRange(-5, 5, cellSizeMeters, rows, cols),
    ).toEqual({
      start: 0,
      count: indicesPerRow * 2,
      useFullTerrainRaycast: false,
    });
  });

  it('clamps a range extending beyond the far terrain edge', () => {
    expect(
      computeTerrainRaycastDrawRange(85, 95, cellSizeMeters, rows, cols),
    ).toEqual({
      start: indicesPerRow * 7,
      count: indicesPerRow * 2,
      useFullTerrainRaycast: false,
    });
  });

  it.each([
    [-100, -90],
    [100, 110],
  ])('fails safe to the full range when both z values are outside: %p, %p', (z0, z1) => {
    expect(
      computeTerrainRaycastDrawRange(z0, z1, cellSizeMeters, rows, cols),
    ).toEqual({
      start: 0,
      count: fullCount,
      useFullTerrainRaycast: false,
    });
  });

  it('returns the same range when the ray endpoints are reversed', () => {
    const forward = computeTerrainRaycastDrawRange(
      25,
      67,
      cellSizeMeters,
      rows,
      cols,
    );
    const reverse = computeTerrainRaycastDrawRange(
      67,
      25,
      cellSizeMeters,
      rows,
      cols,
    );

    expect(reverse).toEqual(forward);
  });

  it.each([
    [Number.NaN, 20],
    [20, Number.NaN],
    [Number.POSITIVE_INFINITY, 20],
    [20, Number.NEGATIVE_INFINITY],
  ])('fails safe to the full range for non-finite endpoints: %p, %p', (z0, z1) => {
    expect(
      computeTerrainRaycastDrawRange(z0, z1, cellSizeMeters, rows, cols),
    ).toEqual({
      start: 0,
      count: fullCount,
      useFullTerrainRaycast: false,
    });
  });

  it('uses only the containing row at a cell boundary when margin is zero', () => {
    expect(
      computeTerrainRaycastDrawRange(20, 29.999, cellSizeMeters, rows, cols, 0),
    ).toEqual({
      start: indicesPerRow * 2,
      count: indicesPerRow,
      useFullTerrainRaycast: false,
    });
  });

  it.each([
    [-100, -90, undefined],
    [-5, 5, undefined],
    [0, 0, undefined],
    [20, 29.999, 0],
    [25, 67, undefined],
    [85, 95, undefined],
    [100, 110, undefined],
    [Number.NaN, 20, undefined],
    [20, Number.POSITIVE_INFINITY, undefined],
  ])('always returns a draw range inside the complete index buffer: %p', (
    z0,
    z1,
    marginRows,
  ) => {
    const range = computeTerrainRaycastDrawRange(
      z0,
      z1,
      cellSizeMeters,
      rows,
      cols,
      marginRows,
    );

    expect(range.start).toBeGreaterThanOrEqual(0);
    expect(range.count).toBeGreaterThanOrEqual(0);
    expect(range.start + range.count).toBeLessThanOrEqual(fullCount);
    expect(range.useFullTerrainRaycast).toBe(false);
  });

  it.each([
    [1, cols],
    [rows, 1],
    [1.5, cols],
    [rows, 2.5],
    [Number.NaN, cols],
    [rows, Number.NaN],
  ])('requires a full terrain raycast for invalid dimensions: %p, %p', (
    invalidRows,
    invalidCols,
  ) => {
    const range = computeTerrainRaycastDrawRange(
      25,
      29,
      cellSizeMeters,
      invalidRows,
      invalidCols,
    );

    // `count` cannot express a full index range without valid dimensions;
    // callers must branch on this explicit flag rather than treating zero as
    // an empty, safe raycast range.
    expect(range.useFullTerrainRaycast).toBe(true);
  });
});
