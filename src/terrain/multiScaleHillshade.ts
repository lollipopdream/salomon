/**
 * Compute hillshade directly from full-resolution DEM gradients at several scales.
 *
 * Unlike terrainMaterial.ts's computeHillshadeFactors, this intentionally does
 * not contrast-stretch the observed dot-product range. Keeping the raw clamped
 * dot values makes results independent of the DEM-wide extrema and lets
 * minFactor/maxFactor define the flat-surface pass-through behavior directly.
 */
import type {
  DemFullResolution,
  MultiScaleHillshadeConfig,
  Vec3,
} from '../types';

function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(length - 1, index));
}

export function computeMultiScaleHillshadeFactors(
  dem: DemFullResolution,
  lightDirection: Vec3,
  config: MultiScaleHillshadeConfig,
): Float32Array {
  const totalWeight = config.scales.reduce(
    (sum, scale) => sum + scale.weight,
    0,
  );
  if (config.scales.length === 0 || totalWeight <= 0) {
    throw new RangeError('Hillshade scales must have a positive total weight.');
  }

  const lightLength = Math.hypot(
    lightDirection.x,
    lightDirection.y,
    lightDirection.z,
  );
  const lightX = lightDirection.x / lightLength;
  const lightY = lightDirection.y / lightLength;
  const lightZ = lightDirection.z / lightLength;
  const factorRange = config.maxFactor - config.minFactor;
  const factors = new Float32Array(dem.cols * dem.rows);

  for (let row = 0; row < dem.rows; row += 1) {
    for (let col = 0; col < dem.cols; col += 1) {
      let weightedDot = 0;

      for (const scale of config.scales) {
        const step = scale.stepPixels;
        const leftCol = clampIndex(col - step, dem.cols);
        const rightCol = clampIndex(col + step, dem.cols);
        const northRow = clampIndex(row - step, dem.rows);
        const southRow = clampIndex(row + step, dem.rows);
        const denominator = 2 * step * dem.cellSizeMeters;
        const gradientX = (
          dem.values[row * dem.cols + rightCol]
          - dem.values[row * dem.cols + leftCol]
        ) / denominator;
        const gradientZ = (
          dem.values[southRow * dem.cols + col]
          - dem.values[northRow * dem.cols + col]
        ) / denominator;
        const normalX = -gradientX * config.slopeExaggeration;
        const normalY = 1;
        const normalZ = -gradientZ * config.slopeExaggeration;
        const normalLength = Math.hypot(normalX, normalY, normalZ);
        const dot = (
          normalX * lightX
          + normalY * lightY
          + normalZ * lightZ
        ) / normalLength;

        weightedDot += scale.weight * Math.max(0, Math.min(1, dot));
      }

      const combined = weightedDot / totalWeight;
      factors[row * dem.cols + col] = config.minFactor + combined * factorRange;
    }
  }

  return factors;
}
