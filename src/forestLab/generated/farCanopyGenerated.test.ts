// @ts-expect-error This project intentionally has no Node type dependency.
import { createHash } from 'node:crypto';
// @ts-expect-error This project intentionally has no Node type dependency.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const PNG_URL = new URL('./far-canopy-2048.png', import.meta.url);
const META_URL = new URL('./far-canopy-meta.json', import.meta.url);
const PROJECT_ROOT_URL = new URL('../../../', import.meta.url);

function sha256(url: URL): string {
  return createHash('sha256').update(readFileSync(url)).digest('hex');
}

describe('generated FAR canopy appearance texture', () => {
  const png = readFileSync(PNG_URL);
  const meta = JSON.parse(readFileSync(META_URL, 'utf8'));

  it('is a 2048x2048 RGBA8 PNG and matches its output digest', () => {
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.toString('ascii', 12, 16)).toBe('IHDR');
    expect(png.readUInt32BE(16)).toBe(2048);
    expect(png.readUInt32BE(20)).toBe(2048);
    expect(png[24]).toBe(8);
    expect(png[25]).toBe(6);
    expect(sha256(PNG_URL)).toBe(meta.output.sha256);
  });

  it('records the locked world alignment and generation settings', () => {
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

  it('records non-empty forest and non-forest statistics', () => {
    expect(meta.stats.nonForestMaxAlpha).toBe(0);
    expect(meta.stats.forestTexelCount + meta.stats.nonForestTexelCount).toBe(2048 * 2048);
    expect(meta.stats.forestTexelCount).toBeGreaterThan(0);
    expect(meta.stats.nonForestTexelCount).toBeGreaterThan(0);
    expect(meta.stats.stampCount).toBeGreaterThan(0);
  });

  it('matches all three recorded input digests to the source files', () => {
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
