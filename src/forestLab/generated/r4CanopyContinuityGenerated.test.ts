// @ts-expect-error This project intentionally has no Node type dependency.
import { createHash } from 'node:crypto';
// @ts-expect-error This project intentionally has no Node type dependency.
import { existsSync, readFileSync } from 'node:fs';
// @ts-expect-error This project intentionally has no Node type dependency.
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

// NOTE: this suite deliberately never invokes any generator. It only reads the already-committed
// R4 assets and cross-checks them against the production atlases / recorded params and meta JSON.
// Running the generator inside a test previously crashed the vitest worker with a
// "Timeout calling onTaskUpdate" (see denseBroadleafGroveGenerated.test.ts history).

const TREE_PNG_URL = new URL('./tree-atlas-r4-crown-dominant-2048x2048.png', import.meta.url);
const GROVE_PNG_URL = new URL('./grove-atlas-r4-fine-grain-3072x2048.png', import.meta.url);
const FAR_PNG_URL = new URL('./far-canopy-r4-2048.png', import.meta.url);
const PARAMS_URL = new URL('./r4-canopy-atlases-params.json', import.meta.url);
const FAR_META_URL = new URL('./far-canopy-r4-meta.json', import.meta.url);
const FAR_R2_META_URL = new URL('./far-canopy-r2-meta.json', import.meta.url);

const PRODUCTION_TREE_PNG_URL = new URL(
  '../../../public/data/forest/impostor-v2/tree_atlas_2048.png',
  import.meta.url,
);
const PRODUCTION_GROVE_PNG_URL = new URL(
  '../../../public/data/forest/impostor-v2/grove_atlas_3072x2048.png',
  import.meta.url,
);
const PRODUCTION_META_URL = new URL(
  '../../../public/data/forest/impostor-v2/impostor-atlas-meta.json',
  import.meta.url,
);

const TREE_CELL_WIDTH = 256;
const TREE_CELL_HEIGHT = 512;
const GROVE_CELL_SIZE = 512;

interface DecodedPng {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  pixels: Uint8Array;
}

interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface ProductionCell {
  atlas: string;
  row: number;
  col: number;
  grove_config: string | null;
  source_variant: string | null;
  yaw_deg: number;
  pixel_content_bounds: Bounds;
}

function uint32be(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
}

function paeth(left: number, above: number, upperLeft: number): number {
  const prediction = left + above - upperLeft;
  const leftDistance = Math.abs(prediction - left);
  const aboveDistance = Math.abs(prediction - above);
  const upperLeftDistance = Math.abs(prediction - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function decodeRgba8Png(url: URL): DecodedPng {
  const png = new Uint8Array(readFileSync(url));
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatChunks: Uint8Array[] = [];
  while (offset < png.length) {
    const length = uint32be(png, offset);
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    const data = png.subarray(offset + 8, offset + 8 + length);
    offset += length + 12;
    if (type === 'IHDR') {
      width = uint32be(data, 0);
      height = uint32be(data, 4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }
  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new TypeError('Expected a non-interlaced RGBA8 PNG.');
  }
  const compressedLength = idatChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const compressed = new Uint8Array(compressedLength);
  let compressedOffset = 0;
  for (const chunk of idatChunks) {
    compressed.set(chunk, compressedOffset);
    compressedOffset += chunk.length;
  }
  const filtered = new Uint8Array(inflateSync(compressed));
  const stride = width * 4;
  if (filtered.length !== (stride + 1) * height) throw new TypeError('Invalid PNG data length.');
  const pixels = new Uint8Array(stride * height);
  let sourceOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = filtered[sourceOffset++];
    if (filter > 4) throw new TypeError(`Unsupported PNG filter ${filter}.`);
    const rowOffset = y * stride;
    const previousRowOffset = rowOffset - stride;
    for (let x = 0; x < stride; x += 1) {
      const raw = filtered[sourceOffset++];
      const left = x >= 4 ? pixels[rowOffset + x - 4] : 0;
      const above = y > 0 ? pixels[previousRowOffset + x] : 0;
      const upperLeft = y > 0 && x >= 4 ? pixels[previousRowOffset + x - 4] : 0;
      const predictor = filter === 1
        ? left
        : filter === 2
          ? above
          : filter === 3
            ? Math.floor((left + above) / 2)
            : filter === 4 ? paeth(left, above, upperLeft) : 0;
      pixels[rowOffset + x] = (raw + predictor) & 0xff;
    }
  }
  return { width, height, bitDepth, colorType, pixels };
}

function sha256(url: URL): string {
  return createHash('sha256').update(readFileSync(url)).digest('hex');
}

function cellsArePixelIdentical(
  a: DecodedPng,
  b: DecodedPng,
  row: number,
  col: number,
  cellWidth: number,
  cellHeight: number,
): boolean {
  for (let y = 0; y < cellHeight; y += 1) {
    const byteStart = ((row * cellHeight + y) * a.width + col * cellWidth) * 4;
    const byteEnd = byteStart + cellWidth * 4;
    for (let byte = byteStart; byte < byteEnd; byte += 1) {
      if (a.pixels[byte] !== b.pixels[byte]) return false;
    }
  }
  return true;
}

const ALPHA_MINIMUM = 8;

function cellAlphaBounds(
  png: DecodedPng,
  row: number,
  col: number,
  cellWidth: number,
  cellHeight: number,
): Bounds {
  let x0 = cellWidth;
  let y0 = cellHeight;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < cellHeight; y += 1) {
    for (let x = 0; x < cellWidth; x += 1) {
      const atlasX = col * cellWidth + x;
      const atlasY = row * cellHeight + y;
      if (png.pixels[(atlasY * png.width + atlasX) * 4 + 3] < ALPHA_MINIMUM) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x + 1);
      y1 = Math.max(y1, y + 1);
    }
  }
  return { x0, y0, x1, y1 };
}

describe('generated R4 canopy continuity atlases', () => {
  const params = JSON.parse(readFileSync(PARAMS_URL, 'utf8')) as {
    sha256: { outputs: { tree_png: string; grove_png: string } };
  };
  const farMeta = JSON.parse(readFileSync(FAR_META_URL, 'utf8')) as {
    world: unknown;
    seed: number;
    stampSpacingMeters: number;
    maskThreshold: number;
    appearanceParameters: { macroFieldOctaves: unknown };
    stats: { nonForestMaxAlpha: number };
    output: { sha256: string };
  };
  const farR2Meta = JSON.parse(readFileSync(FAR_R2_META_URL, 'utf8')) as {
    world: unknown;
    seed: number;
    stampSpacingMeters: number;
    maskThreshold: number;
    appearanceParameters: { macroFieldOctaves: unknown };
  };
  const productionMeta = JSON.parse(readFileSync(PRODUCTION_META_URL, 'utf8')) as {
    cells: ProductionCell[];
  };

  it('exists as three RGBA8 PNGs of the expected dimensions', () => {
    expect(existsSync(TREE_PNG_URL)).toBe(true);
    expect(existsSync(GROVE_PNG_URL)).toBe(true);
    expect(existsSync(FAR_PNG_URL)).toBe(true);

    const tree = decodeRgba8Png(TREE_PNG_URL);
    expect(tree).toMatchObject({ width: 2048, height: 2048, bitDepth: 8, colorType: 6 });

    const grove = decodeRgba8Png(GROVE_PNG_URL);
    expect(grove).toMatchObject({ width: 3072, height: 2048, bitDepth: 8, colorType: 6 });

    const far = decodeRgba8Png(FAR_PNG_URL);
    expect(far).toMatchObject({ width: 2048, height: 2048, bitDepth: 8, colorType: 6 });
  });

  it('matches every recorded sha256 digest', () => {
    expect(sha256(TREE_PNG_URL)).toBe(params.sha256.outputs.tree_png);
    expect(sha256(GROVE_PNG_URL)).toBe(params.sha256.outputs.grove_png);
    expect(sha256(FAR_PNG_URL)).toBe(farMeta.output.sha256);
    // Values independently measured and recorded by the leader (see task sha256 list).
    expect(sha256(FAR_PNG_URL))
      .toBe('95b7551668e8c367f4aa11d11dcb8f00b5212ae518d35e75e64b1e83bac12bb6');
    expect(sha256(FAR_META_URL))
      .toBe('26c428426ff338858c54258a99d1b2cc2e088fa9a875355679f038442f5f7e36');
  });

  it('keeps every non-BL tree cell pixel-identical to the production tree atlas', () => {
    const tree = decodeRgba8Png(TREE_PNG_URL);
    const production = decodeRgba8Png(PRODUCTION_TREE_PNG_URL);
    expect(tree.width).toBe(production.width);
    expect(tree.height).toBe(production.height);
    const nonBlCells = productionMeta.cells.filter((cell) =>
      cell.atlas === 'tree' && cell.source_variant !== 'BL'
    );
    expect(nonBlCells).toHaveLength(24);
    let firstMismatch = '';
    for (const cell of nonBlCells) {
      const identical = cellsArePixelIdentical(
        tree,
        production,
        cell.row,
        cell.col,
        TREE_CELL_WIDTH,
        TREE_CELL_HEIGHT,
      );
      if (!identical) {
        firstMismatch = `${cell.source_variant} yaw ${cell.yaw_deg} (row ${cell.row}, col ${cell.col})`;
        break;
      }
    }
    expect(firstMismatch).toBe('');
  });

  it('keeps every non-G4/G5 grove cell pixel-identical to the production grove atlas', () => {
    const grove = decodeRgba8Png(GROVE_PNG_URL);
    const production = decodeRgba8Png(PRODUCTION_GROVE_PNG_URL);
    expect(grove.width).toBe(production.width);
    expect(grove.height).toBe(production.height);
    const nonG4G5Cells = productionMeta.cells.filter((cell) =>
      cell.atlas === 'grove' && cell.grove_config !== 'G4' && cell.grove_config !== 'G5'
    );
    expect(nonG4G5Cells).toHaveLength(16);
    let firstMismatch = '';
    for (const cell of nonG4G5Cells) {
      const identical = cellsArePixelIdentical(
        grove,
        production,
        cell.row,
        cell.col,
        GROVE_CELL_SIZE,
        GROVE_CELL_SIZE,
      );
      if (!identical) {
        firstMismatch = `${cell.grove_config} yaw ${cell.yaw_deg} (row ${cell.row}, col ${cell.col})`;
        break;
      }
    }
    expect(firstMismatch).toBe('');
  });

  it('matches the production alpha tight bounds exactly for every replaced BL tree cell', () => {
    const tree = decodeRgba8Png(TREE_PNG_URL);
    const blCells = productionMeta.cells.filter((cell) =>
      cell.atlas === 'tree' && cell.source_variant === 'BL'
    );
    expect(blCells).toHaveLength(8);
    for (const cell of blCells) {
      const bounds = cellAlphaBounds(tree, cell.row, cell.col, TREE_CELL_WIDTH, TREE_CELL_HEIGHT);
      expect(bounds, `BL yaw ${cell.yaw_deg}`).toEqual(cell.pixel_content_bounds);
    }
  });

  it('matches the production alpha tight bounds exactly for every replaced G4/G5 grove cell', () => {
    const grove = decodeRgba8Png(GROVE_PNG_URL);
    const g4g5Cells = productionMeta.cells.filter((cell) =>
      cell.atlas === 'grove' && (cell.grove_config === 'G4' || cell.grove_config === 'G5')
    );
    expect(g4g5Cells).toHaveLength(8);
    for (const cell of g4g5Cells) {
      const bounds = cellAlphaBounds(grove, cell.row, cell.col, GROVE_CELL_SIZE, GROVE_CELL_SIZE);
      expect(bounds, `${cell.grove_config} yaw ${cell.yaw_deg}`).toEqual(cell.pixel_content_bounds);
    }
  });

  it('keeps far-canopy-r4-meta.json world/seed/spacing/threshold/macro-field identical to R2', () => {
    expect(farMeta.world).toEqual(farR2Meta.world);
    expect(farMeta.seed).toBe(farR2Meta.seed);
    expect(farMeta.stampSpacingMeters).toBe(farR2Meta.stampSpacingMeters);
    expect(farMeta.maskThreshold).toBe(farR2Meta.maskThreshold);
    expect(farMeta.appearanceParameters.macroFieldOctaves)
      .toEqual(farR2Meta.appearanceParameters.macroFieldOctaves);
  });

  it('never draws canopy alpha outside the forest mask in the R4 FAR asset', () => {
    expect(farMeta.stats.nonForestMaxAlpha).toBe(0);
  });
});
