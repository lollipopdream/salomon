import { describe, expect, it } from 'vitest';
import { Line2 } from 'three/addons/lines/Line2.js';

import { routeVisualDefaults } from '../config/defaults/route';
import type { RouteVisualConfig, Vec3 } from '../types';
import {
  computeRouteLineLayers,
  createRouteVisual,
  shouldShowRouteVisual,
} from './routeVisual';

const config: RouteVisualConfig = {
  baseLayer: { color: 0x8d918b, opacity: 0.12, widthPx: 2.5 },
  coreColor: 0xffffff,
  coreWidthPx: 3,
  haloLayers: [
    { widthPx: 8, opacity: 0.35, color: 0x00aaff },
    { widthPx: 16, opacity: 0.15, color: 0x0044ff },
    { widthPx: 12, opacity: 0.25, color: 0x0088ff },
  ],
};

describe('computeRouteLineLayers', () => {
  it('keeps the tuned C2 base/core/halo hierarchy restrained', () => {
    expect(routeVisualDefaults.baseLayer).toMatchObject({
      widthPx: 2,
      opacity: 0.9,
    });
    expect(routeVisualDefaults.coreWidthPx).toBe(3.6);
    expect(routeVisualDefaults.haloLayers).toMatchObject([
      { widthPx: 7.0, opacity: 0.32 },
      { widthPx: 11, opacity: 0.14 },
    ]);

    expect(routeVisualDefaults.baseLayer.widthPx).toBeLessThan(
      routeVisualDefaults.coreWidthPx,
    );
    expect(routeVisualDefaults.coreWidthPx).toBeLessThan(
      routeVisualDefaults.haloLayers[0].widthPx,
    );
    expect(routeVisualDefaults.haloLayers[0].widthPx).toBeLessThan(
      routeVisualDefaults.haloLayers[1].widthPx,
    );
  });

  it('sorts halo layers by descending width and puts the core last', () => {
    expect(computeRouteLineLayers(config).map(({ role, widthPx }) => ({
      role,
      widthPx,
    }))).toEqual([
      { role: 'halo', widthPx: 16 },
      { role: 'halo', widthPx: 12 },
      { role: 'halo', widthPx: 8 },
      { role: 'core', widthPx: 3 },
    ]);
  });

  it('returns one layer per halo plus one core layer', () => {
    expect(computeRouteLineLayers(config)).toHaveLength(
      config.haloLayers.length + 1,
    );
  });

  it('preserves each configured color, opacity, and width', () => {
    expect(computeRouteLineLayers(config)).toEqual([
      {
        role: 'halo',
        widthPx: 16,
        opacity: 0.15,
        color: 0x0044ff,
      },
      {
        role: 'halo',
        widthPx: 12,
        opacity: 0.25,
        color: 0x0088ff,
      },
      {
        role: 'halo',
        widthPx: 8,
        opacity: 0.35,
        color: 0x00aaff,
      },
      {
        role: 'core',
        widthPx: 3,
        opacity: 1,
        color: 0xffffff,
      },
    ]);
  });
});

describe('shouldShowRouteVisual', () => {
  it('returns false for zero points', () => {
    expect(shouldShowRouteVisual(0)).toBe(false);
  });

  it('returns false for one point', () => {
    expect(shouldShowRouteVisual(1)).toBe(false);
  });

  it('returns true for two points', () => {
    expect(shouldShowRouteVisual(2)).toBe(true);
  });

  it('returns true for 46 points', () => {
    expect(shouldShowRouteVisual(46)).toBe(true);
  });
});

describe('createRouteVisual', () => {
  it('keeps the base layer at full route length when active points change', () => {
    const maxRoutePoints: Vec3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 5, y: 2, z: 1 },
      { x: 12, y: 4, z: 3 },
      { x: 20, y: 7, z: 6 },
    ];
    const routeVisual = createRouteVisual(config, maxRoutePoints);
    const baseLine = routeVisual.object3D.children.find(
      (child) => child.name === 'route-base',
    ) as Line2;

    expect(baseLine).toBeInstanceOf(Line2);
    expect(baseLine.visible).toBe(true);
    expect(baseLine.geometry.instanceCount + 1).toBe(maxRoutePoints.length);

    routeVisual.updatePoints([]);
    expect(baseLine.visible).toBe(true);
    expect(baseLine.geometry.instanceCount + 1).toBe(maxRoutePoints.length);

    routeVisual.updatePoints(maxRoutePoints.slice(0, 2));
    expect(baseLine.visible).toBe(true);
    expect(baseLine.geometry.instanceCount + 1).toBe(maxRoutePoints.length);
  });
});
