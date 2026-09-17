// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { hashIndexTo01 } from '../forestRandom';
import { macroPatchField, macroValueNoise } from './macroNoise';

function averageAdjacentDifference(scaleCells: number): number {
  let total = 0;
  let count = 0;
  for (let z = 0; z < 32; z += 1) {
    for (let x = 0; x < 31; x += 1) {
      total += Math.abs(macroPatchField(x, z, 123, scaleCells) - macroPatchField(x + 1, z, 123, scaleCells));
      count += 1;
    }
  }
  return total / count;
}

describe('macro noise', () => {
  it('is exactly deterministic for both exported fields', () => {
    expect(macroValueNoise(1.25, -4.75, 42)).toBe(macroValueNoise(1.25, -4.75, 42));
    expect(macroPatchField(12, -8, 42, 16)).toBe(macroPatchField(12, -8, 42, 16));
  });

  it('stays in range over fractional coordinates', () => {
    for (let z = -16; z < 48; z += 1) {
      for (let x = -16; x < 48; x += 1) {
        for (const value of [macroValueNoise(x + 0.37, z + 0.61, 77), macroPatchField(x + 0.37, z + 0.61, 77, 12)]) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('changes with its seed on substantially all sampled positions', () => {
    let matches = 0;
    for (let index = 0; index < 1024; index += 1) {
      if (macroValueNoise(index * 0.137, index * -0.219, 10) === macroValueNoise(index * 0.137, index * -0.219, 11)) matches += 1;
    }
    expect(matches / 1024).toBeLessThan(0.01);
  });

  it('varies smoothly between neighbouring samples', () => {
    let smooth = 0;
    const total = 64 * 64;
    for (let z = 0; z < 64; z += 1) {
      for (let x = 0; x < 64; x += 1) {
        const difference = Math.abs(macroValueNoise(x * 0.31, z * 0.29, 987) - macroValueNoise(x * 0.31 + 0.05, z * 0.29, 987));
        if (difference < 0.2) smooth += 1;
      }
    }
    expect(smooth / total).toBeGreaterThanOrEqual(0.95);
  });

  it('equals its lattice value at integer coordinates', () => {
    for (const [x, z] of [[0, 0], [3, -7], [-11, 19]]) {
      const mixed = (Math.imul(x, 73856093) ^ Math.imul(z, 19349663)) >>> 0;
      expect(macroValueNoise(x, z, 222)).toBe(hashIndexTo01(mixed, 222));
    }
  });

  it('makes larger scale cells spatially broader', () => {
    expect(averageAdjacentDifference(32)).toBeLessThan(averageAdjacentDifference(4));
  });

  it('contains no prohibited random source or frozen-v1 term', () => {
    // @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
    const root = process.cwd();
    const source = readFileSync(`${root}/src/forest/impostorV2/macroNoise.ts`, 'utf8');
    expect(source).not.toContain('Math.' + 'random');
    expect(source).not.toContain('forest' + 'Candidate');
  });
});
