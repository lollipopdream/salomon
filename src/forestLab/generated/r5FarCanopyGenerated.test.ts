// @ts-expect-error This project intentionally has no Node type dependency.
import { createHash } from 'node:crypto';
// @ts-expect-error This project intentionally has no Node type dependency.
import { readFileSync } from 'node:fs';
// @ts-expect-error This project intentionally has no Node type dependency.
import { inflateSync } from 'node:zlib';
// @ts-expect-error This project intentionally has no Node type dependency.
import { execFileSync } from 'node:child_process';
// @ts-expect-error This project intentionally has no Node type dependency.
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Opt-in because the generator does real work and writes the committed asset in place.
// Run with:
//   RUN_GENERATOR_DETERMINISM=1 npx vitest run src/forestLab/generated/r5FarCanopyGenerated.test.ts
// @ts-expect-error This project intentionally has no Node type dependency.
const RUN_GENERATOR_DETERMINISM = process.env.RUN_GENERATOR_DETERMINISM === '1';

// NOTE: like r4CanopyContinuityGenerated.test.ts, this suite deliberately never invokes the
// generator. It only reads the already-committed R5 FAR asset and cross-checks it against the
// forest mask (world-coordinate aligned, not a naive proportional scale — see the "mask" test
// below), far-canopy-r2-meta.json, and the recorded input sha256 digests. Running a generator
// inside a test previously crashed the vitest worker with a "Timeout calling onTaskUpdate"
// (see denseBroadleafGroveGenerated.test.ts history).

const FAR_PNG_URL = new URL('./far-canopy-r5-2048.png', import.meta.url);
const FAR_META_URL = new URL('./far-canopy-r5-meta.json', import.meta.url);
const R2_META_URL = new URL('./far-canopy-r2-meta.json', import.meta.url);
const MASK_PNG_URL = new URL('../../../public/data/forest/takao-forest-mask.png', import.meta.url);
const MASK_META_URL = new URL(
  '../../../public/data/forest/takao-forest-mask-meta.json',
  import.meta.url,
);

interface DecodedPng {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  channels: number;
  pixels: Uint8Array;
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

const CHANNELS_BY_COLOR_TYPE: Record<number, number> = {
  0: 1, // grayscale
  6: 4, // truecolor + alpha (RGBA)
};

/** Decodes a non-interlaced 8-bit PNG. Supports grayscale (colorType 0) and RGBA (colorType 6). */
function decodePng(url: URL): DecodedPng {
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
  const channels = CHANNELS_BY_COLOR_TYPE[colorType];
  if (bitDepth !== 8 || channels === undefined || interlace !== 0) {
    throw new TypeError(
      `Expected a non-interlaced 8-bit grayscale or RGBA PNG; got bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}.`,
    );
  }
  const compressedLength = idatChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const compressed = new Uint8Array(compressedLength);
  let compressedOffset = 0;
  for (const chunk of idatChunks) {
    compressed.set(chunk, compressedOffset);
    compressedOffset += chunk.length;
  }
  const filtered = new Uint8Array(inflateSync(compressed));
  const bytesPerPixel = channels;
  const stride = width * bytesPerPixel;
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
      const left = x >= bytesPerPixel ? pixels[rowOffset + x - bytesPerPixel] : 0;
      const above = y > 0 ? pixels[previousRowOffset + x] : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel ? pixels[previousRowOffset + x - bytesPerPixel] : 0;
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
  return { width, height, bitDepth, colorType, channels, pixels };
}

function sha256(url: URL): string {
  return createHash('sha256').update(readFileSync(url)).digest('hex');
}

interface FarCanopyR5Meta {
  world: {
    xMin: number;
    zMin: number;
    texelMeters: number;
  };
  seed: number;
  stampSpacingMeters: number;
  maskThreshold: number;
  appearanceParameters: { macroFieldOctaves: unknown };
  inputs: Record<string, { path: string; sha256: string }>;
  output: { sha256: string };
  stats: { nonForestTexelCount: number; forestTexelCount: number; nonForestMaxAlpha: number };
}

interface FarCanopyR2Meta {
  world: unknown;
  seed: number;
  stampSpacingMeters: number;
  maskThreshold: number;
  appearanceParameters: { macroFieldOctaves: unknown };
}

interface MaskMeta {
  size: number;
  worldExtentMeters: number;
}

describe('generated R5 FAR canopy asset', () => {
  const meta = JSON.parse(readFileSync(FAR_META_URL, 'utf8')) as FarCanopyR5Meta;
  const r2Meta = JSON.parse(readFileSync(R2_META_URL, 'utf8')) as FarCanopyR2Meta;
  const maskMeta = JSON.parse(readFileSync(MASK_META_URL, 'utf8')) as MaskMeta;

  it('exists as a 2048x2048 RGBA8 PNG and matches every recorded sha256 digest', () => {
    const far = decodePng(FAR_PNG_URL);
    expect(far).toMatchObject({ width: 2048, height: 2048, bitDepth: 8, colorType: 6, channels: 4 });
    expect(sha256(FAR_PNG_URL)).toBe(meta.output.sha256);
    // Values independently measured and recorded by the leader (see task sha256 list).
    expect(sha256(FAR_PNG_URL))
      .toBe('c3be3e74d7521ce0e1547b458ac84d3b652a4572b32a13a00e2d665079446dc0');
    expect(sha256(FAR_META_URL))
      .toBe('31a1bf1485349787f09af4658b4cbe1754151281112dbfdd4c21c02fefef997c');
  });

  it('keeps world/seed/stampSpacing/maskThreshold/macro-field identical to R2', () => {
    expect(meta.world).toEqual(r2Meta.world);
    expect(meta.seed).toBe(r2Meta.seed);
    expect(meta.stampSpacingMeters).toBe(r2Meta.stampSpacingMeters);
    expect(meta.maskThreshold).toBe(r2Meta.maskThreshold);
    expect(meta.appearanceParameters.macroFieldOctaves)
      .toEqual(r2Meta.appearanceParameters.macroFieldOctaves);
  });

  it('locks the sha256 of every generator input asset recorded in far-canopy-r5-meta.json', () => {
    let checkedAny = false;
    for (const [key, input] of Object.entries(meta.inputs)) {
      checkedAny = true;
      const url = new URL(`../../../${input.path}`, import.meta.url);
      expect(sha256(url), `${key} (${input.path})`).toBe(input.sha256);
    }
    expect(checkedAny).toBe(true);
  });

  it(
    'never draws canopy alpha outside the forest mask, verified from decoded PNG pixels '
    + '(not the meta self-report) using world-coordinate mask alignment (R4 reviewer #5 recovery)',
    () => {
      const far = decodePng(FAR_PNG_URL);
      const mask = decodePng(MASK_PNG_URL);
      expect(mask.colorType).toBe(0);
      expect(mask.width).toBe(maskMeta.size);
      expect(mask.height).toBe(maskMeta.size);

      const { xMin, zMin, texelMeters } = meta.world;
      const { worldExtentMeters, size: maskSize } = maskMeta;
      const { maskThreshold } = meta;

      let forestTexelCount = 0;
      let nonForestTexelCount = 0;
      let maxAlphaOutsideMask = 0;

      for (let row = 0; row < far.height; row += 1) {
        const worldZ = zMin + (row + 0.5) * texelMeters;
        // IMPORTANT: mask lookup goes through world coordinates, not a naive proportional
        // rescale (far pixel * maskSize / farSize) — the FAR patch is only a sub-region of the
        // mask's full world extent (see meta.world.sideMeters vs. maskMeta.worldExtentMeters).
        const maskRow = Math.floor((worldZ / worldExtentMeters) * maskSize);
        for (let col = 0; col < far.width; col += 1) {
          const worldX = xMin + (col + 0.5) * texelMeters;
          const maskCol = Math.floor((worldX / worldExtentMeters) * maskSize);
          const inMask = maskCol >= 0 && maskCol < mask.width && maskRow >= 0 && maskRow < mask.height;
          const coverage = inMask ? mask.pixels[(maskRow * mask.width + maskCol) * mask.channels] : 0;
          const isForest = coverage / 255 >= maskThreshold;
          if (isForest) {
            forestTexelCount += 1;
          } else {
            nonForestTexelCount += 1;
            const alpha = far.pixels[(row * far.width + col) * 4 + 3];
            if (alpha > maxAlphaOutsideMask) maxAlphaOutsideMask = alpha;
          }
        }
      }

      expect(forestTexelCount + nonForestTexelCount).toBe(far.width * far.height);
      expect(maxAlphaOutsideMask).toBe(0);
      expect(nonForestTexelCount).toBe(582195);
      expect(forestTexelCount).toBe(3612109);
      // Belt-and-suspenders cross-check against the generator's own self-reported counts.
      expect(nonForestTexelCount).toBe(meta.stats.nonForestTexelCount);
      expect(forestTexelCount).toBe(meta.stats.forestTexelCount);
      expect(meta.stats.nonForestMaxAlpha).toBe(0);
    },
  );

  // reviewer #7: the generator's determinism was previously evidenced only by running it by hand.
  // This gates it behind an env flag (same pattern as denseBroadleafGroveGenerated.test.ts) so CI
  // can enforce it without paying the cost on every full-suite run.
  //
  // The generator writes src/forestLab/generated/far-canopy-r5-2048.png in place, so this test
  // asserts the committed bytes are REPRODUCED, not merely that two runs agree with each other:
  // a drifting generator fails here AND leaves a visible working-tree diff.
  it.skipIf(!RUN_GENERATOR_DETERMINISM)(
    'regenerates the committed R5 FAR asset byte-for-byte across two consecutive runs',
    () => {
      const generator = fileURLToPath(
        new URL(
          '../../../outputs/matsu-h01-r5-far-first-crown-grain-lab/tools/generateR5FarCanopy.mjs',
          import.meta.url,
        ),
      );
      const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
      const digest = (url: URL) => createHash('sha256').update(readFileSync(url)).digest('hex');

      const committedPng = digest(FAR_PNG_URL);
      const committedMeta = digest(FAR_META_URL);

      const run = () => {
        // @ts-expect-error This project intentionally has no Node type dependency.
        execFileSync(process.execPath, [generator], { cwd: repoRoot, stdio: 'pipe' });
        return { png: digest(FAR_PNG_URL), meta: digest(FAR_META_URL) };
      };

      const first = run();
      const second = run();

      expect(first.png).toBe(committedPng);
      expect(first.meta).toBe(committedMeta);
      expect(second.png).toBe(first.png);
      expect(second.meta).toBe(first.meta);
    },
    600_000,
  );
});
