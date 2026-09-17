import type { AppSettings, ElevationGrid, Vec3 } from '../types';

function computeMaxElevation(
  grid: ElevationGrid,
  settings: AppSettings,
): number {
  // Avoid Math.max(...grid.values): the spread operator blows the call stack
  // for large grids (e.g. a 768x768 combined DEM tile has ~590,000 cells).
  let max = -Infinity;
  for (let i = 0; i < grid.values.length; i += 1) {
    const value = grid.values[i];
    if (value > max) {
      max = value;
    }
  }
  return max * settings.elevationScale;
}

export function computeLookAtTarget(
  grid: ElevationGrid,
  settings: AppSettings,
): Vec3 {
  const centerX = ((grid.cols - 1) * grid.cellSizeMeters) / 2;
  const centerZ = ((grid.rows - 1) * grid.cellSizeMeters) / 2;
  const maxElevation = computeMaxElevation(grid, settings);

  return {
    x: centerX,
    y: maxElevation / 2,
    z: centerZ,
  };
}

export function computeOverviewCameraPosition(
  grid: ElevationGrid,
  settings: AppSettings,
): Vec3 {
  const target = computeLookAtTarget(grid, settings);
  const terrainWidth = grid.cols * grid.cellSizeMeters;
  const terrainDepth = grid.rows * grid.cellSizeMeters;
  const diagonal = Math.sqrt(
    terrainWidth * terrainWidth + terrainDepth * terrainDepth,
  );
  const maxElevation = computeMaxElevation(grid, settings);
  const { radiusFactor, heightFactor, elevationLiftFactor } =
    settings.cameraState.overview;
  const horizontalOffset = diagonal * radiusFactor;
  // Ten degrees retains oblique depth while aligning the terrain footprint
  // much closer to the frame axes than the former fixed 45-degree view. This
  // removes the diamond-shaped corner deadspace that exposed several edges.
  const overviewAzimuthRad = Math.PI / 18;
  const offsetX = horizontalOffset * Math.cos(overviewAzimuthRad);
  const offsetZ = horizontalOffset * Math.sin(overviewAzimuthRad);

  return {
    x: target.x + offsetX,
    y: maxElevation * elevationLiftFactor + diagonal * heightFactor,
    z: target.z + offsetZ,
  };
}
