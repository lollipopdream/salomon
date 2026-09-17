import { describe, expect, it } from 'vitest';

import { summitCameraDefaults } from '../config/defaults/cameraSummit';
import { defaultSettings } from '../config/settings';
import type { ElevationGrid, Vec3 } from '../types';
import { lengthVec3, subtractVec3 } from '../utils/vecMath';
import { computeOverviewCameraPosition } from './cameraController';
import {
  computeSummitCameraPosition,
  computeSummitLookAtTarget,
} from './summitCamera';

function createFlatGrid(elevation: number): ElevationGrid {
  return {
    cols: 10,
    rows: 10,
    values: new Float32Array(100).fill(elevation),
    cellSizeMeters: 25,
    bounds: {
      north: 35.64,
      south: 35.61,
      east: 139.26,
      west: 139.22,
    },
  };
}

function expectFiniteVec3(value: Vec3): void {
  expect(Number.isFinite(value.x)).toBe(true);
  expect(Number.isFinite(value.y)).toBe(true);
  expect(Number.isFinite(value.z)).toBe(true);
}

describe('summitCameraDefaults', () => {
  it('moves both summit camera offsets closer than the pre-T5 baseline', () => {
    // Pre-T5 baseline: radiusFactor 0.12, heightFactor 0.05.
    expect(summitCameraDefaults.radiusFactor).toBeLessThan(0.12);
    expect(summitCameraDefaults.heightFactor).toBeLessThan(0.05);
  });
});

describe('computeSummitCameraPosition', () => {
  const config = { radiusFactor: 0.12, heightFactor: 0.08 };

  it('is clearly closer to the summit than overview is to its look-at target', () => {
    const grid = createFlatGrid(300);
    const summitWorldPoint = { x: 112.5, y: 300, z: 112.5 };
    const overviewLookAtTarget = {
      x: ((grid.cols - 1) * grid.cellSizeMeters) / 2,
      y: (300 * defaultSettings.elevationScale) / 2,
      z: ((grid.rows - 1) * grid.cellSizeMeters) / 2,
    };
    const overviewCamera = computeOverviewCameraPosition(grid, defaultSettings);
    const summitCamera = computeSummitCameraPosition(
      summitWorldPoint,
      grid,
      summitCameraDefaults,
    );
    const summitDistance = lengthVec3(
      subtractVec3(summitCamera, summitWorldPoint),
    );
    const overviewDistance = lengthVec3(
      subtractVec3(overviewCamera, overviewLookAtTarget),
    );

    expect(summitDistance).toBeLessThan(overviewDistance * 0.5);
  });

  it('uses terrain-diagonal ratios for horizontal radius and height', () => {
    const grid = createFlatGrid(300);
    const summit = { x: 40, y: 300, z: 80 };
    const camera = computeSummitCameraPosition(summit, grid, config);
    const diagonal = Math.hypot(
      grid.cols * grid.cellSizeMeters,
      grid.rows * grid.cellSizeMeters,
    );

    expect(Math.hypot(camera.x - summit.x, camera.z - summit.z)).toBeCloseTo(
      diagonal * config.radiusFactor,
    );
    expect(camera.y - summit.y).toBeCloseTo(
      diagonal * config.heightFactor,
    );
  });

  it('returns only finite coordinates', () => {
    const grid = createFlatGrid(300);
    const summit = { x: -125.5, y: 599.15, z: 342.25 };

    expectFiniteVec3(computeSummitCameraPosition(summit, grid, config));
  });

  it('always keeps a positive height margin above the summit terrain', () => {
    const grid = createFlatGrid(300);
    const summits = [
      { x: 0, y: -20, z: 0 },
      { x: 112.5, y: 300, z: 112.5 },
      { x: 250, y: 1_200, z: 250 },
    ];

    for (const summit of summits) {
      const camera = computeSummitCameraPosition(summit, grid, config);

      expect(camera.y).toBeGreaterThan(summit.y);
    }
  });
});

describe('computeSummitLookAtTarget', () => {
  it('lifts the summit vertically and returns finite coordinates', () => {
    const summit = { x: 112.5, y: 300, z: 112.5 };
    const target = computeSummitLookAtTarget(summit, 15);

    expect(target).toEqual({ x: 112.5, y: 315, z: 112.5 });
    expectFiniteVec3(target);
  });
});
