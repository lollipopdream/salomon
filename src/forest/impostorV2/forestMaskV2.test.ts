// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  decodeForestMaskV2FromRgba,
  isFootprintInsideMask,
  loadForestMaskV2,
  sampleMaskCoverageV2,
} from './forestMaskV2';
import type { ForestMaskV2Data } from './types';

function data(size: number, extentMeters: number, coverage: Uint8Array): ForestMaskV2Data {
  return { size, extentMeters, coverage };
}

function rgbaFor(coverage: readonly number[]): Uint8Array {
  const rgba = new Uint8Array(coverage.length * 4);
  for (let index = 0; index < coverage.length; index += 1) {
    rgba[index * 4] = coverage[index];
    rgba[index * 4 + 1] = 17;
    rgba[index * 4 + 2] = 33;
    rgba[index * 4 + 3] = 49;
  }
  return rgba;
}

describe('forestMaskV2', () => {
  it('decodes only red values and rejects invalid dimensions or lengths', () => {
    expect(() => decodeForestMaskV2FromRgba(Uint8Array.from([1, 2, 3]), 1, 10))
      .toThrow(/expected 4, received 3/);
    for (const size of [0, -1, 1.5]) {
      expect(() => decodeForestMaskV2FromRgba(new Uint8Array(4), size, 10)).toThrow(/expected.*received/);
    }
    const decoded = decodeForestMaskV2FromRgba(Uint8Array.from([
      5, 50, 51, 52, 9, 90, 91, 92,
      13, 130, 131, 132, 17, 170, 171, 172,
    ]), 2, 20);
    expect(decoded.coverage).toHaveLength(4);
    expect([...decoded.coverage]).toEqual([5, 9, 13, 17]);
  });

  it('samples with the established row and column convention, including boundaries', () => {
    const mask = data(2, 20, Uint8Array.from([255, 0, 0, 0]));
    for (const [x, z] of [[-0.1, 1], [1, -0.1], [20, 1], [1, 20]]) {
      expect(sampleMaskCoverageV2(mask, x, z)).toBe(0);
    }
    expect(sampleMaskCoverageV2(mask, 5, 5)).toBe(1);
    expect(sampleMaskCoverageV2(mask, 15, 5)).toBe(0);
    expect(sampleMaskCoverageV2(mask, 5, 15)).toBe(0);
    const value = sampleMaskCoverageV2(data(2, 20, Uint8Array.from([0, 64, 128, 255])), 15, 15);
    expect(value).toBe(1);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1);
  });

  it('erodes the outside boundary while allowing a zero-radius centre check', () => {
    const size = 100;
    const coverage = new Uint8Array(size * size);
    for (let row = 30; row < 70; row += 1) {
      for (let col = 30; col < 70; col += 1) coverage[row * size + col] = 255;
    }
    const mask = data(size, 500, coverage);
    expect(isFootprintInsideMask(mask, 250, 250, 10, 0.9, 0.9)).toBe(true);
    expect(isFootprintInsideMask(mask, 155, 250, 10, 0.9, 0.9)).toBe(false);
    expect(isFootprintInsideMask(mask, 155, 250, 0, 0.9, 0.9)).toBe(true);
  });

  it('uses the same erosion check around a city-sized hole', () => {
    const size = 100;
    const coverage = new Uint8Array(size * size).fill(255);
    for (let row = 40; row < 60; row += 1) {
      for (let col = 40; col < 60; col += 1) coverage[row * size + col] = 0;
    }
    const mask = data(size, 500, coverage);
    expect(isFootprintInsideMask(mask, 250, 250, 10, 0.9, 0.9)).toBe(false);
    expect(isFootprintInsideMask(mask, 195, 250, 10, 0.9, 0.9)).toBe(false);
    expect(isFootprintInsideMask(mask, 150, 250, 10, 0.9, 0.9)).toBe(true);
  });

  it('loads through injected browser adapters', async () => {
    const image = { width: 2, height: 2 } as unknown as HTMLImageElement;
    await expect(loadForestMaskV2('mask', 3, 20, async () => image)).rejects.toThrow(/size mismatch/);

    const noContextCanvas = { getContext: () => null } as unknown as HTMLCanvasElement;
    await expect(loadForestMaskV2('mask', 2, 20, async () => image, () => noContextCanvas))
      .rejects.toThrow(/context/);

    const pixels = rgbaFor([1, 2, 3, 4]);
    const context = {
      drawImage: () => undefined,
      getImageData: () => ({ data: pixels }),
    };
    const canvas = { getContext: () => context } as unknown as HTMLCanvasElement;
    const loaded = await loadForestMaskV2('mask', 2, 20, async () => image, () => canvas);
    expect(loaded.coverage).toEqual(Uint8Array.from([1, 2, 3, 4]));
  });

  it('contains no prohibited randomness or v1 dependency', () => {
    // @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
    const root = process.cwd();
    const source = readFileSync(`${root}/src/forest/impostorV2/forestMaskV2.ts`, 'utf8');
    expect(source).not.toContain('Math.' + 'random');
    expect(source).not.toContain('forest' + 'Candidate');
    expect(source).not.toContain('forest/' + 'candidate');
  });
});
