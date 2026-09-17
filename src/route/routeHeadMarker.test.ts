import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { computeRouteFollowAnchor } from '../camera/routeFollowCamera';
import type { RouteHeadMarkerConfig } from '../types';
import {
  computeRouteDirectionDashOpacity,
  computeRouteDirectionDashTransforms,
  computeRouteHeadMarkerTransform,
  createRouteHeadMarker,
} from './routeHeadMarker';

const config: RouteHeadMarkerConfig = {
  enabled: true,
  radiusMeters: 1.8,
  color: 0xffffff,
  glowRadiusMeters: 3.2,
  glowOpacity: 0.14,
  directionCue: {
    dashCount: 3,
    spacingMeters: 15,
    radiusMeters: 0.7,
    minOpacity: 0.12,
    maxOpacity: 0.48,
    pulsePeriodMs: 1_800,
    phaseStep: 0.22,
  },
};

const routePoints = [
  { x: 0, y: 10, z: 0 },
  { x: 30, y: 20, z: 0 },
  { x: 30, y: 30, z: 40 },
];
const cumulativeDistances = [0, 30, 70];

describe('computeRouteHeadMarkerTransform', () => {
  it('copies the supplied camera anchor and shows it during route-follow', () => {
    const anchor = { x: 120, y: 640, z: 80 };

    const transform = computeRouteHeadMarkerTransform(0.42, anchor, config);

    expect(transform).toEqual({ position: anchor, visible: true });
    expect(transform.position).not.toBe(anchor);
  });

  it('hides the marker at both route boundaries', () => {
    const anchor = { x: 0, y: 0, z: 0 };

    expect(computeRouteHeadMarkerTransform(0, anchor, config).visible).toBe(
      false,
    );
    expect(computeRouteHeadMarkerTransform(-0.1, anchor, config).visible).toBe(
      false,
    );
    expect(computeRouteHeadMarkerTransform(1, anchor, config).visible).toBe(
      false,
    );
    expect(computeRouteHeadMarkerTransform(1.1, anchor, config).visible).toBe(
      false,
    );
  });

  it('honors the enabled setting without changing the anchor', () => {
    const anchor = { x: 4, y: 5, z: 6 };
    const transform = computeRouteHeadMarkerTransform(0.5, anchor, {
      ...config,
      enabled: false,
    });

    expect(transform).toEqual({ position: anchor, visible: false });
  });
});

describe('computeRouteDirectionDashTransforms', () => {
  it('places every dash at the exact shared route anchor for its meter offset', () => {
    const progress = 0.2;
    const transforms = computeRouteDirectionDashTransforms(
      routePoints,
      cumulativeDistances,
      progress,
      config,
    );

    expect(transforms).toHaveLength(config.directionCue.dashCount);
    transforms.forEach((transform, index) => {
      const offsetProgress =
        ((index + 1) * config.directionCue.spacingMeters) / 70;
      const expectedPosition = computeRouteFollowAnchor(
        routePoints,
        cumulativeDistances,
        progress + offsetProgress,
      );

      expect(transform).toEqual({
        position: expectedPosition,
        visible: true,
      });
    });
  });

  it('hides offsets beyond the route end and all dashes outside route-follow', () => {
    const nearEnd = computeRouteDirectionDashTransforms(
      routePoints,
      cumulativeDistances,
      0.7,
      config,
    );

    expect(nearEnd.map(({ visible }) => visible)).toEqual([
      true,
      false,
      false,
    ]);
    expect(nearEnd[1]?.position).toBeUndefined();
    expect(nearEnd[2]?.position).toBeUndefined();

    for (const progress of [-0.1, 0, 1, 1.1]) {
      const transforms = computeRouteDirectionDashTransforms(
        routePoints,
        cumulativeDistances,
        progress,
        config,
      );
      expect(transforms.every(({ visible }) => !visible)).toBe(true);
      expect(transforms.every(({ position }) => position === undefined)).toBe(
        true,
      );
    }
  });

  it('keeps progress-driven positions independent from time-driven opacity', () => {
    const firstPositions = computeRouteDirectionDashTransforms(
      routePoints,
      cumulativeDistances,
      0.2,
      config,
    );
    const firstOpacity = computeRouteDirectionDashOpacity(0, 1, config);
    const secondPositions = computeRouteDirectionDashTransforms(
      routePoints,
      cumulativeDistances,
      0.2,
      config,
    );
    const secondOpacity = computeRouteDirectionDashOpacity(900, 1, config);

    expect(firstOpacity).not.toBe(secondOpacity);
    expect(firstPositions).toEqual(secondPositions);
  });
});

describe('createRouteHeadMarker', () => {
  it('updates position and visibility without requiring a renderer', () => {
    const scene = new THREE.Scene();
    const marker = createRouteHeadMarker({ scene, config });

    expect(scene.children).toContain(marker.object3D);
    expect(marker.object3D.visible).toBe(false);

    marker.updatePosition({ x: 12, y: 34, z: 56 }, true);
    expect(marker.object3D.position.toArray()).toEqual([12, 34, 56]);
    expect(marker.object3D.visible).toBe(true);

    marker.updatePosition({ x: 1, y: 2, z: 3 }, false);
    expect(marker.object3D.position.toArray()).toEqual([1, 2, 3]);
    expect(marker.object3D.visible).toBe(false);

    marker.dispose();
    expect(scene.children).not.toContain(marker.object3D);
  });
});
