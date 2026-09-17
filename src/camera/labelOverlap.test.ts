import { describe, expect, it } from 'vitest';

import {
  computeLabelOverlapFade,
  DEFAULT_OVERLAP_LIGHT_DIM_OPACITY,
  type LabelOverlapCandidate,
} from './labelOverlap';

describe('computeLabelOverlapFade', () => {
  it('keeps every label fully visible when all candidates are outside the light overlap range', () => {
    const candidates: LabelOverlapCandidate[] = [
      { poiId: 'one', ndcX: 0, ndcY: 0, isActive: false, priority: 1 },
      { poiId: 'two', ndcX: 0.2, ndcY: 0, isActive: false, priority: 2 },
      { poiId: 'three', ndcX: 0, ndcY: 0.2, isActive: false, priority: 3 },
    ];

    expect(computeLabelOverlapFade(candidates)).toEqual([
      { poiId: 'one', opacityMultiplier: 1 },
      { poiId: 'two', opacityMultiplier: 1 },
      { poiId: 'three', opacityMultiplier: 1 },
    ]);
  });

  it('lightly dims only the lower-priority non-active label in the light overlap range', () => {
    const candidates: LabelOverlapCandidate[] = [
      { poiId: 'preferred', ndcX: 0, ndcY: 0, isActive: false, priority: 1 },
      { poiId: 'deferred', ndcX: 0.05, ndcY: 0, isActive: false, priority: 2 },
    ];

    expect(computeLabelOverlapFade(candidates)).toEqual([
      { poiId: 'preferred', opacityMultiplier: 1 },
      {
        poiId: 'deferred',
        opacityMultiplier: DEFAULT_OVERLAP_LIGHT_DIM_OPACITY,
      },
    ]);
  });

  it('hides only the lower-priority non-active label in the severe overlap range', () => {
    const candidates: LabelOverlapCandidate[] = [
      { poiId: 'deferred', ndcX: 0.02, ndcY: 0, isActive: false, priority: 4 },
      { poiId: 'preferred', ndcX: 0, ndcY: 0, isActive: false, priority: 2 },
    ];

    expect(computeLabelOverlapFade(candidates)).toEqual([
      { poiId: 'deferred', opacityMultiplier: 0 },
      { poiId: 'preferred', opacityMultiplier: 1 },
    ]);
  });

  it('always keeps an active label fully visible even when another label is at the same position', () => {
    const candidates: LabelOverlapCandidate[] = [
      { poiId: 'active', ndcX: 0, ndcY: 0, isActive: true, priority: 100 },
      { poiId: 'inactive', ndcX: 0, ndcY: 0, isActive: false, priority: 1 },
    ];

    expect(computeLabelOverlapFade(candidates)).toEqual([
      { poiId: 'active', opacityMultiplier: 1 },
      { poiId: 'inactive', opacityMultiplier: 1 },
    ]);
  });

  it('uses the strictest opacity when a label loses multiple overlap comparisons', () => {
    const candidates: LabelOverlapCandidate[] = [
      { poiId: 'light-winner', ndcX: 0, ndcY: 0, isActive: false, priority: 1 },
      { poiId: 'multiple-loser', ndcX: 0.05, ndcY: 0, isActive: false, priority: 3 },
      { poiId: 'severe-winner', ndcX: 0.06, ndcY: 0, isActive: false, priority: 2 },
    ];

    expect(computeLabelOverlapFade(candidates)).toEqual([
      { poiId: 'light-winner', opacityMultiplier: 1 },
      { poiId: 'multiple-loser', opacityMultiplier: 0 },
      {
        poiId: 'severe-winner',
        opacityMultiplier: DEFAULT_OVERLAP_LIGHT_DIM_OPACITY,
      },
    ]);
  });

  it('breaks equal-priority ties by poiId deterministically', () => {
    const candidates: LabelOverlapCandidate[] = [
      { poiId: 'beta', ndcX: 0, ndcY: 0, isActive: false, priority: 1 },
      { poiId: 'alpha', ndcX: 0, ndcY: 0, isActive: false, priority: 1 },
    ];
    const expected = [
      { poiId: 'beta', opacityMultiplier: 0 },
      { poiId: 'alpha', opacityMultiplier: 1 },
    ];

    expect(computeLabelOverlapFade(candidates)).toEqual(expected);
    expect(computeLabelOverlapFade(candidates)).toEqual(expected);
  });
});
