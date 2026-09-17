import { describe, expect, it } from 'vitest';

import type { ElevationGrid, RoutePath } from '../types';
import {
  projectLatLngToGridIndex,
  resampleRouteToWorldPoints,
  routePathToWorldPoints,
  sampleElevationBilinear,
} from './routePath';

const unitBoundsGrid = {
  cols: 11,
  rows: 11,
  bounds: {
    north: 1,
    south: 0,
    east: 1,
    west: 0,
  },
};

describe('projectLatLngToGridIndex', () => {
  it('projects the center to the center grid index', () => {
    expect(projectLatLngToGridIndex(
      { lat: 0.5, lng: 0.5 },
      unitBoundsGrid,
    )).toEqual({ col: 5, row: 5 });
  });

  it('projects the north-west corner to the first grid index', () => {
    expect(projectLatLngToGridIndex(
      { lat: 1, lng: 0 },
      unitBoundsGrid,
    )).toEqual({ col: 0, row: 0 });
  });

  it('projects the south-east corner to the last grid index', () => {
    expect(projectLatLngToGridIndex(
      { lat: 0, lng: 1 },
      unitBoundsGrid,
    )).toEqual({ col: 10, row: 10 });
  });
});

const twoByTwoGrid: ElevationGrid = {
  cols: 2,
  rows: 2,
  values: Float32Array.from([0, 100, 200, 300]),
  cellSizeMeters: 10,
  bounds: {
    north: 1,
    south: 0,
    east: 1,
    west: 0,
  },
};

describe('sampleElevationBilinear', () => {
  it('returns exact corner elevations', () => {
    expect(sampleElevationBilinear(twoByTwoGrid, 0, 0)).toBe(0);
    expect(sampleElevationBilinear(twoByTwoGrid, 1, 1)).toBe(300);
  });

  it('returns the four-corner average at the center', () => {
    expect(sampleElevationBilinear(twoByTwoGrid, 0.5, 0.5)).toBe(150);
  });

  it('clamps positions outside the grid before sampling', () => {
    expect(sampleElevationBilinear(twoByTwoGrid, -1, 0.5)).toBe(100);
    expect(sampleElevationBilinear(twoByTwoGrid, 2, 1)).toBe(300);
  });
});

describe('routePathToWorldPoints', () => {
  it('uses grid index space, interpolated elevation, scale, and height offset', () => {
    const route: RoutePath = {
      isOfficial: false,
      points: [
        { lat: 1, lng: 0 },
        { lat: 0.5, lng: 0.5 },
        { lat: 0, lng: 1 },
      ],
    };

    expect(routePathToWorldPoints(
      route,
      twoByTwoGrid,
      { elevationScale: 0.5 },
      2,
    )).toEqual([
      { x: 0, y: 2, z: 0 },
      { x: 5, y: 77, z: 5 },
      { x: 10, y: 152, z: 10 },
    ]);
  });
});

describe('resampleRouteToWorldPoints', () => {
  const peakedGrid: ElevationGrid = {
    cols: 3,
    rows: 3,
    values: Float32Array.from([
      0, 0, 0,
      0, 100, 0,
      0, 0, 0,
    ]),
    cellSizeMeters: 10,
    bounds: {
      north: 1,
      south: 0,
      east: 1,
      west: 0,
    },
  };

  it('increases the point count according to distance and sample spacing', () => {
    const route: RoutePath = {
      isOfficial: false,
      points: [
        { lat: 0.5, lng: 0 },
        { lat: 0.5, lng: 1 },
      ],
    };

    const points = resampleRouteToWorldPoints(
      route,
      peakedGrid,
      { elevationScale: 1 },
      0,
      5,
    );

    // 20mの区間を最大5m間隔に4分割するため、両端を含めて5点になる。
    expect(points).toHaveLength(5);
  });

  it('samples terrain elevation at every point instead of interpolating endpoint heights', () => {
    const route: RoutePath = {
      isOfficial: false,
      points: [
        { lat: 0.5, lng: 0 },
        { lat: 0.5, lng: 1 },
      ],
    };

    const points = resampleRouteToWorldPoints(
      route,
      peakedGrid,
      { elevationScale: 0.5 },
      2,
      5,
    );

    points.forEach((point) => {
      const col = point.x / peakedGrid.cellSizeMeters;
      const row = point.z / peakedGrid.cellSizeMeters;
      const expectedElevation = sampleElevationBilinear(peakedGrid, col, row);
      expect(point.y).toBe(expectedElevation * 0.5 + 2);
    });
    expect(points[2].y).toBe(52);
    expect(points[2].y).not.toBe((points[0].y + points[4].y) / 2);
  });

  it('includes a shared segment endpoint only once', () => {
    const route: RoutePath = {
      isOfficial: false,
      points: [
        { lat: 0.5, lng: 0 },
        { lat: 0.5, lng: 0.5 },
        { lat: 0.5, lng: 1 },
      ],
    };

    const points = resampleRouteToWorldPoints(
      route,
      peakedGrid,
      { elevationScale: 1 },
      0,
      5,
    );

    expect(points).toHaveLength(5);
    expect(points.filter((point) => point.x === 10)).toHaveLength(1);
  });
});
