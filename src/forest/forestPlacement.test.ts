import { describe, expect, it } from 'vitest';

import { forestDefaults } from '../config/defaults/forest';
import type { ForestDensityBudget, ForestPlacementConfig } from '../types';
import { buildRouteDistanceField, sampleRouteDistance } from './routeDistanceField';
import { createForestPlacement } from './forestPlacement';
import {
  createTerrainHeightSampler,
  type TerrainGridLike,
} from './terrainHeightSampler';

const CELL_SIZE = 23.2978;

function createGrid(valueAt: (col: number, row: number) => number): TerrainGridLike {
  const cols = 64;
  const rows = 64;
  const values = new Float32Array(cols * rows);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) values[row * cols + col] = valueAt(col, row);
  }
  return { values, cols, rows, cellSizeMeters: CELL_SIZE };
}

const routePointsXZ = Array.from({ length: 65 }, (_, index) => ({
  x: 220 + index * 16,
  z: 720,
}));
const config: ForestPlacementConfig = {
  ...forestDefaults.placement,
  corridorCoreHalfWidthMeters: 180,
  corridorFeatherMeters: 120,
  maxRouteDistanceMeters: 300,
};
const generousBudget: ForestDensityBudget = { spacingMeters: 12, maxInstances: 100_000 };
const flatSample = createTerrainHeightSampler(createGrid(() => 120), 1);
const slopedSample = (x: number, z: number): number => 10 + x * 0.005 + z * 0.002;

describe('createForestPlacement', () => {
  it('is deterministic and returns bounded, grounded unit data with coherent stats', () => {
    const first = createForestPlacement({ routePointsXZ, sampleHeight: flatSample, config, budget: generousBudget });
    const second = createForestPlacement({ routePointsXZ, sampleHeight: flatSample, config, budget: generousBudget });

    expect(first.positions).toEqual(second.positions);
    expect(first.rotationsY).toEqual(second.rotationsY);
    expect(first.sizeUnits).toEqual(second.sizeUnits);
    expect(first.colorUnits).toEqual(second.colorUnits);
    expect(first.positions).toHaveLength(first.count * 3);
    expect(first.stats.accepted).toBeGreaterThanOrEqual(first.stats.kept);

    const field = buildRouteDistanceField(
      routePointsXZ,
      config.distanceFieldCellMeters,
      config.maxRouteDistanceMeters,
      config.corridorCoreHalfWidthMeters + config.corridorFeatherMeters,
    );
    const violations: string[] = [];
    for (let index = 0; index < first.count; index += 1) {
      const x = first.positions[index * 3];
      const y = first.positions[index * 3 + 1];
      const z = first.positions[index * 3 + 2];
      if (!(x >= first.stats.aabb.minX && x <= first.stats.aabb.maxX)) {
        violations.push(`i=${index} x=${x} outside aabb`);
      }
      if (!(z >= first.stats.aabb.minZ && z <= first.stats.aabb.maxZ)) {
        violations.push(`i=${index} z=${z} outside aabb`);
      }
      const distance = sampleRouteDistance(field, x, z);
      if (!(distance >= config.routeClearanceMeters)) {
        violations.push(`i=${index} route distance ${distance} below clearance`);
      }
      if (!(distance < config.corridorCoreHalfWidthMeters + config.corridorFeatherMeters)) {
        violations.push(`i=${index} route distance ${distance} outside corridor`);
      }
      if (!(Math.abs(y - flatSample(x, z)) < 0.5 * 10 ** -5)) {
        violations.push(`i=${index} y=${y} does not match sampled height`);
      }
      if (!(first.rotationsY[index] >= 0 && first.rotationsY[index] < Math.PI * 2)) {
        violations.push(`i=${index} rotation=${first.rotationsY[index]} outside [0, 2pi)`);
      }
      if (!(first.sizeUnits[index] >= 0 && first.sizeUnits[index] < 1)) {
        violations.push(`i=${index} size=${first.sizeUnits[index]} outside [0, 1)`);
      }
      if (!(first.colorUnits[index] >= 0 && first.colorUnits[index] < 1)) {
        violations.push(`i=${index} color=${first.colorUnits[index]} outside [0, 1)`);
      }
    }
    expect(violations.slice(0, 5)).toEqual([]);
  });

  it('grounds every selected point using its own coordinates on sloped terrain', () => {
    const result = createForestPlacement({ routePointsXZ, sampleHeight: slopedSample, config, budget: generousBudget });
    const violations: string[] = [];
    for (let index = 0; index < result.count; index += 1) {
      const x = result.positions[index * 3];
      const y = result.positions[index * 3 + 1];
      const z = result.positions[index * 3 + 2];
      const expected = slopedSample(x, z);
      if (!(Math.abs(y - expected) < 0.5 * 10 ** -5)) {
        violations.push(`i=${index} y=${y} does not match sampled height ${expected}`);
      }
    }
    expect(result.count).toBeGreaterThan(0);
    expect(violations.slice(0, 5)).toEqual([]);
  });

  it('keeps exactly the cap and uses the same pre-thinning candidate coordinates for every cap', () => {
    const all = createForestPlacement({ routePointsXZ, sampleHeight: flatSample, config, budget: generousBudget });
    const capped = createForestPlacement({
      routePointsXZ,
      sampleHeight: flatSample,
      config,
      budget: { ...generousBudget, maxInstances: 137 },
    });
    expect(capped.count).toBe(137);
    expect(capped.stats.thinned).toBe(true);
    const allCoordinates = new Set<string>();
    for (let index = 0; index < all.count; index += 1) {
      allCoordinates.add(`${all.positions[index * 3]},${all.positions[index * 3 + 2]}`);
    }
    const missingCoordinates: string[] = [];
    for (let index = 0; index < capped.count; index += 1) {
      const coordinate = `${capped.positions[index * 3]},${capped.positions[index * 3 + 2]}`;
      if (!allCoordinates.has(coordinate)) missingCoordinates.push(`i=${index} coordinate=${coordinate}`);
    }
    expect(missingCoordinates.slice(0, 5)).toEqual([]);
    expect(capped.stats.candidateCells).toBe(all.stats.candidateCells);
    expect(capped.stats.accepted).toBe(all.stats.accepted);
  });

  it('rejects terrain whose slope is at the cutoff everywhere', () => {
    const steepSample = (x: number, _z: number): number => x * 4;
    const result = createForestPlacement({ routePointsXZ, sampleHeight: steepSample, config, budget: generousBudget });
    expect(result.count).toBe(0);
  });
});
