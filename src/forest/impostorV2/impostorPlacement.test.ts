// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { isFootprintInsideMask } from './forestMaskV2';
import { createImpostorPlacement } from './impostorPlacement';
import type {
  ForestImpostorV2Config,
  ForestImpostorV2Flags,
  ForestMaskV2Data,
  ImpostorCellRef,
  ImpostorPlacementResult,
  MacroForestField,
} from './types';

function makeConfig(): ForestImpostorV2Config {
  return {
    assets: { metaUrl: '', treeAtlasUrl: '', groveAtlasUrl: '' },
    mask: { url: '', extentMeters: 256, size: 128 },
    cellSelection: {
      grove: { configs: ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'], yawDegrees: [0, 90, 180, 270] },
      tree: { variants: ['FIR_A', 'FIR_C', 'BL'], yawDegrees: [0, 90, 180, 270] },
    },
    macro: {
      seed: 20260913, cellMeters: 64, reliefRadiusMeters: 120, reliefReferenceMeters: 25,
      minCoverage: 0.35, minCoverageEdge: 0.15, slopeFullDeg: 40, slopeZeroDeg: 60,
      slopeStepMeters: 16, patchNoiseScaleCells: 3,
      patchThreshold: { near: 0.05, mid: 0.28, ridge: 0.45 }, ridgeScoreMin: 0.35,
    },
    corridor: {
      nearMeters: 150, farMeters: 600, ridgeMeters: 1800,
      routeClearanceMeters: 10, clearanceFootprintFactor: 0.6,
      exclusionCellMeters: 8, exclusionMaxMeters: 32,
      corridorCellMeters: 96, corridorMaxMeters: 1920, corridorRouteStride: 4,
    },
    grove: {
      spacingNearMeters: 16, spacingFarMeters: 30, spacingRidgeMeters: 44,
      patchSpacingBoost: 0.35, minSpacingRatio: 0.62,
      scaleMin: 0.85, scaleMax: 1.25, ridgeScalePenalty: 0.18, slopeScalePenalty: 0.25,
      sinkBaseMeters: 0.5, slopeSinkFactor: 0.55, dartAttemptsPerTarget: 8,
      speciesGroups: {
        conifer: ['G1', 'G3'], mixed: ['G2', 'G4', 'G6'], broadleaf: ['G5', 'G6'],
      },
      speciesGroupSplit: { conifer: 0.45, mixed: 0.80 },
    },
    tree: {
      enabled: true, spacingMeters: 26, minSpacingRatio: 0.62,
      nearRouteMeters: 120, patchEdgeBand: 0.08, ridgeScoreMin: 0.5,
      groveClearanceMeters: 6, variantWeights: { FIR_A: 0.40, FIR_C: 0.35, BL: 0.25 },
      nearRouteBroadleafFraction: 0.5, scaleMin: 0.80, scaleMax: 1.15,
      slopeScalePenalty: 0.15, sinkBaseMeters: 0.3, slopeSinkFactor: 0.35,
      dartAttemptsPerTarget: 8,
    },
    material: { groveAlphaTest: 0.45, treeAlphaTest: 0.50, tintJitter: 0 },
    limits: { maxPrimitives: 40000, maxGrovePrimitives: 30000, maxTreePrimitives: 14000 },
  };
}

function makeCells(): ImpostorCellRef[] {
  const yawDegrees = [0, 90, 180, 270];
  const cells: ImpostorCellRef[] = [];
  for (let configIndex = 0; configIndex < 6; configIndex += 1) {
    const groveConfig = `G${configIndex + 1}`;
    for (const yawDeg of yawDegrees) {
      cells.push({
        key: `grove:${groveConfig}:${yawDeg}`, kind: 'grove', atlas: 'grove',
        groveConfig, sourceVariant: null, yawDeg,
        uv: { u0: 0, v0: 0, u1: 1, v1: 1 },
        tightWorldWidth: 14.3 + configIndex * 1.5 + yawDeg / 900,
        tightWorldHeight: 14.2 + configIndex * 0.9 + yawDeg / 1000,
        groundPivotInTight: { u: 0.5, v: 0 }, alphaCoverage: 0.5,
      });
    }
  }
  for (const [variantIndex, sourceVariant] of ['FIR_A', 'FIR_C', 'BL'].entries()) {
    for (const yawDeg of yawDegrees) {
      cells.push({
        key: `tree:${sourceVariant}:${yawDeg}`, kind: 'tree', atlas: 'tree',
        groveConfig: null, sourceVariant, yawDeg,
        uv: { u0: 0, v0: 0, u1: 1, v1: 1 },
        tightWorldWidth: 3.5 + variantIndex + yawDeg / 1800,
        tightWorldHeight: 7 + variantIndex * 4 + yawDeg / 900,
        groundPivotInTight: { u: 0.5, v: 0 }, alphaCoverage: 0.5,
      });
    }
  }
  return cells;
}

function makeField(options: {
  cols?: number;
  rows?: number;
  accepted?: boolean;
  spacingMeters?: number;
  routeDistanceMeters?: number;
} = {}): MacroForestField {
  const cols = options.cols ?? 4;
  const rows = options.rows ?? 4;
  const accepted = options.accepted ?? true;
  const spacingMeters = options.spacingMeters ?? 22;
  const routeDistanceMeters = options.routeDistanceMeters ?? 80;
  const cells: MacroForestField['cells'][number][] = [];
  for (let cellZ = 0; cellZ < rows; cellZ += 1) {
    for (let cellX = 0; cellX < cols; cellX += 1) {
      const index = cellZ * cols + cellX;
      cells.push({
        cellX, cellZ, index, centerX: cellX * 64 + 32, centerZ: cellZ * 64 + 32,
        coverage: accepted ? 1 : 0, slopeRad: 0, slopeDensity: 1, ridgeScore: 0.2,
        routeDistanceMeters, patch: 0.5, band: accepted ? 'near' : 'none',
        spacingMeters, accepted,
      });
    }
  }
  return {
    cols, rows, cellMeters: 64, extentMeters: Math.max(cols, rows) * 64, cells,
    stats: {
      acceptedCells: accepted ? cells.length : 0,
      nearCells: accepted ? cells.length : 0, midCells: 0, ridgeCells: 0,
      meanSpacingMeters: accepted ? spacingMeters : 0,
    },
  };
}

function makeMask(extentMeters = 256, value = 255, size = 128): ForestMaskV2Data {
  return { size, extentMeters, coverage: new Uint8Array(size * size).fill(value) };
}

function paintMaskRect(
  mask: ForestMaskV2Data,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  value: number,
): void {
  const startCol = Math.floor(fromX / mask.extentMeters * mask.size);
  const startRow = Math.floor(fromZ / mask.extentMeters * mask.size);
  const endCol = Math.ceil(toX / mask.extentMeters * mask.size);
  const endRow = Math.ceil(toZ / mask.extentMeters * mask.size);
  for (let row = startRow; row < endRow; row += 1) {
    for (let col = startCol; col < endCol; col += 1) mask.coverage[row * mask.size + col] = value;
  }
}

const defaultFlags: ForestImpostorV2Flags = { enabled: true, densityScale: 1, kinds: 'both' };

function place(options: {
  config?: ForestImpostorV2Config;
  field?: MacroForestField;
  cells?: readonly ImpostorCellRef[];
  mask?: ForestMaskV2Data;
  height?: (x: number, z: number) => number;
  route?: (x: number, z: number) => number;
  flags?: ForestImpostorV2Flags;
} = {}): ImpostorPlacementResult {
  const config = options.config ?? makeConfig();
  const field = options.field ?? makeField();
  return createImpostorPlacement({
    field,
    cells: options.cells ?? makeCells(),
    mask: options.mask ?? makeMask(field.extentMeters),
    sampleHeight: options.height ?? (() => 0),
    routeExclusionDistance: options.route ?? (() => Number.POSITIVE_INFINITY),
    config,
    flags: options.flags ?? defaultFlags,
    now: () => 100,
  });
}

function xyz(result: ImpostorPlacementResult, index: number): [number, number, number] {
  return [result.positions[index * 3], result.positions[index * 3 + 1], result.positions[index * 3 + 2]];
}

function expectGeometryEqual(left: ImpostorPlacementResult, right: ImpostorPlacementResult): void {
  expect(right.count).toBe(left.count);
  expect(right.positions).toEqual(left.positions);
  expect(right.yawRadians).toEqual(left.yawRadians);
  expect(right.widthMeters).toEqual(left.widthMeters);
  expect(right.heightMeters).toEqual(left.heightMeters);
  expect(right.mirrored).toEqual(left.mirrored);
  expect(right.cellSlots).toEqual(left.cellSlots);
}

describe('impostor placement', () => {
  it('is deterministic and changes with the macro seed', () => {
    const first = place();
    const second = place();
    expectGeometryEqual(first, second);
    const changedConfig = makeConfig();
    changedConfig.macro.seed += 1;
    const changed = place({ config: changedConfig });
    expect(changed.positions).not.toEqual(first.positions);
  });

  it('keeps the r10Broad-off path deterministic and changes placement when r10Broad is enabled', () => {
    const field = makeField({ cols: 6, rows: 6 });
    const mask = makeMask(field.extentMeters);
    const offFirst = place({ field, mask, flags: { ...defaultFlags } });
    const offSecond = place({ field, mask, flags: { ...defaultFlags } });
    expectGeometryEqual(offFirst, offSecond);

    const broad = place({ field, mask, flags: { ...defaultFlags, r10Broad: true } });
    expect(broad.positions).not.toEqual(offFirst.positions);
  });

  it('rejects an empty mask and keeps every anchor footprint inside a partial mask', () => {
    expect(place({ mask: makeMask(256, 0) }).count).toBe(0);
    const mask = makeMask(256, 0);
    paintMaskRect(mask, 35, 35, 221, 221, 255);
    const result = place({ mask });
    expect(result.count).toBeGreaterThan(0);
    const config = makeConfig();
    for (let index = 0; index < result.count; index += 1) {
      const [x, , z] = xyz(result, index);
      expect(isFootprintInsideMask(
        mask, x, z, result.widthMeters[index] * 0.35,
        config.macro.minCoverage, config.macro.minCoverageEdge,
      )).toBe(true);
    }
  });

  it('places no primitive in a synthetic city hole', () => {
    const mask = makeMask();
    paintMaskRect(mask, 96, 96, 160, 160, 0);
    const result = place({ mask });
    expect(result.count).toBeGreaterThan(0);
    for (let index = 0; index < result.count; index += 1) {
      const [x, , z] = xyz(result, index);
      expect(x >= 96 && x < 160 && z >= 96 && z < 160).toBe(false);
    }
  });

  it('enforces the configured route base plus footprint clearance', () => {
    const config = makeConfig();
    const route = (x: number, z: number) => x < 128 ? 5 : 10 + x * 0.2 + z * 0.05;
    const result = place({ config, route });
    expect(config.corridor.routeClearanceMeters).toBe(10);
    expect(result.stats.rejectedByRoute).toBeGreaterThan(0);
    expect(result.count).toBeGreaterThan(0);
    for (let index = 0; index < result.count; index += 1) {
      const [x, , z] = xyz(result, index);
      expect(route(x, z)).toBeGreaterThanOrEqual(
        10 + result.widthMeters[index] / 2 * 0.6,
      );
    }
  });

  it('does not form repeated rows, columns, or a spacing-aligned grid', () => {
    const field = makeField({ cols: 6, rows: 6 });
    const result = place({
      field,
      mask: makeMask(field.extentMeters),
      flags: { ...defaultFlags, kinds: 'grove' },
    });
    expect(result.count).toBeGreaterThan(100);
    const xCounts = new Map<number, number>();
    const zCounts = new Map<number, number>();
    const bins = new Array<number>(10).fill(0);
    const spacing = 22;
    for (let index = 0; index < result.count; index += 1) {
      const [x, , z] = xyz(result, index);
      const roundedX = Math.round(x * 100);
      const roundedZ = Math.round(z * 100);
      xCounts.set(roundedX, (xCounts.get(roundedX) ?? 0) + 1);
      zCounts.set(roundedZ, (zCounts.get(roundedZ) ?? 0) + 1);
      const fraction = ((x % spacing) + spacing) % spacing / spacing;
      bins[Math.min(9, Math.floor(fraction * 10))] += 1;
    }
    expect(Math.max(...xCounts.values())).toBeLessThan(3);
    expect(Math.max(...zCounts.values())).toBeLessThan(3);
    expect(Math.max(...bins) / result.count).toBeLessThan(0.5);
  });

  it('keeps grove minimum spacing across adjacent accepted cells', () => {
    const field = makeField({ cols: 4, rows: 3, spacingMeters: 22 });
    const result = place({
      field,
      mask: makeMask(field.extentMeters),
      flags: { ...defaultFlags, kinds: 'grove' },
    });
    const minimum = 22 * makeConfig().grove.minSpacingRatio * 0.99;
    const occupiedCellXs = new Set<number>();
    for (let left = 0; left < result.count; left += 1) {
      const [leftX, , leftZ] = xyz(result, left);
      occupiedCellXs.add(Math.floor(leftX / field.cellMeters));
      for (let right = left + 1; right < result.count; right += 1) {
        const [rightX, , rightZ] = xyz(result, right);
        expect(Math.hypot(leftX - rightX, leftZ - rightZ)).toBeGreaterThanOrEqual(minimum);
      }
    }
    expect(occupiedCellXs.size).toBeGreaterThan(1);
  });

  it('keeps grove as the primary primitive kind with default values', () => {
    const result = place();
    expect(result.stats.groveCount).toBeGreaterThan(result.stats.treeCount);
  });

  it('honours grove-only and tree-only kind flags', () => {
    const grove = place({ flags: { ...defaultFlags, kinds: 'grove' } });
    const tree = place({ flags: { ...defaultFlags, kinds: 'tree' } });
    expect(grove.stats.treeCount).toBe(0);
    expect(grove.stats.groveCount).toBeGreaterThan(0);
    expect(tree.stats.groveCount).toBe(0);
    expect(tree.stats.treeCount).toBeGreaterThan(0);
  });

  it('varies scale, continuous yaw across quadrants, and mirroring', () => {
    const field = makeField({ cols: 6, rows: 6 });
    const result = place({ field, mask: makeMask(field.extentMeters) });
    expect(new Set(result.heightMeters).size / result.count).toBeGreaterThan(0.5);
    const quadrants = new Set<number>();
    for (const yaw of result.yawRadians) {
      expect(yaw).toBeGreaterThanOrEqual(0);
      expect(yaw).toBeLessThan(2 * Math.PI);
      quadrants.add(Math.floor(yaw / (Math.PI / 2)));
    }
    expect(quadrants).toEqual(new Set([0, 1, 2, 3]));
    const mirrorRatio = result.mirrored.reduce((sum, value) => sum + value, 0) / result.count;
    expect(mirrorRatio).toBeGreaterThanOrEqual(0.3);
    expect(mirrorRatio).toBeLessThanOrEqual(0.7);
  });

  it('deterministically thins to the total cap and reports no thinning below it', () => {
    const cappedFlags = { ...defaultFlags, maxPrimitivesOverride: 50 };
    const first = place({ flags: cappedFlags });
    const second = place({ flags: cappedFlags });
    expect(first.count).toBe(50);
    expect(first.stats.thinned).toBe(true);
    expect(first.stats.accepted).toBeGreaterThan(first.count);
    expectGeometryEqual(first, second);
    const uncapped = place({ flags: { ...defaultFlags, maxPrimitivesOverride: 10000 } });
    expect(uncapped.stats.thinned).toBe(false);
  });

  it('computes y from terrain height and a slope-dependent sink', () => {
    const field = makeField({ cols: 3, rows: 3 });
    const flatHeight = (_x: number, _z: number) => 20;
    const steepHeight = (x: number, _z: number) => 20 + x * 0.5;
    const flags = { ...defaultFlags, kinds: 'grove' as const };
    const flat = place({ field, mask: makeMask(field.extentMeters), height: flatHeight, flags });
    const steep = place({ field, mask: makeMask(field.extentMeters), height: steepHeight, flags });
    let flatSinkSum = 0;
    for (let index = 0; index < flat.count; index += 1) {
      const [x, y, z] = xyz(flat, index);
      const sink = flatHeight(x, z) - y;
      expect(sink).toBeCloseTo(makeConfig().grove.sinkBaseMeters, 4);
      flatSinkSum += sink;
    }
    let steepSinkSum = 0;
    for (let index = 0; index < steep.count; index += 1) {
      const [x, y, z] = xyz(steep, index);
      const sink = steepHeight(x, z) - y;
      const expected = makeConfig().grove.sinkBaseMeters
        + steep.widthMeters[index] * 0.5 * 0.5 * makeConfig().grove.slopeSinkFactor;
      expect(sink).toBeCloseTo(expected, 3);
      steepSinkSum += sink;
    }
    expect(steepSinkSum / steep.count).toBeGreaterThan(flatSinkSum / flat.count);
  });

  it('places nothing when every macro cell is rejected', () => {
    expect(place({ field: makeField({ accepted: false }) }).count).toBe(0);
  });

  it('keeps every tree outside grove clearance', () => {
    const cells = makeCells();
    const result = place({ cells });
    const grovePoints: [number, number][] = [];
    const treePoints: [number, number][] = [];
    for (let index = 0; index < result.count; index += 1) {
      const [x, , z] = xyz(result, index);
      const destination = cells[result.cellSlots[index]].kind === 'grove' ? grovePoints : treePoints;
      destination.push([x, z]);
    }
    expect(grovePoints.length).toBeGreaterThan(0);
    expect(treePoints.length).toBeGreaterThan(0);
    for (const [treeX, treeZ] of treePoints) {
      const nearest = Math.min(...grovePoints.map(([groveX, groveZ]) => (
        Math.hypot(treeX - groveX, treeZ - groveZ)
      )));
      expect(nearest).toBeGreaterThanOrEqual(makeConfig().tree.groveClearanceMeters * 0.999999);
    }
  });

  it('keeps counts, per-cell totals, and atlas slots consistent', () => {
    const cells = makeCells();
    const result = place({ cells, flags: { ...defaultFlags, maxPrimitivesOverride: 50 } });
    expect(result.stats.groveCount + result.stats.treeCount).toBe(result.count);
    expect(Object.values(result.stats.perCellCounts).reduce((sum, count) => sum + count, 0))
      .toBe(result.count);
    expect(result.stats.kept).toBe(result.count);
    for (const slot of result.cellSlots) {
      expect(slot).toBeGreaterThanOrEqual(0);
      expect(slot).toBeLessThan(cells.length);
    }
  });

  it('leaves grove/tree caps at production defaults when no r10dense override flags are set', () => {
    const field = makeField({ cols: 4, rows: 4 });
    const mask = makeMask(field.extentMeters);
    const config = makeConfig();
    config.limits.maxGrovePrimitives = 3;
    config.limits.maxTreePrimitives = 3;
    const result = place({ config, field, mask, flags: defaultFlags });
    expect(result.stats.groveCount).toBeLessThanOrEqual(3);
    expect(result.stats.treeCount).toBeLessThanOrEqual(3);
  });

  it('applies per-kind cap overrides only when the r10dense preview flags provide them', () => {
    const config = makeConfig();
    config.limits.maxGrovePrimitives = 5;
    config.limits.maxTreePrimitives = 5;
    const field = makeField({ cols: 6, rows: 6 });
    const mask = makeMask(field.extentMeters);
    const withoutOverride = place({ config, field, mask, flags: defaultFlags });
    expect(withoutOverride.stats.groveCount).toBeLessThanOrEqual(5);
    expect(withoutOverride.stats.treeCount).toBeLessThanOrEqual(5);

    const withOverride = place({
      config,
      field,
      mask,
      flags: {
        ...defaultFlags,
        maxGrovePrimitivesOverride: 5000,
        maxTreePrimitivesOverride: 5000,
        maxPrimitivesOverride: 20000,
      },
    });
    expect(withOverride.stats.groveCount).toBeGreaterThan(5);
    expect(withOverride.stats.treeCount).toBeGreaterThan(5);
    // production default config object そのものは override で変更されない。
    expect(config.limits.maxGrovePrimitives).toBe(5);
    expect(config.limits.maxTreePrimitives).toBe(5);
  });

  it('produces deterministic, in-mask, finite output at R10 parity-level density and cap overrides', () => {
    const field = makeField({ cols: 6, rows: 6 });
    const mask = makeMask(field.extentMeters);
    const denseFlags: ForestImpostorV2Flags = {
      ...defaultFlags,
      densityScale: 18.2,
      maxGrovePrimitivesOverride: 5000,
      maxTreePrimitivesOverride: 5000,
      maxPrimitivesOverride: 9000,
    };
    const first = place({ field, mask, flags: denseFlags });
    const second = place({ field, mask, flags: denseFlags });
    expectGeometryEqual(first, second);
    const sparse = place({ field, mask, flags: defaultFlags });
    expect(first.count).toBeGreaterThan(sparse.count);

    const config = makeConfig();
    for (let index = 0; index < first.count; index += 1) {
      const [x, y, z] = xyz(first, index);
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
      expect(Number.isFinite(z)).toBe(true);
      expect(Number.isFinite(first.yawRadians[index])).toBe(true);
      expect(Number.isFinite(first.widthMeters[index])).toBe(true);
      expect(Number.isFinite(first.heightMeters[index])).toBe(true);
      expect(isFootprintInsideMask(
        mask, x, z, first.widthMeters[index] * 0.35,
        config.macro.minCoverage, config.macro.minCoverageEdge,
      )).toBe(true);
    }
  });

  it('contains no prohibited source, identifier, path, or graphics import', () => {
    // @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
    const root = process.cwd();
    const source = readFileSync(`${root}/src/forest/impostorV2/impostorPlacement.ts`, 'utf8');
    expect(source).not.toContain('Math.' + 'random');
    expect(source).not.toContain('forest' + 'Candidate');
    expect(source).not.toContain('forest/' + 'candidate');
    expect(source).not.toContain("from '" + 'th' + "ree'");
  });
});
