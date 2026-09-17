// @ts-expect-error This project intentionally has no Node type dependency.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import * as labConstants from '../labConstants';
import * as clusterConstants from './clusterConstants';

const impostorMeta = JSON.parse(readFileSync(
  new URL('../../../public/data/forest/impostor-v2/impostor-atlas-meta.json', import.meta.url),
  'utf8',
));
const groveTopMeta = JSON.parse(readFileSync(
  new URL('../../../public/data/forest/impostor-v2/grove_top_atlas_meta.json', import.meta.url),
  'utf8',
));

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function middle(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[index - 1] + sorted[index]) / 2 : sorted[index];
}

function independentlyRecalculate(): Record<string, number> {
  const configs = Object.entries(impostorMeta.grove_configs) as [string, { members: Array<{ variant: string; x: number; y: number; scale: number }> }][];
  const variants = impostorMeta.variants as Record<string, {
    class: string;
    crown_width_over_height: number;
    source_physical_height_m: number;
  }>;
  const topCells = groveTopMeta.cells as Array<{
    groveConfig: string;
    tightWorldWidth: number;
    tightWorldDepth: number;
    alphaCoverage: number;
    renderedWorldWidth: number;
    renderedWorldDepth: number;
  }>;
  const sideCells = impostorMeta.cells as Array<{ atlas: string; tight_world_width: number }>;
  const width = (member: { variant: string; scale: number }) => {
    const variant = variants[member.variant];
    return variant.crown_width_over_height * variant.source_physical_height_m * member.scale;
  };
  const members = configs.flatMap(([configName, config]) => config.members.map((member) => ({ configName, member })));
  const topWidths = topCells.map((cell) => cell.tightWorldWidth);
  const topDepths = topCells.map((cell) => cell.tightWorldDepth);
  const topCanopyAreas = topCells.map((cell) => cell.alphaCoverage * cell.renderedWorldWidth * cell.renderedWorldDepth);
  const memberWidths = members.map(({ member }) => width(member));
  const nearestDistances = configs.flatMap(([, config]) => config.members.map((member, memberIndex) => Math.min(
    ...config.members.filter((_, index) => index !== memberIndex).map((other) => Math.hypot(member.x - other.x, member.y - other.y)),
  )));
  const coniferScales = members.filter(({ member }) => variants[member.variant].class === 'conifer').map(({ member }) => member.scale);
  const broadleafScales = members.filter(({ member }) => variants[member.variant].class === 'broadleaf').map(({ member }) => member.scale);
  const crownFill = configs.map(([name, config]) => {
    const configCanopyAreas = topCells.filter((cell) => cell.groveConfig === name)
      .map((cell) => cell.alphaCoverage * cell.renderedWorldWidth * cell.renderedWorldDepth);
    const crownCircleArea = config.members.reduce((sum, member) => sum + Math.PI * (width(member) / 2) ** 2, 0);
    return middle(configCanopyAreas) / crownCircleArea;
  });
  const dominantFractions = configs.map(([, config]) => {
    const counts = config.members.reduce((map, member) => {
      map.set(member.variant, (map.get(member.variant) ?? 0) + 1);
      return map;
    }, new Map<string, number>());
    return Math.max(...counts.values()) / config.members.length;
  });
  const memberCounts = configs.map(([, config]) => config.members.length);
  const treeWidths = sideCells.filter((cell) => cell.atlas === 'tree').map((cell) => cell.tight_world_width);
  const groveWidths = sideCells.filter((cell) => cell.atlas === 'grove').map((cell) => cell.tight_world_width);

  const TARGET_CANOPY_CLOSURE = 0.95;
  const LAMBDA = -Math.log(1 - TARGET_CANOPY_CLOSURE);
  const GROVE_TOP_TIGHT_WIDTH_MEDIAN_M = middle(topWidths);
  const CLUSTER_FOOTPRINT_MIN_RATIO = Math.min(...topWidths) / GROVE_TOP_TIGHT_WIDTH_MEDIAN_M;
  const CLUSTER_FOOTPRINT_MAX_RATIO = Math.max(...topWidths) / GROVE_TOP_TIGHT_WIDTH_MEDIAN_M;
  const CLUSTER_ASPECT_MIN = Math.min(...topWidths.map((value, index) => value / topDepths[index]));
  const CLUSTER_ASPECT_MAX = Math.max(...topWidths.map((value, index) => value / topDepths[index]));
  const GROVE_TOP_CANOPY_AREA_MEDIAN_M2 = middle(topCanopyAreas);
  const MEAN_MEMBER_FOOTPRINT_W_M = average(memberWidths);
  const SIBLING_NN_MEAN_M = average(nearestDistances);
  const SIBLING_SPACING_RATIO = SIBLING_NN_MEAN_M / MEAN_MEMBER_FOOTPRINT_W_M;
  const CROWN_FILL_RATIO = average(crownFill);
  const CONIFER_SCALE_MIN = Math.min(...coniferScales);
  const CONIFER_SCALE_MAX = Math.max(...coniferScales);
  const CONIFER_SCALE_MEAN_SQUARE = average(coniferScales.map((scale) => scale ** 2));
  const BROADLEAF_SCALE_MIN = Math.min(...broadleafScales);
  const BROADLEAF_SCALE_MAX = Math.max(...broadleafScales);
  const BROADLEAF_SCALE_MEAN_SQUARE = average(broadleafScales.map((scale) => scale ** 2));
  const MEMBER_COUNT_MIN_RATIO = Math.min(...memberCounts) / average(memberCounts);
  const MEMBER_COUNT_MAX_RATIO = Math.max(...memberCounts) / average(memberCounts);
  const DOMINANT_FRACTION = average(dominantFractions);
  const GROVE_FRACTION = 7385 / 11811;
  const TREE_SIDE_TIGHT_WIDTH_MEDIAN_M = middle(treeWidths);
  const GROVE_SIDE_TIGHT_WIDTH_MEDIAN_M = middle(groveWidths);
  const SELF_SIMILAR_RATIO = GROVE_TOP_TIGHT_WIDTH_MEDIAN_M / MEAN_MEMBER_FOOTPRINT_W_M;
  const CLUSTER_FOOTPRINT_W_M = GROVE_TOP_TIGHT_WIDTH_MEDIAN_M * SELF_SIMILAR_RATIO;
  const CLUSTER_SPACING_M = SIBLING_SPACING_RATIO * CLUSTER_FOOTPRINT_W_M;
  const GROVE_MEMBER_CANOPY_AREA_M2 = GROVE_TOP_CANOPY_AREA_MEDIAN_M2 * CONIFER_SCALE_MEAN_SQUARE;
  const TREE_MEMBER_CANOPY_AREA_M2 = average(['FIR_A', 'FIR_B', 'FIR_C', 'BL'].map((name) => {
    const variant = variants[name];
    const scaleMeanSquare = variant.class === 'conifer' ? CONIFER_SCALE_MEAN_SQUARE : BROADLEAF_SCALE_MEAN_SQUARE;
    return Math.PI * (variant.crown_width_over_height * variant.source_physical_height_m / 2) ** 2
      * CROWN_FILL_RATIO * scaleMeanSquare;
  }));
  const MEAN_MEMBER_CANOPY_AREA_M2 = GROVE_FRACTION * GROVE_MEMBER_CANOPY_AREA_M2
    + (1 - GROVE_FRACTION) * TREE_MEMBER_CANOPY_AREA_M2;
  const MEMBER_COUNT_NOMINAL = Math.round(LAMBDA * CLUSTER_SPACING_M ** 2 / MEAN_MEMBER_CANOPY_AREA_M2);
  const MEMBER_COUNT_MIN = Math.max(1, Math.round(MEMBER_COUNT_NOMINAL * MEMBER_COUNT_MIN_RATIO));
  const MEMBER_COUNT_MAX = Math.round(MEMBER_COUNT_NOMINAL * MEMBER_COUNT_MAX_RATIO);
  const MIN_SCREEN_PIXELS = 2.0;
  const TREE_VISIBLE_MAX_DISTANCE_M = TREE_SIDE_TIGHT_WIDTH_MEDIAN_M * 1080
    / (2 * Math.tan(45 * Math.PI / 180 / 2) * MIN_SCREEN_PIXELS);
  const GROVE_VISIBLE_MAX_DISTANCE_M = GROVE_SIDE_TIGHT_WIDTH_MEDIAN_M * 1080
    / (2 * Math.tan(45 * Math.PI / 180 / 2) * MIN_SCREEN_PIXELS);
  const FAR_TEXTURE_SIZE = 2048;
  const FAR_PATCH_SIDE_M = 2236.5931289758273;
  const FAR_TEXEL_METERS = FAR_PATCH_SIDE_M / FAR_TEXTURE_SIZE;
  const FAR_STAMP_SPACING_M = Math.sqrt(GROVE_MEMBER_CANOPY_AREA_M2 / LAMBDA);
  const MEMBER_HASH_STRIDE = 8;
  const CLUSTER_HASH_STRIDE = 8 + MEMBER_COUNT_MAX * 8;
  const CLUSTER_AREA_FRACTION = Math.PI * (0.5 * CLUSTER_FOOTPRINT_W_M) ** 2 / CLUSTER_SPACING_M ** 2;
  const WITHIN_CLUSTER_LAMBDA = MEMBER_COUNT_NOMINAL * MEAN_MEMBER_CANOPY_AREA_M2
    / (Math.PI * (0.5 * CLUSTER_FOOTPRINT_W_M) ** 2);
  const EFFECTIVE_GLOBAL_CLOSURE = CLUSTER_AREA_FRACTION * (1 - Math.exp(-WITHIN_CLUSTER_LAMBDA));
  const ESTIMATED_CLUSTER_COUNT = Math.round(Math.ceil(FAR_PATCH_SIDE_M / CLUSTER_SPACING_M) ** 2 * 0.8650228504623233);
  const ESTIMATED_MEMBER_COUNT = ESTIMATED_CLUSTER_COUNT * MEMBER_COUNT_NOMINAL;
  const ESTIMATED_TRIANGLE_COUNT = ESTIMATED_MEMBER_COUNT * 4;
  return {
    TARGET_CANOPY_CLOSURE, LAMBDA,
    GROVE_TOP_TIGHT_WIDTH_MEDIAN_M, CLUSTER_FOOTPRINT_MIN_RATIO, CLUSTER_FOOTPRINT_MAX_RATIO,
    CLUSTER_ASPECT_MIN, CLUSTER_ASPECT_MAX, GROVE_TOP_CANOPY_AREA_MEDIAN_M2,
    MEAN_MEMBER_FOOTPRINT_W_M, SIBLING_NN_MEAN_M, SIBLING_SPACING_RATIO, CROWN_FILL_RATIO,
    CONIFER_SCALE_MIN, CONIFER_SCALE_MAX, CONIFER_SCALE_MEAN_SQUARE,
    BROADLEAF_SCALE_MIN, BROADLEAF_SCALE_MAX, BROADLEAF_SCALE_MEAN_SQUARE,
    MEMBER_COUNT_MIN_RATIO, MEMBER_COUNT_MAX_RATIO, DOMINANT_FRACTION, GROVE_FRACTION,
    TREE_SIDE_TIGHT_WIDTH_MEDIAN_M, GROVE_SIDE_TIGHT_WIDTH_MEDIAN_M,
    SELF_SIMILAR_RATIO, CLUSTER_FOOTPRINT_W_M, CLUSTER_SPACING_M,
    GROVE_MEMBER_CANOPY_AREA_M2, TREE_MEMBER_CANOPY_AREA_M2, MEAN_MEMBER_CANOPY_AREA_M2,
    MEMBER_COUNT_NOMINAL, MEMBER_COUNT_MIN, MEMBER_COUNT_MAX,
    MIN_SCREEN_PIXELS, TREE_VISIBLE_MAX_DISTANCE_M, GROVE_VISIBLE_MAX_DISTANCE_M,
    FAR_TEXTURE_SIZE, FAR_PATCH_SIDE_M, FAR_TEXEL_METERS, FAR_STAMP_SPACING_M,
    MEMBER_HASH_STRIDE, CLUSTER_HASH_STRIDE,
    CLUSTER_AREA_FRACTION, WITHIN_CLUSTER_LAMBDA, EFFECTIVE_GLOBAL_CLOSURE,
    ESTIMATED_CLUSTER_COUNT, ESTIMATED_MEMBER_COUNT, ESTIMATED_TRIANGLE_COUNT,
  };
}

describe('cluster constants', () => {
  it('independently reproduces every generated constant from the locked metadata', () => {
    const expected = independentlyRecalculate();
    expect(Object.keys(clusterConstants).sort()).toEqual(Object.keys(expected).sort());
    for (const [name, value] of Object.entries(expected)) {
      const actual = clusterConstants[name as keyof typeof clusterConstants];
      expect(Math.abs(actual - value), name).toBeLessThanOrEqual(1e-12 * Math.max(1, Math.abs(value)));
    }
  });

  it('keeps the explicitly locked constants exact', () => {
    expect(clusterConstants.LAMBDA).toBe(-Math.log(1 - 0.95));
    expect(clusterConstants.MIN_SCREEN_PIXELS).toBe(2);
    expect(clusterConstants.GROVE_FRACTION).toBe(labConstants.DETAIL_GROVE_FRACTION);
    expect(clusterConstants.FAR_PATCH_SIDE_M).toBe(2236.5931289758273);
  });

  it('exports only finite, positive constants', () => {
    for (const [name, value] of Object.entries(clusterConstants)) {
      expect(Number.isFinite(value), name).toBe(true);
      expect(value, name).toBeGreaterThan(0);
    }
  });
});
