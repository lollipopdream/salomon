import type {
  AppSettings,
  ElevationGrid,
  HighOverviewCameraConfig,
  Vec3,
} from '../types';
import { easeOutQuart, rotateAroundY } from '../utils/vecMath';
import { computeLookAtTarget } from './cameraController';

function computeMaxElevation(
  grid: ElevationGrid,
  settings: AppSettings,
): number {
  let max = -Infinity;
  for (let i = 0; i < grid.values.length; i += 1) {
    const value = grid.values[i];
    if (value > max) {
      max = value;
    }
  }
  return max * settings.elevationScale;
}

export function computeHighOverviewCameraPosition(
  grid: ElevationGrid,
  settings: AppSettings,
  config: HighOverviewCameraConfig,
  orbitAngleDegrees: number,
  holdProgressT: number = 1,
): Vec3 {
  const target = computeLookAtTarget(grid, settings);
  const terrainWidth = grid.cols * grid.cellSizeMeters;
  const terrainDepth = grid.rows * grid.cellSizeMeters;
  const diagonal = Math.sqrt(
    terrainWidth * terrainWidth + terrainDepth * terrainDepth,
  );
  const maxElevation = computeMaxElevation(grid, settings);
  const driftStartRadiusFactor =
    config.holdDriftStartRadiusFactor ?? config.radiusFactor;
  const driftStartHeightFactor =
    config.holdDriftStartHeightFactor ?? config.heightFactor;
  const eased = easeOutQuart(holdProgressT);
  const effectiveRadiusFactor =
    eased === 1
      ? config.radiusFactor
      : driftStartRadiusFactor
        + (config.radiusFactor - driftStartRadiusFactor) * eased;
  const effectiveHeightFactor =
    eased === 1
      ? config.heightFactor
      : driftStartHeightFactor
        + (config.heightFactor - driftStartHeightFactor) * eased;
  const horizontalDistance = diagonal * effectiveRadiusFactor;
  // The fixed end/base azimuth remains ten degrees; an optional hold-start
  // azimuth eases back to it with the same radius/height drift pattern.
  const baseAngleRad = Math.PI / 18;
  const startAngleRad =
    config.holdDriftStartAzimuthDegrees !== undefined
      ? (config.holdDriftStartAzimuthDegrees * Math.PI) / 180
      : baseAngleRad;
  const effectiveAngleRad =
    eased === 1
      ? baseAngleRad
      : startAngleRad + (baseAngleRad - startAngleRad) * eased;
  const basePosition: Vec3 = {
    x: target.x + horizontalDistance * Math.cos(effectiveAngleRad),
    y: maxElevation * 1.5 + diagonal * effectiveHeightFactor,
    z: target.z + horizontalDistance * Math.sin(effectiveAngleRad),
  };

  return rotateAroundY(
    basePosition,
    target,
    (orbitAngleDegrees * Math.PI) / 180,
  );
}
