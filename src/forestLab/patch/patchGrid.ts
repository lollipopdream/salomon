import { elevationToWorldHeight } from '../../geo/elevation';
import type { AppSettings, ElevationGrid } from '../../types';
import {
  CANONICAL_CELL_SIZE_METERS,
  CANONICAL_COLS,
  CANONICAL_ROWS,
  SHELL_SUBDIVISION,
} from '../labConstants';
import type { PatchSpec } from '../labTypes';

export function patchVertexIndex(
  localRow: number,
  localCol: number,
  sizeCells: number,
): number {
  return localRow * (sizeCells + 1) + localCol;
}

export function canonicalIndexOf(
  patch: PatchSpec,
  localRow: number,
  localCol: number,
): number {
  return (patch.rowStart + localRow) * CANONICAL_COLS + patch.colStart + localCol;
}

export function buildPatchTerrainVertices(
  grid: ElevationGrid,
  patch: PatchSpec,
  settings: Pick<AppSettings, 'elevationScale'>,
): Float32Array {
  const sizeRows = patch.rowEnd - patch.rowStart;
  const sizeCols = patch.colEnd - patch.colStart;
  const rowLength = sizeCols + 1;
  const vertices = new Float32Array((sizeRows + 1) * rowLength * 3);

  for (let localRow = 0; localRow <= sizeRows; localRow += 1) {
    for (let localCol = 0; localCol <= sizeCols; localCol += 1) {
      const canonicalRow = patch.rowStart + localRow;
      const canonicalCol = patch.colStart + localCol;
      const canonicalIndex = canonicalRow * CANONICAL_COLS + canonicalCol;
      const localIndex = localRow * rowLength + localCol;
      const vertexOffset = localIndex * 3;

      vertices[vertexOffset] = canonicalCol * CANONICAL_CELL_SIZE_METERS;
      vertices[vertexOffset + 1] = elevationToWorldHeight(
        grid.values[canonicalIndex],
        settings.elevationScale,
      );
      vertices[vertexOffset + 2] = canonicalRow * CANONICAL_CELL_SIZE_METERS;
    }
  }

  return vertices;
}

export function buildPatchTerrainUvs(patch: PatchSpec): Float32Array {
  const sizeRows = patch.rowEnd - patch.rowStart;
  const sizeCols = patch.colEnd - patch.colStart;
  const rowLength = sizeCols + 1;
  const uvs = new Float32Array((sizeRows + 1) * rowLength * 2);

  for (let localRow = 0; localRow <= sizeRows; localRow += 1) {
    for (let localCol = 0; localCol <= sizeCols; localCol += 1) {
      const canonicalRow = patch.rowStart + localRow;
      const canonicalCol = patch.colStart + localCol;
      const offset = (localRow * rowLength + localCol) * 2;
      uvs[offset] = canonicalCol / (CANONICAL_COLS - 1);
      uvs[offset + 1] = 1 - canonicalRow / (CANONICAL_ROWS - 1);
    }
  }

  return uvs;
}

export function buildPatchIndices(sizeCells: number): Uint32Array {
  const rowLength = sizeCells + 1;
  const indices = new Uint32Array(sizeCells * sizeCells * 6);
  let offset = 0;

  for (let row = 0; row < sizeCells; row += 1) {
    for (let col = 0; col < sizeCells; col += 1) {
      const topLeft = row * rowLength + col;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + rowLength;
      const bottomRight = bottomLeft + 1;

      indices[offset] = topLeft;
      indices[offset + 1] = bottomLeft;
      indices[offset + 2] = topRight;
      indices[offset + 3] = topRight;
      indices[offset + 4] = bottomLeft;
      indices[offset + 5] = bottomRight;
      offset += 6;
    }
  }

  return indices;
}

export function shellVertexCount(sizeCells: number, subdivision: number): number {
  const side = sizeCells * subdivision + 1;
  return side * side;
}

export function shellCanonicalCol(
  i: number,
  patch: PatchSpec,
  subdivision: number,
): number {
  return patch.colStart + i / subdivision;
}

export function shellCanonicalRow(
  j: number,
  patch: PatchSpec,
  subdivision: number,
): number {
  return patch.rowStart + j / subdivision;
}

export function shellWorldX(i: number, patch: PatchSpec): number {
  return shellCanonicalCol(i, patch, SHELL_SUBDIVISION) * CANONICAL_CELL_SIZE_METERS;
}

export function shellWorldZ(j: number, patch: PatchSpec): number {
  return shellCanonicalRow(j, patch, SHELL_SUBDIVISION) * CANONICAL_CELL_SIZE_METERS;
}

export function shellVertexIndex(
  i: number,
  j: number,
  sizeCells: number,
  subdivision: number,
): number {
  return j * (sizeCells * subdivision + 1) + i;
}

export function sampleGridBilinear(
  grid: Pick<ElevationGrid, 'cols' | 'rows' | 'values'>,
  colF: number,
  rowF: number,
): number {
  const col = Math.min(grid.cols - 1, Math.max(0, colF));
  const row = Math.min(grid.rows - 1, Math.max(0, rowF));
  const col0 = Math.floor(col);
  const row0 = Math.floor(row);
  const col1 = Math.min(col0 + 1, grid.cols - 1);
  const row1 = Math.min(row0 + 1, grid.rows - 1);
  const tx = col - col0;
  const ty = row - row0;
  const topLeft = grid.values[row0 * grid.cols + col0];
  const topRight = grid.values[row0 * grid.cols + col1];
  const bottomLeft = grid.values[row1 * grid.cols + col0];
  const bottomRight = grid.values[row1 * grid.cols + col1];

  const top = tx === 0 ? topLeft : topLeft + (topRight - topLeft) * tx;
  if (ty === 0) return top;
  const bottom = tx === 0 ? bottomLeft : bottomLeft + (bottomRight - bottomLeft) * tx;
  return top + (bottom - top) * ty;
}
