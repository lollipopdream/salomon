import { describe, expect, it } from 'vitest';

import { mockTakaoRoute } from './mockRoute';

const demBounds = {
  north: 35.6573,
  south: 35.6037,
  east: 139.2847,
  west: 139.2188,
};

describe('mockTakaoRoute', () => {
  it('is explicitly marked as unofficial', () => {
    expect(mockTakaoRoute.isOfficial).toBe(false);
  });

  it('contains the 11 selected route points', () => {
    expect(mockTakaoRoute.points).toHaveLength(11);
  });

  it('keeps every point within the bundled DEM bounds', () => {
    mockTakaoRoute.points.forEach((point) => {
      expect(point.lat).toBeGreaterThanOrEqual(demBounds.south);
      expect(point.lat).toBeLessThanOrEqual(demBounds.north);
      expect(point.lng).toBeGreaterThanOrEqual(demBounds.west);
      expect(point.lng).toBeLessThanOrEqual(demBounds.east);
    });
  });
});
