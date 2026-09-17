import * as THREE from 'three';

import type { BackgroundFogConfig, ElevationGrid } from '../types';

export function computeBackgroundGradientCss(
  config: BackgroundFogConfig,
): string {
  if (config.gradientMidColor !== undefined) {
    const midPercent = config.gradientMidStopPercent ?? 45;
    return `linear-gradient(to bottom, ${config.gradientTopColor} 0%, ${config.gradientMidColor} ${midPercent}%, ${config.gradientBottomColor} 100%)`;
  }

  return `linear-gradient(to bottom, ${config.gradientTopColor} 0%, ${config.gradientBottomColor} 100%)`;
}

export function computeFogRange(
  grid: Pick<ElevationGrid, 'cols' | 'rows' | 'cellSizeMeters'>,
  config: BackgroundFogConfig,
): { color: number; near: number; far: number } {
  const terrainWidth = grid.cols * grid.cellSizeMeters;
  const terrainDepth = grid.rows * grid.cellSizeMeters;
  const diagonal = Math.sqrt(
    terrainWidth * terrainWidth + terrainDepth * terrainDepth,
  );

  return {
    color: config.fogColor,
    near: diagonal * config.fogNearFactor,
    far: diagonal * config.fogFarFactor,
  };
}

export function computeFogExp2Density(
  grid: Pick<ElevationGrid, 'cols' | 'rows' | 'cellSizeMeters'>,
  fogDensityFactor: number,
): number {
  const terrainWidth = grid.cols * grid.cellSizeMeters;
  const terrainDepth = grid.rows * grid.cellSizeMeters;
  const diagonal = Math.sqrt(
    terrainWidth * terrainWidth + terrainDepth * terrainDepth,
  );

  return fogDensityFactor / diagonal;
}

export function applyBackgroundAndFog(
  container: HTMLElement,
  scene: THREE.Scene,
  grid: ElevationGrid,
  config: BackgroundFogConfig,
): void {
  container.style.background = computeBackgroundGradientCss(config);
  scene.background = null;

  if (config.fogMode === 'exp2') {
    scene.fog = new THREE.FogExp2(
      config.fogColor,
      computeFogExp2Density(grid, config.fogDensityFactor ?? 1),
    );
    return;
  }

  const { color, near, far } = computeFogRange(grid, config);
  scene.fog = new THREE.Fog(color, near, far);
}
