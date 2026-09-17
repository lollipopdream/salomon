import { describe, expect, it, vi } from 'vitest';

import type { DemLoadResult, ElevationGrid } from '../types';
import {
  buildDemFullResolution,
  computeCellSizeMeters,
  downsampleElevationGrid,
  loadDemTiles,
  parseDemPixels,
  validateElevationGrid,
} from './demLoader';

describe('parseDemPixels', () => {
  it('decodes RGBA pixels in row-major order and maps no-data to zero', () => {
    const pixels = new Uint8ClampedArray([
      0, 0, 0, 255,
      0, 233, 252, 255,
      128, 0, 0, 0,
      255, 252, 24, 255,
    ]);

    expect(parseDemPixels(pixels, 2, 2)).toEqual(
      new Float32Array([0, 599, 0, -10]),
    );
  });
});

const validGrid: ElevationGrid = {
  cols: 2,
  rows: 2,
  values: new Float32Array([200, 300, 400, 599]),
  cellSizeMeters: 46.6,
  bounds: {
    north: 35.64,
    south: 35.61,
    east: 139.26,
    west: 139.22,
  },
};

describe('validateElevationGrid', () => {
  it('accepts a well-formed elevation grid', () => {
    expect(validateElevationGrid(validGrid)).toBe(true);
  });

  it('rejects a values length that does not match cols times rows', () => {
    expect(
      validateElevationGrid({
        ...validGrid,
        values: new Float32Array([200, 300, 400]),
      }),
    ).toBe(false);
  });

  it('rejects bounds whose north is not greater than south', () => {
    expect(
      validateElevationGrid({
        ...validGrid,
        bounds: { ...validGrid.bounds, north: validGrid.bounds.south },
      }),
    ).toBe(false);
  });

  it('rejects a non-positive cell size', () => {
    expect(validateElevationGrid({ ...validGrid, cellSizeMeters: 0 })).toBe(false);
  });
});

describe('computeCellSizeMeters', () => {
  it('computes the downsampled cell size from bounds and stride', () => {
    const cellSizeMeters = computeCellSizeMeters(
      {
        north: 35.6573,
        south: 35.60372,
        east: 139.28467,
        west: 139.21875,
      },
      768,
      768,
      6,
    );

    expect(cellSizeMeters).toBeCloseTo(46.6, 0);
  });
});

describe('downsampleElevationGrid', () => {
  it('averages every stride-sized block', () => {
    const result = downsampleElevationGrid(
      4,
      4,
      Float32Array.from([
        1, 2, 3, 4,
        5, 6, 7, 8,
        9, 10, 11, 12,
        13, 14, 15, 16,
      ]),
      2,
      25,
    );

    expect(result).toEqual({
      cols: 2,
      rows: 2,
      values: Float32Array.from([3.5, 5.5, 11.5, 13.5]),
      cellSizeMeters: 25,
    });
  });

  it('averages only existing pixels in partial edge blocks', () => {
    const result = downsampleElevationGrid(
      3,
      3,
      Float32Array.from([
        1, 2, 3,
        4, 5, 6,
        7, 8, 9,
      ]),
      2,
      25,
    );

    expect(result.values).toEqual(Float32Array.from([3, 4.5, 7.5, 9]));
  });
});

const tileUrls = [
  'https://example.test/14/0/0.png',
  'https://example.test/14/1/0.png',
  'https://example.test/14/2/0.png',
  'https://example.test/14/0/1.png',
  'https://example.test/14/1/1.png',
  'https://example.test/14/2/1.png',
  'https://example.test/14/0/2.png',
  'https://example.test/14/1/2.png',
  'https://example.test/14/2/2.png',
];

function mock768PixelDemTiles(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(),
    })),
  );
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width: 256, height: 256, close: vi.fn() })),
  );
  vi.stubGlobal('document', {
    createElement: vi.fn(() => {
      const canvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({
          drawImage: vi.fn(),
          getImageData: () => ({
            data: new Uint8ClampedArray(canvas.width * canvas.height * 4),
          }),
        })),
      };
      return canvas;
    }),
  });
}

describe('loadDemTiles grid dimension options', () => {
  it('keeps the previous 128 by 128 effective grid when maxGridDimension is omitted', async () => {
    mock768PixelDemTiles();

    try {
      const grid = await loadDemTiles(tileUrls, { lat: 35.63, lng: 139.25 });

      expect(grid.cols).toBe(128);
      expect(grid.rows).toBe(128);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('uses a 256 by 256 effective grid when maxGridDimension is 256', async () => {
    mock768PixelDemTiles();

    try {
      const grid = await loadDemTiles(
        tileUrls,
        { lat: 35.63, lng: 139.25 },
        256,
      );

      expect(grid.cols).toBe(256);
      expect(grid.rows).toBe(256);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('uses stride 4 with a 192 by 192 grid and expected cell size when maxGridDimension is 192', async () => {
    mock768PixelDemTiles();

    try {
      const grid = await loadDemTiles(
        tileUrls,
        { lat: 35.63, lng: 139.25 },
        192,
      );

      const stride = 4;
      expect(grid.cols).toBe(192);
      expect(grid.rows).toBe(192);
      expect(grid.cellSizeMeters).toBeCloseTo(3.2988920445080794, 12);
      expect(768 / stride).toBe(grid.cols);
      expect(768 / stride).toBe(grid.rows);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('buildDemFullResolution', () => {
  const bounds: ElevationGrid['bounds'] = {
    north: 35.6573,
    south: 35.60372,
    east: 139.28467,
    west: 139.21875,
  };

  it('uses the existing stride-1 cell-size calculation exactly', () => {
    const values = new Float32Array(12);
    const fullResolution = buildDemFullResolution(4, 3, values, bounds);

    expect(fullResolution.cellSizeMeters).toBe(
      computeCellSizeMeters(bounds, 4, 3, 1),
    );
  });

  it('matches the measured z14 3x3 DEM resolution', () => {
    const zoom = 14;
    const tileYToLatitudeEquivalent = (y: number): number => {
      const mercator = Math.PI * (1 - (2 * y) / 2 ** zoom);
      return (Math.atan(Math.sinh(mercator)) * 180) / Math.PI;
    };
    const realTileBounds: ElevationGrid['bounds'] = {
      north: tileYToLatitudeEquivalent(6453),
      south: tileYToLatitudeEquivalent(6456),
      west: (14528 / 16384) * 360 - 180,
      east: (14531 / 16384) * 360 - 180,
    };

    const fullResolution = buildDemFullResolution(
      768,
      768,
      new Float32Array(768 * 768),
      realTileBounds,
    );

    expect(fullResolution.cellSizeMeters).toBeGreaterThanOrEqual(7.6);
    expect(fullResolution.cellSizeMeters).toBeLessThanOrEqual(7.95);
  });

  it('preserves exact stride linearity in the cell-size calculation', () => {
    expect(computeCellSizeMeters(bounds, 768, 768, 3)).toBe(
      3 * computeCellSizeMeters(bounds, 768, 768, 1),
    );
  });

  it('rejects a values length that does not match cols times rows', () => {
    expect(() =>
      buildDemFullResolution(2, 2, new Float32Array(3), bounds),
    ).toThrow(RangeError);
  });
});

describe('DemLoadResult', () => {
  it('requires grid and permits fullResolution to be omitted', () => {
    const gridOnly: DemLoadResult = { grid: validGrid };
    const withFullResolution: DemLoadResult = {
      grid: validGrid,
      fullResolution: buildDemFullResolution(
        validGrid.cols,
        validGrid.rows,
        validGrid.values,
        validGrid.bounds,
      ),
    };

    expect(gridOnly).toEqual({ grid: validGrid });
    expect(withFullResolution.grid).toBe(validGrid);
    expect(withFullResolution.fullResolution).toBeDefined();
  });
});

// loadDemTilesWithFullResolution's fetch/Canvas path is browser-only and is not
// unit-tested directly in this node environment (fetch/createImageBitmap/document).
