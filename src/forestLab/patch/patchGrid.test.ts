import { describe, expect, it } from 'vitest';

import { defaultSettings } from '../../config/settings';
import { computeTerrainVertices, buildTerrainGeometry } from '../../terrain/terrainMesh';
import { computeTerrainUVs } from '../../terrain/terrainUv';
import type { ElevationGrid } from '../../types';
import {
  CANONICAL_CELL_SIZE_METERS,
  CANONICAL_COLS,
  CANONICAL_ROWS,
  PATCH_SIZE_CELLS,
  SHELL_SUBDIVISION,
} from '../labConstants';
import type { PatchSpec } from '../labTypes';
import {
  buildPatchIndices,
  buildPatchTerrainUvs,
  buildPatchTerrainVertices,
  canonicalIndexOf,
  patchVertexIndex,
  sampleGridBilinear,
  shellCanonicalCol,
  shellCanonicalRow,
  shellVertexCount,
  shellVertexIndex,
  shellWorldX,
  shellWorldZ,
} from './patchGrid';

const patch: PatchSpec = {
  id: 'A',
  rowStart: 92,
  rowEnd: 188,
  colStart: 36,
  colEnd: 132,
};

function syntheticGrid(): ElevationGrid {
  const values = new Float32Array(CANONICAL_ROWS * CANONICAL_COLS);
  for (let row = 0; row < CANONICAL_ROWS; row += 1) {
    for (let col = 0; col < CANONICAL_COLS; col += 1) {
      values[row * CANONICAL_COLS + col] = row * 0.375 - col * 0.125 + (row % 7);
    }
  }
  return {
    rows: CANONICAL_ROWS,
    cols: CANONICAL_COLS,
    values,
    cellSizeMeters: CANONICAL_CELL_SIZE_METERS,
    bounds: { north: 2, south: 1, west: 3, east: 4 },
  };
}

describe('patch grid', () => {
  it('maps every 97x97 patch point to local and canonical row-major indices', () => {
    for (let localRow = 0; localRow <= PATCH_SIZE_CELLS; localRow += 1) {
      for (let localCol = 0; localCol <= PATCH_SIZE_CELLS; localCol += 1) {
        expect(patchVertexIndex(localRow, localCol, PATCH_SIZE_CELLS)).toBe(
          localRow * (PATCH_SIZE_CELLS + 1) + localCol,
        );
        expect(canonicalIndexOf(patch, localRow, localCol)).toBe(
          (patch.rowStart + localRow) * CANONICAL_COLS + patch.colStart + localCol,
        );
      }
    }
  });

  it('matches production terrain positions at every canonical patch index exactly', () => {
    const grid = syntheticGrid();
    const settings = { ...defaultSettings, elevationScale: 1.375 };
    const canonical = computeTerrainVertices(grid, settings);
    const actual = buildPatchTerrainVertices(grid, patch, settings);

    for (let localRow = 0; localRow <= PATCH_SIZE_CELLS; localRow += 1) {
      for (let localCol = 0; localCol <= PATCH_SIZE_CELLS; localCol += 1) {
        const local = patchVertexIndex(localRow, localCol, PATCH_SIZE_CELLS);
        const canonicalIndex = canonicalIndexOf(patch, localRow, localCol);
        expect(actual[local * 3]).toBe(canonical[canonicalIndex * 3]);
        expect(actual[local * 3 + 1]).toBe(canonical[canonicalIndex * 3 + 1]);
        expect(actual[local * 3 + 2]).toBe(canonical[canonicalIndex * 3 + 2]);
      }
    }
  });

  it('matches production UVs at every canonical patch index exactly', () => {
    const canonical = computeTerrainUVs({ rows: CANONICAL_ROWS, cols: CANONICAL_COLS });
    const actual = buildPatchTerrainUvs(patch);
    for (let localRow = 0; localRow <= PATCH_SIZE_CELLS; localRow += 1) {
      for (let localCol = 0; localCol <= PATCH_SIZE_CELLS; localCol += 1) {
        const local = patchVertexIndex(localRow, localCol, PATCH_SIZE_CELLS);
        const canonicalIndex = canonicalIndexOf(patch, localRow, localCol);
        expect(actual[local * 2]).toBe(canonical[canonicalIndex * 2]);
        expect(actual[local * 2 + 1]).toBe(canonical[canonicalIndex * 2 + 1]);
      }
    }
  });

  it('uses the production triangle winding and index order', () => {
    const size = 5;
    const grid: ElevationGrid = {
      rows: size + 1,
      cols: size + 1,
      values: new Float32Array((size + 1) ** 2),
      cellSizeMeters: CANONICAL_CELL_SIZE_METERS,
      bounds: { north: 2, south: 1, west: 3, east: 4 },
    };
    const geometry = buildTerrainGeometry(grid, defaultSettings);
    expect(Array.from(buildPatchIndices(size))).toEqual(Array.from(geometry.getIndex()!.array));
    geometry.dispose();
  });

  it('keeps canonical vertices as an exact shell-grid subset', () => {
    expect(shellVertexCount(PATCH_SIZE_CELLS, SHELL_SUBDIVISION)).toBe(1537 ** 2);
    for (let i = 0; i <= PATCH_SIZE_CELLS * SHELL_SUBDIVISION; i += SHELL_SUBDIVISION) {
      const localCol = i / SHELL_SUBDIVISION;
      expect(shellCanonicalCol(i, patch, SHELL_SUBDIVISION)).toBe(patch.colStart + localCol);
      expect(shellWorldX(i, patch)).toBe((patch.colStart + localCol) * CANONICAL_CELL_SIZE_METERS);
    }
    for (let j = 0; j <= PATCH_SIZE_CELLS * SHELL_SUBDIVISION; j += SHELL_SUBDIVISION) {
      const localRow = j / SHELL_SUBDIVISION;
      expect(shellCanonicalRow(j, patch, SHELL_SUBDIVISION)).toBe(patch.rowStart + localRow);
      expect(shellWorldZ(j, patch)).toBe((patch.rowStart + localRow) * CANONICAL_CELL_SIZE_METERS);
    }
    expect(shellVertexIndex(7, 9, PATCH_SIZE_CELLS, SHELL_SUBDIVISION)).toBe(9 * 1537 + 7);
  });

  it('bilinearly samples and clamps the elevation grid', () => {
    const grid: Pick<ElevationGrid, 'cols' | 'rows' | 'values'> = {
      cols: 2,
      rows: 2,
      values: new Float32Array([0, 10, 20, 30]),
    };
    expect(sampleGridBilinear(grid, 0.25, 0.5)).toBe(12.5);
    expect(sampleGridBilinear(grid, -10, 10)).toBe(20);
  });
});
