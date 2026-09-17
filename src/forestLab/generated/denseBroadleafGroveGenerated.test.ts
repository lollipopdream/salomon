// @ts-expect-error This project intentionally has no Node type dependency.
import { createHash } from 'node:crypto';
// @ts-expect-error This project intentionally has no Node type dependency.
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
// @ts-expect-error This project intentionally has no Node type dependency.
import { tmpdir } from 'node:os';
// @ts-expect-error This project intentionally has no Node type dependency.
import { pathToFileURL } from 'node:url';
// @ts-expect-error This project intentionally has no Node type dependency.
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
// @ts-expect-error The offline generator is deliberately plain JavaScript.
import { generateDenseBroadleafGrove } from '../../../outputs/matsu-h01-dense-broadleaf-cluster-lab/tools/generateDenseBroadleafGrove.mjs';

const GENERATED_PNG_URL = new URL(
  './grove-atlas-r3-dense-broadleaf-3072x2048.png',
  import.meta.url,
);
const PARAMS_URL = new URL('./grove-atlas-r3-dense-broadleaf-params.json', import.meta.url);
const PRODUCTION_PNG_URL = new URL(
  '../../../public/data/forest/impostor-v2/grove_atlas_3072x2048.png',
  import.meta.url,
);
const PRODUCTION_META_URL = new URL(
  '../../../public/data/forest/impostor-v2/impostor-atlas-meta.json',
  import.meta.url,
);
const EXPECTED_SHA256 = '1cae7ba517eafd52b1e20e3504c03d5e114e6fdf6d77eade6ec740463c257cd0';
const CELL_SIZE = 512;
const ALPHA_MINIMUM = 8;
// @ts-expect-error This project intentionally has no Node type dependency.
const RUN_GENERATOR_DETERMINISM = process.env.RUN_GENERATOR_DETERMINISM === '1';

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
  yaw_deg: number;
  pixel_content_bounds: Bounds;
}

interface GeneratedCell {
  config: string;
  yaw_deg: number;
  achieved_alpha_coverage: number;
  required_alpha_coverage: number;
  target_tight_bounds: Bounds;
  achieved_tight_bounds: Bounds;
  tight_bounds_equal: boolean;
}

interface GeneratedParams {
  sha256: {
    output_png: string;
    production_grove_atlas: string;
    broadleaf_round_light_a: string;
    broadleaf_round_light_b: string;
    broadleaf_meta: string;
    production_meta: string;
  };
  cells: GeneratedCell[];
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

function cellsArePixelIdentical(a: DecodedPng, b: DecodedPng, row: number, col: number): boolean {
  for (let y = 0; y < CELL_SIZE; y += 1) {
    const byteStart = ((row * CELL_SIZE + y) * a.width + col * CELL_SIZE) * 4;
    const byteEnd = byteStart + CELL_SIZE * 4;
    for (let byte = byteStart; byte < byteEnd; byte += 1) {
      if (a.pixels[byte] !== b.pixels[byte]) return false;
    }
  }
  return true;
}

function cellAlphaMetrics(png: DecodedPng, row: number, col: number): {
  bounds: Bounds;
  coverage: number;
} {
  let x0 = CELL_SIZE;
  let y0 = CELL_SIZE;
  let x1 = 0;
  let y1 = 0;
  let covered = 0;
  for (let y = 0; y < CELL_SIZE; y += 1) {
    for (let x = 0; x < CELL_SIZE; x += 1) {
      const atlasX = col * CELL_SIZE + x;
      const atlasY = row * CELL_SIZE + y;
      if (png.pixels[(atlasY * png.width + atlasX) * 4 + 3] < ALPHA_MINIMUM) continue;
      covered += 1;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x + 1);
      y1 = Math.max(y1, y + 1);
    }
  }
  return { bounds: { x0, y0, x1, y1 }, coverage: covered / (CELL_SIZE * CELL_SIZE) };
}

describe('generated R3 dense broadleaf grove atlas', () => {
  const params = JSON.parse(readFileSync(PARAMS_URL, 'utf8')) as GeneratedParams;
  const productionMeta = JSON.parse(readFileSync(PRODUCTION_META_URL, 'utf8')) as {
    cells: ProductionCell[];
  };
  const generated = decodeRgba8Png(GENERATED_PNG_URL);
  const production = decodeRgba8Png(PRODUCTION_PNG_URL);

  it('exists as a 3072x2048 RGBA8 PNG with the locked sha256', () => {
    expect(existsSync(GENERATED_PNG_URL)).toBe(true);
    expect(generated).toMatchObject({ width: 3072, height: 2048, bitDepth: 8, colorType: 6 });
    expect(sha256(GENERATED_PNG_URL)).toBe(EXPECTED_SHA256);
  });

  it('records the locked PNG sha256 in its params JSON', () => {
    expect(params.sha256.output_png).toBe(EXPECTED_SHA256);
  });

  it('locks every recorded production and baked broadleaf input digest', () => {
    expect(params.sha256.production_grove_atlas).toBe(sha256(PRODUCTION_PNG_URL));
    expect(params.sha256.production_meta).toBe(sha256(PRODUCTION_META_URL));
    expect(params.sha256.broadleaf_round_light_a).toBe(sha256(new URL(
      '../../../outputs/matsu-h01-broadleaf-round-light-asset-source-and-bake-preflight/bake/broadleaf_round_light_a_3072x2304.png',
      import.meta.url,
    )));
    expect(params.sha256.broadleaf_round_light_b).toBe(sha256(new URL(
      '../../../outputs/matsu-h01-broadleaf-round-light-asset-source-and-bake-preflight/bake/broadleaf_round_light_b_3072x2304.png',
      import.meta.url,
    )));
    expect(params.sha256.broadleaf_meta).toBe(sha256(new URL(
      '../../../outputs/matsu-h01-broadleaf-round-light-asset-source-and-bake-preflight/bake/broadleaf-round-light-atlas-meta.json',
      import.meta.url,
    )));
  });

  it('keeps all 16 non-G4/G5 cells pixel-identical to the production grove atlas', () => {
    expect(production.width).toBe(generated.width);
    expect(production.height).toBe(generated.height);
    let firstMismatch = -1;
    for (let row = 0; row < 4 && firstMismatch < 0; row += 1) {
      for (const col of [0, 1, 2, 5]) {
        for (let y = 0; y < CELL_SIZE && firstMismatch < 0; y += 1) {
          const byteStart = ((row * CELL_SIZE + y) * generated.width + col * CELL_SIZE) * 4;
          const byteEnd = byteStart + CELL_SIZE * 4;
          for (let byte = byteStart; byte < byteEnd; byte += 1) {
            if (generated.pixels[byte] !== production.pixels[byte]) {
              firstMismatch = byte;
              break;
            }
          }
        }
      }
    }
    expect(firstMismatch).toBe(-1);
  });

  it('changes every G4/G5 cell from the production grove atlas', () => {
    for (const config of ['G4', 'G5']) {
      for (const yaw of [0, 90, 180, 270]) {
        const productionCell = productionMeta.cells.find((cell) =>
          cell.atlas === 'grove' && cell.grove_config === config && cell.yaw_deg === yaw
        )!;
        expect(
          cellsArePixelIdentical(generated, production, productionCell.row, productionCell.col),
          `${config} yaw ${yaw}`,
        ).toBe(false);
      }
    }
  });

  it('matches production alpha tight bounds exactly for every G4/G5 cell', () => {
    for (const config of ['G4', 'G5']) {
      for (const yaw of [0, 90, 180, 270]) {
        const productionCell = productionMeta.cells.find((cell) =>
          cell.atlas === 'grove' && cell.grove_config === config && cell.yaw_deg === yaw
        )!;
        const actual = cellAlphaMetrics(generated, productionCell.row, productionCell.col);
        expect(actual.bounds, `${config} yaw ${yaw}`).toEqual(productionCell.pixel_content_bounds);
        const paramsCell = params.cells.find((cell) =>
          cell.config === config && cell.yaw_deg === yaw
        )!;
        expect(paramsCell.target_tight_bounds).toEqual(productionCell.pixel_content_bounds);
        expect(paramsCell.achieved_tight_bounds).toEqual(productionCell.pixel_content_bounds);
        expect(paramsCell.tight_bounds_equal).toBe(true);
      }
    }
  });

  it('meets the alpha coverage floor for every G4/G5 cell', () => {
    for (const config of ['G4', 'G5']) {
      for (const yaw of [0, 90, 180, 270]) {
        const productionCell = productionMeta.cells.find((cell) =>
          cell.atlas === 'grove' && cell.grove_config === config && cell.yaw_deg === yaw
        )!;
        const actual = cellAlphaMetrics(generated, productionCell.row, productionCell.col);
        const floor = yaw === 0 || yaw === 180 ? 0.45 : 0.55;
        expect(actual.coverage, `${config} yaw ${yaw}`).toBeGreaterThanOrEqual(floor);
        const paramsCell = params.cells.find((cell) =>
          cell.config === config && cell.yaw_deg === yaw
        )!;
        expect(paramsCell.required_alpha_coverage).toBe(floor);
        expect(paramsCell.achieved_alpha_coverage).toBeCloseTo(actual.coverage, 9);
      }
    }
  });

  // Gated because the measured 86.5 s generator work can trigger a worker RPC timeout under full-suite load.
  // Run with: RUN_GENERATOR_DETERMINISM=1 npx vitest run src/forestLab/generated/denseBroadleafGroveGenerated.test.ts
  it.skipIf(!RUN_GENERATOR_DETERMINISM)('recreates the committed atlas byte-for-byte', async () => {
    const outputDirectory = mkdtempSync(`${tmpdir()}/dense-broadleaf-grove-`);
    const outputUrls = (directory: string) => {
      const directoryUrl = pathToFileURL(`${directory}/`);
      return {
        outputPng: new URL('grove.png', directoryUrl),
        params: new URL('params.json', directoryUrl),
        preview: new URL('preview.png', directoryUrl),
      };
    };
    const output = outputUrls(outputDirectory);
    try {
      await generateDenseBroadleafGrove(output);

      expect(readFileSync(output.outputPng).equals(readFileSync(GENERATED_PNG_URL))).toBe(true);
      expect(readFileSync(output.params).equals(readFileSync(PARAMS_URL))).toBe(true);
    } finally {
      rmSync(outputDirectory, { recursive: true, force: true });
    }
  }, 300_000);
});
