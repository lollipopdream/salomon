import { describe, expect, it } from 'vitest';

import type { ElevationGrid } from '../types';
import {
  SCOPE_PROOF_CANDIDATES,
  classifyScopeProofPixels,
  computeScopeProofClipPlanes,
  computeScopeProofMetrics,
  latLngToWorldXZ,
  parseScopeProofBounds,
  resolveScopeProofSelection,
  worldXZToLatLng,
} from './scopeProof';
import type { ScopeProofBounds } from './scopeProof';

const grid: ElevationGrid = {
  cols: 256,
  rows: 256,
  cellSizeMeters: 23.297845,
  bounds: {
    north: 35.657296248,
    south: 35.603718741,
    west: 139.218750000,
    east: 139.284667969,
  },
  values: new Float32Array(256 * 256),
};

const auditBounds: ScopeProofBounds = {
  north: 35.6450,
  south: 35.6155,
  west: 139.2210,
  east: 139.2745,
};

describe('scope proof selection', () => {
  it('forces OFF outside DEV', () => {
    expect(resolveScopeProofSelection({
      scopeProof: 'audit-b',
      scopeProofBounds: null,
    }, false)).toEqual({
      id: 'off',
      label: 'OFF (production default)',
      bounds: null,
      fallbackReason: 'not-dev',
    });
  });

  it('keeps the omitted default and current candidate unclipped', () => {
    const omitted = resolveScopeProofSelection({
      scopeProof: null,
      scopeProofBounds: null,
    }, true);
    const current = resolveScopeProofSelection({
      scopeProof: 'current',
      scopeProofBounds: null,
    }, true);

    expect({ omitted, current }).toEqual({
      omitted: {
        id: 'off',
        label: 'OFF (production default)',
        bounds: null,
        fallbackReason: null,
      },
      current: {
        id: 'current',
        label: 'CURRENT',
        bounds: null,
        fallbackReason: null,
      },
    });
  });

  it('resolves audit-b and adjusted to their own distinct measured bounds', () => {
    const audit = resolveScopeProofSelection({
      scopeProof: 'audit-b',
      scopeProofBounds: null,
    }, true);
    const adjusted = resolveScopeProofSelection({
      scopeProof: 'adjusted',
      scopeProofBounds: null,
    }, true);

    // ADJUSTED は bounds-analysis.md §3 の実測 overshoot から導いた値であり、
    // AUDIT B と一致してはならない(一致すると ?scopeProof=adjusted が
    // AUDIT B を描画してしまい、成果物が文書どおりに再現できなくなる)。
    expect({ audit: audit.bounds, adjusted: adjusted.bounds }).toEqual({
      audit: auditBounds,
      adjusted: {
        north: 35.6500,
        south: 35.6142,
        west: 139.21875,
        east: 139.2772,
      },
    });
    expect(adjusted.bounds).not.toEqual(auditBounds);
    expect(SCOPE_PROOF_CANDIDATES.find(({ id }) => id === 'adjusted')?.label)
      .toBe('ADJUSTED');
  });

  it('falls back safely for an unknown candidate', () => {
    const selection = resolveScopeProofSelection({
      scopeProof: 'zzz-unknown',
      scopeProofBounds: null,
    }, true);

    expect(selection).toMatchObject({
      id: 'off',
      bounds: null,
      fallbackReason: expect.stringContaining('unknown-candidate'),
    });
  });

  it('overrides a selected candidate with valid explicit bounds', () => {
    const selection = resolveScopeProofSelection({
      scopeProof: 'audit-b',
      scopeProofBounds: '35.64,35.62,139.23,139.27',
    }, true);

    expect(selection).toMatchObject({
      id: 'audit-b',
      label: 'AUDIT B',
      bounds: { north: 35.64, south: 35.62, west: 139.23, east: 139.27 },
      fallbackReason: null,
    });
  });

  it('retains candidate bounds and reports invalid explicit bounds', () => {
    const selection = resolveScopeProofSelection({
      scopeProof: 'audit-b',
      scopeProofBounds: 'garbage',
    }, true);

    expect(selection).toMatchObject({
      id: 'audit-b',
      bounds: auditBounds,
      fallbackReason: expect.stringContaining('invalid-bounds'),
    });
  });

  it('never lets explicit bounds change OFF', () => {
    const selection = resolveScopeProofSelection({
      scopeProof: 'off',
      scopeProofBounds: '35.64,35.62,139.23,139.27',
    }, true);

    expect(selection).toMatchObject({ id: 'off', bounds: null });
  });
});

describe('parseScopeProofBounds', () => {
  it('parses a valid decimal-degree tuple', () => {
    expect(parseScopeProofBounds('35.64, 35.62, 139.23, 139.27')).toEqual({
      north: 35.64,
      south: 35.62,
      west: 139.23,
      east: 139.27,
    });
  });

  it('rejects every malformed or invalid tuple', () => {
    const invalid = [
      '35.64,35.62,139.23',
      '35.64,35.62,139.23,139.27,1',
      '35.64,NaN,139.23,139.27',
      '35.62,35.62,139.23,139.27',
      '35.64,35.62,139.27,139.23',
      '91,35.62,139.23,139.27',
      '35.64,-91,139.23,139.27',
      '35.64,35.62,-181,139.27',
      '35.64,35.62,139.23,181',
      '35.64,,139.23,139.27',
    ];

    expect(invalid.map((raw) => parseScopeProofBounds(raw))).toEqual(
      invalid.map(() => undefined),
    );
  });
});

describe('scope proof coordinate transforms', () => {
  it('maps the grid corners to the terrain span', () => {
    const northWest = latLngToWorldXZ(grid.bounds.north, grid.bounds.west, grid);
    const southEast = latLngToWorldXZ(grid.bounds.south, grid.bounds.east, grid);

    expect(northWest).toEqual({ x: 0, z: 0 });
    expect(southEast.x).toBeCloseTo((grid.cols - 1) * grid.cellSizeMeters, 9);
    expect(southEast.z).toBeCloseTo((grid.rows - 1) * grid.cellSizeMeters, 9);
  });

  it('round-trips arbitrary coordinates to within 1e-9 degrees', () => {
    const original = { lat: 35.631234567, lng: 139.253456789 };
    const world = latLngToWorldXZ(original.lat, original.lng, grid);
    const roundTrip = worldXZToLatLng(world.x, world.z, grid);

    expect(Math.abs(roundTrip.lat - original.lat)).toBeLessThanOrEqual(1e-9);
    expect(Math.abs(roundTrip.lng - original.lng)).toBeLessThanOrEqual(1e-9);
  });
});

describe('computeScopeProofClipPlanes', () => {
  it('keeps the center inside all four unique edge planes', () => {
    const planes = computeScopeProofClipPlanes(auditBounds, grid);
    const center = latLngToWorldXZ(
      (auditBounds.north + auditBounds.south) / 2,
      (auditBounds.west + auditBounds.east) / 2,
      grid,
    );
    const signedDistances = planes.map(({ normal, constant }) =>
      normal.x * center.x + normal.z * center.z + constant);

    expect({
      count: planes.length,
      edges: [...new Set(planes.map(({ edge }) => edge))].sort(),
      centerIsInside: signedDistances.every((distance) => distance >= 0),
    }).toEqual({
      count: 4,
      edges: ['east', 'north', 'south', 'west'],
      centerIsInside: true,
    });
  });

  it('makes only the corresponding plane negative just outside each edge', () => {
    const planes = computeScopeProofClipPlanes(auditBounds, grid);
    const centerLat = (auditBounds.north + auditBounds.south) / 2;
    const centerLng = (auditBounds.west + auditBounds.east) / 2;
    const outsidePoints = [
      { expected: 'north', ...latLngToWorldXZ(auditBounds.north + 0.001, centerLng, grid) },
      { expected: 'south', ...latLngToWorldXZ(auditBounds.south - 0.001, centerLng, grid) },
      { expected: 'west', ...latLngToWorldXZ(centerLat, auditBounds.west - 0.001, grid) },
      { expected: 'east', ...latLngToWorldXZ(centerLat, auditBounds.east + 0.001, grid) },
    ];
    const negativeEdges = outsidePoints.map(({ x, z }) => planes
      .filter(({ normal, constant }) => normal.x * x + normal.z * z + constant < 0)
      .map(({ edge }) => edge));

    expect(negativeEdges).toEqual(outsidePoints.map(({ expected }) => [expected]));
  });
});

describe('computeScopeProofMetrics', () => {
  it('reports the audited candidate physical area and current-terrain ratio', () => {
    const metrics = computeScopeProofMetrics(auditBounds, grid);

    expect(metrics.widthMeters).toBeCloseTo(4_841, -1);
    expect(metrics.heightMeters).toBeCloseTo(3_284, -1);
    expect(metrics.areaKm2).toBeCloseTo(15.90, 1);
    // 分母は **mesh 実効 span**((cols-1)*cell)² = 35.295 km² であり、
    // DEM tile extent 35.572 km²(前段監査の「44.7 %」の分母)ではない。
    // 緩い許容にすると両者(0.4504 / 0.4469)を取り違えても通ってしまうため厳しく固定する。
    expect(metrics.ratioOfCurrent).toBeCloseTo(0.45039, 4);
  });
});

describe('classifyScopeProofPixels', () => {
  const attributionGrid: ElevationGrid = {
    cols: 256,
    rows: 256,
    cellSizeMeters: 10,
    bounds: { north: 1, south: 0, west: 0, east: 1 },
    values: new Float32Array(256 * 256),
  };
  const bounds: ScopeProofBounds = { north: 0.7, south: 0.3, west: 0.3, east: 0.7 };

  it('classifies sky, inside, single-edge, and double-edge pixels', () => {
    const pixels = new Uint8Array(4 * 4 * 4);
    const setTerrainPixel = (pixelIndex: number, colByte: number, rowByte: number): void => {
      const offset = pixelIndex * 4;
      pixels[offset] = colByte;
      pixels[offset + 1] = rowByte;
      pixels[offset + 2] = 255;
      pixels[offset + 3] = 255;
    };
    setTerrainPixel(1, 100, 100); // inside
    setTerrainPixel(2, 100, 51); // north
    setTerrainPixel(3, 51, 100); // west
    setTerrainPixel(4, 51, 51); // north + west

    const result = classifyScopeProofPixels(pixels, 4, 4, attributionGrid, bounds);
    const expectedNorthOvershoot = 0.1 * 111_320;
    const expectedWestOvershoot = 0.1 * 111_320 * Math.cos(0.5 * Math.PI / 180);

    expect({
      totalPixels: result.totalPixels,
      terrainPixels: result.terrainPixels,
      skyPixels: result.skyPixels,
      insidePixels: result.insidePixels,
      outsidePixels: result.outsidePixels,
      holeShareOfScreen: result.holeShareOfScreen,
      holeShareOfTerrain: result.holeShareOfTerrain,
      northPixels: result.byEdge.north.pixels,
      westPixels: result.byEdge.west.pixels,
      southPixels: result.byEdge.south.pixels,
      eastPixels: result.byEdge.east.pixels,
      outsideExtent: result.outsideExtent,
      quantizationMeters: result.quantizationMeters,
    }).toEqual({
      totalPixels: 16,
      terrainPixels: 4,
      skyPixels: 12,
      insidePixels: 1,
      outsidePixels: 3,
      holeShareOfScreen: 3 / 16,
      holeShareOfTerrain: 3 / 4,
      northPixels: 2,
      westPixels: 2,
      southPixels: 0,
      eastPixels: 0,
      outsideExtent: {
        minLat: 0.607843137254902,
        maxLat: 0.8,
        minLng: 0.2,
        maxLng: 0.39215686274509803,
      },
      quantizationMeters: 10,
    });
    expect([
      result.byEdge.north.overshootMetersP50,
      result.byEdge.north.overshootMetersMax,
    ]).toEqual([
      expect.closeTo(expectedNorthOvershoot, 8),
      expect.closeTo(expectedNorthOvershoot, 8),
    ]);
    expect([
      result.byEdge.west.overshootMetersP50,
      result.byEdge.west.overshootMetersMax,
    ]).toEqual([
      expect.closeTo(expectedWestOvershoot, 8),
      expect.closeTo(expectedWestOvershoot, 8),
    ]);
  });

  it('returns finite zero shares when no terrain pixels are present', () => {
    const result = classifyScopeProofPixels(
      new Uint8Array(2 * 2 * 4),
      2,
      2,
      attributionGrid,
      bounds,
    );
    const numericOutputs = [
      result.holeShareOfScreen,
      result.holeShareOfTerrain,
      result.byEdge.north.pixelShare,
      result.byEdge.north.terrainShare,
      result.byEdge.north.overshootMetersP50,
      result.byEdge.north.overshootMetersMax,
    ];

    expect({
      terrainPixels: result.terrainPixels,
      skyPixels: result.skyPixels,
      insidePixels: result.insidePixels,
      outsidePixels: result.outsidePixels,
      allFinite: numericOutputs.every(Number.isFinite),
      numericOutputs,
    }).toEqual({
      terrainPixels: 0,
      skyPixels: 4,
      insidePixels: 0,
      outsidePixels: 0,
      allFinite: true,
      numericOutputs: [0, 0, 0, 0, 0, 0],
    });
  });
});
