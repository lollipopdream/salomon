import { describe, expect, it } from 'vitest';

import { createTerrainHeightSampler } from './terrainHeightSampler';
import {
  computePlacementMacroShade,
  computeRawMacroShade,
  DEFAULT_MACRO_SHADE_CONFIG,
  normalizeMacroShade,
  type MacroShadeConfig,
} from './macroShade';

function independentLabFormula(
  config: MacroShadeConfig,
  terrainYAt: (x: number, z: number) => number,
  x: number,
  z: number,
): number {
  const step = config.normalStepMeters;
  const dx = (terrainYAt(x + step, z) - terrainYAt(x - step, z)) / (2 * step);
  const dz = (terrainYAt(x, z + step) - terrainYAt(x, z - step)) / (2 * step);
  const length = Math.sqrt(dx * dx + 1 + dz * dz);
  const ndl = Math.max(0,
    (-dx / length) * config.sun.x + (1 / length) * config.sun.y + (-dz / length) * config.sun.z);
  let ringSum = 0;
  for (let index = 0; index < 8; index += 1) {
    const angle = index * 2 * Math.PI / 8;
    ringSum += terrainYAt(
      x + config.valleyRadiusMeters * Math.cos(angle),
      z + config.valleyRadiusMeters * Math.sin(angle),
    );
  }
  const rel = Math.min(1, Math.max(-1,
    (terrainYAt(x, z) - ringSum / 8) / config.reliefScaleMeters));
  return (config.ambient + config.direct * ndl) * (1 + config.valleyWeight * rel);
}

describe('production macro shade', () => {
  it('uses the adopted R10 parameters and normalized production light direction', () => {
    expect(DEFAULT_MACRO_SHADE_CONFIG).toMatchObject({
      enabled: false,
      ambient: 0.06,
      direct: 0.94,
      valleyWeight: 0.75,
      normalStepMeters: 50,
      valleyRadiusMeters: 260,
      reliefScaleMeters: 90,
      gain: 1.3,
      shadeMin: 0.19,
      shadeMax: 2.5,
    });
    const { sun } = DEFAULT_MACRO_SHADE_CONFIG;
    expect(Math.hypot(sun.x, sun.y, sun.z)).toBeCloseTo(1, 12);
    expect(sun.x).toBeCloseTo(-3600 / Math.hypot(-3600, 3200, -2400), 12);
    expect(sun.y).toBeCloseTo(3200 / Math.hypot(-3600, 3200, -2400), 12);
    expect(sun.z).toBeCloseTo(-2400 / Math.hypot(-3600, 3200, -2400), 12);
  });

  it('matches the lab formula independently on a synthetic height field', () => {
    const height = (x: number, z: number): number => 80 + x * 0.07 - z * 0.04
      + 16 * Math.sin(x / 170) * Math.cos(z / 210);
    for (const [x, z] of [[0, 0], [125, -340], [-510, 275]] as const) {
      expect(computeRawMacroShade(DEFAULT_MACRO_SHADE_CONFIG, height, x, z))
        .toBeCloseTo(independentLabFormula(DEFAULT_MACRO_SHADE_CONFIG, height, x, z), 12);
    }
  });

  it('is deterministic for identical complete placements', () => {
    const positions = new Float32Array([0, 1, 0, 120, 2, 90, 350, 3, -210]);
    const height = (x: number, z: number): number => x * 0.1 + z * z * 0.0004;
    const first = computePlacementMacroShade(DEFAULT_MACRO_SHADE_CONFIG, height, positions, 3);
    const second = computePlacementMacroShade(DEFAULT_MACRO_SHADE_CONFIG, height, positions, 3);
    expect(Array.from(second)).toEqual(Array.from(first));
  });

  it('normalizes once over the complete placement before gain and clamp', () => {
    const config = { ...DEFAULT_MACRO_SHADE_CONFIG, gain: 1, shadeMin: -100, shadeMax: 100 };
    const positions = new Float32Array([0, 0, 0, 100, 0, 50, 450, 0, 220, 900, 0, -400]);
    const height = (x: number, z: number): number => x * 0.13 - z * 0.08 + 30 * Math.sin(x / 230);
    const actual = computePlacementMacroShade(config, height, positions, 4);
    const completeRaw = Float32Array.from({ length: 4 }, (_, index) =>
      computeRawMacroShade(config, height, positions[index * 3], positions[index * 3 + 2]));
    expect(Array.from(actual)).toEqual(Array.from(normalizeMacroShade(completeRaw, config)));
    expect(Array.from(actual).reduce((sum, value) => sum + value, 0) / actual.length).toBeCloseTo(1, 6);
  });

  it('keeps every output finite for non-finite sampler results', () => {
    const positions = new Float32Array([0, 0, 0, 10, 0, 20, 30, 0, 40]);
    for (const sampleHeight of [() => Number.NaN, () => Number.POSITIVE_INFINITY]) {
      const shades = computePlacementMacroShade(DEFAULT_MACRO_SHADE_CONFIG, sampleHeight, positions, 3);
      for (const shade of shades) expect(Number.isFinite(shade)).toBe(true);
    }
    expect(Array.from(normalizeMacroShade(
      [Number.NaN, Number.POSITIVE_INFINITY],
      DEFAULT_MACRO_SHADE_CONFIG,
    ))).toEqual([1, 1]);
  });

  it('stays finite and clamped when macro samples cross a clamped DEM edge', () => {
    const sampleHeight = createTerrainHeightSampler({
      cols: 3,
      rows: 3,
      cellSizeMeters: 10,
      values: new Float32Array([0, 2, 5, 3, 7, 9, 8, 11, 15]),
    }, 1);
    const shades = computePlacementMacroShade(
      DEFAULT_MACRO_SHADE_CONFIG,
      sampleHeight,
      new Float32Array([0, 0, 0, 1, 0, 19, 20, 0, 20]),
      3,
    );
    for (const shade of shades) {
      expect(Number.isFinite(shade)).toBe(true);
      expect(shade).toBeGreaterThanOrEqual(DEFAULT_MACRO_SHADE_CONFIG.shadeMin);
      expect(shade).toBeLessThanOrEqual(DEFAULT_MACRO_SHADE_CONFIG.shadeMax);
    }
  });
});
