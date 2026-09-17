import { describe, expect, it } from 'vitest';

import {
  LITE_BACKGROUND_HEIGHT,
  LITE_BACKGROUND_URL,
  LITE_BACKGROUND_WIDTH,
  LITE_ROUTE_LABELS,
  LITE_ROUTE_POINTS,
} from './liteFixedRoute';

describe('fixed Lite2D composition', () => {
  it('uses the bundled background natural dimensions and runtime URL', () => {
    expect(LITE_BACKGROUND_WIDTH).toBe(1672);
    expect(LITE_BACKGROUND_HEIGHT).toBe(941);
    expect(LITE_BACKGROUND_URL).toBe(
      '/data/lite-background/takao-lite-bg-daylight.png',
    );
  });

  it('keeps every route point inside the image and climbs bottom-to-top', () => {
    expect(LITE_ROUTE_POINTS.length).toBeGreaterThanOrEqual(6);
    for (const point of LITE_ROUTE_POINTS) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(LITE_BACKGROUND_WIDTH);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(LITE_BACKGROUND_HEIGHT);
    }

    expect(LITE_ROUTE_POINTS[LITE_ROUTE_POINTS.length - 1].y).toBeLessThan(
      LITE_ROUTE_POINTS[0].y,
    );
  });

  it('anchors the three required labels to route waypoints', () => {
    expect(LITE_ROUTE_LABELS.map(({ text }) => text)).toEqual([
      '清滝駅',
      '薬王院',
      '高尾山頂',
    ]);
    for (const label of LITE_ROUTE_LABELS) {
      expect(LITE_ROUTE_POINTS).toContainEqual({ x: label.x, y: label.y });
    }
  });

  it('keeps enough top/bottom margin for label boxes rendered above each anchor', () => {
    // Label boxes render ~60-90px above their anchor via a CSS transform.
    // Keep every anchor comfortably below the top edge and above the bottom
    // edge so the label chip never clips out of frame.
    const LABEL_CLEARANCE_PX = 90;
    for (const point of LITE_ROUTE_POINTS) {
      expect(point.y).toBeGreaterThanOrEqual(LABEL_CLEARANCE_PX);
      expect(point.y).toBeLessThanOrEqual(LITE_BACKGROUND_HEIGHT - 20);
    }
  });
});
