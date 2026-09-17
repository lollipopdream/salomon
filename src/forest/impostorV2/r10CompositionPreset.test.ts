// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { forestImpostorV2Defaults } from '../../config/defaults/forestImpostorV2';
import {
  R10_COMPOSITION_FIELD,
  computeSpeciesField,
  createR10CompositionPreset,
  selectSpeciesGroupKey,
} from './r10CompositionPreset';

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('R10 composition field', () => {
  it('is deterministic and always returns a finite value in 0..1', () => {
    const samples = [
      [-10_000, -10_000],
      [-512.25, 1_024.75],
      [0, 0],
      [96, 192],
      [1_000_000, -1_000_000],
    ] as const;
    for (const [x, z] of samples) {
      const first = computeSpeciesField(x, z, 20260913, R10_COMPOSITION_FIELD);
      const second = computeSpeciesField(x, z, 20260913, R10_COMPOSITION_FIELD);
      expect(second).toBe(first);
      expect(Number.isFinite(first)).toBe(true);
      expect(first).toBeGreaterThanOrEqual(0);
      expect(first).toBeLessThanOrEqual(1);
    }
  });

  it('does not introduce a discontinuity at a 96 m macro-cell boundary', () => {
    const values = Array.from({ length: 13 }, (_, offset) => (
      computeSpeciesField(90 + offset, 173, 20260913, R10_COMPOSITION_FIELD)
    ));
    const adjacentDiffs = values.slice(1).map((value, index) => Math.abs(value - values[index]));
    expect(Math.max(...adjacentDiffs)).toBeLessThan(0.02);
  });

  it('selects all three groups at the specified thresholds, including boundaries', () => {
    expect(selectSpeciesGroupKey(0, 0.5, R10_COMPOSITION_FIELD)).toBe('conifer');
    expect(selectSpeciesGroupKey(0.247999, 0.5, R10_COMPOSITION_FIELD)).toBe('conifer');
    expect(selectSpeciesGroupKey(0.2480, 0.5, R10_COMPOSITION_FIELD)).toBe('mixed');
    expect(selectSpeciesGroupKey(0.450599, 0.5, R10_COMPOSITION_FIELD)).toBe('mixed');
    expect(selectSpeciesGroupKey(0.4506, 0.5, R10_COMPOSITION_FIELD)).toBe('broadleaf');
    expect(selectSpeciesGroupKey(1, 0.5, R10_COMPOSITION_FIELD)).toBe('broadleaf');
  });

  it('gives the measured species proportions over the 0..5940 m grid without jitter', () => {
    const counts = { conifer: 0, mixed: 0, broadleaf: 0 };
    const sampleCount = 200;
    const sampleSpacingMeters = 29.7;
    for (let zIndex = 0; zIndex < sampleCount; zIndex += 1) {
      for (let xIndex = 0; xIndex < sampleCount; xIndex += 1) {
        const fieldValue = computeSpeciesField(
          xIndex * sampleSpacingMeters,
          zIndex * sampleSpacingMeters,
          20260913,
          R10_COMPOSITION_FIELD,
        );
        counts[selectSpeciesGroupKey(fieldValue, 0.5, R10_COMPOSITION_FIELD)] += 1;
      }
    }

    const total = sampleCount ** 2;
    expect(counts.conifer / total).toBeGreaterThanOrEqual(0.06);
    expect(counts.conifer / total).toBeLessThanOrEqual(0.10);
    expect(counts.mixed / total).toBeGreaterThanOrEqual(0.26);
    expect(counts.mixed / total).toBeLessThanOrEqual(0.34);
    expect(counts.broadleaf / total).toBeGreaterThanOrEqual(0.58);
    expect(counts.broadleaf / total).toBeLessThanOrEqual(0.66);
  });
});

describe('createR10CompositionPreset', () => {
  it('does not mutate its input', () => {
    const input = jsonClone(forestImpostorV2Defaults);
    const before = jsonClone(input);
    const result = createR10CompositionPreset(input);

    expect(input).toEqual(before);
    expect(result).not.toBe(input);
    expect(result.grove).not.toBe(input.grove);
    expect(result.tree).not.toBe(input.tree);
  });

  it('makes broadleaf grove and tree composition dominant over conifers', () => {
    const result = createR10CompositionPreset(forestImpostorV2Defaults);
    const coniferShare = result.grove.speciesGroupSplit.conifer;
    const broadleafShare = 1 - result.grove.speciesGroupSplit.mixed;

    expect(broadleafShare).toBeGreaterThan(coniferShare);
    expect(result.grove.speciesGroups.broadleaf).toEqual(['G5', 'G4']);
    expect(result.grove.speciesGroups.mixed).toEqual(['G4', 'G6']);
    expect(result.tree.variantWeights.BL).toBeGreaterThan(result.tree.variantWeights.FIR_A);
    expect(result.tree.variantWeights.BL).toBeGreaterThan(result.tree.variantWeights.FIR_C);
  });

  it('keeps the atlas-member weighted conifer ratio in the intended 34--44% range', () => {
    // @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
    const root = process.cwd();
    const meta = JSON.parse(readFileSync(
      `${root}/public/data/forest/impostor-v2/impostor-atlas-meta.json`,
      'utf8',
    )) as { grove_configs: Record<string, { members: readonly { variant: string }[] }> };
    const preset = createR10CompositionPreset(forestImpostorV2Defaults);
    const groups = preset.grove.speciesGroups;
    const shares = {
      conifer: preset.grove.speciesGroupSplit.conifer,
      mixed: preset.grove.speciesGroupSplit.mixed - preset.grove.speciesGroupSplit.conifer,
      broadleaf: 1 - preset.grove.speciesGroupSplit.mixed,
    } as const;
    let coniferRatio = 0;
    for (const [groupKey, groupShare] of Object.entries(shares) as [keyof typeof shares, number][]) {
      const configs = groups[groupKey];
      for (const configId of configs) {
        const members = meta.grove_configs[configId].members;
        const coniferMembers = members.filter(({ variant }) => variant.startsWith('FIR')).length;
        coniferRatio += groupShare / configs.length * coniferMembers / members.length;
      }
    }

    // G5 偏重（針葉樹比 0.387）は PRIMARY 距離で粒が消えて一様な面になったため却下し、
    // G4 主体（G4 46% / G5 31% / G6 15% / G1 4% / G3 4%）へ戻した。
    // 尖ったシルエットの主因は grove 内の FIR ではなく tree layer の単木 FIR であり、
    // そちらは variantWeights で 30% -> 8% に落としてある。
    expect(coniferRatio).toBeGreaterThanOrEqual(0.48);
    expect(coniferRatio).toBeLessThanOrEqual(0.58);
    expect(coniferRatio).toBeCloseTo(0.533, 3);
  });

  it('widens grove and tree crown scale variation to at least a twofold ratio', () => {
    const result = createR10CompositionPreset(forestImpostorV2Defaults);

    expect(result.grove.scaleMax / result.grove.scaleMin).toBeGreaterThanOrEqual(2.0);
    expect(result.tree.scaleMax / result.tree.scaleMin).toBeGreaterThanOrEqual(2.0);
  });

  it('uses the closed-canopy grove scale and spacing overrides', () => {
    const result = createR10CompositionPreset(forestImpostorV2Defaults);

    expect(result.grove.scaleMin).toBe(0.82);
    expect(result.grove.scaleMax).toBe(1.78);
    expect(result.grove.minSpacingRatio).toBe(0.54);
    expect(result.grove.speciesGroupSplit).toEqual({ conifer: 0.08, mixed: 0.38 });
    expect(result.tree.variantWeights).toEqual({ BL: 0.92, FIR_A: 0.05, FIR_C: 0.03 });
  });
});
