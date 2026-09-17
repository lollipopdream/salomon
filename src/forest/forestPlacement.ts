import type { ForestDensityBudget, ForestPlacementConfig } from '../types';
import { computeDensityFactor } from './forestDensity';
import { createSeededRandom, hashIndexTo01 } from './forestRandom';
import { buildRouteDistanceField, sampleRouteDistance } from './routeDistanceField';
import { sampleTerrainSlopeRadians } from './terrainHeightSampler';

export interface ForestPlacementResult {
  count: number;
  positions: Float32Array;
  rotationsY: Float32Array;
  sizeUnits: Float32Array;
  colorUnits: Float32Array;
  stats: {
    candidateCells: number;
    accepted: number;
    kept: number;
    maxInstances: number;
    thinned: boolean;
    aabb: { minX: number; minZ: number; maxX: number; maxZ: number };
    elapsedMs: number;
  };
}

export function createForestPlacement(args: {
  routePointsXZ: readonly { x: number; z: number }[];
  sampleHeight: (x: number, z: number) => number;
  config: ForestPlacementConfig;
  budget: ForestDensityBudget;
}): ForestPlacementResult {
  const startedAt = performance.now();
  const { routePointsXZ, sampleHeight, config, budget } = args;
  const emptyAabb = { minX: 0, minZ: 0, maxX: 0, maxZ: 0 };
  if (routePointsXZ.length === 0 || budget.spacingMeters <= 0 || budget.maxInstances <= 0) {
    return emptyResult(emptyAabb, budget.maxInstances, performance.now() - startedAt);
  }

  let minX = routePointsXZ[0].x;
  let maxX = minX;
  let minZ = routePointsXZ[0].z;
  let maxZ = minZ;
  for (let index = 1; index < routePointsXZ.length; index += 1) {
    const point = routePointsXZ[index];
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  }

  const margin = config.corridorCoreHalfWidthMeters + config.corridorFeatherMeters;
  const aabb = {
    minX: minX - margin,
    minZ: minZ - margin,
    maxX: maxX + margin,
    maxZ: maxZ + margin,
  };
  const distanceField = buildRouteDistanceField(
    routePointsXZ,
    config.distanceFieldCellMeters,
    config.maxRouteDistanceMeters,
    margin,
  );
  const cols = Math.floor((aabb.maxX - aabb.minX) / budget.spacingMeters);
  const rows = Math.floor((aabb.maxZ - aabb.minZ) / budget.spacingMeters);
  const candidateCells = cols * rows;
  const acceptedX = new Float64Array(candidateCells);
  const acceptedZ = new Float64Array(candidateCells);
  const acceptedSizes = new Float32Array(candidateCells);
  const acceptedColors = new Float32Array(candidateCells);
  const random = createSeededRandom(config.seed);
  const jitterExtent = budget.spacingMeters * config.jitterRatio;
  const slopeStep = config.distanceFieldCellMeters;
  let accepted = 0;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const jitterX = random();
      const jitterZ = random();
      const accept = random();
      const sizeUnit = random();
      const colorUnit = random();
      const x = aabb.minX + (col + 0.5) * budget.spacingMeters + (jitterX - 0.5) * jitterExtent;
      const z = aabb.minZ + (row + 0.5) * budget.spacingMeters + (jitterZ - 0.5) * jitterExtent;
      const distance = sampleRouteDistance(distanceField, x, z);
      const slope = sampleTerrainSlopeRadians(sampleHeight, x, z, slopeStep);
      const density = distance < config.routeClearanceMeters
        ? 0
        : computeDensityFactor(distance, slope, config);

      if (accept < density) {
        acceptedX[accepted] = x;
        acceptedZ[accepted] = z;
        acceptedSizes[accepted] = sizeUnit;
        acceptedColors[accepted] = colorUnit;
        accepted += 1;
      }
    }
  }

  const kept = Math.min(accepted, budget.maxInstances);
  const keptAcceptedIndices = new Uint32Array(accepted);
  for (let index = 0; index < accepted; index += 1) keptAcceptedIndices[index] = index;
  if (accepted > kept) {
    const thinningSeed = config.seed ^ 0x9e3779b9;
    keptAcceptedIndices.sort((left, right) => {
      const difference = hashIndexTo01(left, thinningSeed) - hashIndexTo01(right, thinningSeed);
      return difference || left - right;
    });
    keptAcceptedIndices.subarray(0, kept).sort();
  }

  const positions = new Float32Array(kept * 3);
  const rotationsY = new Float32Array(kept);
  const sizeUnits = new Float32Array(kept);
  const colorUnits = new Float32Array(kept);
  for (let resultIndex = 0; resultIndex < kept; resultIndex += 1) {
    const acceptedIndex = keptAcceptedIndices[resultIndex];
    const x = acceptedX[acceptedIndex];
    const z = acceptedZ[acceptedIndex];
    positions[resultIndex * 3] = x;
    positions[resultIndex * 3 + 1] = sampleHeight(x, z);
    positions[resultIndex * 3 + 2] = z;
    rotationsY[resultIndex] = Math.PI * 2 * random();
    sizeUnits[resultIndex] = acceptedSizes[acceptedIndex];
    colorUnits[resultIndex] = acceptedColors[acceptedIndex];
  }

  return {
    count: kept,
    positions,
    rotationsY,
    sizeUnits,
    colorUnits,
    stats: {
      candidateCells,
      accepted,
      kept,
      maxInstances: budget.maxInstances,
      thinned: accepted > kept,
      aabb,
      elapsedMs: performance.now() - startedAt,
    },
  };
}

function emptyResult(
  aabb: ForestPlacementResult['stats']['aabb'],
  maxInstances: number,
  elapsedMs: number,
): ForestPlacementResult {
  return {
    count: 0,
    positions: new Float32Array(0),
    rotationsY: new Float32Array(0),
    sizeUnits: new Float32Array(0),
    colorUnits: new Float32Array(0),
    stats: {
      candidateCells: 0,
      accepted: 0,
      kept: 0,
      maxInstances,
      thinned: false,
      aabb,
      elapsedMs,
    },
  };
}
