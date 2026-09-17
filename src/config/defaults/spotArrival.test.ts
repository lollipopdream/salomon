import { describe, expect, it } from 'vitest';

import { SPOT_ARRIVAL_TIMING_MS } from './spotArrival';

describe('SPOT_ARRIVAL_TIMING_MS', () => {
  it('uses the Yakuoin canonical cadence for both tiers', () => {
    const expectedTiming = { approachMs: 450, dwellMs: 950, departMs: 450 };

    expect(SPOT_ARRIVAL_TIMING_MS.primary).toEqual(expectedTiming);
    expect(SPOT_ARRIVAL_TIMING_MS.secondary).toEqual(expectedTiming);
    expect(SPOT_ARRIVAL_TIMING_MS.primary).toEqual(
      SPOT_ARRIVAL_TIMING_MS.secondary,
    );
  });
});
