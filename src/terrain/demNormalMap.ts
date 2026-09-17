/**
 * Use the high-pass DEM residual (fine minus coarse) because the terrain mesh
 * already represents wavelengths at and above its 23.3 m vertex spacing.
 * Baking the full DEM gradient would count that macro slope a second time.
 */
import type {
  DemFullResolution,
  DemNormalMapConfig,
  TangentNormalField,
} from '../types';

/** Compute a row-major, north-first tangent-space detail normal field. */
export function computeDemDetailNormalField(
  dem: DemFullResolution,
  config: DemNormalMapConfig,
): TangentNormalField {
  const { cols, rows } = dem;
  const { coarseStepPixels: coarseStep, strength } = config;
  const cell = dem.cellSizeMeters;
  const values = new Float32Array(cols * rows * 3);

  const clamp = (value: number, maximum: number): number =>
    Math.min(Math.max(value, 0), maximum);
  const heightAt = (row: number, col: number): number =>
    dem.values[
      clamp(row, rows - 1) * cols + clamp(col, cols - 1)
    ];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const offset = (row * cols + col) * 3;

      if (
        col < coarseStep ||
        col >= cols - coarseStep ||
        row < coarseStep ||
        row >= rows - coarseStep
      ) {
        values[offset] = 0;
        values[offset + 1] = 0;
        values[offset + 2] = 1;
        continue;
      }

      const gxFine =
        (heightAt(row, col + 1) - heightAt(row, col - 1)) / (2 * cell);
      const gzFine =
        (heightAt(row + 1, col) - heightAt(row - 1, col)) / (2 * cell);
      const gxCoarse =
        (heightAt(row, col + coarseStep) -
          heightAt(row, col - coarseStep)) /
        (2 * coarseStep * cell);
      const gzCoarse =
        (heightAt(row + coarseStep, col) -
          heightAt(row - coarseStep, col)) /
        (2 * coarseStep * cell);

      const gx = (gxFine - gxCoarse) * strength;
      const gz = (gzFine - gzCoarse) * strength;
      const nx = gx === 0 ? 0 : -gx;
      // +v points toward world -Z, so the tangent-space bitangent uses +gz.
      const ny = gz === 0 ? 0 : gz;
      const inverseLength = 1 / Math.hypot(nx, ny, 1);

      values[offset] = nx * inverseLength;
      values[offset + 1] = ny * inverseLength;
      values[offset + 2] = inverseLength;
    }
  }

  return { cols, rows, values };
}
