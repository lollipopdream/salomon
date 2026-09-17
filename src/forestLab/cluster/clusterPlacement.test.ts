// @ts-expect-error This project intentionally has no Node type dependency.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { forestImpostorV2Defaults } from '../../config/defaults/forestImpostorV2';
import { hashIndexTo01 } from '../../forest/forestRandom';
import { MASK_THRESHOLD, SEED } from '../labConstants';
import { DEFAULT_COVERAGE_FILL_CONFIG, type CoverageFillConfig } from '../r10/coverageFill';
import { DEFAULT_MACRO_SHADE_CONFIG, type MacroShadeConfig } from '../r10/macroShade';
import { setR10Config } from '../r10/r10LabConfig';
import {
  BROADLEAF_SCALE_MAX,
  BROADLEAF_SCALE_MIN,
  CLUSTER_HASH_STRIDE,
  CLUSTER_SPACING_M,
  CONIFER_SCALE_MAX,
  CONIFER_SCALE_MIN,
  MEAN_MEMBER_CANOPY_AREA_M2,
  WITHIN_CLUSTER_LAMBDA,
} from './clusterConstants';
import {
  BL_TREE_VARIANT_INDEX,
  buildClusterPlacement,
  type BuildClusterPlacementArgs,
} from './clusterPlacement';
import { MEMBER_KIND_GROVE, MEMBER_KIND_TREE } from './clusterTypes';

const worldBbox = { xMin: 100, xMax: 500, zMin: 200, zMax: 600 };
const FLAT_TERRAIN_Y = 200;
const latticeCols = Math.ceil(
  (worldBbox.xMax - worldBbox.xMin) / CLUSTER_SPACING_M,
);
const candidateCenterKeys = new Set<string>();
let forestIslandCenterKey = '';

function coordinateKey(x: number, z: number): string {
  return `${x}:${z}`;
}

for (let j = -1; j <= latticeCols; j += 1) {
  for (let i = -1; i <= latticeCols; i += 1) {
    const n = (j + 1) * (latticeCols + 2) + (i + 1);
    const clusterBase = n * CLUSTER_HASH_STRIDE;
    const ccx = worldBbox.xMin + (
      i + 0.5 + (hashIndexTo01(clusterBase, SEED) - 0.5)
    ) * CLUSTER_SPACING_M;
    const ccz = worldBbox.zMin + (
      j + 0.5 + (hashIndexTo01(clusterBase + 1, SEED) - 0.5)
    ) * CLUSTER_SPACING_M;
    const key = coordinateKey(ccx, ccz);
    candidateCenterKeys.add(key);
    if (i === 3 && j === 6) forestIslandCenterKey = key;
  }
}

function sampleCoverage(x: number, z: number): number {
  if (x >= 100 && x <= 110 && z >= 200 && z <= 210) return 0;
  const key = coordinateKey(x, z);
  if (candidateCenterKeys.has(key)) return key === forestIslandCenterKey ? 1 : 0;
  return 1;
}

const baseArgs: BuildClusterPlacementArgs = {
  worldBbox,
  seed: SEED,
  maskThreshold: MASK_THRESHOLD,
  sampleCoverage,
  terrainYAt: () => FLAT_TERRAIN_Y,
  groveCellSlot: (variantIndex, yawIndex) => variantIndex * 4 + yawIndex,
  treeCellSlot: (variantIndex, yawIndex) => 24 + variantIndex * 8 + yawIndex,
  cellWidthOf: (cellSlot) => cellSlot < 24 ? 18 : 6,
};

const placement = buildClusterPlacement(baseArgs);

const typedArrayKeys = [
  'clusterX',
  'clusterY',
  'clusterZ',
  'clusterRadiusA',
  'clusterRadiusB',
  'clusterRotation',
  'clusterMemberStart',
  'memberX',
  'memberY',
  'memberZ',
  'memberScale',
  'memberMirrored',
  'memberKind',
  'memberCellSlot',
  'memberCluster',
] as const;

describe('cluster placement', () => {
  it('is element-by-element deterministic and depends on the seed', () => {
    const again = buildClusterPlacement(baseArgs);
    for (const key of typedArrayKeys) {
      const firstArray = placement[key];
      const secondArray = again[key];
      expect(firstArray.length).toBe(secondArray.length);
      for (let i = 0; i < firstArray.length; i += 1) {
        expect(firstArray[i]).toBe(secondArray[i]);
      }
    }
    expect(placement.stats).toEqual(again.stats);

    const changedSeed = buildClusterPlacement({ ...baseArgs, seed: SEED + 1 });
    let hasDifference = false;
    for (const key of typedArrayKeys) {
      const firstArray = placement[key];
      const changedArray = changedSeed[key];
      if (firstArray.length !== changedArray.length) {
        hasDifference = true;
        break;
      }
      for (let i = 0; i < firstArray.length; i += 1) {
        if (firstArray[i] !== changedArray[i]) {
          hasDifference = true;
          break;
        }
      }
      if (hasDifference) break;
    }
    expect(hasDifference).toBe(true);
  });

  it('keeps every member inside its cluster ellipse, bbox, and forest mask', () => {
    const { xMin, xMax, zMin, zMax } = worldBbox;
    for (let i = 0; i < placement.memberCount; i += 1) {
      const cluster = placement.memberCluster[i];
      const dx = placement.memberX[i] - placement.clusterX[cluster];
      const dz = placement.memberZ[i] - placement.clusterZ[cluster];
      const phi = placement.clusterRotation[cluster];
      const lx = dx * Math.cos(phi) + dz * Math.sin(phi);
      const lz = -dx * Math.sin(phi) + dz * Math.cos(phi);
      const ellipseDistance = (lx / placement.clusterRadiusA[cluster]) ** 2 +
        (lz / placement.clusterRadiusB[cluster]) ** 2;

      expect(ellipseDistance).toBeLessThanOrEqual(1 + 1e-6);
      expect(placement.memberX[i]).toBeGreaterThanOrEqual(xMin);
      expect(placement.memberX[i]).toBeLessThanOrEqual(xMax);
      expect(placement.memberZ[i]).toBeGreaterThanOrEqual(zMin);
      expect(placement.memberZ[i]).toBeLessThanOrEqual(zMax);
      expect(sampleCoverage(placement.memberX[i], placement.memberZ[i]))
        .toBeGreaterThanOrEqual(MASK_THRESHOLD);
    }
  });

  it('builds a valid cluster-to-member prefix sum', () => {
    expect(placement.clusterMemberStart.length).toBe(placement.clusterCount + 1);
    expect(placement.clusterMemberStart[0]).toBe(0);
    for (let c = 0; c < placement.clusterCount; c += 1) {
      expect(placement.clusterMemberStart[c + 1])
        .toBeGreaterThanOrEqual(placement.clusterMemberStart[c]);
    }
    expect(placement.clusterMemberStart[placement.clusterCount])
      .toBe(placement.memberCount);

    for (let i = 0; i < placement.memberCount; i += 1) {
      const cluster = placement.memberCluster[i];
      expect(placement.clusterMemberStart[cluster]).toBeLessThanOrEqual(i);
      expect(i).toBeLessThan(placement.clusterMemberStart[cluster + 1]);
    }
  });

  it('uses only baked yaw slots and the scale range for each member class', () => {
    let groveCount = 0;
    let treeCount = 0;
    let broadleafCount = 0;

    for (let i = 0; i < placement.memberCount; i += 1) {
      const kind = placement.memberKind[i];
      const cellSlot = placement.memberCellSlot[i];
      const scale = placement.memberScale[i];
      if (kind === MEMBER_KIND_GROVE) {
        const yawIndex = cellSlot % 4;
        expect(yawIndex).toBeGreaterThanOrEqual(0);
        expect(yawIndex).toBeLessThanOrEqual(3);
        expect(scale).toBeGreaterThanOrEqual(CONIFER_SCALE_MIN);
        expect(scale).toBeLessThanOrEqual(CONIFER_SCALE_MAX);
        groveCount += 1;
      } else {
        expect(kind).toBe(MEMBER_KIND_TREE);
        const treeSlot = cellSlot - 24;
        const variantIndex = Math.floor(treeSlot / 8);
        const yawIndex = treeSlot % 8;
        expect(yawIndex).toBeGreaterThanOrEqual(0);
        expect(yawIndex).toBeLessThanOrEqual(7);
        if (variantIndex === BL_TREE_VARIANT_INDEX) {
          expect(scale).toBeGreaterThanOrEqual(BROADLEAF_SCALE_MIN);
          expect(scale).toBeLessThanOrEqual(BROADLEAF_SCALE_MAX);
          broadleafCount += 1;
        } else {
          expect(scale).toBeGreaterThanOrEqual(CONIFER_SCALE_MIN);
          expect(scale).toBeLessThanOrEqual(CONIFER_SCALE_MAX);
        }
        treeCount += 1;
      }
    }

    expect(groveCount).toBeGreaterThan(0);
    expect(treeCount).toBeGreaterThan(0);
    expect(broadleafCount).toBeGreaterThan(0);
  });

  it('uses the kind-specific base sink on flat terrain', () => {
    const groveExpected = new Float32Array([
      FLAT_TERRAIN_Y - forestImpostorV2Defaults.grove.sinkBaseMeters,
    ])[0];
    const treeExpected = new Float32Array([
      FLAT_TERRAIN_Y - forestImpostorV2Defaults.tree.sinkBaseMeters,
    ])[0];

    for (let i = 0; i < placement.memberCount; i += 1) {
      if (placement.memberKind[i] === MEMBER_KIND_GROVE) {
        expect(placement.memberY[i]).toBeCloseTo(groveExpected, 9);
      } else {
        expect(placement.memberY[i]).toBeCloseTo(treeExpected, 9);
      }
    }
  });

  it('reports measured counts and an actual mask rejection', () => {
    const cols = Math.ceil((worldBbox.xMax - worldBbox.xMin) / CLUSTER_SPACING_M);
    expect(placement.stats.memberPlacedCount).toBe(placement.memberCount);
    expect(placement.stats.groveInstanceCount + placement.stats.treeInstanceCount)
      .toBe(placement.memberCount);
    expect(placement.stats.clusterAcceptedCount).toBe(placement.clusterCount);
    expect(placement.stats.clusterCandidateCount).toBe((cols + 2) ** 2);
    expect(placement.stats.clusterLatticeCols).toBe(cols);
    expect(
      placement.stats.memberRejectedByMaskCount > 0 ||
      placement.stats.clusterCandidateCount > placement.stats.clusterAcceptedCount,
    ).toBe(true);
  });

  it('matches the derived within-cluster density within ten percent', () => {
    let ellipseAreaSum = 0;
    for (let c = 0; c < placement.clusterCount; c += 1) {
      ellipseAreaSum += Math.PI *
        placement.clusterRadiusA[c] * placement.clusterRadiusB[c];
    }
    const measuredLambda = placement.memberCount *
      MEAN_MEMBER_CANOPY_AREA_M2 / ellipseAreaSum;
    const relativeError = Math.abs(measuredLambda - WITHIN_CLUSTER_LAMBDA) /
      WITHIN_CLUSTER_LAMBDA;
    expect(relativeError).toBeLessThanOrEqual(0.1);
  });

  it('does not create per-member objects through collection helpers', () => {
    const source = readFileSync(
      new URL('./clusterPlacement.ts', import.meta.url),
      'utf8',
    );
    expect(source.match(/push\(\{/g) ?? []).toHaveLength(0);
    expect(source.match(/\.map\(/g) ?? []).toHaveLength(0);
  });
});

describe('R10 macro shade (opt-in)', () => {
  const variedTerrainY = (x: number, z: number): number =>
    200 + 40 * Math.sin(x / 300) + 25 * Math.cos(z / 250);

  const macroShadeConfig: MacroShadeConfig = {
    ...DEFAULT_MACRO_SHADE_CONFIG,
    enabled: true,
  };

  // `baseArgs.sampleCoverage` intentionally rejects every cluster candidate except a single
  // "forest island" (so the baseline suite above can assert an actual mask rejection). That
  // collapses the placement to one cluster, which cannot demonstrate that different clusters
  // get different macro-shade multipliers. These R10 tests use full coverage instead so that
  // many clusters are accepted across the varied terrain.
  const fullCoverageArgs: BuildClusterPlacementArgs = {
    ...baseArgs,
    sampleCoverage: () => 1,
    terrainYAt: variedTerrainY,
  };

  it('leaves the placement result completely unchanged when macroShade is omitted or disabled', () => {
    const withoutField = buildClusterPlacement(baseArgs);
    const explicitlyUndefined = buildClusterPlacement({ ...baseArgs, macroShade: undefined });
    const explicitlyDisabled = buildClusterPlacement({
      ...baseArgs,
      macroShade: { ...macroShadeConfig, enabled: false },
    });

    for (const candidate of [withoutField, explicitlyUndefined, explicitlyDisabled]) {
      expect(candidate.memberCount).toBe(placement.memberCount);
      expect(candidate.clusterCount).toBe(placement.clusterCount);
      for (let i = 0; i < placement.memberCount; i += 1) {
        expect(candidate.memberColorR[i]).toBe(placement.memberColorR[i]);
        expect(candidate.memberColorG[i]).toBe(placement.memberColorG[i]);
        expect(candidate.memberColorB[i]).toBe(placement.memberColorB[i]);
      }
      expect(candidate.stats.meanColorLuminanceMultiplier)
        .toBe(placement.stats.meanColorLuminanceMultiplier);
    }
  });

  it('changes member colors while keeping instance/member/cluster counts unchanged', () => {
    const withMacroShade = buildClusterPlacement({
      ...fullCoverageArgs,
      macroShade: macroShadeConfig,
    });
    const withoutMacroShade = buildClusterPlacement(fullCoverageArgs);
    expect(withMacroShade.clusterCount).toBeGreaterThan(1);

    expect(withMacroShade.memberCount).toBe(withoutMacroShade.memberCount);
    expect(withMacroShade.clusterCount).toBe(withoutMacroShade.clusterCount);
    expect(withMacroShade.stats.memberPlacedCount)
      .toBe(withoutMacroShade.stats.memberPlacedCount);
    expect(withMacroShade.stats.groveInstanceCount)
      .toBe(withoutMacroShade.stats.groveInstanceCount);
    expect(withMacroShade.stats.treeInstanceCount)
      .toBe(withoutMacroShade.stats.treeInstanceCount);

    let hasColorDifference = false;
    for (let i = 0; i < withMacroShade.memberCount; i += 1) {
      if (
        withMacroShade.memberColorR[i] !== withoutMacroShade.memberColorR[i] ||
        withMacroShade.memberColorG[i] !== withoutMacroShade.memberColorG[i] ||
        withMacroShade.memberColorB[i] !== withoutMacroShade.memberColorB[i]
      ) {
        hasColorDifference = true;
        break;
      }
    }
    expect(hasColorDifference).toBe(true);
  });

  it('shares the same shade multiplier across all members of one cluster', () => {
    const withMacroShade = buildClusterPlacement({
      ...fullCoverageArgs,
      macroShade: macroShadeConfig,
    });
    const withoutMacroShade = buildClusterPlacement(fullCoverageArgs);
    expect(withMacroShade.clusterCount).toBeGreaterThan(1);

    const multiplierByCluster = new Map<number, number>();
    for (let i = 0; i < withMacroShade.memberCount; i += 1) {
      const baseline = withoutMacroShade.memberColorR[i];
      if (baseline === 0) continue;
      const multiplier = withMacroShade.memberColorR[i] / baseline;
      const cluster = withMacroShade.memberCluster[i];
      const seen = multiplierByCluster.get(cluster);
      if (seen === undefined) {
        multiplierByCluster.set(cluster, multiplier);
      } else {
        expect(multiplier).toBeCloseTo(seen, 5);
      }
    }
    expect(multiplierByCluster.size).toBeGreaterThan(0);
  });
});

describe('R10 coverage fill (opt-in)', { timeout: 20000 }, () => {
  const variedTerrainY = (x: number, z: number): number =>
    200 + 40 * Math.sin(x / 300) + 25 * Math.cos(z / 250);

  // Full mask coverage so gaps between existing cluster ellipses (which are
  // deliberately smaller than the lattice tile) are the only source of "holes"
  // -- exactly the scenario coverage fill targets.
  const fullCoverageArgs: BuildClusterPlacementArgs = {
    ...baseArgs,
    sampleCoverage: () => 1,
    terrainYAt: variedTerrainY,
  };

  const coverageFillConfig: CoverageFillConfig = {
    ...DEFAULT_COVERAGE_FILL_CONFIG,
    enabled: true,
  };

  const withoutCoverageFill = buildClusterPlacement(fullCoverageArgs);

  it('leaves the placement result completely unchanged when coverageFill is omitted or disabled', () => {
    const withoutField = buildClusterPlacement(fullCoverageArgs);
    const explicitlyUndefined = buildClusterPlacement({
      ...fullCoverageArgs,
      coverageFill: undefined,
    });
    const explicitlyDisabled = buildClusterPlacement({
      ...fullCoverageArgs,
      coverageFill: { ...coverageFillConfig, enabled: false },
    });

    for (const candidate of [withoutField, explicitlyUndefined, explicitlyDisabled]) {
      expect(candidate.memberCount).toBe(withoutCoverageFill.memberCount);
      expect(candidate.clusterCount).toBe(withoutCoverageFill.clusterCount);
      for (let i = 0; i < withoutCoverageFill.memberCount; i += 1) {
        expect(candidate.memberX[i]).toBe(withoutCoverageFill.memberX[i]);
        expect(candidate.memberY[i]).toBe(withoutCoverageFill.memberY[i]);
        expect(candidate.memberZ[i]).toBe(withoutCoverageFill.memberZ[i]);
        expect(candidate.memberColorR[i]).toBe(withoutCoverageFill.memberColorR[i]);
        expect(candidate.memberColorG[i]).toBe(withoutCoverageFill.memberColorG[i]);
        expect(candidate.memberColorB[i]).toBe(withoutCoverageFill.memberColorB[i]);
      }
    }
  });

  it('adds clusters/members without changing any existing member or cluster (add-only)', () => {
    const withCoverageFill = buildClusterPlacement({
      ...fullCoverageArgs,
      coverageFill: coverageFillConfig,
    });

    expect(withCoverageFill.memberCount).toBeGreaterThan(withoutCoverageFill.memberCount);
    expect(withCoverageFill.clusterCount).toBeGreaterThan(withoutCoverageFill.clusterCount);

    for (let i = 0; i < withoutCoverageFill.memberCount; i += 1) {
      expect(withCoverageFill.memberX[i]).toBe(withoutCoverageFill.memberX[i]);
      expect(withCoverageFill.memberY[i]).toBe(withoutCoverageFill.memberY[i]);
      expect(withCoverageFill.memberZ[i]).toBe(withoutCoverageFill.memberZ[i]);
      expect(withCoverageFill.memberScale[i]).toBe(withoutCoverageFill.memberScale[i]);
      expect(withCoverageFill.memberMirrored[i]).toBe(withoutCoverageFill.memberMirrored[i]);
      expect(withCoverageFill.memberKind[i]).toBe(withoutCoverageFill.memberKind[i]);
      expect(withCoverageFill.memberCellSlot[i]).toBe(withoutCoverageFill.memberCellSlot[i]);
      expect(withCoverageFill.memberCluster[i]).toBe(withoutCoverageFill.memberCluster[i]);
      expect(withCoverageFill.memberFamily[i]).toBe(withoutCoverageFill.memberFamily[i]);
      expect(withCoverageFill.memberColorR[i]).toBe(withoutCoverageFill.memberColorR[i]);
      expect(withCoverageFill.memberColorG[i]).toBe(withoutCoverageFill.memberColorG[i]);
      expect(withCoverageFill.memberColorB[i]).toBe(withoutCoverageFill.memberColorB[i]);
    }
    for (let c = 0; c < withoutCoverageFill.clusterCount; c += 1) {
      expect(withCoverageFill.clusterX[c]).toBe(withoutCoverageFill.clusterX[c]);
      expect(withCoverageFill.clusterY[c]).toBe(withoutCoverageFill.clusterY[c]);
      expect(withCoverageFill.clusterZ[c]).toBe(withoutCoverageFill.clusterZ[c]);
      expect(withCoverageFill.clusterRadiusA[c]).toBe(withoutCoverageFill.clusterRadiusA[c]);
      expect(withCoverageFill.clusterRadiusB[c]).toBe(withoutCoverageFill.clusterRadiusB[c]);
      expect(withCoverageFill.clusterRotation[c]).toBe(withoutCoverageFill.clusterRotation[c]);
    }
  });

  it('places every added member at a position that satisfies the mask threshold', () => {
    const withCoverageFill = buildClusterPlacement({
      ...fullCoverageArgs,
      coverageFill: coverageFillConfig,
    });
    expect(withCoverageFill.memberCount).toBeGreaterThan(withoutCoverageFill.memberCount);
    for (let i = withoutCoverageFill.memberCount; i < withCoverageFill.memberCount; i += 1) {
      expect(fullCoverageArgs.sampleCoverage(withCoverageFill.memberX[i], withCoverageFill.memberZ[i]))
        .toBeGreaterThanOrEqual(MASK_THRESHOLD);
    }
  });

  it('is deterministic across repeated runs', () => {
    const first = buildClusterPlacement({ ...fullCoverageArgs, coverageFill: coverageFillConfig });
    const second = buildClusterPlacement({ ...fullCoverageArgs, coverageFill: coverageFillConfig });
    expect(first.memberCount).toBe(second.memberCount);
    expect(first.clusterCount).toBe(second.clusterCount);
    for (let i = 0; i < first.memberCount; i += 1) {
      expect(first.memberX[i]).toBe(second.memberX[i]);
      expect(first.memberY[i]).toBe(second.memberY[i]);
      expect(first.memberZ[i]).toBe(second.memberZ[i]);
      expect(first.memberColorR[i]).toBe(second.memberColorR[i]);
      expect(first.memberCellSlot[i]).toBe(second.memberCellSlot[i]);
    }
    expect(first.stats).toEqual(second.stats);
  });

  it('produces no NaN or non-finite transforms for cluster or member arrays', () => {
    const withCoverageFill = buildClusterPlacement({
      ...fullCoverageArgs,
      coverageFill: coverageFillConfig,
    });
    for (let i = 0; i < withCoverageFill.memberCount; i += 1) {
      expect(Number.isFinite(withCoverageFill.memberX[i])).toBe(true);
      expect(Number.isFinite(withCoverageFill.memberY[i])).toBe(true);
      expect(Number.isFinite(withCoverageFill.memberZ[i])).toBe(true);
      expect(Number.isFinite(withCoverageFill.memberScale[i])).toBe(true);
      expect(Number.isFinite(withCoverageFill.memberColorR[i])).toBe(true);
      expect(Number.isFinite(withCoverageFill.memberColorG[i])).toBe(true);
      expect(Number.isFinite(withCoverageFill.memberColorB[i])).toBe(true);
    }
    for (let c = 0; c < withCoverageFill.clusterCount; c += 1) {
      expect(Number.isFinite(withCoverageFill.clusterX[c])).toBe(true);
      expect(Number.isFinite(withCoverageFill.clusterY[c])).toBe(true);
      expect(Number.isFinite(withCoverageFill.clusterZ[c])).toBe(true);
      expect(Number.isFinite(withCoverageFill.clusterRadiusA[c])).toBe(true);
      expect(Number.isFinite(withCoverageFill.clusterRadiusB[c])).toBe(true);
      expect(Number.isFinite(withCoverageFill.clusterRotation[c])).toBe(true);
    }
  });

  it('applies the macro shade multiplier to added clusters as well as existing ones', () => {
    const macroShadeConfig: MacroShadeConfig = { ...DEFAULT_MACRO_SHADE_CONFIG, enabled: true };
    const withBoth = buildClusterPlacement({
      ...fullCoverageArgs,
      coverageFill: coverageFillConfig,
      macroShade: macroShadeConfig,
    });
    const withCoverageFillOnly = buildClusterPlacement({
      ...fullCoverageArgs,
      coverageFill: coverageFillConfig,
    });
    expect(withBoth.clusterCount).toBe(withCoverageFillOnly.clusterCount);
    expect(withBoth.memberCount).toBe(withCoverageFillOnly.memberCount);
    expect(withBoth.clusterCount).toBeGreaterThan(withoutCoverageFill.clusterCount);

    let hasDifferenceInAddedMembers = false;
    for (let i = withoutCoverageFill.memberCount; i < withBoth.memberCount; i += 1) {
      if (
        withBoth.memberColorR[i] !== withCoverageFillOnly.memberColorR[i] ||
        withBoth.memberColorG[i] !== withCoverageFillOnly.memberColorG[i] ||
        withBoth.memberColorB[i] !== withCoverageFillOnly.memberColorB[i]
      ) {
        hasDifferenceInAddedMembers = true;
        break;
      }
    }
    expect(hasDifferenceInAddedMembers).toBe(true);
  });

  it('falls back to getR10Config().coverageFill when args.coverageFill is omitted', () => {
    setR10Config({ macroShade: DEFAULT_MACRO_SHADE_CONFIG, coverageFill: coverageFillConfig });
    try {
      const viaGlobalConfig = buildClusterPlacement(fullCoverageArgs);
      expect(viaGlobalConfig.clusterCount).toBeGreaterThan(withoutCoverageFill.clusterCount);
      expect(viaGlobalConfig.memberCount).toBeGreaterThan(withoutCoverageFill.memberCount);
    } finally {
      setR10Config({
        macroShade: DEFAULT_MACRO_SHADE_CONFIG,
        coverageFill: DEFAULT_COVERAGE_FILL_CONFIG,
      });
    }
  });
});
