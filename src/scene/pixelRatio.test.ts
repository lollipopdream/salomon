import { describe, expect, it } from 'vitest';

import { computeEffectivePixelRatio } from './pixelRatio';

describe('computeEffectivePixelRatio', () => {
  it.each([1, 1.5, 2, 3])(
    'matches sceneSetup.ts current Math.min(devicePixelRatio, 2) behavior for DPR %s',
    (devicePixelRatio) => {
      expect(computeEffectivePixelRatio(devicePixelRatio)).toBe(
        Math.min(devicePixelRatio, 2),
      );
    },
  );

  it('uses the smaller of the hard cap and variant cap', () => {
    expect(
      computeEffectivePixelRatio(3, { hardCapRatio: 2, variantCapRatio: 1.5 }),
    ).toBe(1.5);
    expect(
      computeEffectivePixelRatio(3, { hardCapRatio: 1.25, variantCapRatio: 1.5 }),
    ).toBe(1.25);
  });

  it('honors an overridden hard cap when no variant cap is set', () => {
    expect(computeEffectivePixelRatio(3, { hardCapRatio: 2.5 })).toBe(2.5);
  });
});
