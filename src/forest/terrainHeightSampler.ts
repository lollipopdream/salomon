import { elevationToWorldHeight } from '../geo/elevation';
import { sampleElevationBilinear } from '../route/routePath';
import type { ElevationGrid } from '../types';

export type TerrainGridLike = Pick<
  ElevationGrid,
  'values' | 'cols' | 'rows' | 'cellSizeMeters'
>;

/** world(x,z) の地表 world Y。col = x/cellSize, row = z/cellSize。範囲外は端クランプ。 */
export function createTerrainHeightSampler(
  grid: TerrainGridLike,
  elevationScale: number,
): (x: number, z: number) => number {
  return (x: number, z: number) => {
    const col = Math.min(
      Math.max(x / grid.cellSizeMeters, 0),
      grid.cols - 1,
    );
    const row = Math.min(
      Math.max(z / grid.cellSizeMeters, 0),
      grid.rows - 1,
    );
    const elevationMeters = sampleElevationBilinear(grid, col, row);

    return elevationToWorldHeight(elevationMeters, elevationScale);
  };
}

/** 中央差分による地表傾斜(radian, 0 = 水平)。 */
export function sampleTerrainSlopeRadians(
  sample: (x: number, z: number) => number,
  x: number,
  z: number,
  stepMeters: number,
): number {
  const dydx = (sample(x + stepMeters, z) - sample(x - stepMeters, z)) /
    (2 * stepMeters);
  const dydz = (sample(x, z + stepMeters) - sample(x, z - stepMeters)) /
    (2 * stepMeters);

  return Math.atan(Math.hypot(dydx, dydz));
}
