import { describe, expect, it } from 'vitest';

import { routeFollowSpotsDefaults } from './cameraSpotHold';

describe('routeFollowSpotsDefaults', () => {
  it('uses non-negative durations for every spot event', () => {
    for (const event of routeFollowSpotsDefaults.events) {
      expect(event.decelMs).toBeGreaterThanOrEqual(0);
      expect(event.midMs).toBeGreaterThanOrEqual(0);
      expect(event.accelMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('uses the Yakuoin canonical hold cadence for every spot event', () => {
    expect(routeFollowSpotsDefaults.events).toHaveLength(5);

    for (const event of routeFollowSpotsDefaults.events) {
      expect(event.kind).toBe('hold');
      expect(event.decelMs).toBe(300);
      expect(event.midMs).toBe(900);
      expect(event.accelMs).toBe(300);
    }
  });
});
