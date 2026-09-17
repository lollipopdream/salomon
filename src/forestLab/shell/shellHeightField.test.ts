import { describe, expect, it } from 'vitest';

import type { ElevationGrid } from '../../types';
import {
  CANONICAL_CELL_SIZE_METERS,
  CANONICAL_COLS,
  CANONICAL_ROWS,
  CANOPY_HEIGHT_METERS,
  MASK_SIZE,
  PATCH_SIZE_CELLS,
  SHELL_SUBDIVISION,
} from '../labConstants';
import type { PatchSpec } from '../labTypes';
import { shellVertexCount } from '../patch/patchGrid';
import { enumerateCrowns } from './crownField';
import {
  buildCanopyHeightFieldA,
  buildCanopyHeightFieldB,
  buildShellTaperField,
  buildShellTerrainYField,
  buildShellYField,
} from './shellHeightField';

const smallPatch: PatchSpec = {
  id: 'A',
  rowStart: 0,
  rowEnd: 2,
  colStart: 0,
  colEnd: 2,
};

function syntheticGrid(): ElevationGrid {
  const values = new Float32Array(CANONICAL_ROWS * CANONICAL_COLS);
  for (let row = 0; row < CANONICAL_ROWS; row += 1) {
    for (let col = 0; col < CANONICAL_COLS; col += 1) {
      values[row * CANONICAL_COLS + col] = row * 10 + col;
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

function floatBits(values: Float32Array): Uint32Array {
  return new Uint32Array(values.buffer, values.byteOffset, values.length);
}

describe('shell height fields', () => {
  it('builds bilinear terrain heights at shell resolution', () => {
    const terrain = buildShellTerrainYField(syntheticGrid(), smallPatch, 2, {
      elevationScale: 2,
    });
    expect(terrain).toHaveLength(25);
    expect(terrain[0]).toBe(0);
    expect(terrain[1]).toBe(1);
    expect(terrain[5]).toBe(10);
    expect(terrain[24]).toBe(44);
  });

  it('keeps shellY bit-identical to terrainY wherever taper is exactly zero', () => {
    const terrain = buildShellTerrainYField(syntheticGrid(), smallPatch, 2, {
      elevationScale: 1,
    });
    const taper = buildShellTaperField(
      new Float32Array(MASK_SIZE * MASK_SIZE),
      MASK_SIZE,
      smallPatch,
      2,
    );
    const canopy = buildCanopyHeightFieldA(terrain.length);
    const shell = buildShellYField(terrain, taper, canopy);
    for (let index = 0; index < shell.length; index += 1) {
      expect(taper[index]).toBe(0);
      expect(shell[index]).toBe(terrain[index]);
    }
  });

  it('has the one required full 1537-square dimension and constant Candidate A height', () => {
    const count = shellVertexCount(PATCH_SIZE_CELLS, SHELL_SUBDIVISION);
    const field = buildCanopyHeightFieldA(count);
    const expected = new Float32Array([CANOPY_HEIGHT_METERS])[0];
    expect(field).toHaveLength(1537 ** 2);
    expect(field.every((height) => height === expected)).toBe(true);
  });

  it('builds Candidate B bit-identically for the same seed and differently for another seed', () => {
    const crownsForSeed = (seed: number) => enumerateCrowns({
      xMin: 0,
      zMin: 0,
      latticeCols: 8,
      spacing: 6,
      seed,
      sampleCoverage: () => 1,
    });
    const first = buildCanopyHeightFieldB(crownsForSeed(11), smallPatch, 4);
    const second = buildCanopyHeightFieldB(crownsForSeed(11), smallPatch, 4);
    const changed = buildCanopyHeightFieldB(crownsForSeed(12), smallPatch, 4);
    expect(Array.from(floatBits(first))).toEqual(Array.from(floatBits(second)));
    expect(Array.from(floatBits(first))).not.toEqual(Array.from(floatBits(changed)));
  });

});
