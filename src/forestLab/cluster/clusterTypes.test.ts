import { describe, expect, it } from 'vitest';

import {
  CANDIDATE_IDS,
  CANDIDATE_NAMES,
  LEGACY_CANDIDATE_IDS,
  MAIN_COMPARISON_CANDIDATE_IDS,
  isClusterCandidate,
  usesFarCanopyLayer,
} from './clusterTypes';

describe('cluster candidate types', () => {
  it('defines six unique candidate IDs', () => {
    expect(CANDIDATE_IDS).toHaveLength(6);
    expect(new Set(CANDIDATE_IDS).size).toBe(CANDIDATE_IDS.length);
  });

  it('partitions candidates into main comparison and legacy groups', () => {
    const main = new Set<number>(MAIN_COMPARISON_CANDIDATE_IDS);
    const legacy = new Set<number>(LEGACY_CANDIDATE_IDS);
    expect([...main].filter((id) => legacy.has(id))).toEqual([]);
    expect([...main, ...legacy].sort((left, right) => left - right)).toEqual([...CANDIDATE_IDS]);
  });

  it('uses the specified cluster and far-canopy candidate rules', () => {
    expect(CANDIDATE_IDS.map((id) => isClusterCandidate(id))).toEqual([
      false, false, false, false, true, true,
    ]);
    expect(CANDIDATE_IDS.map((id) => usesFarCanopyLayer(id))).toEqual([
      false, false, false, false, false, true,
    ]);
  });

  it('assigns every candidate one unique name', () => {
    expect(Object.keys(CANDIDATE_NAMES).map(Number).sort((left, right) => left - right)).toEqual(CANDIDATE_IDS);
    expect(new Set(Object.values(CANDIDATE_NAMES)).size).toBe(CANDIDATE_IDS.length);
  });
});
