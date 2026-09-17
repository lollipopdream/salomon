// @ts-expect-error This project intentionally has no Node type dependency.
import { createHash } from 'node:crypto';
// @ts-expect-error This project intentionally has no Node type dependency.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const PNG_URL = new URL('./far-canopy-r2-2048.png', import.meta.url);
const META_URL = new URL('./far-canopy-r2-meta.json', import.meta.url);
const PROJECT_ROOT_URL = new URL('../../../', import.meta.url);
const MASK_URL = new URL('../../../public/data/forest/takao-forest-mask.png', import.meta.url);
const VERIFICATION_URL = new URL(
  '../../../outputs/matsu-h01-forest-lab-reference-appearance-convergence-v1/tools/far-canopy-r2-verification.json',
  import.meta.url,
);

function sha256(url: URL): string {
  return createHash('sha256').update(readFileSync(url)).digest('hex');
}

describe('generated FAR canopy R2 appearance texture (I-11, design §11)', () => {
  const png = readFileSync(PNG_URL);
  const meta = JSON.parse(readFileSync(META_URL, 'utf8'));

  it('is a 2048x2048 RGBA8 PNG and matches its recorded output digest (I-11)', () => {
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.toString('ascii', 12, 16)).toBe('IHDR');
    expect(png.readUInt32BE(16)).toBe(2048);
    expect(png.readUInt32BE(20)).toBe(2048);
    expect(png[24]).toBe(8);
    expect(png[25]).toBe(6);
    expect(sha256(PNG_URL)).toBe(meta.output.sha256);
  });

  it('is tagged as the R2 appearance and keeps the locked world alignment', () => {
    expect(meta.appearance).toBe('R2');
    expect(meta.world.xMin).toBe(838.7224233659354);
    expect(meta.world.xMax).toBe(3075.3155523417627);
    expect(meta.world.zMin).toBe(2143.4017486018347);
    expect(meta.world.zMax).toBe(4379.994877577662);
    expect(meta.world.sideMeters).toBe(2236.5931289758273);
    expect(meta.world.texelMeters).toBe(1.0920864887577282);
    expect(meta.world.pngRowZeroIsZMin).toBe(true);
    expect(meta.world.requiredTextureFlipY).toBe(false);
    expect(meta.maskThreshold).toBe(0.35);
    expect(meta.routeCorridorRemoval).toBe(false);
    expect(meta.seed).toBe(20260913);
    expect(meta.size).toBe(2048);
    expect(meta.prefilter.cellSize).toBe(64);
  });

  it('records non-empty forest and non-forest statistics and a zero non-forest alpha', () => {
    expect(meta.stats.nonForestMaxAlpha).toBe(0);
    expect(meta.stats.forestTexelCount + meta.stats.nonForestTexelCount).toBe(2048 * 2048);
    expect(meta.stats.forestTexelCount).toBeGreaterThan(0);
    expect(meta.stats.nonForestTexelCount).toBeGreaterThan(0);
    expect(meta.stats.stampCount).toBeGreaterThan(0);
  });

  it('records the R2 family-driven appearance parameters (design §11.2 thresholds)', () => {
    expect(meta.appearanceParameters.familyThresholds.DARK_CONIFER_THRESHOLD).toBe(0.3892);
    expect(meta.appearanceParameters.familyThresholds.BRIGHT_BROADLEAF_THRESHOLD).toBe(0.6137);
    expect(meta.appearanceParameters.groveWeightsByFamily).toHaveLength(3);
    for (const row of meta.appearanceParameters.groveWeightsByFamily as number[][]) {
      const sum = row.reduce((total, value) => total + value, 0);
      expect(Math.abs(sum - 1)).toBeLessThanOrEqual(1e-9);
    }
    expect(meta.appearanceParameters.colorAnchors).toHaveLength(3);
    // design §11.2: R2 color anchor field positions are the fieldFull p10/p50/p90.
    expect(meta.appearanceParameters.colorAnchors[0].field).toBe(0.3232);
    expect(meta.appearanceParameters.colorAnchors[1].field).toBe(0.4825);
    expect(meta.appearanceParameters.colorAnchors[2].field).toBe(0.6409);
    // design §11.2: R2 macro field octave weights (0.48 / 0.30 / 0.22).
    const weights = (meta.appearanceParameters.macroFieldOctaves as Array<{ weight: number }>)
      .map((octave) => octave.weight);
    expect(weights).toEqual([0.48, 0.3, 0.22]);
  });

  it('matches all three recorded input digests to the source files (identical inputs to BASELINE/R1)', () => {
    expect(Object.keys(meta.inputs).sort()).toEqual([
      'forestMaskPng',
      'groveTopAtlasMeta',
      'groveTopAtlasPng',
    ]);
    for (const input of Object.values(meta.inputs) as Array<{ path: string; sha256: string }>) {
      expect(sha256(new URL(input.path, PROJECT_ROOT_URL))).toBe(input.sha256);
    }
  });
});

describe('independent FAR canopy R2 mask alignment verification', () => {
  const verification = JSON.parse(readFileSync(VERIFICATION_URL, 'utf8'));
  const meta = JSON.parse(readFileSync(META_URL, 'utf8'));

  it('checks every texel and covers both forest classifications', () => {
    expect(verification.checkedTexelCount).toBe(2048 * 2048);
    expect(verification.nonForestAlphaMax).toBe(0);
    expect(verification.nonForestTexelCount).toBeGreaterThan(0);
    expect(verification.forestTexelCount).toBeGreaterThan(0);
    expect(verification.nonForestTexelCount + verification.forestTexelCount).toBe(2048 * 2048);
  });

  it('binds the verification to the exact generated and source PNGs', () => {
    expect(verification.farCanopySha256).toBe(sha256(PNG_URL));
    expect(verification.maskSha256).toBe(sha256(MASK_URL));
  });

  it('matches the generated metadata world alignment exactly', () => {
    expect(verification.worldAlignment.xMin).toBe(meta.world.xMin);
    expect(verification.worldAlignment.zMin).toBe(meta.world.zMin);
    expect(verification.worldAlignment.texelMeters).toBe(meta.world.texelMeters);
    expect(verification.worldAlignment.pngRowZeroIsZMin).toBe(meta.world.pngRowZeroIsZMin);
  });

  it('independently reaches the generated metadata forest texel count', () => {
    expect(verification.forestTexelCount).toBe(meta.stats.forestTexelCount);
  });
});
