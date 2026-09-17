import { elevationToWorldHeight } from '../../geo/elevation';
import type { AppSettings, ElevationGrid } from '../../types';
import {
  CANONICAL_CELL_SIZE_METERS,
  CANDIDATE_B_BASE_METERS,
  CANOPY_HEIGHT_METERS,
  CROWN_SMAX_K_METERS,
} from '../labConstants';
import type { PatchSpec } from '../labTypes';
import { sampleGridBilinear } from '../patch/patchGrid';
import { crownProfile, smax, type Crown } from './crownField';
import { taperAt } from './maskDistanceField';

function shellDimensions(patch: PatchSpec, subdivision: number): {
  cols: number;
  rows: number;
} {
  return {
    cols: (patch.colEnd - patch.colStart) * subdivision + 1,
    rows: (patch.rowEnd - patch.rowStart) * subdivision + 1,
  };
}

export function buildShellTerrainYField(
  grid: ElevationGrid,
  patch: PatchSpec,
  subdivision: number,
  settings: Pick<AppSettings, 'elevationScale'>,
): Float32Array {
  const { cols, rows } = shellDimensions(patch, subdivision);
  const field = new Float32Array(cols * rows);

  for (let j = 0; j < rows; j += 1) {
    const canonicalRow = patch.rowStart + j / subdivision;
    for (let i = 0; i < cols; i += 1) {
      const canonicalCol = patch.colStart + i / subdivision;
      field[j * cols + i] = elevationToWorldHeight(
        sampleGridBilinear(grid, canonicalCol, canonicalRow),
        settings.elevationScale,
      );
    }
  }
  return field;
}

export function buildShellTaperField(
  distanceField: Float32Array,
  maskSize: number,
  patch: PatchSpec,
  subdivision: number,
): Float32Array {
  const { cols, rows } = shellDimensions(patch, subdivision);
  const field = new Float32Array(cols * rows);

  for (let j = 0; j < rows; j += 1) {
    const z = (patch.rowStart + j / subdivision) * CANONICAL_CELL_SIZE_METERS;
    for (let i = 0; i < cols; i += 1) {
      const x = (patch.colStart + i / subdivision) * CANONICAL_CELL_SIZE_METERS;
      field[j * cols + i] = taperAt(distanceField, maskSize, x, z);
    }
  }
  return field;
}

export function buildCanopyHeightFieldA(vertexCount: number): Float32Array {
  if (!Number.isInteger(vertexCount) || vertexCount < 0) {
    throw new RangeError('Vertex count must be a non-negative integer.');
  }
  return new Float32Array(vertexCount).fill(CANOPY_HEIGHT_METERS);
}

export function buildCanopyHeightFieldB(
  crowns: readonly Crown[],
  patch: PatchSpec,
  subdivision: number,
): Float32Array {
  const { cols, rows } = shellDimensions(patch, subdivision);
  const vertexCount = cols * rows;
  const acc = new Float64Array(vertexCount);
  const hasContribution = new Uint8Array(vertexCount);
  const xMin = patch.colStart * CANONICAL_CELL_SIZE_METERS;
  const zMin = patch.rowStart * CANONICAL_CELL_SIZE_METERS;
  const shellCell = CANONICAL_CELL_SIZE_METERS / subdivision;
  const orderedCrowns = [...crowns].sort((a, b) => a.n - b.n);

  for (const crown of orderedCrowns) {
    const iStart = Math.max(0, Math.floor((crown.cx - crown.r - xMin) / shellCell));
    const iEnd = Math.min(cols - 1, Math.ceil((crown.cx + crown.r - xMin) / shellCell));
    const jStart = Math.max(0, Math.floor((crown.cz - crown.r - zMin) / shellCell));
    const jEnd = Math.min(rows - 1, Math.ceil((crown.cz + crown.r - zMin) / shellCell));
    if (iStart > iEnd || jStart > jEnd) continue;

    for (let j = jStart; j <= jEnd; j += 1) {
      const z = (patch.rowStart + j / subdivision) * CANONICAL_CELL_SIZE_METERS;
      for (let i = iStart; i <= iEnd; i += 1) {
        const x = (patch.colStart + i / subdivision) * CANONICAL_CELL_SIZE_METERS;
        const distance = Math.hypot(x - crown.cx, z - crown.cz);
        if (distance >= crown.r) continue;

        const index = j * cols + i;
        const height = crown.h * crownProfile(distance / crown.r);
        if (hasContribution[index] === 0) {
          acc[index] = height;
          hasContribution[index] = 1;
        } else {
          acc[index] = smax(acc[index], height, CROWN_SMAX_K_METERS);
        }
      }
    }
  }

  const result = new Float32Array(vertexCount);
  for (let index = 0; index < vertexCount; index += 1) {
    result[index] = CANDIDATE_B_BASE_METERS
      + (hasContribution[index] === 1 ? acc[index] : 0);
  }
  return result;
}

export function buildShellYField(
  terrainY: Float32Array,
  taper: Float32Array,
  canopyHeight: Float32Array,
): Float32Array {
  if (terrainY.length !== taper.length || terrainY.length !== canopyHeight.length) {
    throw new RangeError('Shell height field inputs must have matching lengths.');
  }

  const result = new Float32Array(terrainY.length);
  for (let index = 0; index < result.length; index += 1) {
    result[index] = terrainY[index] + taper[index] * canopyHeight[index];
  }
  return result;
}
