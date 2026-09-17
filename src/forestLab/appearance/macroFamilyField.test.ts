import { describe, expect, it } from 'vitest';

import {
  BRIGHT_BROADLEAF_THRESHOLD,
  DARK_CONIFER_THRESHOLD,
  R1_MACRO_FIELD_OCTAVES,
  R2_BRIGHT_BROADLEAF_THRESHOLD,
  R2_DARK_CONIFER_THRESHOLD,
  R2_MACRO_FIELD_OCTAVES,
} from './appearanceConstants';
import {
  sampleMacroField,
  sampleMacroFieldFull,
  sampleMacroFieldLow,
  selectionFamilyAt,
} from './macroFamilyField';

const SEED = 20260913;

describe('sampleMacroField (I-9)', () => {
  it('is deterministic for the same input', () => {
    const a = sampleMacroField(1234.5, 6789.25, SEED);
    const b = sampleMacroField(1234.5, 6789.25, SEED);
    expect(a).toBe(b);
  });

  it('is not a constant function across different coordinates', () => {
    const values = new Set<number>();
    for (let i = 0; i < 40; i += 1) {
      values.add(sampleMacroField(1000 + i * 53.7, 2000 + i * 91.3, SEED));
    }
    expect(values.size).toBeGreaterThan(1);
  });

  it('always returns a value within [0, 1]', () => {
    for (let i = 0; i < 200; i += 1) {
      const x = -5000 + i * 37.123;
      const z = 500 + i * 61.71;
      const value = sampleMacroField(x, z, SEED);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('depends on the seed', () => {
    const a = sampleMacroField(1234.5, 6789.25, SEED);
    const b = sampleMacroField(1234.5, 6789.25, SEED + 1);
    expect(a).not.toBe(b);
  });
});

describe('selectionFamilyAt', () => {
  it('classifies using the fixed thresholds 0.40 / 0.60', () => {
    for (let i = 0; i < 200; i += 1) {
      const x = -3000 + i * 41.7;
      const z = 1000 + i * 29.3;
      const field = sampleMacroField(x, z, SEED);
      const family = selectionFamilyAt(x, z, SEED);
      if (field < DARK_CONIFER_THRESHOLD) expect(family).toBe(0);
      else if (field < BRIGHT_BROADLEAF_THRESHOLD) expect(family).toBe(1);
      else expect(family).toBe(2);
    }
  });

  it('uses R2 fieldLow alone for R2 selection', () => {
    for (let i = 0; i < 200; i += 1) {
      const x = -3000 + i * 41.7;
      const z = 1000 + i * 29.3;
      const low = sampleMacroFieldLow(x, z, SEED);
      const family = selectionFamilyAt(x, z, SEED, 'R2');
      if (low < R2_DARK_CONIFER_THRESHOLD) expect(family).toBe(0);
      else if (low < R2_BRIGHT_BROADLEAF_THRESHOLD) expect(family).toBe(1);
      else expect(family).toBe(2);
    }
  });
});

describe('R2 macro fields', () => {
  it('are deterministic, bounded, and non-constant', () => {
    const lowValues = new Set<number>();
    const fullValues = new Set<number>();
    for (let i = 0; i < 200; i += 1) {
      const x = -5000 + i * 37.123;
      const z = 500 + i * 61.71;
      const low = sampleMacroFieldLow(x, z, SEED);
      const full = sampleMacroFieldFull(x, z, SEED, 'R2');
      expect(sampleMacroFieldLow(x, z, SEED)).toBe(low);
      expect(sampleMacroFieldFull(x, z, SEED, 'R2')).toBe(full);
      expect(low).toBeGreaterThanOrEqual(0);
      expect(low).toBeLessThanOrEqual(1);
      expect(full).toBeGreaterThanOrEqual(0);
      expect(full).toBeLessThanOrEqual(1);
      lowValues.add(low);
      fullValues.add(full);
    }
    expect(lowValues.size).toBeGreaterThan(1);
    expect(fullValues.size).toBeGreaterThan(1);
  });
});

describe('R2 fieldLow weight literals stay in sync with the constants (reviewer #5)', () => {
  it('sampleMacroFieldLow のリテラル重み 0.48 / 0.30 と正規化分母 0.78 が R2_MACRO_FIELD_OCTAVES と一致する', () => {
    // sampleMacroFieldLow は数値の bit 再現性を守るためリテラルを直書きしている
    // (定数から導出すると 0.48 + 0.30 の浮動小数和が 0.78 と 1 ulp ずれ、
    //  family 判定が閾値境界で反転して FAR texture の hash が変わりうるため)。
    // その代わりにリテラルと定数の一致をここで拘束し、silent drift を塞ぐ。
    expect(R2_MACRO_FIELD_OCTAVES[0].weight).toBe(0.48);
    expect(R2_MACRO_FIELD_OCTAVES[1].weight).toBe(0.30);
    expect(R2_MACRO_FIELD_OCTAVES[2].weight).toBe(0.22);
    const lowSum = R2_MACRO_FIELD_OCTAVES[0].weight + R2_MACRO_FIELD_OCTAVES[1].weight;
    expect(Math.abs(lowSum - 0.78)).toBeLessThan(1e-12);
    const total = R2_MACRO_FIELD_OCTAVES.reduce((sum, octave) => sum + octave.weight, 0);
    expect(Math.abs(total - 1)).toBeLessThan(1e-12);
  });

  it('R1 の octave 重みも合計 1.0 で、R2 とは別セットである', () => {
    const r1Total = R1_MACRO_FIELD_OCTAVES.reduce((sum, octave) => sum + octave.weight, 0);
    expect(Math.abs(r1Total - 1)).toBeLessThan(1e-12);
    expect(R1_MACRO_FIELD_OCTAVES[2].weight).not.toBe(R2_MACRO_FIELD_OCTAVES[2].weight);
    expect(R1_MACRO_FIELD_OCTAVES[2].wavelengthMeters)
      .not.toBe(R2_MACRO_FIELD_OCTAVES[2].wavelengthMeters);
  });
});
