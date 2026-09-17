import type { ElevationGrid, SummitCameraConfig, Vec3 } from '../types';
import {
  addVec3,
  lengthVec3,
  normalizeVec3,
  scaleVec3,
} from '../utils/vecMath';

export type { SummitCameraConfig } from '../types';

const HORIZONTAL_VIEW_DIRECTION = normalizeVec3({ x: 1, y: 0, z: 1 });
const UP_DIRECTION: Vec3 = { x: 0, y: 1, z: 0 };

export function computeSummitCameraPosition(
  summitWorldPoint: Vec3,
  grid: Pick<ElevationGrid, 'cols' | 'rows' | 'cellSizeMeters'>,
  config: SummitCameraConfig,
): Vec3 {
  const terrainDiagonal = lengthVec3({
    x: grid.cols * grid.cellSizeMeters,
    y: 0,
    z: grid.rows * grid.cellSizeMeters,
  });
  const horizontalOffset = scaleVec3(
    HORIZONTAL_VIEW_DIRECTION,
    terrainDiagonal * config.radiusFactor,
  );
  const verticalOffset = scaleVec3(
    UP_DIRECTION,
    terrainDiagonal * config.heightFactor,
  );

  return addVec3(
    summitWorldPoint,
    addVec3(horizontalOffset, verticalOffset),
  );
}

export function computeSummitLookAtTarget(
  summitWorldPoint: Vec3,
  verticalLiftMeters: number,
): Vec3 {
  return addVec3(
    summitWorldPoint,
    scaleVec3(UP_DIRECTION, verticalLiftMeters),
  );
}
