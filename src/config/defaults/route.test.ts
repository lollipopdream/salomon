import { describe, expect, it } from 'vitest';

import { routeHeadMarkerDefaults, routeVisualDefaults } from './route';

describe('routeVisualDefaults', () => {
  it('uses the C2 amber hero-line palette and weight', () => {
    expect(routeVisualDefaults.baseLayer).toEqual({
      color: 0xf7c56b,
      opacity: 0.9,
      widthPx: 2,
    });
    expect(routeVisualDefaults.coreWidthPx).toBe(3.6);
    expect(routeVisualDefaults.haloLayers).toEqual([
      { widthPx: 7.0, opacity: 0.32, color: 0xffb84d },
      { widthPx: 11, opacity: 0.14, color: 0xffb84d },
    ]);
    expect(routeHeadMarkerDefaults.glowOpacity).toBe(0.28);
  });

  it('uses a core width below the pre-CV1.1 baseline (B5: thinner, less dominant line)', () => {
    const preCv11CoreWidthPx = 4.5; // Baseline from MV3/VDv2 before CV1-T2.

    expect(routeVisualDefaults.coreWidthPx).toBeLessThan(preCv11CoreWidthPx);
  });

  it('uses halo widths below their pre-CV1.1 baselines (B5: halo does not dominate the core)', () => {
    const preCv11HaloWidthsPx = [
      12, // First halo baseline before CV1-T2.
      24, // Second halo baseline before CV1-T2.
    ];

    expect(routeVisualDefaults.haloLayers).toHaveLength(
      preCv11HaloWidthsPx.length,
    );
    routeVisualDefaults.haloLayers.forEach((layer, index) => {
      expect(layer.widthPx).toBeLessThan(preCv11HaloWidthsPx[index]);
    });
  });

  it('keeps the always-visible base layer dimmer than the active core (B2: full-route context, not a competing highlight)', () => {
    expect(routeVisualDefaults.baseLayer.opacity).toBeLessThan(1);
    expect(routeVisualDefaults.baseLayer.widthPx).toBeLessThan(
      routeVisualDefaults.coreWidthPx,
    );
  });

  it('keeps all widths positive and halo opacities in the valid range', () => {
    expect(routeVisualDefaults.coreWidthPx).toBeGreaterThan(0);

    routeVisualDefaults.haloLayers.forEach(({ opacity, widthPx }) => {
      expect(widthPx).toBeGreaterThan(0);
      expect(opacity).toBeGreaterThan(0);
      expect(opacity).toBeLessThanOrEqual(1);
    });
  });
});
