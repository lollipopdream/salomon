import { describe, expect, it } from 'vitest';

import { createSeededRandom, hashIndexTo01 } from './forestRandom';

describe('createSeededRandom', () => {
  it('returns the identical 1,000-value sequence for the same seed', () => {
    const first = createSeededRandom(123456789);
    const second = createSeededRandom(123456789);

    for (let index = 0; index < 1000; index += 1) {
      expect(first()).toBe(second());
    }
  });

  it('returns values in [0, 1)', () => {
    const random = createSeededRandom(987654321);

    for (let index = 0; index < 10000; index += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('has an average within 0.02 of 0.5 over 10,000 values', () => {
    const random = createSeededRandom(246813579);
    let sum = 0;

    for (let index = 0; index < 10000; index += 1) {
      sum += random();
    }

    expect(sum / 10000).toBeCloseTo(0.5, 2);
  });

  it('returns different first eight values for different seeds', () => {
    const first = createSeededRandom(1);
    const second = createSeededRandom(2);

    for (let index = 0; index < 8; index += 1) {
      expect(first()).not.toBe(second());
    }
  });

  it('preserves the golden sequence for seed 123456789', () => {
    const random = createSeededRandom(123456789);
    const values = Array.from({ length: 8 }, () => random());

    expect(values).toEqual([
      0.2577907438389957,
      0.9707721115555614,
      0.7853280142880976,
      0.20616457983851433,
      0.30307188746519387,
      0.7470660470426083,
      0.7787336520850658,
      0.2845096290111542,
    ]);
  });
});

describe('hashIndexTo01', () => {
  it('is deterministic, varies by index, and returns values in [0, 1)', () => {
    const first = hashIndexTo01(42, 98765);
    const repeated = hashIndexTo01(42, 98765);
    const differentIndex = hashIndexTo01(43, 98765);

    expect(first).toBe(repeated);
    expect(first).not.toBe(differentIndex);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(1);
    expect(differentIndex).toBeGreaterThanOrEqual(0);
    expect(differentIndex).toBeLessThan(1);
  });
});
