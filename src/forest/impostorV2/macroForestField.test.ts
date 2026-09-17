// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import type { ForestImpostorV2Config, ForestMaskV2Data } from './types';
import { buildMacroForestField, computeRidgeScore } from './macroForestField';

function makeConfig(): ForestImpostorV2Config {
  return {
    assets: { metaUrl: '', treeAtlasUrl: '', groveAtlasUrl: '' },
    mask: { url: '', extentMeters: 96, size: 1 },
    cellSelection: { grove: { configs: [], yawDegrees: [] }, tree: { variants: [], yawDegrees: [] } },
    macro: {
      seed: 20260913, cellMeters: 96, reliefRadiusMeters: 120, reliefReferenceMeters: 25,
      minCoverage: 0.35, minCoverageEdge: 0.15, slopeFullDeg: 40, slopeZeroDeg: 60,
      slopeStepMeters: 16, patchNoiseScaleCells: 3,
      patchThreshold: { near: 0.05, mid: 0.28, ridge: 0.45 }, ridgeScoreMin: 0.35,
    },
    corridor: {
      nearMeters: 150, farMeters: 600, ridgeMeters: 1800, routeClearanceMeters: 10,
      clearanceFootprintFactor: 0.6, exclusionCellMeters: 8, exclusionMaxMeters: 32,
      corridorCellMeters: 96, corridorMaxMeters: 1920, corridorRouteStride: 4,
    },
    grove: {
      spacingNearMeters: 16, spacingFarMeters: 30, spacingRidgeMeters: 44,
      patchSpacingBoost: 0.35, minSpacingRatio: 0.62, scaleMin: 0.85, scaleMax: 1.25,
      ridgeScalePenalty: 0.18, slopeScalePenalty: 0.25, sinkBaseMeters: 0.5,
      slopeSinkFactor: 0.55, dartAttemptsPerTarget: 8,
      speciesGroups: { conifer: [], mixed: [], broadleaf: [] }, speciesGroupSplit: { conifer: 0.45, mixed: 0.8 },
    },
    tree: {
      enabled: true, spacingMeters: 26, minSpacingRatio: 0.62, nearRouteMeters: 120,
      patchEdgeBand: 0.08, ridgeScoreMin: 0.5, groveClearanceMeters: 6, variantWeights: {},
      nearRouteBroadleafFraction: 0.5, scaleMin: 0.8, scaleMax: 1.15, slopeScalePenalty: 0.15,
      sinkBaseMeters: 0.3, slopeSinkFactor: 0.35, dartAttemptsPerTarget: 8,
    },
    material: { groveAlphaTest: 0.45, treeAlphaTest: 0.5, tintJitter: 0 },
    limits: { maxPrimitives: 1, maxGrovePrimitives: 1, maxTreePrimitives: 1 },
  };
}

function mask(extentMeters = 96, value = 255): ForestMaskV2Data {
  return { size: 1, extentMeters, coverage: new Uint8Array([value]) };
}

function field(options: {
  extentMeters?: number; coverage?: number; height?: (x: number, z: number) => number;
  distance?: number; config?: ForestImpostorV2Config; densityScale?: number;
} = {}) {
  const config = options.config ?? makeConfig();
  const extentMeters = options.extentMeters ?? config.mask.extentMeters;
  return buildMacroForestField({
    mask: mask(extentMeters, options.coverage ?? 255),
    sampleHeight: options.height ?? (() => 0),
    corridorDistance: () => options.distance ?? 100,
    config,
    densityScale: options.densityScale ?? 1,
  });
}

function oneCell(options: Parameters<typeof field>[0] = {}) {
  return field(options).cells[0];
}

describe('macro forest field', () => {
  it('scores convex, flat, concave terrain and normalizes by reference', () => {
    const cone = (x: number, z: number) => 100 - 0.1 * Math.hypot(x, z);
    const bowl = (x: number, z: number) => -100 + 0.1 * Math.hypot(x, z);
    const score = computeRidgeScore(cone, 0, 0, 120, 20);
    expect(score).toBeGreaterThan(0.5);
    expect(computeRidgeScore(() => 42, 0, 0, 120, 20)).toBeCloseTo(0, 12);
    expect(computeRidgeScore(bowl, 0, 0, 120, 20)).toBe(0);
    expect(computeRidgeScore(cone, 0, 0, 120, 40)).toBeCloseTo(score / 2, 12);
  });

  it('uses the prescribed row-major 62 by 62 grid', () => {
    const result = field({ extentMeters: 5940.950684 });
    expect(result.cols).toBe(62);
    expect(result.rows).toBe(62);
    expect(result.cells).toHaveLength(3844);
    for (const cell of result.cells) expect(cell.index).toBe(cell.cellZ * result.cols + cell.cellX);
  });

  it('keeps an empty mask entirely outside the field', () => {
    const result = field({ coverage: 0 });
    expect(result.cells.every((cell) => cell.band === 'none' && !cell.accepted)).toBe(true);
    expect(result.stats.acceptedCells).toBe(0);
  });

  it('applies the coverage threshold', () => {
    expect(oneCell({ coverage: 76 }).band).toBe('none');
    expect(oneCell({ coverage: 128 }).band).not.toBe('none');
  });

  it('maps slope to density and gates fully steep cells', () => {
    const slope = (degrees: number) => (x: number) => x * Math.tan(degrees * Math.PI / 180);
    expect(oneCell({ height: slope(65) }).slopeDensity).toBe(0);
    expect(oneCell({ height: slope(65) }).band).toBe('none');
    expect(oneCell().slopeDensity).toBe(1);
    expect(oneCell({ height: slope(50) }).slopeDensity).toBeCloseTo(0.5, 12);
  });

  it('assigns near, mid, ridge, and no band in distance order', () => {
    const ridge = (x: number, z: number) => 100 - 0.2 * Math.hypot(x - 48, z - 48);
    expect(oneCell({ distance: 100 }).band).toBe('near');
    expect(oneCell({ distance: 400 }).band).toBe('mid');
    expect(oneCell({ distance: 1000, height: ridge }).band).toBe('ridge');
    expect(oneCell({ distance: 1000 }).band).toBe('none');
    expect(oneCell({ distance: 2000, height: ridge }).band).toBe('none');
  });

  it('interpolates mid spacing and keeps near spacing below ridge spacing', () => {
    const config = makeConfig();
    config.grove.patchSpacingBoost = 0;
    const ridge = (x: number, z: number) => 100 - 0.2 * Math.hypot(x - 48, z - 48);
    const at = (distance: number, height?: (x: number, z: number) => number) => oneCell({ config, distance, height });
    const near = at(100);
    const mid200 = at(200);
    const mid400 = at(400);
    const far = at(600);
    const ridgeCell = at(1000, ridge);
    expect(mid200.spacingMeters).toBeLessThanOrEqual(mid400.spacingMeters);
    expect(mid400.spacingMeters).toBeLessThanOrEqual(far.spacingMeters);
    expect(near.spacingMeters).toBeLessThan(ridgeCell.spacingMeters);
    expect(at(150).spacingMeters).toBeCloseTo(config.grove.spacingNearMeters, 12);
    expect(far.spacingMeters).toBeCloseTo(config.grove.spacingFarMeters, 12);
  });

  it('scales spacing by inverse square root of density', () => {
    const baseline = oneCell();
    const doubled = oneCell({ densityScale: 2 });
    expect(Math.abs(doubled.spacingMeters / baseline.spacingMeters - 1 / Math.sqrt(2))).toBeLessThan(1e-6);
  });

  it('is completely deterministic for identical inputs', () => {
    const input = { extentMeters: 192, distance: 400 };
    const first = field(input);
    const second = field(input);
    expect(second).toEqual(first);
  });

  it('uses patch thresholds only for acceptance', () => {
    const blocked = makeConfig();
    blocked.macro.patchThreshold = { near: 1, mid: 1, ridge: 1 };
    const open = makeConfig();
    open.macro.patchThreshold = { near: 0, mid: 0, ridge: 0 };
    const denied = field({ extentMeters: 192, config: blocked });
    const allowed = field({ extentMeters: 192, config: open });
    expect(denied.cells.some((cell) => cell.band === 'near' && cell.patch <= 1 && !cell.accepted)).toBe(true);
    expect(allowed.stats.acceptedCells).toBeGreaterThan(denied.stats.acceptedCells);
  });

  it('keeps stats consistent with accepted cells', () => {
    const result = field({ extentMeters: 192, config: (() => {
      const config = makeConfig();
      config.macro.patchThreshold = { near: 0, mid: 0, ridge: 0 };
      return config;
    })() });
    const accepted = result.cells.filter((cell) => cell.accepted);
    const mean = accepted.reduce((sum, cell) => sum + cell.spacingMeters, 0) / accepted.length;
    expect(result.stats.nearCells + result.stats.midCells + result.stats.ridgeCells).toBe(result.stats.acceptedCells);
    expect(result.stats.meanSpacingMeters).toBeCloseTo(mean, 12);
  });

  it('has no prohibited dependency or identifier in its source', () => {
    // @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
    const root = process.cwd();
    const source = readFileSync(`${root}/src/forest/impostorV2/macroForestField.ts`, 'utf8');
    expect(source).not.toContain('Math.' + 'random');
    expect(source).not.toContain('forest' + 'Candidate');
    expect(source).not.toContain('forest/' + 'candidate');
    expect(source).not.toContain('th' + 'ree');
  });
});
