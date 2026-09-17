import { describe, expect, it } from 'vitest';

import { hashIndexTo01 } from '../forestRandom';
import {
  R10_CANOPY_TINT,
  computePlacementCanopyTints,
  normalizeTintPalette,
  selectCanopyTint,
  type CanopyTintEntry,
} from './r10CanopyTint';

const SEED = 20260913;

function makeGridPositions(sampleCount = 200, spacingMeters = 29.7): Float32Array {
  const positions = new Float32Array(sampleCount * sampleCount * 3);
  let offset = 0;
  for (let zIndex = 0; zIndex < sampleCount; zIndex += 1) {
    for (let xIndex = 0; xIndex < sampleCount; xIndex += 1) {
      positions[offset] = xIndex * spacingMeters;
      positions[offset + 1] = 0;
      positions[offset + 2] = zIndex * spacingMeters;
      offset += 3;
    }
  }
  return positions;
}

function makeLightCouplingFixture(): {
  positions: Float32Array;
  shades: Float32Array;
  count: number;
} {
  const count = 400;
  const positions = new Float32Array(count * 3);
  const shades = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    positions[offset] = (index % 20) * 29.7;
    positions[offset + 2] = Math.floor(index / 20) * 29.7;
    shades[index] = index < count / 2 ? 1.6 : 0.5;
  }
  return { positions, shades, count };
}

function meanTint(tints: Float32Array, start: number, end: number): [number, number, number] {
  const mean: [number, number, number] = [0, 0, 0];
  for (let index = start; index < end; index += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      mean[channel] += tints[index * 3 + channel] / (end - start);
    }
  }
  return mean;
}

describe('R10 canopy tint', () => {
  it('locks the R10 canopy tint configuration values', () => {
    expect(R10_CANOPY_TINT).toEqual({
      palette: normalizeTintPalette([
        { weight: 0.34, rgb: [0.86, 1.02, 1.02] },
        { weight: 0.34, rgb: [0.97, 1.03, 0.96] },
        { weight: 0.20, rgb: [1.10, 1.02, 0.83] },
        { weight: 0.08, rgb: [1.28, 1.00, 0.70] },
        { weight: 0.04, rgb: [1.42, 0.90, 0.62] },
      ]),
      fieldMeters: 260,
      jitter: 0.16,
      seedSalt: 0x27d4eb2f,
      lightBias: 0.55,
    });
  });

  it('normalizes every weighted channel mean to one without mutating the input', () => {
    const input: readonly CanopyTintEntry[] = [
      { weight: 0.25, rgb: [0.5, 1.5, 0.8] },
      { weight: 0.75, rgb: [1.5, 0.5, 1.2] },
    ];
    const before = input.map((entry) => ({ weight: entry.weight, rgb: [...entry.rgb] }));
    const normalized = normalizeTintPalette(input);

    expect(input).toEqual(before);
    expect(normalized).not.toBe(input);
    for (let channel = 0; channel < 3; channel += 1) {
      const mean = normalized.reduce(
        (sum, entry) => sum + entry.weight * entry.rgb[channel],
        0,
      );
      expect(mean).toBeCloseTo(1, 9);
    }
  });

  it('selects deterministically for identical world coordinates and jitter', () => {
    const first = selectCanopyTint(1234.5, 987.25, SEED, 0.314, R10_CANOPY_TINT);
    const second = selectCanopyTint(1234.5, 987.25, SEED, 0.314, R10_CANOPY_TINT);
    expect(second).toBe(first);
  });

  it('matches palette weights on the calibrated 0..5940 m grid', () => {
    const counts = new Uint32Array(R10_CANOPY_TINT.palette.length);
    const sampleCount = 200;
    const spacingMeters = 29.7;
    for (let zIndex = 0; zIndex < sampleCount; zIndex += 1) {
      for (let xIndex = 0; xIndex < sampleCount; xIndex += 1) {
        const tint = selectCanopyTint(
          xIndex * spacingMeters,
          zIndex * spacingMeters,
          SEED,
          0.5,
          R10_CANOPY_TINT,
        );
        const paletteIndex = R10_CANOPY_TINT.palette.findIndex((entry) => entry.rgb === tint);
        expect(paletteIndex).toBeGreaterThanOrEqual(0);
        counts[paletteIndex] += 1;
      }
    }

    const total = sampleCount * sampleCount;
    for (let index = 0; index < counts.length; index += 1) {
      const actual = counts[index] / total;
      const expected = R10_CANOPY_TINT.palette[index].weight;
      expect(actual).toBeGreaterThanOrEqual(expected * 0.75);
      expect(actual).toBeLessThanOrEqual(expected * 1.25);
    }
  });

  it('keeps coherent tint intervals across 96 m cell boundaries', () => {
    for (const startX of [90, 186]) {
      const tints = Array.from({ length: 13 }, (_, offset) => (
        selectCanopyTint(startX + offset, 173, SEED, 0.5, R10_CANOPY_TINT)
      ));
      expect(tints.some((tint, index) => index > 0 && tint === tints[index - 1])).toBe(true);
    }
  });

  it('returns finite positive tints and preserves the full-placement mean color', () => {
    const positions = makeGridPositions();
    const count = positions.length / 3;
    const tints = computePlacementCanopyTints(positions, count, SEED);
    expect(tints).toHaveLength(count * 3);
    expect(Array.from(tints).every((value) => Number.isFinite(value) && value > 0)).toBe(true);

    const means = [0, 0, 0];
    for (let index = 0; index < count; index += 1) {
      for (let channel = 0; channel < 3; channel += 1) {
        means[channel] += tints[index * 3 + channel] / count;
      }
    }
    for (const mean of means) expect(mean).toBeGreaterThanOrEqual(0.92);
    for (const mean of means) expect(mean).toBeLessThanOrEqual(1.08);
  });

  it('keeps the legacy result when shades are omitted or light bias is disabled', () => {
    const positions = makeGridPositions(20);
    const count = positions.length / 3;
    const shades = new Float32Array(count).fill(1.6);
    const withoutShades = computePlacementCanopyTints(positions, count, SEED);
    const withoutShadesAndZeroBias = computePlacementCanopyTints(
      positions,
      count,
      SEED,
      { ...R10_CANOPY_TINT, lightBias: 0 },
    );
    const withShadesAndZeroBias = computePlacementCanopyTints(
      positions,
      count,
      SEED,
      { ...R10_CANOPY_TINT, lightBias: 0 },
      shades,
    );

    const selectedDirectly = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const offset = index * 3;
      const tint = selectCanopyTint(
        positions[offset],
        positions[offset + 2],
        SEED,
        hashIndexTo01(index, SEED),
        R10_CANOPY_TINT,
      );
      selectedDirectly.set(tint, offset);
    }

    expect(withoutShades).toEqual(withoutShadesAndZeroBias);
    expect(withShadesAndZeroBias).toEqual(withoutShades);
    expect(withoutShades).toEqual(selectedDirectly);
  });

  it('makes the lit half clearly warmer than the shaded half', () => {
    const { positions, shades, count } = makeLightCouplingFixture();
    const tints = computePlacementCanopyTints(
      positions,
      count,
      SEED,
      R10_CANOPY_TINT,
      shades,
    );
    const litMean = meanTint(tints, 0, count / 2);
    const shadedMean = meanTint(tints, count / 2, count);
    const litRatio = litMean[0] / litMean[1];
    const shadedRatio = shadedMean[0] / shadedMean[1];

    expect(litRatio).toBeGreaterThan(shadedRatio * 1.05);
  });

  it('preserves the full-placement mean color with light coupling', () => {
    const { positions, shades, count } = makeLightCouplingFixture();
    const tints = computePlacementCanopyTints(
      positions,
      count,
      SEED,
      R10_CANOPY_TINT,
      shades,
    );
    const means = meanTint(tints, 0, count);

    for (const mean of means) expect(mean).toBeGreaterThanOrEqual(0.92);
    for (const mean of means) expect(mean).toBeLessThanOrEqual(1.08);
  });

  it('is deterministic with light-coupled shades', () => {
    const { positions, shades, count } = makeLightCouplingFixture();
    const first = computePlacementCanopyTints(
      positions,
      count,
      SEED,
      R10_CANOPY_TINT,
      shades,
    );
    const second = computePlacementCanopyTints(
      positions,
      count,
      SEED,
      R10_CANOPY_TINT,
      shades,
    );

    expect(second).toEqual(first);
  });
});
