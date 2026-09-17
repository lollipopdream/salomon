import { describe, expect, it } from 'vitest';

import { routeVisualDefaults } from '../config/defaults/route';
import {
  createWhiteThickRoutePreset,
  R11_ROUTE_HALO_OPACITY_SCALE,
  R11_ROUTE_HALO_WIDTH_SCALE,
  R11_ROUTE_WIDTH_SCALE,
  resolveRouteStyleFlags,
} from './r11RouteStylePreset';

describe('resolveRouteStyleFlags', () => {
  it('enables whiteThick only for ?routeWhite=1', () => {
    expect(resolveRouteStyleFlags(new URLSearchParams('?routeWhite=1'))).toEqual({
      whiteThick: true,
    });

    for (const query of [
      'routeWhite=0',
      'routeWhite=true',
      'routeWhite=',
      '',
    ]) {
      expect(resolveRouteStyleFlags(new URLSearchParams(query))).toEqual({
        whiteThick: false,
      });
    }
  });
});

describe('createWhiteThickRoutePreset', () => {
  it('creates the fixed white, thick preview without changing defaults', () => {
    const defaultsBefore = structuredClone(routeVisualDefaults);

    const preset = createWhiteThickRoutePreset(routeVisualDefaults);

    expect(routeVisualDefaults).toEqual(defaultsBefore);

    // 実線部は厳密 2 倍。
    expect(preset.baseLayer).toEqual({ color: 0xffffff, opacity: 0.9, widthPx: 4 });
    expect(preset.coreColor).toBe(0xffffff);
    expect(preset.coreWidthPx).toBe(7.2);

    // halo は光彩へ戻すため実線部より控えめな倍率と opacity にする。
    expect(preset.haloLayers).toHaveLength(2);
    expect(preset.haloLayers[0].color).toBe(0xffffff);
    expect(preset.haloLayers[0].widthPx).toBeCloseTo(11.2, 10);
    expect(preset.haloLayers[0].opacity).toBeCloseTo(0.176, 10);
    expect(preset.haloLayers[1].color).toBe(0xffffff);
    expect(preset.haloLayers[1].widthPx).toBeCloseTo(17.6, 10);
    expect(preset.haloLayers[1].opacity).toBeCloseTo(0.077, 10);
  });

  it('makes every layer white, doubles the solid widths and tames the halo', () => {
    const preset = createWhiteThickRoutePreset(routeVisualDefaults);

    expect(preset.baseLayer.color).toBe(0xffffff);
    expect(preset.coreColor).toBe(0xffffff);
    expect(preset.haloLayers.every((layer) => layer.color === 0xffffff)).toBe(true);

    // base / core は厳密 2 倍（「明確に太い」の本体）。
    expect(preset.baseLayer.widthPx).toBe(
      routeVisualDefaults.baseLayer.widthPx * R11_ROUTE_WIDTH_SCALE,
    );
    expect(preset.coreWidthPx).toBe(
      routeVisualDefaults.coreWidthPx * R11_ROUTE_WIDTH_SCALE,
    );

    // halo は実線部より細く、かつ元より薄い。
    // POI ラベル板への白かぶりと switchback 密集部の塊状化を抑えるため。
    preset.haloLayers.forEach((layer, index) => {
      const source = routeVisualDefaults.haloLayers[index];
      expect(layer.widthPx).toBeCloseTo(source.widthPx * R11_ROUTE_HALO_WIDTH_SCALE, 10);
      expect(layer.opacity).toBeCloseTo(source.opacity * R11_ROUTE_HALO_OPACITY_SCALE, 10);
      expect(layer.widthPx).toBeGreaterThan(source.widthPx);
      expect(layer.widthPx).toBeLessThan(source.widthPx * R11_ROUTE_WIDTH_SCALE);
      expect(layer.opacity).toBeLessThan(source.opacity);
    });
  });

  it('preserves the halo input order in a new array', () => {
    const preset = createWhiteThickRoutePreset(routeVisualDefaults);

    expect(preset).not.toBe(routeVisualDefaults);
    expect(preset.haloLayers).not.toBe(routeVisualDefaults.haloLayers);
    // opacity は一律に縮小されるため値そのものは一致しないが、
    // 入力の並び（幅の相対順）は保たれていること。routeVisual.ts 側が
    // 幅の降順へ sort するので、ここで並べ替えてはいけない。
    const inputOrder = routeVisualDefaults.haloLayers.map((layer) => layer.widthPx);
    const presetOrder = preset.haloLayers.map((layer) => layer.widthPx);
    expect(presetOrder.map((w, i) => w / inputOrder[i])).toEqual(
      presetOrder.map(() => R11_ROUTE_HALO_WIDTH_SCALE),
    );
  });
});
