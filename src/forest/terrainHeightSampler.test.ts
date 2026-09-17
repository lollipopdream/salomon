import { describe, expect, it } from 'vitest';

import type { TerrainGridLike } from './terrainHeightSampler';
import {
  createTerrainHeightSampler,
  sampleTerrainSlopeRadians,
} from './terrainHeightSampler';

const cols = 5;
const rows = 5;
const cellSizeMeters = 10;

function createGrid(valueAt: (col: number, row: number) => number): TerrainGridLike {
  return {
    cols,
    rows,
    cellSizeMeters,
    values: Float32Array.from(
      Array.from({ length: cols * rows }, (_, index) =>
        valueAt(index % cols, Math.floor(index / cols)),
      ),
    ),
  };
}

describe('createTerrainHeightSampler', () => {
  it('returns the same height at every point for a constant grid', () => {
    const sample = createTerrainHeightSampler(createGrid(() => 150), 1);

    expect(sample(0, 0)).toBe(150);
    expect(sample(17.25, 31.5)).toBe(150);
    expect(sample(40, 40)).toBe(150);
  });

  it('matches the analytic height for an eastward constant gradient', () => {
    const sample = createTerrainHeightSampler(
      createGrid((col) => 100 + col * 2.5),
      1,
    );

    expect(sample(15, 26)).toBeCloseTo(103.75);
  });

  it('matches grid values exactly at grid points', () => {
    const grid = createGrid((col, row) => row * 100 + col * 7);
    const sample = createTerrainHeightSampler(grid, 1);

    expect(sample(30, 20)).toBe(grid.values[2 * cols + 3]);
  });

  it('clamps samples outside the grid to the nearest edge', () => {
    const sample = createTerrainHeightSampler(
      createGrid((col, row) => row * 10 + col),
      1,
    );

    expect(sample(-5, 20)).toBe(20);
    expect(sample(100, 20)).toBe(24);
  });

  it('applies elevationScale to the sampled height', () => {
    const sample = createTerrainHeightSampler(createGrid(() => 37), 2);

    expect(sample(12, 28)).toBe(74);
  });
});

describe('sampleTerrainSlopeRadians', () => {
  it('matches atan(0.1) for an eastward 0.1 gradient', () => {
    const sample = createTerrainHeightSampler(
      createGrid((col) => col * cellSizeMeters * 0.1),
      1,
    );

    expect(sampleTerrainSlopeRadians(sample, 20, 20, 10)).toBeCloseTo(
      Math.atan(0.1),
    );
  });

  it('returns zero for flat terrain', () => {
    const sample = createTerrainHeightSampler(createGrid(() => 42), 1);

    expect(sampleTerrainSlopeRadians(sample, 20, 20, 10)).toBe(0);
  });
});
