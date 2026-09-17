import { describe, expect, it } from 'vitest';

import {
  computeRawMacroShade,
  DEFAULT_MACRO_SHADE_CONFIG,
  normalizeMacroShade,
  type MacroShadeConfig,
} from './macroShade';

const FLAT_HEIGHT = 512;
const flatTerrain = (): number => FLAT_HEIGHT;

function slopeTerrain(k: number): (x: number, z: number) => number {
  return (x: number) => k * x;
}

describe('macroShade defaults', () => {
  it('normalizes the existing sun-direction contract, not a new one', () => {
    const { sun } = DEFAULT_MACRO_SHADE_CONFIG;
    const length = Math.sqrt(sun.x * sun.x + sun.y * sun.y + sun.z * sun.z);
    expect(length).toBeCloseTo(1, 9);
    expect(sun.x).toBeCloseTo(-0.6689, 3);
    expect(sun.y).toBeCloseTo(0.5946, 3);
    expect(sun.z).toBeCloseTo(-0.4459, 3);
  });

  it('defaults to disabled', () => {
    expect(DEFAULT_MACRO_SHADE_CONFIG.enabled).toBe(false);
  });
});

describe('computeRawMacroShade', () => {
  it('is deterministic for identical inputs', () => {
    const first = computeRawMacroShade(DEFAULT_MACRO_SHADE_CONFIG, slopeTerrain(0.3), 120, -40);
    const second = computeRawMacroShade(DEFAULT_MACRO_SHADE_CONFIG, slopeTerrain(0.3), 120, -40);
    expect(second).toBe(first);
  });

  it('yields a constant value on flat terrain', () => {
    const values: number[] = [];
    for (const [x, z] of [[0, 0], [500, -300], [-900, 1200], [123.45, -67.8]]) {
      values.push(computeRawMacroShade(DEFAULT_MACRO_SHADE_CONFIG, flatTerrain, x, z));
    }
    for (const value of values) expect(value).toBeCloseTo(values[0], 12);
  });

  it('is always finite and within the configured shade range after normalization', () => {
    const raw: number[] = [];
    for (let i = 0; i < 16; i += 1) {
      const value = computeRawMacroShade(
        DEFAULT_MACRO_SHADE_CONFIG,
        slopeTerrain(i % 2 === 0 ? 0.5 : -0.5),
        i * 37,
        -i * 51,
      );
      expect(Number.isFinite(value)).toBe(true);
      raw.push(value);
    }
    const normalized = normalizeMacroShade(raw, DEFAULT_MACRO_SHADE_CONFIG);
    for (const value of normalized) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(DEFAULT_MACRO_SHADE_CONFIG.shadeMin);
      expect(value).toBeLessThanOrEqual(DEFAULT_MACRO_SHADE_CONFIG.shadeMax);
    }
  });

  it('makes a sun-facing slope brighter than a slope facing away from the sun', () => {
    // Isolated to the direct/ndl term only (ambient 0, valleyWeight 0) so the
    // comparison is not contaminated by the valley/ridge relief term.
    const config: MacroShadeConfig = {
      ...DEFAULT_MACRO_SHADE_CONFIG,
      enabled: true,
      sun: { x: Math.SQRT1_2, y: Math.SQRT1_2, z: 0 },
      ambient: 0,
      direct: 1,
      valleyWeight: 0,
    };
    // h = -x faces toward +x (toward the sun's x component); h = +x faces away.
    const facingSun = computeRawMacroShade(config, slopeTerrain(-1), 0, 0);
    const facingAway = computeRawMacroShade(config, slopeTerrain(1), 0, 0);
    expect(facingSun).toBeGreaterThan(facingAway);
  });

  it('makes a valley darker than a ridge', () => {
    // Isolated to the relief/valley term only (direct 0) so ndl cannot interfere.
    const config: MacroShadeConfig = {
      ...DEFAULT_MACRO_SHADE_CONFIG,
      enabled: true,
      ambient: 1,
      direct: 0,
      valleyWeight: 0.5,
    };
    const valleyTerrain = (x: number, z: number): number => Math.sqrt(x * x + z * z);
    const ridgeTerrain = (x: number, z: number): number => -Math.sqrt(x * x + z * z);
    const valleyRaw = computeRawMacroShade(config, valleyTerrain, 0, 0);
    const ridgeRaw = computeRawMacroShade(config, ridgeTerrain, 0, 0);
    expect(valleyRaw).toBeLessThan(ridgeRaw);
  });

  it('never returns NaN even when terrainYAt returns NaN', () => {
    const nanTerrain = (): number => Number.NaN;
    const value = computeRawMacroShade(DEFAULT_MACRO_SHADE_CONFIG, nanTerrain, 10, 20);
    expect(Number.isFinite(value)).toBe(true);
    expect(Number.isNaN(value)).toBe(false);
  });

  it('never returns NaN when terrainYAt is NaN only at some sample points', () => {
    const partiallyNanTerrain = (x: number, z: number): number =>
      (x + z) % 200 === 0 ? Number.NaN : x * 0.1 - z * 0.2;
    const value = computeRawMacroShade(DEFAULT_MACRO_SHADE_CONFIG, partiallyNanTerrain, 200, 0);
    expect(Number.isFinite(value)).toBe(true);
  });
});

describe('normalizeMacroShade', () => {
  it('is deterministic for identical inputs', () => {
    const raw = new Float32Array([0.8, 1.0, 1.4, 0.6]);
    const first = normalizeMacroShade(raw, DEFAULT_MACRO_SHADE_CONFIG);
    const second = normalizeMacroShade(raw, DEFAULT_MACRO_SHADE_CONFIG);
    expect(Array.from(second)).toEqual(Array.from(first));
  });

  it('normalizes a constant input to exactly 1', () => {
    const raw = new Float32Array([0.73, 0.73, 0.73, 0.73]);
    const normalized = normalizeMacroShade(raw, DEFAULT_MACRO_SHADE_CONFIG);
    for (const value of normalized) expect(value).toBeCloseTo(1, 6);
  });

  it('keeps the patch-wide mean at 1 before clamping is applied', () => {
    const config: MacroShadeConfig = {
      ...DEFAULT_MACRO_SHADE_CONFIG,
      shadeMin: -Infinity,
      shadeMax: Infinity,
    };
    const raw = new Float32Array([0.5, 1.0, 1.5, 2.0]);
    const normalized = normalizeMacroShade(raw, config);
    const mean = Array.from(normalized).reduce((a, b) => a + b, 0) / normalized.length;
    expect(mean).toBeCloseTo(1, 6);
  });

  it('fails safe to all-1 when the mean is zero or non-finite', () => {
    const zeroMean = normalizeMacroShade([1, -1, 1, -1], DEFAULT_MACRO_SHADE_CONFIG);
    for (const value of zeroMean) expect(value).toBe(1);

    const nonFinite = normalizeMacroShade([Number.POSITIVE_INFINITY, 1], DEFAULT_MACRO_SHADE_CONFIG);
    for (const value of nonFinite) expect(value).toBe(1);
  });

  it('clamps to the configured shade range', () => {
    const config: MacroShadeConfig = {
      ...DEFAULT_MACRO_SHADE_CONFIG,
      shadeMin: 0.9,
      shadeMax: 1.1,
    };
    const raw = new Float32Array([0.1, 1.0, 10.0]);
    const normalized = normalizeMacroShade(raw, config);
    // Float32 storage of the clamp bounds can round a hair below/above the
    // float64 literal (e.g. Math.fround(0.9) < 0.9), so allow float32 epsilon.
    const epsilon = 1e-6;
    for (const value of normalized) {
      expect(value).toBeGreaterThanOrEqual(config.shadeMin - epsilon);
      expect(value).toBeLessThanOrEqual(config.shadeMax + epsilon);
    }
  });

  it('returns an empty array for empty input', () => {
    const normalized = normalizeMacroShade(new Float32Array(0), DEFAULT_MACRO_SHADE_CONFIG);
    expect(normalized.length).toBe(0);
  });

  describe('gain (post-normalization, pre-clamp)', () => {
    it('defaults to 1.0', () => {
      expect(DEFAULT_MACRO_SHADE_CONFIG.gain).toBe(1.0);
    });

    it('leaves output numerically unchanged when gain is 1.0', () => {
      const config: MacroShadeConfig = { ...DEFAULT_MACRO_SHADE_CONFIG, gain: 1.0 };
      const raw = new Float32Array([0.5, 0.8, 1.0, 1.2, 1.4]);
      const withDefaultGain = normalizeMacroShade(raw, DEFAULT_MACRO_SHADE_CONFIG);
      const withExplicitGainOne = normalizeMacroShade(raw, config);
      expect(Array.from(withExplicitGainOne)).toEqual(Array.from(withDefaultGain));
    });

    it('doubles the normalized output when gain is 2.0, outside the clamp range', () => {
      // shadeMin/shadeMax widened so the doubling is observable without clipping.
      const config: MacroShadeConfig = {
        ...DEFAULT_MACRO_SHADE_CONFIG,
        gain: 1,
        shadeMin: -100,
        shadeMax: 100,
      };
      const gainedConfig: MacroShadeConfig = { ...config, gain: 2 };
      const raw = new Float32Array([0.5, 0.8, 1.0, 1.2, 1.4]);
      const unity = normalizeMacroShade(raw, config);
      const doubled = normalizeMacroShade(raw, gainedConfig);
      for (let i = 0; i < unity.length; i += 1) {
        expect(doubled[i]).toBeCloseTo(unity[i] * 2, 5);
      }
    });

    it('never exceeds shadeMax even with a large gain', () => {
      const config: MacroShadeConfig = {
        ...DEFAULT_MACRO_SHADE_CONFIG,
        gain: 100,
        shadeMin: 0.55,
        shadeMax: 1.55,
      };
      const raw = new Float32Array([0.5, 0.8, 1.0, 1.2, 1.4]);
      const normalized = normalizeMacroShade(raw, config);
      for (const value of normalized) {
        expect(value).toBeLessThanOrEqual(config.shadeMax);
        expect(value).toBeGreaterThanOrEqual(config.shadeMin);
      }
    });

    it('fails safe to gain 1.0 when gain is non-finite', () => {
      const nanGainConfig: MacroShadeConfig = { ...DEFAULT_MACRO_SHADE_CONFIG, gain: Number.NaN };
      const infGainConfig: MacroShadeConfig = {
        ...DEFAULT_MACRO_SHADE_CONFIG,
        gain: Number.POSITIVE_INFINITY,
      };
      const unityGainConfig: MacroShadeConfig = { ...DEFAULT_MACRO_SHADE_CONFIG, gain: 1 };
      const raw = new Float32Array([0.5, 0.8, 1.0, 1.2, 1.4]);
      const withNanGain = normalizeMacroShade(raw, nanGainConfig);
      const withInfGain = normalizeMacroShade(raw, infGainConfig);
      const withUnityGain = normalizeMacroShade(raw, unityGainConfig);
      expect(Array.from(withNanGain)).toEqual(Array.from(withUnityGain));
      expect(Array.from(withInfGain)).toEqual(Array.from(withUnityGain));
      for (const value of [...withNanGain, ...withInfGain]) {
        expect(Number.isFinite(value)).toBe(true);
      }
    });
  });
});
