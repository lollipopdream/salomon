import { describe, expect, it } from 'vitest';

import {
  EDGE_TAPER_WIDTH_METERS,
  MASK_EXTENT_METERS,
  MASK_SIZE,
  MASK_THRESHOLD,
} from '../labConstants';
import {
  buildMaskDistanceFieldTexels,
  MASK_TEXEL_METERS,
  sampleDistanceMeters,
  taperAt,
} from './maskDistanceField';

function texelCenter(index: number): number {
  return (index + 0.5) * MASK_EXTENT_METERS / MASK_SIZE;
}

function floatBits(values: Float32Array): Uint32Array {
  return new Uint32Array(values.buffer, values.byteOffset, values.length);
}

describe('mask distance field', () => {
  it('matches the analytic inward distance on cardinal radii of a circular mask', () => {
    const size = 65;
    const center = 32;
    const radius = 12;
    const coverage = new Uint8Array(size * size);
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (Math.hypot(col - center, row - center) < radius) {
          coverage[row * size + col] = 255;
        }
      }
    }
    const field = buildMaskDistanceFieldTexels(coverage, size, MASK_THRESHOLD);
    for (let offset = 0; offset < radius; offset += 1) {
      const expected = radius - offset;
      for (const index of [
        center * size + center + offset,
        center * size + center - offset,
        (center + offset) * size + center,
        (center - offset) * size + center,
      ]) {
        expect(Math.abs(field[index] - expected)).toBeLessThanOrEqual(1e-6);
      }
    }
  });

  it('returns exact distances for a one-dimensional half-plane', () => {
    const size = 11;
    const firstForestCol = 4;
    const coverage = new Uint8Array(size * size);
    for (let row = 0; row < size; row += 1) {
      for (let col = firstForestCol; col < size; col += 1) {
        coverage[row * size + col] = 255;
      }
    }
    const field = buildMaskDistanceFieldTexels(coverage, size, MASK_THRESHOLD);
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        expect(field[row * size + col]).toBe(col < firstForestCol ? 0 : col - firstForestCol + 1);
      }
    }
  });

  it('samples bilinearly in texel space, converts to meters, and returns zero outside', () => {
    const field = new Float32Array(MASK_SIZE * MASK_SIZE);
    const row = 200;
    const col = 100;
    field[row * MASK_SIZE + col] = 1;
    field[row * MASK_SIZE + col + 1] = 3;
    field[(row + 1) * MASK_SIZE + col] = 5;
    field[(row + 1) * MASK_SIZE + col + 1] = 7;
    const x = (col + 1) * MASK_EXTENT_METERS / MASK_SIZE;
    const z = (row + 1) * MASK_EXTENT_METERS / MASK_SIZE;
    expect(sampleDistanceMeters(field, MASK_SIZE, x, z)).toBe(4 * MASK_TEXEL_METERS);
    expect(sampleDistanceMeters(field, MASK_SIZE, 0, 0)).toBe(0);
  });

  it('maps D=0 to zero, reaches one at the fixed taper width, and is monotone', () => {
    const field = new Float32Array(MASK_SIZE * MASK_SIZE);
    const coordinate = texelCenter(400);
    let previous = -1;
    for (let step = 0; step <= 20; step += 1) {
      const distanceMeters = EDGE_TAPER_WIDTH_METERS * step / 20;
      field.fill(distanceMeters / MASK_TEXEL_METERS);
      const taper = taperAt(field, MASK_SIZE, coordinate, coordinate);
      expect(taper).toBeGreaterThanOrEqual(previous);
      previous = taper;
    }
    field.fill(0);
    expect(taperAt(field, MASK_SIZE, coordinate, coordinate)).toBe(0);
    field.fill(EDGE_TAPER_WIDTH_METERS / MASK_TEXEL_METERS);
    expect(taperAt(field, MASK_SIZE, coordinate, coordinate)).toBeCloseTo(1, 12);
    field.fill(2 * EDGE_TAPER_WIDTH_METERS / MASK_TEXEL_METERS);
    expect(taperAt(field, MASK_SIZE, coordinate, coordinate)).toBe(1);
  });

  it('is bit deterministic for identical input', () => {
    const size = 31;
    const coverage = new Uint8Array(size * size);
    for (let index = 0; index < coverage.length; index += 1) {
      coverage[index] = index % 7 === 0 ? 0 : 255;
    }
    const first = buildMaskDistanceFieldTexels(coverage, size, MASK_THRESHOLD);
    const second = buildMaskDistanceFieldTexels(coverage, size, MASK_THRESHOLD);
    expect(Array.from(floatBits(first))).toEqual(Array.from(floatBits(second)));
  });

  it('handles all-forest and all-non-forest masks', () => {
    const size = 7;
    const forest = buildMaskDistanceFieldTexels(
      new Uint8Array(size * size).fill(255),
      size,
      MASK_THRESHOLD,
    );
    const nonForest = buildMaskDistanceFieldTexels(
      new Uint8Array(size * size),
      size,
      MASK_THRESHOLD,
    );
    expect(Array.from(forest).every((distance) => distance === Number.POSITIVE_INFINITY)).toBe(true);
    expect(Array.from(nonForest).every((distance) => distance === 0)).toBe(true);
  });
});
