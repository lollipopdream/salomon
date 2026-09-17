import { describe, expect, it } from 'vitest';

import {
  BROADLEAF_SCALE_RANGE_BY_FAMILY,
  CONIFER_SCALE_RANGE_BY_FAMILY,
  GROVE_WEIGHTS_BY_FAMILY,
  TREE_WEIGHTS_BY_FAMILY,
} from './appearanceConstants';
import { groveConfigFor, pickWeighted, scaleFor, treeVariantFor } from './familySelection';

const WEIGHT_TABLES = [
  ['GROVE_WEIGHTS_BY_FAMILY', GROVE_WEIGHTS_BY_FAMILY] as const,
  ['TREE_WEIGHTS_BY_FAMILY', TREE_WEIGHTS_BY_FAMILY] as const,
];

describe('family weight tables (I-10)', () => {
  for (const [name, table] of WEIGHT_TABLES) {
    it(`${name}: each family row sums to 1.0 within 1e-12`, () => {
      for (const row of table) {
        const sum = row.reduce((total, weight) => total + weight, 0);
        expect(Math.abs(sum - 1)).toBeLessThanOrEqual(1e-12);
      }
    });
  }

  it('pickWeighted returns index 0 at u = 0', () => {
    expect(pickWeighted([0.3, 0.3, 0.4], 0)).toBe(0);
  });

  it('pickWeighted returns the correct index just before and after each cumulative boundary', () => {
    const weights = [0.2, 0.3, 0.5];
    // cumulative boundaries: 0.2, 0.5, 1.0
    expect(pickWeighted(weights, 0.2 - 1e-9)).toBe(0);
    expect(pickWeighted(weights, 0.2 + 1e-9)).toBe(1);
    expect(pickWeighted(weights, 0.5 - 1e-9)).toBe(1);
    expect(pickWeighted(weights, 0.5 + 1e-9)).toBe(2);
  });

  it('pickWeighted returns the last index at u = 0.999999', () => {
    expect(pickWeighted([0.2, 0.3, 0.5], 0.999999)).toBe(2);
  });

  it('pickWeighted never selects a weight-0 element', () => {
    const weights = [0.5, 0, 0.5];
    for (let i = 0; i <= 1000; i += 1) {
      const u = i / 1000;
      expect(pickWeighted(weights, u)).not.toBe(1);
    }
  });

  it('groveConfigFor and treeVariantFor stay within each family CDF range', () => {
    for (let family = 0; family <= 2; family += 1) {
      for (let i = 0; i <= 20; i += 1) {
        const u = i / 20;
        const groveIndex = groveConfigFor(family, u);
        expect(groveIndex).toBeGreaterThanOrEqual(0);
        expect(groveIndex).toBeLessThan(GROVE_WEIGHTS_BY_FAMILY[family as 0 | 1 | 2].length);

        const treeIndex = treeVariantFor(family, u);
        expect(treeIndex).toBeGreaterThanOrEqual(0);
        expect(treeIndex).toBeLessThan(TREE_WEIGHTS_BY_FAMILY[family as 0 | 1 | 2].length);
      }
    }
  });

  it('scaleFor stays within the safe envelope for each family and member class', () => {
    for (let family = 0; family <= 2; family += 1) {
      const coniferRange = CONIFER_SCALE_RANGE_BY_FAMILY[family as 0 | 1 | 2];
      const broadleafRange = BROADLEAF_SCALE_RANGE_BY_FAMILY[family as 0 | 1 | 2];
      for (let i = 0; i <= 20; i += 1) {
        const u = i / 20;
        const conifer = scaleFor(family, false, u);
        expect(conifer).toBeGreaterThanOrEqual(coniferRange[0] - 1e-9);
        expect(conifer).toBeLessThanOrEqual(coniferRange[1] + 1e-9);

        const broadleaf = scaleFor(family, true, u);
        expect(broadleaf).toBeGreaterThanOrEqual(broadleafRange[0] - 1e-9);
        expect(broadleaf).toBeLessThanOrEqual(broadleafRange[1] + 1e-9);
      }
    }
  });
});
