export interface TerrainRaycastDrawRange {
  start: number;
  count: number;
  /**
   * When true, callers must not apply this draw range and must instead
   * raycast the complete terrain mesh. This is only used when invalid grid
   * dimensions prevent deriving the terrain index layout.
   */
  useFullTerrainRaycast: boolean;
}

/**
 * Computes the contiguous index draw range for terrain triangle rows that a
 * ray segment can intersect, based on the segment's z endpoints.
 *
 * `rows` and `cols` are terrain-grid vertex counts. `marginRows` expands the
 * candidate band on both sides and defaults to one row.
 */
export function computeTerrainRaycastDrawRange(
  z0: number,
  z1: number,
  cellSizeMeters: number,
  rows: number,
  cols: number,
  marginRows = 1,
): TerrainRaycastDrawRange {
  const dimensionsAreValid = Number.isInteger(rows)
    && rows >= 2
    && Number.isInteger(cols)
    && cols >= 2;
  if (!dimensionsAreValid) {
    return { start: 0, count: 0, useFullTerrainRaycast: true };
  }

  const indicesPerRow = (cols - 1) * 6;
  const lastRow = rows - 2;
  const fullRange = {
    start: 0,
    count: (lastRow + 1) * indicesPerRow,
    useFullTerrainRaycast: false,
  };

  if (
    !Number.isFinite(z0)
    || !Number.isFinite(z1)
    || !Number.isFinite(cellSizeMeters)
    || cellSizeMeters <= 0
    || !Number.isInteger(marginRows)
    || marginRows < 0
  ) {
    return fullRange;
  }

  const unclampedRowLo = Math.floor(Math.min(z0, z1) / cellSizeMeters)
    - marginRows;
  const unclampedRowHi = Math.floor(Math.max(z0, z1) / cellSizeMeters)
    + marginRows;

  // A segment wholly outside the terrain's z extent cannot usefully be
  // narrowed. Return every triangle as a fail-safe instead of risking a miss.
  if (unclampedRowHi < 0 || unclampedRowLo > lastRow) {
    return fullRange;
  }

  const rowLo = Math.max(0, unclampedRowLo);
  const rowHi = Math.min(lastRow, unclampedRowHi);

  return {
    start: rowLo * indicesPerRow,
    count: (rowHi - rowLo + 1) * indicesPerRow,
    useFullTerrainRaycast: false,
  };
}
