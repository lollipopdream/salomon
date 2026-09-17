import { decodeElevationPixel } from '../geo/elevation';
import type {
  DemFullResolution,
  DemLoadResult,
  ElevationGrid,
  LatLng,
} from '../types';
import { generateSyntheticElevationGrid } from './syntheticDem';

const FALLBACK_COLS = 100;
const FALLBACK_ROWS = 100;
const FALLBACK_PEAK_ELEVATION_METERS = 599;
const TILE_URL_PATTERN = /\/(\d+)\/(\d+)\/(\d+)\.png(?:[?#].*)?$/;
const METERS_PER_DEGREE_LAT = 111_320;
// design.md §6 (既知の落とし穴6): avoid excessive polygon counts on modest GPUs.
// A combined 3x3 tile grid at z14 is 768x768 (~590k vertices), which is far
// above the ~100x100 target and measurably hurts frame rate. Downsample by
// striding before building the mesh.
const MAX_GRID_DIMENSION = 150;

type DemBounds = ElevationGrid['bounds'];

export function computeCellSizeMeters(
  bounds: DemBounds,
  fullResCols: number,
  fullResRows: number,
  stride: number,
): number {
  const centerLat = (bounds.north + bounds.south) / 2;
  const metersPerDegreeLng =
    METERS_PER_DEGREE_LAT * Math.cos((centerLat * Math.PI) / 180);
  const widthMeters = (bounds.east - bounds.west) * metersPerDegreeLng;
  const heightMeters = (bounds.north - bounds.south) * METERS_PER_DEGREE_LAT;
  const pixelSpacingX = widthMeters / fullResCols;
  const pixelSpacingZ = heightMeters / fullResRows;

  return ((pixelSpacingX + pixelSpacingZ) / 2) * stride;
}

export function downsampleElevationGrid(
  cols: number,
  rows: number,
  values: Float32Array,
  stride: number,
  cellSizeMeters: number,
): {
  cols: number;
  rows: number;
  values: Float32Array;
  cellSizeMeters: number;
} {
  if (stride === 1) {
    return { cols, rows, values, cellSizeMeters };
  }

  const downsampledCols = Math.floor((cols - 1) / stride) + 1;
  const downsampledRows = Math.floor((rows - 1) / stride) + 1;
  const downsampled = new Float32Array(downsampledCols * downsampledRows);

  for (let row = 0; row < downsampledRows; row += 1) {
    const sourceRowStart = row * stride;
    const sourceRowEnd = Math.min(sourceRowStart + stride, rows);
    for (let col = 0; col < downsampledCols; col += 1) {
      const sourceColStart = col * stride;
      const sourceColEnd = Math.min(sourceColStart + stride, cols);
      let sum = 0;
      let count = 0;

      for (let sourceRow = sourceRowStart; sourceRow < sourceRowEnd; sourceRow += 1) {
        for (let sourceCol = sourceColStart; sourceCol < sourceColEnd; sourceCol += 1) {
          sum += values[sourceRow * cols + sourceCol];
          count += 1;
        }
      }

      downsampled[row * downsampledCols + col] = sum / count;
    }
  }

  return {
    cols: downsampledCols,
    rows: downsampledRows,
    values: downsampled,
    cellSizeMeters,
  };
}

interface TileCoordinate {
  zoom: number;
  x: number;
  y: number;
}

interface LoadedTile extends TileCoordinate {
  image: ImageBitmap;
}

/** Decode row-major RGBA pixels into elevations in meters. */
export function parseDemPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): Float32Array {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new RangeError('DEM dimensions must be positive integers.');
  }

  const pixelCount = width * height;
  if (pixels.length !== pixelCount * 4) {
    throw new RangeError('RGBA pixel length does not match the DEM dimensions.');
  }

  const elevations = new Float32Array(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * 4;
    const elevation = decodeElevationPixel(
      pixels[offset],
      pixels[offset + 1],
      pixels[offset + 2],
    );

    // Use sea level for no-data pixels so NaN does not propagate into mesh geometry.
    elevations[index] = elevation ?? 0;
  }

  return elevations;
}

export function validateElevationGrid(grid: ElevationGrid): boolean {
  if (
    !grid ||
    !Number.isInteger(grid.cols) ||
    !Number.isInteger(grid.rows) ||
    grid.cols <= 0 ||
    grid.rows <= 0 ||
    !(grid.values instanceof Float32Array) ||
    grid.values.length !== grid.cols * grid.rows ||
    !Number.isFinite(grid.cellSizeMeters) ||
    grid.cellSizeMeters <= 0 ||
    !grid.bounds
  ) {
    return false;
  }

  const { north, south, east, west } = grid.bounds;
  return (
    Number.isFinite(north) &&
    Number.isFinite(south) &&
    Number.isFinite(east) &&
    Number.isFinite(west) &&
    north > south &&
    east > west
  );
}

function parseTileCoordinate(url: string): TileCoordinate {
  const match = TILE_URL_PATTERN.exec(url);
  if (!match) {
    throw new Error(`DEM tile URL does not end in /{z}/{x}/{y}.png: ${url}`);
  }

  return {
    zoom: Number(match[1]),
    x: Number(match[2]),
    y: Number(match[3]),
  };
}

function tileYToLatitude(y: number, zoom: number): number {
  const n = 2 ** zoom;
  const mercator = Math.PI * (1 - (2 * y) / n);
  return (Math.atan(Math.sinh(mercator)) * 180) / Math.PI;
}

function createFallbackGrid(origin: LatLng): ElevationGrid {
  const fallback = generateSyntheticElevationGrid(
    FALLBACK_COLS,
    FALLBACK_ROWS,
    FALLBACK_PEAK_ELEVATION_METERS,
  );
  const halfLatitudeSpan = (fallback.bounds.north - fallback.bounds.south) / 2;
  const halfLongitudeSpan = (fallback.bounds.east - fallback.bounds.west) / 2;

  return {
    ...fallback,
    bounds: {
      north: origin.lat + halfLatitudeSpan,
      south: origin.lat - halfLatitudeSpan,
      east: origin.lng + halfLongitudeSpan,
      west: origin.lng - halfLongitudeSpan,
    },
  };
}

export function buildDemFullResolution(
  cols: number,
  rows: number,
  values: Float32Array,
  bounds: ElevationGrid['bounds'],
): DemFullResolution {
  if (values.length !== cols * rows) {
    throw new RangeError('DEM values length does not match cols times rows.');
  }

  return {
    cols,
    rows,
    values,
    cellSizeMeters: computeCellSizeMeters(bounds, cols, rows, 1),
  };
}

async function loadRealDemTiles(
  tileUrls: string[],
  maxGridDimension = MAX_GRID_DIMENSION,
): Promise<DemLoadResult> {
  if (tileUrls.length === 0) {
    throw new Error('At least one DEM tile URL is required.');
  }

  const coordinates = tileUrls.map(parseTileCoordinate);
  const zoom = coordinates[0].zoom;
  if (coordinates.some((coordinate) => coordinate.zoom !== zoom)) {
    throw new Error('All DEM tiles must use the same zoom level.');
  }

  const loadedTiles: LoadedTile[] = [];
  try {
    for (let index = 0; index < tileUrls.length; index += 1) {
      const response = await fetch(tileUrls[index]);
      if (!response.ok) {
        throw new Error(
          `Failed to load DEM tile ${tileUrls[index]}: HTTP ${response.status}`,
        );
      }

      const image = await createImageBitmap(await response.blob());
      loadedTiles.push({ ...coordinates[index], image });
    }

    const tileWidth = loadedTiles[0].image.width;
    const tileHeight = loadedTiles[0].image.height;
    if (
      tileWidth <= 0 ||
      tileHeight <= 0 ||
      loadedTiles.some(
        ({ image }) => image.width !== tileWidth || image.height !== tileHeight,
      )
    ) {
      throw new Error('DEM tiles must have matching, non-zero dimensions.');
    }

    const minX = Math.min(...coordinates.map(({ x }) => x));
    const maxX = Math.max(...coordinates.map(({ x }) => x));
    const minY = Math.min(...coordinates.map(({ y }) => y));
    const maxY = Math.max(...coordinates.map(({ y }) => y));
    const canvas = document.createElement('canvas');
    canvas.width = (maxX - minX + 1) * tileWidth;
    canvas.height = (maxY - minY + 1) * tileHeight;

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('Could not create a 2D canvas context for DEM decoding.');
    }

    for (const { x, y, image } of loadedTiles) {
      context.drawImage(image, (x - minX) * tileWidth, (y - minY) * tileHeight);
    }

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const n = 2 ** zoom;
    const bounds = {
      north: tileYToLatitude(minY, zoom),
      south: tileYToLatitude(maxY + 1, zoom),
      west: (minX / n) * 360 - 180,
      east: ((maxX + 1) / n) * 360 - 180,
    };
    const fullResolutionValues = parseDemPixels(pixels, canvas.width, canvas.height);
    const stride = Math.max(
      1,
      Math.ceil(Math.max(canvas.width, canvas.height) / maxGridDimension),
    );
    const cellSizeMeters = computeCellSizeMeters(
      bounds,
      canvas.width,
      canvas.height,
      stride,
    );
    const downsampled = downsampleElevationGrid(
      canvas.width,
      canvas.height,
      fullResolutionValues,
      stride,
      cellSizeMeters,
    );
    return {
      grid: {
        cols: downsampled.cols,
        rows: downsampled.rows,
        values: downsampled.values,
        cellSizeMeters: downsampled.cellSizeMeters,
        bounds,
      },
      fullResolution: buildDemFullResolution(
        canvas.width,
        canvas.height,
        fullResolutionValues,
        bounds,
      ),
    };
  } finally {
    for (const { image } of loadedTiles) {
      image.close();
    }
  }
}

/**
 * Browser-only fetch/Canvas integration. It is intentionally excluded from
 * node-based unit tests; parseDemPixels and validateElevationGrid cover its
 * environment-independent logic.
 */
export async function loadDemTilesWithFullResolution(
  tileUrls: string[],
  origin: LatLng,
  maxGridDimension = MAX_GRID_DIMENSION,
): Promise<DemLoadResult> {
  try {
    return await loadRealDemTiles(tileUrls, maxGridDimension);
  } catch (error) {
    console.warn('DEM loading failed; using the PoC synthetic terrain.', error);
    return {
      grid: createFallbackGrid(origin),
      fullResolution: undefined,
    };
  }
}

export async function loadDemTiles(
  tileUrls: string[],
  origin: LatLng,
  maxGridDimension = MAX_GRID_DIMENSION,
): Promise<ElevationGrid> {
  return (
    await loadDemTilesWithFullResolution(tileUrls, origin, maxGridDimension)
  ).grid;
}
