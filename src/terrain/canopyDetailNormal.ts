/**
 * Approximation premise: bright crowns in aerial photographs are sunlit upper
 * surfaces and are generally higher than their surroundings, so luminance
 * high-frequency detail is treated as canopy-height high-frequency detail.
 * This is a visual approximation and is not a physically exact reconstruction.
 */
import type { CanopyDetailNormalConfig, TangentNormalField } from '../types';

function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(length - 1, index));
}

function boxBlur(
  values: Float32Array,
  cols: number,
  rows: number,
  radius: number,
): Float32Array {
  if (radius === 0) {
    return values.slice();
  }

  const diameter = radius * 2 + 1;
  const horizontal = new Float32Array(values.length);
  const blurred = new Float32Array(values.length);

  for (let row = 0; row < rows; row += 1) {
    const rowOffset = row * cols;
    let sum = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      sum += values[rowOffset + clampIndex(offset, cols)];
    }

    for (let col = 0; col < cols; col += 1) {
      horizontal[rowOffset + col] = sum / diameter;
      sum -= values[rowOffset + clampIndex(col - radius, cols)];
      sum += values[rowOffset + clampIndex(col + radius + 1, cols)];
    }
  }

  for (let col = 0; col < cols; col += 1) {
    let sum = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      sum += horizontal[clampIndex(offset, rows) * cols + col];
    }

    for (let row = 0; row < rows; row += 1) {
      blurred[row * cols + col] = sum / diameter;
      sum -= horizontal[clampIndex(row - radius, rows) * cols + col];
      sum += horizontal[clampIndex(row + radius + 1, rows) * cols + col];
    }
  }

  return blurred;
}

export function computeCanopyDetailNormalField(
  luminance: Float32Array,
  cols: number,
  rows: number,
  metersPerTexel: number,
  config: CanopyDetailNormalConfig,
): TangentNormalField {
  if (!Number.isInteger(cols) || cols <= 0 || !Number.isInteger(rows) || rows <= 0) {
    throw new RangeError('cols and rows must be positive integers.');
  }
  if (luminance.length !== cols * rows) {
    throw new RangeError('Luminance length must equal cols * rows.');
  }
  if (!Number.isFinite(metersPerTexel) || metersPerTexel <= 0) {
    throw new RangeError('metersPerTexel must be positive and finite.');
  }
  if (!Number.isInteger(config.blurRadiusTexels) || config.blurRadiusTexels < 0) {
    throw new RangeError('blurRadiusTexels must be a non-negative integer.');
  }
  if (!Number.isFinite(config.heightScale) || config.heightScale < 0) {
    throw new RangeError('heightScale must be non-negative and finite.');
  }

  const low = boxBlur(
    luminance,
    cols,
    rows,
    config.blurRadiusTexels,
  );
  const heights = new Float32Array(luminance.length);
  for (let index = 0; index < luminance.length; index += 1) {
    heights[index] = (luminance[index] - low[index]) * config.heightScale;
  }

  const values = new Float32Array(luminance.length * 3);
  const gradientDenominator = 2 * metersPerTexel;
  for (let row = 0; row < rows; row += 1) {
    const northRow = clampIndex(row - 1, rows);
    const southRow = clampIndex(row + 1, rows);

    for (let col = 0; col < cols; col += 1) {
      const westCol = clampIndex(col - 1, cols);
      const eastCol = clampIndex(col + 1, cols);
      const gradientX = (
        heights[row * cols + eastCol] - heights[row * cols + westCol]
      ) / gradientDenominator;
      const gradientZ = (
        heights[southRow * cols + col] - heights[northRow * cols + col]
      ) / gradientDenominator;

      // Avoid preserving JavaScript's -0 for an exactly neutral x component.
      const normalX = gradientX === 0 ? 0 : -gradientX;
      // terrainUv.ts maps +v to world -Z, so the row gradient keeps this sign.
      const normalY = gradientZ;
      const inverseLength = 1 / Math.hypot(normalX, normalY, 1);
      const offset = (row * cols + col) * 3;
      values[offset] = normalX * inverseLength;
      values[offset + 1] = normalY * inverseLength;
      values[offset + 2] = inverseLength;
    }
  }

  return { cols, rows, values };
}
