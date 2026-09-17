import { describe, expect, it } from 'vitest';

import { forestImpostorV2Defaults } from '../../config/defaults/forestImpostorV2';
import {
  R10_WIDE_DEFAULT_PATCH_THRESHOLD,
  createR10WidePreset,
} from './r10WidePreset';
import type { ForestImpostorV2Config } from './types';

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function numericValues(value: unknown): number[] {
  if (typeof value === 'number') return [value];
  if (Array.isArray(value)) return value.flatMap(numericValues);
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(numericValues);
  return [];
}

describe('createR10WidePreset', () => {
  it('does not mutate production defaults and applies only the wide-coverage overrides', () => {
    const before = jsonClone(forestImpostorV2Defaults);
    const result = createR10WidePreset(forestImpostorV2Defaults);
    const expected = jsonClone(forestImpostorV2Defaults);
    expected.corridor.corridorMaxMeters = 7000;
    expected.corridor.ridgeMeters = 6500;
    expected.macro.ridgeScoreMin = 0;
    expected.macro.patchThreshold = { ...R10_WIDE_DEFAULT_PATCH_THRESHOLD };
    expected.grove.spacingRidgeMeters = 54;
    expected.grove.patchSpacingBoost = 0.10;

    expect(forestImpostorV2Defaults).toEqual(before);
    expect(result).toEqual(expected);
    expect(result.corridor.nearMeters).toBe(before.corridor.nearMeters);
    expect(result.corridor.farMeters).toBe(before.corridor.farMeters);
  });

  it('keeps ridge spacing within a fourfold density ratio of mid spacing', () => {
    const result = createR10WidePreset(forestImpostorV2Defaults);

    expect(result.grove.spacingRidgeMeters / result.grove.spacingFarMeters).toBeLessThan(2.0);
  });

  it('clones every nested mutable object and array', () => {
    const input = jsonClone(forestImpostorV2Defaults);
    const before = jsonClone(input);
    const result = createR10WidePreset(input);

    expect(result).not.toBe(input);
    expect(result.assets).not.toBe(input.assets);
    expect(result.mask).not.toBe(input.mask);
    expect(result.cellSelection).not.toBe(input.cellSelection);
    expect(result.cellSelection.grove).not.toBe(input.cellSelection.grove);
    expect(result.cellSelection.grove.configs).not.toBe(input.cellSelection.grove.configs);
    expect(result.cellSelection.tree.yawDegrees).not.toBe(input.cellSelection.tree.yawDegrees);
    expect(result.macro).not.toBe(input.macro);
    expect(result.macro.patchThreshold).not.toBe(input.macro.patchThreshold);
    expect(result.corridor).not.toBe(input.corridor);
    expect(result.grove).not.toBe(input.grove);
    expect(result.grove.speciesGroups).not.toBe(input.grove.speciesGroups);
    expect(result.grove.speciesGroups.conifer).not.toBe(input.grove.speciesGroups.conifer);
    expect(result.grove.speciesGroupSplit).not.toBe(input.grove.speciesGroupSplit);
    expect(result.tree).not.toBe(input.tree);
    expect(result.tree.variantWeights).not.toBe(input.tree.variantWeights);
    expect(result.material).not.toBe(input.material);
    expect(result.limits).not.toBe(input.limits);

    (result.grove.speciesGroups.conifer as string[])[0] = 'changed';
    (result.tree.variantWeights as Record<string, number>).FIR_A = 99;
    result.material.tintJitter = 0.5;
    expect(input).toEqual(before);
  });

  it('is deterministic and permits a future patch-threshold tune without changing other behavior', () => {
    const patchThreshold = { near: 0.1, mid: 0.2, ridge: 0.3 };
    const first = createR10WidePreset(forestImpostorV2Defaults, { patchThreshold });
    const second = createR10WidePreset(forestImpostorV2Defaults, { patchThreshold });

    expect(first).toEqual(second);
    expect(first.macro.patchThreshold).toEqual(patchThreshold);
    expect(first.macro.patchThreshold).not.toBe(patchThreshold);
  });

  it('returns finite numeric values only', () => {
    const result: ForestImpostorV2Config = createR10WidePreset(forestImpostorV2Defaults);
    expect(numericValues(result).every(Number.isFinite)).toBe(true);
  });
});
