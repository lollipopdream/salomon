import { describe, expect, it } from 'vitest';

import { defaultSettings } from '../config/settings';
import type { AppSettings, ElevationGrid } from '../types';
import { buildTerrainGeometry, computeTerrainVertices } from './terrainMesh';
import { computeTerrainUVs } from './terrainUv';

const grid: ElevationGrid = {
  cols: 2,
  rows: 2,
  values: Float32Array.from([0, 100, 200, 300]),
  cellSizeMeters: 25,
  bounds: {
    north: 1,
    south: 0,
    east: 1,
    west: 0,
  },
};

const settings: AppSettings = {
  resolutionWidth: 1920,
  resolutionHeight: 1080,
  loopDurationSec: 25,
  terrainOrigin: { lat: 35.6255, lng: 139.2432 },
  elevationScale: 1,
  metersPerUnit: 1,
  routeAnimation: { playDurationMs: 11_000, holdAtEndMs: 2_000 },
  visual: defaultSettings.visual,
  cameraState: {
    ...defaultSettings.cameraState,
    timeline: {
      ...defaultSettings.cameraState.timeline,
      highOverviewHoldMs:
        defaultSettings.cameraState.timeline.highOverviewHoldMs,
      descendToOverviewMs:
        defaultSettings.cameraState.timeline.descendToOverviewMs,
      ascendToHighOverviewMs:
        defaultSettings.cameraState.timeline.ascendToHighOverviewMs,
    },
    highOverview: defaultSettings.cameraState.highOverview,
  },
  labels: defaultSettings.labels,
};

function expectVerticesToBeCloseTo(
  actual: Float32Array,
  expected: number[],
): void {
  expect(actual).toBeInstanceOf(Float32Array);
  expect(actual).toHaveLength(expected.length);
  expected.forEach((value, index) => {
    expect(actual[index]).toBeCloseTo(value);
  });
}

describe('computeTerrainVertices', () => {
  it('computes row-major vertices using the grid cell size', () => {
    const vertices = computeTerrainVertices(grid, settings);

    expectVerticesToBeCloseTo(vertices, [
      0, 0, 0,
      25, 100, 0,
      0, 200, 25,
      25, 300, 25,
    ]);
  });

  it('applies elevationScale only to the Y coordinate', () => {
    const vertices = computeTerrainVertices(grid, {
      ...settings,
      elevationScale: 0.5,
    });

    expectVerticesToBeCloseTo(vertices, [
      0, 0, 0,
      25, 50, 0,
      0, 100, 25,
      25, 150, 25,
    ]);
  });
});

describe('buildTerrainGeometry', () => {
  it('adds a two-component UV for every position vertex', () => {
    const geometry = buildTerrainGeometry(grid, settings);

    const uvAttribute = geometry.getAttribute('uv');
    const positionAttribute = geometry.getAttribute('position');
    expect(uvAttribute).toBeDefined();
    expect(uvAttribute.itemSize).toBe(2);
    expect(uvAttribute.count).toBe(positionAttribute.count);
    expect(uvAttribute.count).toBe(grid.rows * grid.cols);
  });

  it('uses computeTerrainUVs corner values in row-major vertex order', () => {
    const cornerGrid: ElevationGrid = {
      ...grid,
      cols: 3,
      rows: 3,
      values: new Float32Array(9),
    };
    const geometry = buildTerrainGeometry(cornerGrid, settings);
    const uvAttribute = geometry.getAttribute('uv');
    const expectedUvs = computeTerrainUVs(cornerGrid);
    const cornerIndices = [0, 2, 6, 8];

    cornerIndices.forEach((index) => {
      expect(uvAttribute.getX(index)).toBeCloseTo(expectedUvs[index * 2]);
      expect(uvAttribute.getY(index)).toBeCloseTo(expectedUvs[index * 2 + 1]);
    });
  });

  it('preserves the existing position attribute and index order', () => {
    const geometry = buildTerrainGeometry(grid, settings);

    expect(Array.from(geometry.getAttribute('position').array)).toEqual([
      0, 0, 0,
      25, 100, 0,
      0, 200, 25,
      25, 300, 25,
    ]);
    expect(Array.from(geometry.getIndex()?.array ?? [])).toEqual([
      0, 2, 1,
      1, 2, 3,
    ]);
  });
});
