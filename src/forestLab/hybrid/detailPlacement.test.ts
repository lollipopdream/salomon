// @ts-expect-error This project intentionally has no Node type dependency.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { DETAIL_SPACING_METERS } from '../labConstants';
import {
  assignDetailAttributes,
  computeDetailMaxCount,
  scoreDetailSites,
  selectDetailPlacements,
} from './detailPlacement';

const crowns = Array.from({ length: 80 }, (_, n) => ({
  n,
  cx: (n % 10) * 20,
  cz: Math.floor(n / 10) * 20,
}));

function run() {
  const scored = scoreDetailSites(crowns, {
    laplacianAt: (x, z) => x * 0.1 + z * 0.05,
    Lt: 2,
    LmaxPatch: 30,
    primaryPosXZ: { x: 0, z: 0 },
    distanceMetersAt: (x, z) => (x + z) % 25,
  });
  return assignDetailAttributes(selectDetailPlacements(scored, 20), 20260913);
}

describe('hybrid detail placement', () => {
  it('computes the manifest maximum count exactly', () => {
    expect(computeDetailMaxCount(4327146.039246672)).toBe(358);
    expect(selectDetailPlacements(run(), 0)).toEqual([]);
  });

  it('is deterministic, capped, separated, and score ordered', () => {
    const first = run();
    expect(run()).toEqual(first);
    expect(first.length).toBeLessThanOrEqual(20);
    for (let i = 0; i < first.length; i += 1) {
      for (let j = i + 1; j < first.length; j += 1) {
        expect(Math.hypot(first[i].cx - first[j].cx, first[i].cz - first[j].cz))
          .toBeGreaterThanOrEqual(DETAIL_SPACING_METERS);
      }
      if (i > 0) {
        expect(first[i - 1].score).toBeGreaterThanOrEqual(first[i].score);
        if (first[i - 1].score === first[i].score) {
          expect(first[i - 1].n).toBeLessThan(first[i].n);
        }
      }
    }
  });

  it('does not use the ambient random generator', () => {
    const source = readFileSync(new URL('./detailPlacement.ts', import.meta.url), 'utf8');
    expect(source).not.toContain('Math.random');
  });
});
