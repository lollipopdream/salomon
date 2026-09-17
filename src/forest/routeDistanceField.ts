export interface RouteDistanceField {
  originX: number;
  originZ: number;
  cols: number;
  rows: number;
  cellSizeMeters: number;
  maxDistanceMeters: number;
  /** Row-major values capped at maxDistanceMeters. */
  values: Float32Array;
}

/**
 * Builds a raster field of distances to route sample points. This intentionally
 * measures distance to the point cloud, not distance to the route polyline.
 */
export function buildRouteDistanceField(
  routePointsXZ: readonly { x: number; z: number }[],
  cellSizeMeters: number,
  maxDistanceMeters: number,
  marginMeters: number,
): RouteDistanceField {
  if (routePointsXZ.length === 0) {
    return {
      originX: 0,
      originZ: 0,
      cols: 0,
      rows: 0,
      cellSizeMeters,
      maxDistanceMeters,
      values: new Float32Array(0),
    };
  }

  let minX = routePointsXZ[0].x;
  let maxX = minX;
  let minZ = routePointsXZ[0].z;
  let maxZ = minZ;

  for (let pointIndex = 1; pointIndex < routePointsXZ.length; pointIndex += 1) {
    const point = routePointsXZ[pointIndex];
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  }

  const originX = minX - marginMeters;
  const originZ = minZ - marginMeters;
  const cols = Math.ceil((maxX + marginMeters - originX) / cellSizeMeters) + 1;
  const rows = Math.ceil((maxZ + marginMeters - originZ) / cellSizeMeters) + 1;
  const values = new Float32Array(cols * rows);
  values.fill(maxDistanceMeters);

  for (let pointIndex = 0; pointIndex < routePointsXZ.length; pointIndex += 1) {
    const point = routePointsXZ[pointIndex];
    const firstCol = Math.max(
      0,
      Math.ceil((point.x - maxDistanceMeters - originX) / cellSizeMeters),
    );
    const lastCol = Math.min(
      cols - 1,
      Math.floor((point.x + maxDistanceMeters - originX) / cellSizeMeters),
    );
    const firstRow = Math.max(
      0,
      Math.ceil((point.z - maxDistanceMeters - originZ) / cellSizeMeters),
    );
    const lastRow = Math.min(
      rows - 1,
      Math.floor((point.z + maxDistanceMeters - originZ) / cellSizeMeters),
    );

    for (let row = firstRow; row <= lastRow; row += 1) {
      const z = originZ + row * cellSizeMeters;
      const rowOffset = row * cols;

      for (let col = firstCol; col <= lastCol; col += 1) {
        const x = originX + col * cellSizeMeters;
        const distance = Math.hypot(x - point.x, z - point.z);
        const valueIndex = rowOffset + col;

        if (distance < values[valueIndex]) {
          values[valueIndex] = distance;
        }
      }
    }
  }

  return {
    originX,
    originZ,
    cols,
    rows,
    cellSizeMeters,
    maxDistanceMeters,
    values,
  };
}

/** Samples the nearest cell; positions outside the field use the capped maximum. */
export function sampleRouteDistance(
  field: RouteDistanceField,
  x: number,
  z: number,
): number {
  const maxX = field.originX + (field.cols - 1) * field.cellSizeMeters;
  const maxZ = field.originZ + (field.rows - 1) * field.cellSizeMeters;

  if (x < field.originX || x > maxX || z < field.originZ || z > maxZ) {
    return field.maxDistanceMeters;
  }

  const col = Math.round((x - field.originX) / field.cellSizeMeters);
  const row = Math.round((z - field.originZ) / field.cellSizeMeters);

  if (col < 0 || col >= field.cols || row < 0 || row >= field.rows) {
    return field.maxDistanceMeters;
  }

  return field.values[row * field.cols + col];
}
