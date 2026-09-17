import { describe, expect, it } from 'vitest';

import { defaultSettings } from '../config/settings';
import type { ElevationGrid } from '../types';
import { buildTerrainGeometry } from './terrainMesh';

function createGrid(rows: number, cols: number, cellSizeMeters: number): ElevationGrid {
  return {
    rows,
    cols,
    cellSizeMeters,
    values: Float32Array.from(
      { length: rows * cols },
      (_, index) => index * 3,
    ),
    bounds: { north: 1, south: 0, east: 1, west: 0 },
  };
}

function expectRowMajorTriangleLayout(
  rows: number,
  cols: number,
  cellSizeMeters: number,
): void {
  const geometry = buildTerrainGeometry(
    createGrid(rows, cols, cellSizeMeters),
    defaultSettings,
  );
  const index = geometry.getIndex();
  const position = geometry.getAttribute('position');
  const indicesPerRow = (cols - 1) * 6;

  expect(index).not.toBeNull();
  expect(index?.count).toBe((rows - 1) * indicesPerRow);

  for (let row = 0; row < rows - 1; row += 1) {
    const rangeStart = row * indicesPerRow;
    const rangeEnd = (row + 1) * indicesPerRow;

    for (let offset = rangeStart; offset < rangeEnd; offset += 1) {
      const vertexIndex = index!.getX(offset);
      const vertexRow = Math.floor(vertexIndex / cols);
      const worldZ = position.getZ(vertexIndex);

      expect([row, row + 1]).toContain(vertexRow);
      expect(worldZ).toBeGreaterThanOrEqual(row * cellSizeMeters);
      expect(worldZ).toBeLessThanOrEqual((row + 1) * cellSizeMeters);
    }
  }

  geometry.dispose();
}

describe('buildTerrainGeometry index layout', () => {
  it('keeps each 5x5 triangle row in a contiguous row-major index block', () => {
    expectRowMajorTriangleLayout(5, 5, 12.5);
  });

  it('keeps the row-major layout for a differently shaped 3x7 grid', () => {
    expectRowMajorTriangleLayout(3, 7, 8);
  });
});
