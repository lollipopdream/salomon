import type { ElevationGrid, TerrainEdgeFadeConfig } from '../types';

/**
 * Compute row-major edge-fade factors from normalized distance to the grid center.
 * The outermost row and column reach a normalized distance of one, ensuring every
 * straight mesh boundary fades completely instead of leaving visible mid-edge gaps.
 */
export function computeEdgeFadeFactors(
  grid: Pick<ElevationGrid, 'cols' | 'rows'>,
  config: TerrainEdgeFadeConfig,
): Float32Array {
  const factors = new Float32Array(grid.cols * grid.rows);
  factors.fill(1);

  if (!config.enabled) {
    return factors;
  }

  const centerCol = (grid.cols - 1) / 2;
  const centerRow = (grid.rows - 1) / 2;
  const fadeStart = Math.max(0, Math.min(1, config.fadeStartFactor));

  for (let row = 0; row < grid.rows; row += 1) {
    const normalizedRow = centerRow === 0
      ? 0
      : Math.abs(row - centerRow) / centerRow;

    for (let col = 0; col < grid.cols; col += 1) {
      const normalizedCol = centerCol === 0
        ? 0
        : Math.abs(col - centerCol) / centerCol;
      const normalizedDistance = Math.min(
        1,
        Math.hypot(normalizedCol, normalizedRow),
      );

      if (normalizedDistance <= fadeStart) {
        continue;
      }

      const transition = (normalizedDistance - fadeStart) / (1 - fadeStart);
      const smoothTransition = transition * transition * (3 - 2 * transition);
      factors[row * grid.cols + col] = 1 - smoothTransition;
    }
  }

  return factors;
}
