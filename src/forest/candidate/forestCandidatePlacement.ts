import { createSeededRandom, hashIndexTo01 } from '../forestRandom';
import { buildRouteDistanceField, sampleRouteDistance } from '../routeDistanceField';
import { sampleTerrainSlopeRadians } from '../terrainHeightSampler';
import { sampleForestCoverage } from './forestMask';
import type {
  ForestCandidateConfig,
  ForestCandidateFlags,
  ForestCandidatePlacementResult,
  ForestMaskData,
} from './types';

export type { ForestCandidatePlacementResult } from './types';

type PlacementConfig = Pick<ForestCandidateConfig, 'placement' | 'size' | 'atlas'>;

export function createForestCandidatePlacement(args: {
  mask: ForestMaskData;
  sampleHeight: (x: number, z: number) => number;
  routePointsXZ: readonly { x: number; z: number }[];
  config: PlacementConfig;
  flags: ForestCandidateFlags;
  now?: () => number;
}): ForestCandidatePlacementResult {
  const now = args.now ?? (() => performance.now());
  const startedAt = now();
  const { mask, sampleHeight, routePointsXZ, config, flags } = args;
  const spacing = flags.spacingMetersOverride ?? config.placement.spacingMeters;
  const maxInstances = flags.maxInstancesOverride ?? config.placement.maxInstances;
  if (spacing <= 0 || maxInstances <= 0 || mask.size <= 0 || mask.extentMeters <= 0) {
    return emptyResult(0, now() - startedAt);
  }

  const cols = Math.ceil(mask.extentMeters / spacing);
  const rows = Math.ceil(mask.extentMeters / spacing);
  const candidateCells = cols * rows;
  const acceptedX = new Float64Array(candidateCells);
  const acceptedZ = new Float64Array(candidateCells);
  const acceptedSpecies = new Uint8Array(candidateCells);
  const acceptedVariants = new Uint8Array(candidateCells);
  const acceptedHeightUnits = new Float32Array(candidateCells);
  const acceptedTintUnits = new Float32Array(candidateCells);
  const random = createSeededRandom(config.placement.seed);
  const jitterExtent = spacing * config.placement.jitterRatio;
  const slopeFull = degreesToRadians(config.placement.slopeFullDeg);
  const slopeZero = degreesToRadians(config.placement.slopeZeroDeg);
  const routeField = buildRouteDistanceField(
    routePointsXZ,
    config.placement.routeDistanceCellMeters,
    config.placement.routeClearanceMeters,
    config.placement.routeClearanceMeters,
  );
  let accepted = 0;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      // Always consume in this order, even if the candidate is rejected.
      const jitterXUnit = random();
      const jitterZUnit = random();
      const acceptanceUnit = random();
      const speciesUnit = random();
      const variantUnit = random();
      const heightUnit = random();
      const tintUnit = random();
      const x = (col + 0.5) * spacing + (jitterXUnit - 0.5) * jitterExtent;
      const z = (row + 0.5) * spacing + (jitterZUnit - 0.5) * jitterExtent;
      if (x < 0 || z < 0 || x >= mask.extentMeters || z >= mask.extentMeters) continue;

      const coverage = sampleForestCoverage(mask, x, z);
      if (coverage < config.placement.minCoverage) continue;
      if (sampleRouteDistance(routeField, x, z) < config.placement.routeClearanceMeters) continue;

      const slope = sampleTerrainSlopeRadians(
        sampleHeight,
        x,
        z,
        config.placement.routeDistanceCellMeters,
      );
      const slopeDensity = slope <= slopeFull
        ? 1
        : slope >= slopeZero
          ? 0
          : 1 - (slope - slopeFull) / (slopeZero - slopeFull);
      const density = clamp01(coverage * flags.densityScale) * slopeDensity;
      if (acceptanceUnit >= density) continue;

      acceptedX[accepted] = x;
      acceptedZ[accepted] = z;
      acceptedSpecies[accepted] = speciesUnit < config.placement.coniferFraction ? 0 : 1;
      acceptedVariants[accepted] = Math.min(
        config.atlas.variantsPerSpecies - 1,
        Math.floor(variantUnit * config.atlas.variantsPerSpecies),
      );
      acceptedHeightUnits[accepted] = heightUnit;
      acceptedTintUnits[accepted] = tintUnit;
      accepted += 1;
    }
  }

  const kept = Math.min(accepted, maxInstances);
  const acceptedIndices = new Uint32Array(accepted);
  for (let index = 0; index < accepted; index += 1) acceptedIndices[index] = index;
  if (accepted > kept) {
    const thinningSeed = config.placement.seed ^ 0x9e3779b9;
    acceptedIndices.sort((left, right) => {
      const delta = hashIndexTo01(left, thinningSeed) - hashIndexTo01(right, thinningSeed);
      return delta || left - right;
    });
    acceptedIndices.subarray(0, kept).sort();
  }

  const positions = new Float32Array(kept * 3);
  const sizes = new Float32Array(kept * 2);
  const speciesIndices = new Uint8Array(kept);
  const variantIndices = new Uint8Array(kept);
  const tintUnits = new Float32Array(kept);
  let coniferCount = 0;
  for (let resultIndex = 0; resultIndex < kept; resultIndex += 1) {
    const acceptedIndex = acceptedIndices[resultIndex];
    const x = acceptedX[acceptedIndex];
    const z = acceptedZ[acceptedIndex];
    const speciesIndex = acceptedSpecies[acceptedIndex];
    const speciesConfig = speciesIndex === 0 ? config.size.conifer : config.size.broadleaf;
    const height = speciesConfig.minHeightMeters
      + acceptedHeightUnits[acceptedIndex]
      * (speciesConfig.maxHeightMeters - speciesConfig.minHeightMeters);
    positions[resultIndex * 3] = x;
    positions[resultIndex * 3 + 1] = sampleHeight(x, z) - config.placement.sinkMeters;
    positions[resultIndex * 3 + 2] = z;
    sizes[resultIndex * 2] = height * speciesConfig.widthRatio;
    sizes[resultIndex * 2 + 1] = height;
    speciesIndices[resultIndex] = speciesIndex;
    variantIndices[resultIndex] = acceptedVariants[acceptedIndex];
    tintUnits[resultIndex] = acceptedTintUnits[acceptedIndex];
    if (speciesIndex === 0) coniferCount += 1;
  }

  return {
    count: kept,
    positions,
    sizes,
    speciesIndices,
    variantIndices,
    tintUnits,
    stats: {
      candidateCells,
      accepted,
      kept,
      thinned: accepted > kept,
      coniferCount,
      broadleafCount: kept - coniferCount,
      elapsedMs: now() - startedAt,
    },
  };
}

function emptyResult(candidateCells: number, elapsedMs: number): ForestCandidatePlacementResult {
  return {
    count: 0,
    positions: new Float32Array(0),
    sizes: new Float32Array(0),
    speciesIndices: new Uint8Array(0),
    variantIndices: new Uint8Array(0),
    tintUnits: new Float32Array(0),
    stats: {
      candidateCells,
      accepted: 0,
      kept: 0,
      thinned: false,
      coniferCount: 0,
      broadleafCount: 0,
      elapsedMs,
    },
  };
}

function degreesToRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
