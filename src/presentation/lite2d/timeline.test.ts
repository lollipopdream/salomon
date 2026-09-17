import { describe, expect, it } from 'vitest';
import {
  LITE2D_LOOP_DURATION_MS,
  computeLite2DFrame,
} from './timeline';

const IDENTITY_TRANSFORM = {
  scale: 1,
  translateXPercent: 0,
  translateYPercent: 0,
};

describe('computeLite2DFrame', () => {
  it('starts with the complete route in an unmoving hero composition', () => {
    expect(computeLite2DFrame(0)).toEqual({
      cut: 'hero',
      cutElapsedMs: 0,
      cutProgress: 0,
      routeProgress: 1,
      stageTransform: IDENTITY_TRANSFORM,
    });
  });

  it('switches to ascent at 3000ms with only route drawing as motion', () => {
    expect(computeLite2DFrame(3_000)).toEqual({
      cut: 'ascent',
      cutElapsedMs: 0,
      cutProgress: 0,
      routeProgress: 0,
      stageTransform: IDENTITY_TRANSFORM,
    });

    const middle = computeLite2DFrame(5_500);
    expect(middle.cut).toBe('ascent');
    expect(middle.cutElapsedMs).toBe(2_500);
    expect(middle.cutProgress).toBeCloseTo(0.5);
    expect(middle.routeProgress).toBeCloseTo(0.5);
    expect(middle.stageTransform).toEqual(IDENTITY_TRANSFORM);
  });

  it('keeps ascent route progress monotonic from zero toward one', () => {
    const progress = [3_000, 4_000, 5_000, 6_000, 7_000, 7_999].map(
      (elapsedMs) => computeLite2DFrame(elapsedMs).routeProgress,
    );

    expect(progress[0]).toBe(0);
    expect(progress[progress.length - 1]).toBeCloseTo(0.9998);
    for (let index = 1; index < progress.length; index += 1) {
      expect(progress[index]).toBeGreaterThan(progress[index - 1]);
    }
  });

  it('keeps the mountain stage static when the crop phase starts', () => {
    expect(computeLite2DFrame(8_000)).toEqual({
      cut: 'crop',
      cutElapsedMs: 0,
      cutProgress: 0,
      routeProgress: 1,
      stageTransform: IDENTITY_TRANSFORM,
    });
    expect(computeLite2DFrame(10_999).stageTransform).toEqual(
      IDENTITY_TRANSFORM,
    );
  });

  it('wraps the 11000ms loop for arbitrarily large finite elapsed times', () => {
    expect(LITE2D_LOOP_DURATION_MS).toBe(11_000);
    expect(computeLite2DFrame(11_000)).toEqual(computeLite2DFrame(0));
    expect(computeLite2DFrame(27_500)).toEqual(computeLite2DFrame(5_500));
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'sanitizes unsafe elapsed time %s to the start of the loop',
    (elapsedMs) => {
      const frame = computeLite2DFrame(elapsedMs);

      expect(frame).toEqual(computeLite2DFrame(0));
      expect(Number.isNaN(frame.cutProgress)).toBe(false);
      expect(Number.isNaN(frame.routeProgress)).toBe(false);
    },
  );
});
