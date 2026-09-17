import { describe, expect, it } from 'vitest';

import {
  BROADLEAF_SCALE_MAX,
  BROADLEAF_SCALE_MIN,
  CONIFER_SCALE_MAX,
  CONIFER_SCALE_MIN,
} from '../cluster/clusterConstants';
import {
  APPEARANCE_IDS,
  COLOR_ANCHORS_BY_APPEARANCE,
  MACRO_FIELD_OCTAVES_BY_APPEARANCE,
  R2_BRIGHT_BROADLEAF_THRESHOLD,
  R2_DARK_CONIFER_THRESHOLD,
  R3_BRIGHT_BROADLEAF_THRESHOLD,
  R3_DARK_CONIFER_THRESHOLD,
  R4_BRIGHT_BROADLEAF_THRESHOLD,
  R4_DARK_CONIFER_THRESHOLD,
  R5_BRIGHT_BROADLEAF_THRESHOLD,
  R5_DARK_CONIFER_THRESHOLD,
  R6_BRIGHT_BROADLEAF_THRESHOLD,
  R6_DARK_CONIFER_THRESHOLD,
  SHARED_FAMILY_PARAMETERS_BY_APPEARANCE,
} from './appearanceConstants';
import { createAppearanceModel, resolveAppearanceId } from './appearanceModel';

const SEED = 20260913;

describe('resolveAppearanceId (I-14)', () => {
  it('falls back to BASELINE for every unknown input', () => {
    const unknownInputs: unknown[] = [undefined, null, 'R9', 42, '', 'BASELINE'];
    for (const value of unknownInputs) {
      expect(resolveAppearanceId(value)).toBe('BASELINE');
    }
  });

  it('resolves the literal string R1 to R1', () => {
    expect(resolveAppearanceId('R1')).toBe('R1');
  });

  it('includes and resolves R2', () => {
    expect(APPEARANCE_IDS).toEqual(['BASELINE', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7']);
    expect(resolveAppearanceId('R2')).toBe('R2');
  });

  it('includes and resolves R3 with every numeric appearance parameter inherited from R2', () => {
    expect(resolveAppearanceId('R3')).toBe('R3');
    expect(MACRO_FIELD_OCTAVES_BY_APPEARANCE.R3)
      .toBe(MACRO_FIELD_OCTAVES_BY_APPEARANCE.R2);
    expect(COLOR_ANCHORS_BY_APPEARANCE.R3).toBe(COLOR_ANCHORS_BY_APPEARANCE.R2);
    expect(SHARED_FAMILY_PARAMETERS_BY_APPEARANCE.R3)
      .toBe(SHARED_FAMILY_PARAMETERS_BY_APPEARANCE.R2);
    expect(R3_DARK_CONIFER_THRESHOLD).toBe(R2_DARK_CONIFER_THRESHOLD);
    expect(R3_BRIGHT_BROADLEAF_THRESHOLD).toBe(R2_BRIGHT_BROADLEAF_THRESHOLD);

    const r2 = createAppearanceModel('R2', SEED);
    const r3 = createAppearanceModel('R3', SEED);
    for (const family of [0, 1, 2]) {
      for (const u of [0, 0.25, 0.5, 0.75, 1 - Number.EPSILON]) {
        expect(r3.groveVariant(family, u)).toBe(r2.groveVariant(family, u));
        expect(r3.treeVariant(family, u)).toBe(r2.treeVariant(family, u));
        expect(r3.scale(family, false, u)).toBe(r2.scale(family, false, u));
        expect(r3.scale(family, true, u)).toBe(r2.scale(family, true, u));
      }
    }
    for (const [x, z] of [[0, 0], [1234.5, -678.9], [9999, -9999]]) {
      expect(r3.colorAt(x, z)).toEqual(r2.colorAt(x, z));
      expect(r3.familyAt(x, z)).toBe(r2.familyAt(x, z));
    }
  });

  it('includes and resolves R4 with every numeric appearance parameter inherited from R2/R3', () => {
    expect(resolveAppearanceId('R4')).toBe('R4');
    expect(MACRO_FIELD_OCTAVES_BY_APPEARANCE.R4)
      .toBe(MACRO_FIELD_OCTAVES_BY_APPEARANCE.R2);
    expect(COLOR_ANCHORS_BY_APPEARANCE.R4).toBe(COLOR_ANCHORS_BY_APPEARANCE.R2);
    expect(SHARED_FAMILY_PARAMETERS_BY_APPEARANCE.R4)
      .toBe(SHARED_FAMILY_PARAMETERS_BY_APPEARANCE.R2);
    expect(R4_DARK_CONIFER_THRESHOLD).toBe(R2_DARK_CONIFER_THRESHOLD);
    expect(R4_BRIGHT_BROADLEAF_THRESHOLD).toBe(R2_BRIGHT_BROADLEAF_THRESHOLD);
    expect(R4_DARK_CONIFER_THRESHOLD).toBe(R3_DARK_CONIFER_THRESHOLD);
    expect(R4_BRIGHT_BROADLEAF_THRESHOLD).toBe(R3_BRIGHT_BROADLEAF_THRESHOLD);

    const r2 = createAppearanceModel('R2', SEED);
    const r4 = createAppearanceModel('R4', SEED);
    for (const family of [0, 1, 2]) {
      for (const u of [0, 0.25, 0.5, 0.75, 1 - Number.EPSILON]) {
        expect(r4.groveVariant(family, u)).toBe(r2.groveVariant(family, u));
        expect(r4.treeVariant(family, u)).toBe(r2.treeVariant(family, u));
        expect(r4.scale(family, false, u)).toBe(r2.scale(family, false, u));
        expect(r4.scale(family, true, u)).toBe(r2.scale(family, true, u));
      }
    }
    for (const [x, z] of [[0, 0], [1234.5, -678.9], [9999, -9999]]) {
      expect(r4.colorAt(x, z)).toEqual(r2.colorAt(x, z));
      expect(r4.familyAt(x, z)).toBe(r2.familyAt(x, z));
    }
  });

  it('includes and resolves R5 with every numeric appearance parameter inherited from R2/R3/R4', () => {
    expect(resolveAppearanceId('R5')).toBe('R5');
    expect(MACRO_FIELD_OCTAVES_BY_APPEARANCE.R5)
      .toBe(MACRO_FIELD_OCTAVES_BY_APPEARANCE.R2);
    expect(COLOR_ANCHORS_BY_APPEARANCE.R5).toBe(COLOR_ANCHORS_BY_APPEARANCE.R2);
    expect(SHARED_FAMILY_PARAMETERS_BY_APPEARANCE.R5)
      .toBe(SHARED_FAMILY_PARAMETERS_BY_APPEARANCE.R2);
    expect(R5_DARK_CONIFER_THRESHOLD).toBe(R2_DARK_CONIFER_THRESHOLD);
    expect(R5_BRIGHT_BROADLEAF_THRESHOLD).toBe(R2_BRIGHT_BROADLEAF_THRESHOLD);
    expect(R5_DARK_CONIFER_THRESHOLD).toBe(R4_DARK_CONIFER_THRESHOLD);
    expect(R5_BRIGHT_BROADLEAF_THRESHOLD).toBe(R4_BRIGHT_BROADLEAF_THRESHOLD);

    const r2 = createAppearanceModel('R2', SEED);
    const r5 = createAppearanceModel('R5', SEED);
    for (const family of [0, 1, 2]) {
      for (const u of [0, 0.25, 0.5, 0.75, 1 - Number.EPSILON]) {
        expect(r5.groveVariant(family, u)).toBe(r2.groveVariant(family, u));
        expect(r5.treeVariant(family, u)).toBe(r2.treeVariant(family, u));
        expect(r5.scale(family, false, u)).toBe(r2.scale(family, false, u));
        expect(r5.scale(family, true, u)).toBe(r2.scale(family, true, u));
      }
    }
    for (const [x, z] of [[0, 0], [1234.5, -678.9], [9999, -9999]]) {
      expect(r5.colorAt(x, z)).toEqual(r2.colorAt(x, z));
      expect(r5.familyAt(x, z)).toBe(r2.familyAt(x, z));
    }
  });

  it('includes and resolves R6 with every numeric appearance parameter inherited from R2/R3', () => {
    expect(resolveAppearanceId('R6')).toBe('R6');
    expect(MACRO_FIELD_OCTAVES_BY_APPEARANCE.R6)
      .toBe(MACRO_FIELD_OCTAVES_BY_APPEARANCE.R2);
    expect(COLOR_ANCHORS_BY_APPEARANCE.R6).toBe(COLOR_ANCHORS_BY_APPEARANCE.R2);
    expect(SHARED_FAMILY_PARAMETERS_BY_APPEARANCE.R6)
      .toBe(SHARED_FAMILY_PARAMETERS_BY_APPEARANCE.R2);
    expect(R6_DARK_CONIFER_THRESHOLD).toBe(R2_DARK_CONIFER_THRESHOLD);
    expect(R6_BRIGHT_BROADLEAF_THRESHOLD).toBe(R2_BRIGHT_BROADLEAF_THRESHOLD);

    // R6 の唯一の差分は grove member の local representation(top-cap plane の追加)であり、
    // selection / placement / color を決める数値は R3 と 1 つも違わない。
    const r3 = createAppearanceModel('R3', SEED);
    const r6 = createAppearanceModel('R6', SEED);
    for (const family of [0, 1, 2]) {
      for (const u of [0, 0.25, 0.5, 0.75, 1 - Number.EPSILON]) {
        expect(r6.groveVariant(family, u)).toBe(r3.groveVariant(family, u));
        expect(r6.treeVariant(family, u)).toBe(r3.treeVariant(family, u));
        expect(r6.scale(family, false, u)).toBe(r3.scale(family, false, u));
        expect(r6.scale(family, true, u)).toBe(r3.scale(family, true, u));
      }
    }
    for (const [x, z] of [[0, 0], [1234.5, -678.9], [9999, -9999]]) {
      expect(r6.colorAt(x, z)).toEqual(r3.colorAt(x, z));
      expect(r6.familyAt(x, z)).toBe(r3.familyAt(x, z));
    }
  });

  // R6 追加時に resolveAppearanceId / createAppearanceModel の文字列リテラル連鎖が
  // 更新されず、R6 がエラーにならず黙って BASELINE へ落ちた。両者を APPEARANCE_IDS から
  // 導出する形へ直したうえで、その性質自体をここで固定する。
  it('resolves every non-BASELINE appearance id in APPEARANCE_IDS instead of silently falling back', () => {
    const baseline = createAppearanceModel('BASELINE', SEED);
    for (const id of APPEARANCE_IDS) {
      if (id === 'BASELINE') continue;
      expect(resolveAppearanceId(id)).toBe(id);
      const model = createAppearanceModel(id, SEED);
      expect(model.id).toBe(id);
      // BASELINE の colorAt は常に (1,1,1)。取り違えるとこれと一致してしまう。
      expect(model.colorAt(1234.5, -678.9)).not.toEqual(baseline.colorAt(1234.5, -678.9));
    }
  });
});

describe('BASELINE appearance model matches the pre-appearance uniform mapping', () => {
  const model = createAppearanceModel('BASELINE', SEED);

  function expectedGroveVariant(u: number): number {
    return Math.min(5, Math.floor(u * 6));
  }
  function expectedTreeVariant(u: number): number {
    return Math.min(3, Math.floor(u * 4));
  }
  function expectedScale(isBroadleafTree: boolean, u: number): number {
    return isBroadleafTree
      ? BROADLEAF_SCALE_MIN + (BROADLEAF_SCALE_MAX - BROADLEAF_SCALE_MIN) * u
      : CONIFER_SCALE_MIN + (CONIFER_SCALE_MAX - CONIFER_SCALE_MIN) * u;
  }

  const sampleUs = [0, 1 / 6, 0.1666666666666, 0.5, 0.9999, 1 - 1e-9];

  it('groveVariant matches Math.min(5, Math.floor(u * 6)) across the u domain', () => {
    for (const u of sampleUs) {
      for (let family = 0; family <= 2; family += 1) {
        expect(model.groveVariant(family, u)).toBe(expectedGroveVariant(u));
      }
    }
  });

  it('treeVariant matches Math.min(3, Math.floor(u * 4)) across the u domain', () => {
    for (const u of sampleUs) {
      for (let family = 0; family <= 2; family += 1) {
        expect(model.treeVariant(family, u)).toBe(expectedTreeVariant(u));
      }
    }
  });

  it('scale matches the uniform lerp over the safe envelope across the u domain', () => {
    for (const u of sampleUs) {
      for (let family = 0; family <= 2; family += 1) {
        expect(model.scale(family, false, u)).toBeCloseTo(expectedScale(false, u), 12);
        expect(model.scale(family, true, u)).toBeCloseTo(expectedScale(true, u), 12);
      }
    }
  });

  it('colorAt is always the identity multiplier (1, 1, 1)', () => {
    expect(model.colorAt(0, 0)).toEqual([1, 1, 1]);
    expect(model.colorAt(1234.5, -678.9)).toEqual([1, 1, 1]);
  });

  it('familyAt is always the neutral family 1', () => {
    expect(model.familyAt(0, 0)).toBe(1);
    expect(model.familyAt(9999, -9999)).toBe(1);
  });
});
