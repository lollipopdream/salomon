/**
 * UV orientation contract:
 *
 * This mapping is intended for future north-up aerial imagery such as GSI
 * rasters. Image row 0 is normally the top of the file/screen (north), which
 * matches ElevationGrid row 0 at the grid's northern edge. With Three.js
 * TextureLoader's default `texture.flipY = true`, UV v=1 addresses the top of
 * the image (file row 0, north) and v=0 addresses the bottom (south).
 * Therefore grid row 0 maps to v=1 and the last row maps to v=0, giving
 * `v = 1 - row / denominator`.
 *
 * This function's contract requires the separate texture-loading code to keep
 * `texture.flipY` at its default value (`true`). The u coordinate needs no
 * inversion because grid columns run west-to-east, matching the standard
 * raster image column order from left to right.
 */
import type { ElevationGrid } from '../types';

/** Compute row-major terrain UVs in the same vertex order as the terrain mesh. */
export function computeTerrainUVs(
  grid: Pick<ElevationGrid, 'cols' | 'rows'>,
): Float32Array {
  if (
    !Number.isInteger(grid.cols) ||
    !Number.isInteger(grid.rows) ||
    grid.cols <= 0 ||
    grid.rows <= 0
  ) {
    throw new RangeError('Terrain grid dimensions must be positive integers.');
  }

  const uvs = new Float32Array(grid.rows * grid.cols * 2);
  const colDenominator = Math.max(grid.cols - 1, 1);
  const rowDenominator = Math.max(grid.rows - 1, 1);

  for (let index = 0; index < grid.rows * grid.cols; index += 1) {
    const row = Math.floor(index / grid.cols);
    const col = index % grid.cols;
    const offset = index * 2;

    const u = colDenominator > 0 ? col / colDenominator : 0;
    const v = rowDenominator > 0 ? 1 - row / rowDenominator : 0;
    uvs[offset] = u;
    uvs[offset + 1] = v;
  }

  return uvs;
}
