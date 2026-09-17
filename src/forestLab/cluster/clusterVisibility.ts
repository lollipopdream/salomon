import {
  GROVE_SIDE_TIGHT_WIDTH_MEDIAN_M,
  MIN_SCREEN_PIXELS,
  TREE_SIDE_TIGHT_WIDTH_MEDIAN_M,
} from './clusterConstants';
import { CAPTURE_HEIGHT } from '../labConstants';

export const DEFAULT_FOV_DEGREES = 45;
export const VISIBILITY_GROVE_BIT = 1;
export const VISIBILITY_TREE_BIT = 2;

export function metersPerPixel(
  distanceMeters: number,
  fovDegrees: number,
  pixelHeight: number,
): number {
  return 2 * distanceMeters * Math.tan(fovDegrees * Math.PI / 180 / 2) / pixelHeight;
}

export function isFeatureVisible(
  featureWidthMeters: number,
  distanceMeters: number,
  fovDegrees: number = DEFAULT_FOV_DEGREES,
  pixelHeight: number = CAPTURE_HEIGHT,
): boolean {
  const metersPerPixelValue = metersPerPixel(distanceMeters, fovDegrees, pixelHeight);
  return metersPerPixelValue <= 0
    ? true
    : featureWidthMeters / metersPerPixelValue >= MIN_SCREEN_PIXELS;
}

export function evaluateClusterVisibility({
  clusterX,
  clusterY,
  clusterZ,
  clusterCount,
  cameraPosition,
  fovDegrees = DEFAULT_FOV_DEGREES,
  pixelHeight = CAPTURE_HEIGHT,
  out,
}: {
  clusterX: Float32Array;
  clusterY: Float32Array;
  clusterZ: Float32Array;
  clusterCount: number;
  cameraPosition: { x: number; y: number; z: number };
  fovDegrees?: number;
  pixelHeight?: number;
  out?: Uint8Array;
}): Uint8Array {
  if (out && out.length < clusterCount) {
    throw new RangeError('Visibility output is shorter than clusterCount.');
  }
  const visibility = out ?? new Uint8Array(clusterCount);
  for (let cluster = 0; cluster < clusterCount; cluster += 1) {
    const distance = Math.hypot(
      clusterX[cluster] - cameraPosition.x,
      clusterY[cluster] - cameraPosition.y,
      clusterZ[cluster] - cameraPosition.z,
    );
    let flags = 0;
    if (isFeatureVisible(GROVE_SIDE_TIGHT_WIDTH_MEDIAN_M, distance, fovDegrees, pixelHeight)) {
      flags |= VISIBILITY_GROVE_BIT;
    }
    if (isFeatureVisible(TREE_SIDE_TIGHT_WIDTH_MEDIAN_M, distance, fovDegrees, pixelHeight)) {
      flags |= VISIBILITY_TREE_BIT;
    }
    visibility[cluster] = flags;
  }
  return visibility;
}
