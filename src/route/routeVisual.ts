import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

import type { RouteVisualConfig, Vec3 } from '../types';

export interface RouteLineLayer {
  role: 'core' | 'halo';
  widthPx: number;
  opacity: number;
  color: number;
}

export interface RouteVisual {
  object3D: THREE.Group;
  updatePoints(points: Vec3[]): void;
}

export function computeRouteLineLayers(
  config: RouteVisualConfig,
): RouteLineLayer[] {
  const haloLayers: RouteLineLayer[] = [...config.haloLayers]
    .sort((a, b) => b.widthPx - a.widthPx)
    .map((layer) => ({
      role: 'halo',
      widthPx: layer.widthPx,
      opacity: layer.opacity,
      color: layer.color,
    }));

  return [
    ...haloLayers,
    {
      role: 'core',
      widthPx: config.coreWidthPx,
      opacity: 1,
      color: config.coreColor,
    },
  ];
}

export function shouldShowRouteVisual(pointsLength: number): boolean {
  return pointsLength >= 2;
}

export function createRouteVisual(
  config: RouteVisualConfig,
  maxRoutePoints: Vec3[],
): RouteVisual {
  const object3D = new THREE.Group();
  const maxSegments = Math.max(maxRoutePoints.length - 1, 0);
  const baseGeometry = new LineGeometry();
  // The muted base is allocated and populated once with the complete route. It
  // remains unchanged while the active layers advance during route-follow.
  (baseGeometry.setFromPoints as (pointLikes: Vec3[]) => LineGeometry)(
    maxRoutePoints,
  );
  const baseMaterial = new LineMaterial({
    worldUnits: false,
    linewidth: config.baseLayer.widthPx,
    color: config.baseLayer.color,
    fog: false,
    depthTest: true,
    depthWrite: false,
    transparent: true,
    opacity: config.baseLayer.opacity,
  });
  const baseLine = new Line2(baseGeometry, baseMaterial);
  baseLine.name = 'route-base';
  baseLine.visible = shouldShowRouteVisual(maxRoutePoints.length);
  object3D.add(baseLine);

  const lineLayers = computeRouteLineLayers(config).map((layer) => {
    const geometry = new LineGeometry();
    // Allocate each interleaved segment buffer only once. Calling setFromPoints
    // again replaces it and leaves WebGLRenderer bound to the initial buffer.
    (geometry.setFromPoints as (pointLikes: Vec3[]) => LineGeometry)(
      maxRoutePoints,
    );
    const material = new LineMaterial({
      worldUnits: false,
      linewidth: layer.widthPx,
      color: layer.color,
      fog: false,
      depthTest: true,
      depthWrite: false,
      transparent: layer.role === 'halo',
      opacity: layer.role === 'halo' ? layer.opacity : 1,
      ...(layer.role === 'halo'
        ? { blending: THREE.AdditiveBlending }
        : {}),
    });
    const line = new Line2(geometry, material);
    line.name = `route-${layer.role}`;
    line.visible = false;

    object3D.add(line);

    return { geometry, line };
  });

  return {
    object3D,
    updatePoints(points: Vec3[]): void {
      const visible = shouldShowRouteVisual(points.length);

      for (const { line } of lineLayers) {
        line.visible = visible;
      }

      if (!visible) {
        return;
      }

      const segmentCount = Math.min(points.length - 1, maxSegments);

      for (const { geometry } of lineLayers) {
        const instanceStart = geometry.getAttribute(
          'instanceStart',
        ) as THREE.InterleavedBufferAttribute;
        const interleaved =
          instanceStart.data as THREE.InstancedInterleavedBuffer;
        const array = interleaved.array as Float32Array;

        for (let i = 0; i < segmentCount; i += 1) {
          const start = points[i];
          const end = points[i + 1];
          const offset = i * 6;

          array[offset] = start.x;
          array[offset + 1] = start.y;
          array[offset + 2] = start.z;
          array[offset + 3] = end.x;
          array[offset + 4] = end.y;
          array[offset + 5] = end.z;
        }

        interleaved.needsUpdate = true;
        geometry.instanceCount = segmentCount;
      }
    },
  };
}
