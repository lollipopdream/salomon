import { describe, expect, it } from 'vitest';

import { generateSyntheticElevationGrid } from './syntheticDem';

describe('generateSyntheticElevationGrid', () => {
  it('creates a smooth peak that is higher than the outer cells', () => {
    const grid = generateSyntheticElevationGrid(5, 5, 599);
    const center = grid.values[2 * grid.cols + 2];
    const northWestCorner = grid.values[0];
    const eastEdge = grid.values[2 * grid.cols + 4];

    expect(center).toBeGreaterThan(northWestCorner);
    expect(center).toBeGreaterThan(eastEdge);
  });

  it('reaches the requested elevation near the center', () => {
    const grid = generateSyntheticElevationGrid(5, 5, 599);
    const maximum = Math.max(...grid.values);

    expect(maximum).toBeCloseTo(599, 4);
  });

  it('sets a cell size based on the approximate six-kilometer coverage', () => {
    const grid = generateSyntheticElevationGrid(100, 50, 599);

    expect(grid.cellSizeMeters).toBe(60);
  });
});
