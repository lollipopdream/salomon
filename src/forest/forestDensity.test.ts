import { describe, expect, it } from 'vitest';

import { forestDefaults } from '../config/defaults/forest';
import type { ForestPlacementConfig } from '../types';
import {
  computeCorridorFactor,
  computeDensityFactor,
  computeSizeFromUnit,
  computeSlopeFactor,
  smoothstep,
} from './forestDensity';

const config: ForestPlacementConfig = forestDefaults.placement;
const degreesToRadians = (degrees: number): number => (degrees * Math.PI) / 180;

describe('smoothstep', () => {
  it.each([
    [-1, 0],
    [0, 0],
    [0.5, 0.5],
    [1, 1],
    [2, 1],
  ])('clamps and interpolates at %s', (x, expected) => {
    expect(smoothstep(0, 1, x)).toBeCloseTo(expected);
  });
});

describe('computeCorridorFactor', () => {
  it('has the specified clearance, core, and feather boundary values', () => {
    const core = config.corridorCoreHalfWidthMeters;
    const feather = config.corridorFeatherMeters;

    expect(computeCorridorFactor(0, config)).toBe(0);
    expect(computeCorridorFactor(config.routeClearanceMeters, config)).toBeCloseTo(1);
    expect(computeCorridorFactor(core, config)).toBeCloseTo(1);
    expect(computeCorridorFactor(core + feather, config)).toBe(0);
    expect(computeCorridorFactor(core + feather + 1, config)).toBe(0);
  });

  it('keeps every sampled result in the unit interval', () => {
    for (let distance = -100; distance <= config.corridorCoreHalfWidthMeters + config.corridorFeatherMeters + 200; distance += 1) {
      const value = computeCorridorFactor(distance, config);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('is monotonically non-increasing across the feather', () => {
    const start = config.corridorCoreHalfWidthMeters;
    const end = start + config.corridorFeatherMeters;
    let previous = computeCorridorFactor(start, config);

    for (let distance = start + 1; distance <= end; distance += 1) {
      const current = computeCorridorFactor(distance, config);
      expect(current).toBeLessThanOrEqual(previous);
      previous = current;
    }
  });

  it('changes by less than 0.02 between adjacent 0.1-metre samples', () => {
    const end = config.corridorCoreHalfWidthMeters + config.corridorFeatherMeters + 200;
    let previous = computeCorridorFactor(0, config);
    let maximumAdjacentDifference = 0;

    for (let distance = 0.1; distance <= end; distance += 0.1) {
      const current = computeCorridorFactor(distance, config);
      maximumAdjacentDifference = Math.max(maximumAdjacentDifference, Math.abs(current - previous));
      previous = current;
    }

    expect(maximumAdjacentDifference).toBeLessThan(0.02);
  });

  it('is monotonically non-decreasing across the inner clearance ramp', () => {
    const clearance = config.routeClearanceMeters;
    let previous = computeCorridorFactor(0, config);

    expect(clearance).toBeLessThanOrEqual(config.corridorCoreHalfWidthMeters);
    expect(previous).toBe(0);

    for (let distance = 0.1; distance <= clearance; distance += 0.1) {
      const current = computeCorridorFactor(distance, config);
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }

    expect(computeCorridorFactor(clearance, config)).toBeCloseTo(1, 5);
  });

  it('changes by less than 0.01 between adjacent one-metre samples across the outer feather', () => {
    const core = config.corridorCoreHalfWidthMeters;
    const end = core + config.corridorFeatherMeters + 200;
    let previous = computeCorridorFactor(core, config);
    let maximumAdjacentDifference = 0;

    for (let distance = core + 1; distance <= end; distance += 1) {
      const current = computeCorridorFactor(distance, config);
      maximumAdjacentDifference = Math.max(maximumAdjacentDifference, Math.abs(current - previous));
      previous = current;
    }

    expect(maximumAdjacentDifference).toBeLessThan(0.01);
    expect(computeCorridorFactor(core + config.corridorFeatherMeters, config)).toBe(0);
    expect(computeCorridorFactor(end, config)).toBe(0);
  });
});

describe('computeSlopeFactor', () => {
  it('is full at or below the falloff and zero at or above the cutoff', () => {
    expect(computeSlopeFactor(degreesToRadians(config.slopeFalloffStartDeg), config)).toBe(1);
    expect(computeSlopeFactor(degreesToRadians(config.slopeZeroDeg), config)).toBe(0);
  });

  it('keeps every sampled result in the unit interval', () => {
    for (let degrees = 0; degrees <= 90; degrees += 0.1) {
      const value = computeSlopeFactor(degreesToRadians(degrees), config);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('changes by less than 0.02 between adjacent 0.1-degree samples', () => {
    let previous = computeSlopeFactor(0, config);
    let maximumAdjacentDifference = 0;

    for (let degrees = 0.1; degrees <= 90; degrees += 0.1) {
      const current = computeSlopeFactor(degreesToRadians(degrees), config);
      maximumAdjacentDifference = Math.max(maximumAdjacentDifference, Math.abs(current - previous));
      previous = current;
    }

    expect(maximumAdjacentDifference).toBeLessThan(0.02);
  });
});

describe('computeDensityFactor', () => {
  it('is the product of the corridor and slope factors', () => {
    const distance = config.corridorCoreHalfWidthMeters + config.corridorFeatherMeters / 2;
    const slope = degreesToRadians((config.slopeFalloffStartDeg + config.slopeZeroDeg) / 2);

    expect(computeDensityFactor(distance, slope, config)).toBeCloseTo(
      computeCorridorFactor(distance, config) * computeSlopeFactor(slope, config),
    );
  });
});

describe('computeSizeFromUnit', () => {
  it('maps the unit interval linearly to the requested size range', () => {
    expect(computeSizeFromUnit(0, 10, 30)).toBe(10);
    expect(computeSizeFromUnit(1, 10, 30)).toBe(30);
    expect(computeSizeFromUnit(0.5, 10, 30)).toBe(20);
  });
});
