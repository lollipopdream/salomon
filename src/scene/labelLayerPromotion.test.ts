import { describe, expect, it } from 'vitest';

import { resolveLabelLayerPromotionFlags } from './labelLayerPromotion';

describe('resolveLabelLayerPromotionFlags', () => {
  it('does not promote label layers when the query is unspecified', () => {
    expect(
      resolveLabelLayerPromotionFlags(new URLSearchParams(), true),
    ).toEqual({ promoteLabelLayers: false });
  });

  it('allows development-only opt-in with labelLayerPromote=1', () => {
    expect(
      resolveLabelLayerPromotionFlags(
        new URLSearchParams('labelLayerPromote=1'),
        true,
      ),
    ).toEqual({ promoteLabelLayers: true });
  });

  it('does not allow the opt-in in production', () => {
    expect(
      resolveLabelLayerPromotionFlags(
        new URLSearchParams('labelLayerPromote=1'),
        false,
      ),
    ).toEqual({ promoteLabelLayers: false });
  });

  it('does not promote for labelLayerPromote=0', () => {
    expect(
      resolveLabelLayerPromotionFlags(
        new URLSearchParams('labelLayerPromote=0'),
        true,
      ),
    ).toEqual({ promoteLabelLayers: false });
  });

  it.each(['', 'x', 'true'])('does not promote for labelLayerPromote=%j', (value) => {
    expect(
      resolveLabelLayerPromotionFlags(
        new URLSearchParams(`labelLayerPromote=${value}`),
        true,
      ),
    ).toEqual({ promoteLabelLayers: false });
  });

  it('uses only the first value returned by URLSearchParams.get', () => {
    expect(
      resolveLabelLayerPromotionFlags(
        new URLSearchParams(
          'labelLayerPromote=0&labelLayerPromote=1',
        ),
        true,
      ),
    ).toEqual({ promoteLabelLayers: false });

    expect(
      resolveLabelLayerPromotionFlags(
        new URLSearchParams(
          'labelLayerPromote=1&labelLayerPromote=0',
        ),
        true,
      ),
    ).toEqual({ promoteLabelLayers: true });
  });
});
