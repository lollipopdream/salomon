// @ts-expect-error This project intentionally has no Node type dependency.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { SEED } from '../labConstants';
import { CLUSTER_ASSET_CONFIG } from '../cluster/clusterAssets';
import {
  parseImpostorAtlasMeta,
  selectImpostorCells,
} from '../../forest/impostorV2/impostorAtlasMeta';
import {
  BL_TREE_VARIANT_INDEX,
  buildClusterPlacement,
  type BuildClusterPlacementArgs,
} from '../cluster/clusterPlacement';
import {
  BROADLEAF_SCALE_MAX,
  BROADLEAF_SCALE_MIN,
  CONIFER_SCALE_MAX,
  CONIFER_SCALE_MIN,
} from '../cluster/clusterConstants';
import { MEMBER_KIND_TREE } from '../cluster/clusterTypes';
import { PATCH_MANIFEST_JSON } from '../scene/labDataSources';
import { createAppearanceModel } from './appearanceModel';
import { computeAppearanceScaleMetrics, computeMeanColorMultiplierSpan } from './appearanceMetrics';
import {
  R2_COLOR_ANCHORS,
  SHARED_FAMILY_PARAMETERS_BY_APPEARANCE,
} from './appearanceConstants';

// design §8 の不変条件 test は「cluster が 200 個以上できる十分に大きい bbox」で回す必要がある
// (小さすぎると I-12 / I-13 の統計的な主張が意味を持たない)。ここでは実際の PATCH A の
// world bbox をそのまま使い(3,000+ cluster)、mask は「常に forest」の単純な関数で置き換える
// (mask ロジック自体は appearance と無関係で、既存 clusterPlacement.test.ts と同じ簡略化)。
const worldBbox = PATCH_MANIFEST_JSON.patches[0].worldBbox;
const FLAT_TERRAIN_Y = 200;
const rawImpostorAtlasMeta = JSON.parse(readFileSync(
  new URL('../../../public/data/forest/impostor-v2/impostor-atlas-meta.json', import.meta.url),
  'utf8',
)) as unknown;
const productionCellWidths = selectImpostorCells(
  parseImpostorAtlasMeta(rawImpostorAtlasMeta),
  CLUSTER_ASSET_CONFIG.cellSelection,
  'both',
).map((cell) => cell.tightWorldWidth);

function buildArgs(overrides: Partial<BuildClusterPlacementArgs> = {}): BuildClusterPlacementArgs {
  return {
    worldBbox,
    seed: SEED,
    maskThreshold: 0.35,
    sampleCoverage: () => 1,
    terrainYAt: () => FLAT_TERRAIN_Y,
    groveCellSlot: (variantIndex, yawIndex) => variantIndex * 4 + yawIndex,
    treeCellSlot: (variantIndex, yawIndex) => 24 + variantIndex * 8 + yawIndex,
    cellWidthOf: (cellSlot) => productionCellWidths[cellSlot]!,
    ...overrides,
  };
}

const baselineImplicit = buildClusterPlacement(buildArgs());
const baselineExplicit = buildClusterPlacement(
  buildArgs({ appearance: createAppearanceModel('BASELINE', SEED) }),
);
const r1 = buildClusterPlacement(buildArgs({ appearance: createAppearanceModel('R1', SEED) }));
const r2 = buildClusterPlacement(buildArgs({ appearance: createAppearanceModel('R2', SEED) }));
const r3 = buildClusterPlacement(buildArgs({ appearance: createAppearanceModel('R3', SEED) }));
const r4 = buildClusterPlacement(buildArgs({ appearance: createAppearanceModel('R4', SEED) }));
const r5 = buildClusterPlacement(buildArgs({ appearance: createAppearanceModel('R5', SEED) }));

const BIT_EXACT_ARRAY_KEYS = [
  'memberCellSlot',
  'memberScale',
  'memberX',
  'memberY',
  'memberZ',
  'memberKind',
  'memberMirrored',
  'memberCluster',
] as const;

function expectBitExactArrays(
  actual: ClusterArrayHolder,
  expected: ClusterArrayHolder,
  keys: readonly (keyof ClusterArrayHolder)[],
): void {
  for (const key of keys) {
    const a = actual[key];
    const b = expected[key];
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i += 1) {
      if (!Object.is(a[i], b[i])) {
        expect(`${String(key)}[${i}]=${a[i]}`).toBe(`${String(key)}[${i}]=${b[i]}`);
      }
    }
  }
}

// 型ヘルパー: memberX / clusterX 等の TypedArray フィールドだけを許す。
type ClusterArrayHolder = Record<string, ArrayLike<number>>;

describe('appearance architecture-freeze invariants (design §4 / §8)', () => {
  it('I-3: omitting `appearance` matches an explicit BASELINE model bit-for-bit', () => {
    expectBitExactArrays(
      baselineImplicit as unknown as ClusterArrayHolder,
      baselineExplicit as unknown as ClusterArrayHolder,
      BIT_EXACT_ARRAY_KEYS,
    );
    expect(baselineImplicit.stats).toEqual(baselineExplicit.stats);
  });

  it('I-3: the first 32 memberCellSlot / memberScale values match the recorded BASELINE snapshot', () => {
    // 2026-09-13, node scratch dump of this exact worldBbox/seed/lambda setup
    // (BASELINE appearance, before any R1 change could have affected the hash mapping).
    const expectedMemberCellSlot32 = [
      2, 37, 1, 5, 23, 3, 3, 16, 18, 16, 37, 28, 39, 42, 46, 10,
      13, 28, 18, 23, 38, 20, 21, 28, 2, 21, 50, 21, 21, 37, 23, 51,
    ];
    const expectedMemberScale32 = [
      0.7574518322944641, 0.9877134561538696, 0.7634804844856262, 1.0184741020202637,
      1.0671666860580444, 0.939119815826416, 1.0684844255447388, 0.7857212424278259,
      0.7808727025985718, 1.064866065979004, 0.8620031476020813, 0.9634405970573425,
      0.8591998219490051, 0.8911837935447693, 1.1123238801956177, 0.8716227412223816,
      0.8072701096534729, 0.873073160648346, 0.9341495633125305, 0.7570140361785889,
      0.9737626314163208, 1.1066007614135742, 1.0375972986221313, 0.9928372502326965,
      0.9871166944503784, 0.9838566184043884, 2.6517562866210938, 0.9889405369758606,
      0.9635988473892212, 0.847422182559967, 0.8004745244979858, 2.5944268703460693,
    ];
    for (let i = 0; i < 32; i += 1) {
      expect(baselineExplicit.memberCellSlot[i]).toBe(expectedMemberCellSlot32[i]);
      expect(baselineExplicit.memberScale[i]).toBeCloseTo(expectedMemberScale32[i], 6);
    }
  });

  it('I-4: BASELINE and R1 share the frozen geometry fields bit-for-bit', () => {
    expect(r1.clusterCount).toBe(baselineExplicit.clusterCount);
    expect(r1.memberCount).toBe(baselineExplicit.memberCount);
    expectBitExactArrays(
      r1 as unknown as ClusterArrayHolder,
      baselineExplicit as unknown as ClusterArrayHolder,
      [
        'clusterX',
        'clusterY',
        'clusterZ',
        'clusterRadiusA',
        'clusterRadiusB',
        'clusterRotation',
        'clusterMemberStart',
        'memberX',
        'memberZ',
        'memberKind',
        'memberCluster',
        'memberMirrored',
      ],
    );
    // memberY は appearance 変更(scale 分布変更)の従属量であり、bit 一致を要求しない(design §4)。
  });

  it('I-4: BASELINE and R2 share the frozen geometry fields bit-for-bit', () => {
    expect(r2.clusterCount).toBe(baselineExplicit.clusterCount);
    expect(r2.memberCount).toBe(baselineExplicit.memberCount);
    expectBitExactArrays(r2 as unknown as ClusterArrayHolder, baselineExplicit as unknown as ClusterArrayHolder, [
      'clusterX', 'clusterY', 'clusterZ', 'clusterRadiusA', 'clusterRadiusB', 'clusterRotation',
      'clusterMemberStart', 'memberX', 'memberZ', 'memberKind', 'memberCluster', 'memberMirrored',
    ]);
  });

  it('I-5: BASELINE and R1 report the same grove / tree instance counts', () => {
    expect(r1.stats.groveInstanceCount).toBe(baselineExplicit.stats.groveInstanceCount);
    expect(r1.stats.treeInstanceCount).toBe(baselineExplicit.stats.treeInstanceCount);
  });

  it('I-5: BASELINE and R2 report the same grove / tree instance counts', () => {
    expect(r2.stats.groveInstanceCount).toBe(baselineExplicit.stats.groveInstanceCount);
    expect(r2.stats.treeInstanceCount).toBe(baselineExplicit.stats.treeInstanceCount);
  });

  it('R3 changes no placement or instance-count field relative to R2', () => {
    expect(r3.clusterCount).toBe(r2.clusterCount);
    expect(r3.memberCount).toBe(r2.memberCount);
    expectBitExactArrays(r3 as unknown as ClusterArrayHolder, r2 as unknown as ClusterArrayHolder, [
      'clusterX', 'clusterY', 'clusterZ', 'clusterRadiusA', 'clusterRadiusB', 'clusterRotation',
      'clusterMemberStart', 'memberX', 'memberZ', 'memberKind', 'memberCluster', 'memberMirrored',
    ]);
    expect(r3.stats.groveInstanceCount).toBe(r2.stats.groveInstanceCount);
    expect(r3.stats.treeInstanceCount).toBe(r2.stats.treeInstanceCount);
  });

  it('R4 changes no placement or instance-count field relative to R3 (only the bound texture differs)', () => {
    expect(r4.clusterCount).toBe(r3.clusterCount);
    expect(r4.memberCount).toBe(r3.memberCount);
    expectBitExactArrays(r4 as unknown as ClusterArrayHolder, r3 as unknown as ClusterArrayHolder, [
      'clusterX', 'clusterY', 'clusterZ', 'clusterRadiusA', 'clusterRadiusB', 'clusterRotation',
      'clusterMemberStart', 'memberX', 'memberZ', 'memberKind', 'memberCluster', 'memberMirrored',
    ]);
    expect(r4.stats.groveInstanceCount).toBe(r3.stats.groveInstanceCount);
    expect(r4.stats.treeInstanceCount).toBe(r3.stats.treeInstanceCount);
  });

  it(
    'R5 matches R3 placement bit-for-bit, including memberCellSlot and memberScale '
    + '(R4 reviewer #6 recovery)',
    () => {
      expect(r5.clusterCount).toBe(r3.clusterCount);
      expect(r5.memberCount).toBe(r3.memberCount);
      expectBitExactArrays(r5 as unknown as ClusterArrayHolder, r3 as unknown as ClusterArrayHolder, [
        'clusterX', 'clusterY', 'clusterZ', 'clusterRadiusA', 'clusterRadiusB', 'clusterRotation',
        'clusterMemberStart', 'memberX', 'memberZ', 'memberKind', 'memberCluster', 'memberMirrored',
        'memberCellSlot', 'memberScale',
      ]);
      expect(r5.stats.groveInstanceCount).toBe(r3.stats.groveInstanceCount);
      expect(r5.stats.treeInstanceCount).toBe(r3.stats.treeInstanceCount);
    },
  );

  it('I-12: every R1 member scale stays inside the safe envelope for its class', () => {
    // 204k 要素それぞれで expect() を呼ぶと(CPU 負荷次第で)テストタイムアウトに達するため、
    // 違反を先に集計してから 1 回だけ expect する(farCanopyLayer.test.ts の
    // expectArraysToBeEqual と同じ配慮)。
    let firstViolation = -1;
    for (let i = 0; i < r1.memberCount; i += 1) {
      const kind = r1.memberKind[i];
      const cellSlot = r1.memberCellSlot[i];
      const scale = r1.memberScale[i];
      const isBroadleafTree = kind === MEMBER_KIND_TREE &&
        Math.floor((cellSlot - 24) / 8) === BL_TREE_VARIANT_INDEX;
      const [min, max] = isBroadleafTree
        ? [BROADLEAF_SCALE_MIN, BROADLEAF_SCALE_MAX]
        : [CONIFER_SCALE_MIN, CONIFER_SCALE_MAX];
      if (scale < min || scale > max) {
        firstViolation = i;
        break;
      }
    }
    expect(firstViolation).toBe(-1);
  });

  it('I-12: exports the measured BASELINE/R1 footprint-width metrics', () => {
    const metrics = computeAppearanceScaleMetrics(baselineExplicit, r1);
    expect(metrics.baselineMeanSquareFootprintWidth)
      .toBe(baselineExplicit.stats.meanSquareFootprintWidth);
    expect(metrics.r1MeanSquareFootprintWidth).toBe(r1.stats.meanSquareFootprintWidth);
    expect(metrics.meanSquareFootprintWidthRatio).toBeCloseTo(
      metrics.r1MeanSquareFootprintWidth / metrics.baselineMeanSquareFootprintWidth,
      12,
    );
    expect(metrics.baselineMeanFootprintWidth).toBe(baselineExplicit.stats.meanFootprintWidth);
    expect(metrics.r1MeanFootprintWidth).toBe(r1.stats.meanFootprintWidth);
    expect(metrics.meanFootprintWidthRatio).toBeCloseTo(
      metrics.r1MeanFootprintWidth / metrics.baselineMeanFootprintWidth,
      12,
    );
  });

  it('I-12: R1 meanSquareFootprintWidth stays within ±3% of BASELINE (design §9 FIX-3)', () => {
    const metrics = computeAppearanceScaleMetrics(baselineExplicit, r1);
    // scale は cell 基準幅に対する倍率なので canopy 面積の proxy にならない。design §9 FIX-3 参照。
    // meanSquareScaleRatio は参考値として上の helper で計算するが、closure 判定には使わない。
    expect(Math.abs(metrics.meanSquareFootprintWidthRatio - 1)).toBeLessThanOrEqual(0.03);
  });

  it('I-12: R2 meanSquareFootprintWidth stays within ±3% of BASELINE', () => {
    const ratio = r2.stats.meanSquareFootprintWidth / baselineExplicit.stats.meanSquareFootprintWidth;
    expect(Math.abs(ratio - 1)).toBeLessThanOrEqual(0.03);
  });

  it('I-13: BASELINE meanColorLuminanceMultiplier is exactly 1.0 (no color response)', () => {
    expect(baselineExplicit.stats.meanColorLuminanceMultiplier).toBe(1);
  });

  it('I-13: R1 meanColorLuminanceMultiplier is 1.00 ± 0.05 (no global tint)', () => {
    expect(
      Math.abs(r1.stats.meanColorLuminanceMultiplier - 1),
    ).toBeLessThanOrEqual(0.05);
  });

  it('I-13: R2 meanColorLuminanceMultiplier is 1.00 ± 0.05 (no global tint)', () => {
    expect(Math.abs(r2.stats.meanColorLuminanceMultiplier - 1)).toBeLessThanOrEqual(0.05);
  });

  it('R2 anchors have exact unit equal-weight mean luminance', () => {
    const luminance = (anchor: typeof R2_COLOR_ANCHORS[number]) =>
      0.2126 * anchor.r + 0.7152 * anchor.g + 0.0722 * anchor.b;
    const average = R2_COLOR_ANCHORS.reduce((sum, anchor) => sum + luminance(anchor), 0)
      / R2_COLOR_ANCHORS.length;
    expect(average).toBeCloseTo(1, 6);
  });

  it('keeps R1/R2 selection and scale parameter objects identical by reference', () => {
    const r1Parameters = SHARED_FAMILY_PARAMETERS_BY_APPEARANCE.R1;
    const r2Parameters = SHARED_FAMILY_PARAMETERS_BY_APPEARANCE.R2;
    expect(r2Parameters.groveWeights).toBe(r1Parameters.groveWeights);
    expect(r2Parameters.treeWeights).toBe(r1Parameters.treeWeights);
    expect(r2Parameters.coniferScaleRange).toBe(r1Parameters.coniferScaleRange);
    expect(r2Parameters.broadleafScaleRange).toBe(r1Parameters.broadleafScaleRange);
    expect(r2Parameters.colorDampingGamma).toBe(r1Parameters.colorDampingGamma);
  });

  it('has a wider mean max-min color multiplier span in R2 than R1 (design §11.1 GAP-1)', () => {
    // design §11.1: R2 は luminance にだけ γ を掛け、chromaticity は raw のまま保つため、
    // R1(RGB 各成分に一律 γ)より彩度幅が広いはず。実測値は export された helper で取得できる。
    const r1Span = computeMeanColorMultiplierSpan(r1);
    const r2Span = computeMeanColorMultiplierSpan(r2);
    expect(r2Span).toBeGreaterThan(r1Span);
  });

  it('I-13: at least 50% of R1 members have a non-identity color multiplier', () => {
    let nonIdentityCount = 0;
    for (let i = 0; i < r1.memberCount; i += 1) {
      if (r1.memberColorR[i] !== 1 || r1.memberColorG[i] !== 1 || r1.memberColorB[i] !== 1) {
        nonIdentityCount += 1;
      }
    }
    expect(nonIdentityCount / r1.memberCount).toBeGreaterThanOrEqual(0.5);
  });

  it('I-13(R2): at least 50% of R2 members have a non-identity color multiplier', () => {
    let nonIdentityCount = 0;
    for (let i = 0; i < r2.memberCount; i += 1) {
      if (r2.memberColorR[i] !== 1 || r2.memberColorG[i] !== 1 || r2.memberColorB[i] !== 1) {
        nonIdentityCount += 1;
      }
    }
    expect(nonIdentityCount / r2.memberCount).toBeGreaterThanOrEqual(0.5);
  });

  it('records the realized family distribution (diagnostic, not a pass/fail gate)', () => {
    const [f0, f1, f2] = r1.stats.familyClusterCounts;
    const total = f0 + f1 + f2;
    expect(total).toBe(r1.clusterCount);
    expect(total).toBeGreaterThanOrEqual(200);
  });

  it('records a populated R2 family distribution', () => {
    const [f0, f1, f2] = r2.stats.familyClusterCounts;
    expect(f0 + f1 + f2).toBe(r2.clusterCount);
    expect(f0).toBeGreaterThan(0);
    expect(f1).toBeGreaterThan(0);
    expect(f2).toBeGreaterThan(0);
  });

  it('keeps the R2 family split within 0.03 absolute of R1 (design §11.2: macro 構成を動かさない)', () => {
    const r1Total = r1.stats.familyClusterCounts.reduce((sum, count) => sum + count, 0);
    const r2Total = r2.stats.familyClusterCounts.reduce((sum, count) => sum + count, 0);
    for (let familyIndex = 0; familyIndex < 3; familyIndex += 1) {
      const r1Fraction = r1.stats.familyClusterCounts[familyIndex] / r1Total;
      const r2Fraction = r2.stats.familyClusterCounts[familyIndex] / r2Total;
      expect(Math.abs(r2Fraction - r1Fraction)).toBeLessThanOrEqual(0.03);
    }
  });
});
