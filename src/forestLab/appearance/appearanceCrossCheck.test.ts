// @ts-expect-error This project intentionally has no Node type dependency.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { createAppearanceModel } from './appearanceModel';
import { sampleMacroField, selectionFamilyAt } from './macroFamilyField';

// `outputs/matsu-h01-forest-lab-reference-appearance-convergence-v1/tools/crossCheckAppearanceField.mjs`
// を実際に実行して書き出したフィクスチャ。生成コマンド:
//   node outputs/matsu-h01-forest-lab-reference-appearance-convergence-v1/tools/crossCheckAppearanceField.mjs --write-fixture
const FIXTURE_URL = new URL(
  '../../../outputs/matsu-h01-forest-lab-reference-appearance-convergence-v1/tools/appearanceFieldCrossCheck.fixture.json',
  import.meta.url,
);

interface CrossCheckEntry {
  x: number;
  z: number;
  field: number;
  family: 0 | 1 | 2;
  color: { r: number; g: number; b: number };
}

const SEED = 20260913;
const TOLERANCE = 1e-9;

describe('appearance field cross-check (.mjs FAR generator vs. TS runtime)', () => {
  const fixture: Record<'R1' | 'R2', CrossCheckEntry[]> = JSON.parse(readFileSync(FIXTURE_URL, 'utf8'));

  it('loads a non-trivial fixture with 32 coordinates', () => {
    expect(fixture.R1.length).toBe(32);
    expect(fixture.R2.length).toBe(32);
  });

  it('matches sampleMacroField / selectionFamilyAt / color multiplier within 1e-9', () => {
    for (const appearance of ['R1', 'R2'] as const) {
      const model = createAppearanceModel(appearance, SEED);
      for (const entry of fixture[appearance]) {
        const field = sampleMacroField(entry.x, entry.z, SEED, appearance);
        expect(Math.abs(field - entry.field)).toBeLessThanOrEqual(TOLERANCE);
        expect(selectionFamilyAt(entry.x, entry.z, SEED, appearance)).toBe(entry.family);
        const [r, g, b] = model.colorAt(entry.x, entry.z);
        expect(Math.abs(r - entry.color.r)).toBeLessThanOrEqual(TOLERANCE);
        expect(Math.abs(g - entry.color.g)).toBeLessThanOrEqual(TOLERANCE);
        expect(Math.abs(b - entry.color.b)).toBeLessThanOrEqual(TOLERANCE);
      }
    }
  });

  it('covers all three families across the sampled coordinates', () => {
    for (const appearance of ['R1', 'R2'] as const) {
      const seen = new Set(fixture[appearance].map((entry) => entry.family));
      expect(seen.size).toBeGreaterThanOrEqual(2);
    }
  });
});
