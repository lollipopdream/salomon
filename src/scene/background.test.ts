import { describe, expect, it } from 'vitest';

import { backgroundDefaults } from '../config/defaults/background';
import type { BackgroundFogConfig } from '../types';
import {
  computeBackgroundGradientCss,
  computeFogExp2Density,
  computeFogRange,
} from './background';

describe('computeBackgroundGradientCss', () => {
  it('returns the tuned daylight 3-stop default gradient', () => {
    const gradient = computeBackgroundGradientCss(backgroundDefaults);

    expect(gradient).toBe(
      'linear-gradient(to bottom, #7fa9d8 0%, #b9d2e8 55%, #dfe8ee 100%)',
    );
  });

  it('uses the provided gradientMidStopPercent when set', () => {
    const config: BackgroundFogConfig = {
      ...backgroundDefaults,
      gradientMidStopPercent: 30,
    };

    expect(computeBackgroundGradientCss(config)).toBe(
      'linear-gradient(to bottom, #7fa9d8 0%, #b9d2e8 30%, #dfe8ee 100%)',
    );
  });

  it('falls back to the existing 2-stop gradient when gradientMidColor is unset', () => {
    const config: BackgroundFogConfig = {
      gradientTopColor: '#0d1721',
      gradientBottomColor: '#46535c',
      fogColor: 0x46535c,
      fogNearFactor: 0.68,
      fogFarFactor: 1.75,
    };

    expect(computeBackgroundGradientCss(config)).toBe(
      'linear-gradient(to bottom, #0d1721 0%, #46535c 100%)',
    );
  });
});

describe('computeFogRange', () => {
  it('keeps the tuned default fog range ordered around the terrain diagonal', () => {
    const diagonal = 250 * Math.sqrt(2);
    const fogRange = computeFogRange(
      { cols: 10, rows: 10, cellSizeMeters: 25 },
      backgroundDefaults,
    );

    expect(fogRange.near).toBeCloseTo(diagonal * 0.55);
    expect(fogRange.far).toBeCloseTo(diagonal * 1.9);
    expect(fogRange.color).toBe(0xc3d6e4);
    expect(fogRange.near).toBeLessThan(fogRange.far);
    expect(fogRange.near).toBeGreaterThan(0);
  });
});

describe('computeFogExp2Density', () => {
  it('computes density as fogDensityFactor divided by the terrain diagonal', () => {
    const diagonal = 250 * Math.sqrt(2);
    const density = computeFogExp2Density(
      { cols: 10, rows: 10, cellSizeMeters: 25 },
      1,
    );

    expect(density).toBeCloseTo(1 / diagonal);
  });

  it('scales linearly with fogDensityFactor', () => {
    const grid = { cols: 10, rows: 10, cellSizeMeters: 25 };

    expect(computeFogExp2Density(grid, 2)).toBeCloseTo(
      2 * computeFogExp2Density(grid, 1),
    );
  });
});

// applyBackgroundAndFog is DOM/Three.js integration and is excluded from unit tests.
