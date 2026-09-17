import * as THREE from 'three';

import { computeRouteFollowAnchor } from '../camera/routeFollowCamera';
import type { RouteHeadMarkerConfig, Vec3 } from '../types';

export interface RouteHeadMarkerTransform {
  position: Vec3;
  visible: boolean;
}

export interface RouteDirectionDashTransform {
  position?: Vec3;
  visible: boolean;
}

export interface RouteHeadMarker {
  object3D: THREE.Object3D;
  directionCueObject3D: THREE.Object3D;
  updatePosition(position: Vec3, visible: boolean): void;
  updateDirectionDashes(
    transforms: RouteDirectionDashTransform[],
    elapsedMs: number,
  ): void;
  dispose(): void;
}

export interface CreateRouteHeadMarkerOptions {
  scene: THREE.Scene;
  config: RouteHeadMarkerConfig;
}

/**
 * Keeps route-boundary visibility separate from Three.js integration. The
 * completed marker is hidden so it cannot compete with the summit waypoint.
 */
export function computeRouteHeadMarkerTransform(
  progress: number,
  anchor: Vec3,
  config: RouteHeadMarkerConfig,
): RouteHeadMarkerTransform {
  return {
    position: { ...anchor },
    visible:
      config.enabled &&
      Number.isFinite(progress) &&
      progress > 0 &&
      progress < 1,
  };
}

/**
 * Places fixed-distance dots ahead of the authoritative route-follow progress.
 * Time is deliberately absent: only the separate opacity helper is animated.
 */
export function computeRouteDirectionDashTransforms(
  points: Vec3[],
  cumulativeDistances: number[],
  progress: number,
  config: RouteHeadMarkerConfig,
): RouteDirectionDashTransform[] {
  const totalDistance = cumulativeDistances[cumulativeDistances.length - 1];
  const routeIsActive =
    config.enabled &&
    Number.isFinite(progress) &&
    progress > 0 &&
    progress < 1 &&
    Number.isFinite(totalDistance) &&
    totalDistance > 0;

  return Array.from(
    { length: config.directionCue.dashCount },
    (_, dashIndex) => {
      if (!routeIsActive) {
        return { visible: false };
      }

      const distanceAhead =
        (dashIndex + 1) * config.directionCue.spacingMeters;
      const dashProgress = progress + distanceAhead / totalDistance;
      if (dashProgress > 1) {
        return { visible: false };
      }

      return {
        position: computeRouteFollowAnchor(
          points,
          cumulativeDistances,
          dashProgress,
        ),
        visible: true,
      };
    },
  );
}

/** Gentle cosine pulse, phase-delayed so brightness travels head-to-summit. */
export function computeRouteDirectionDashOpacity(
  elapsedMs: number,
  dashIndex: number,
  config: RouteHeadMarkerConfig,
): number {
  const { minOpacity, maxOpacity, phaseStep, pulsePeriodMs } =
    config.directionCue;
  const rawPhase = elapsedMs / pulsePeriodMs - dashIndex * phaseStep;
  const phase = ((rawPhase % 1) + 1) % 1;
  const pulse = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);

  return minOpacity + (maxOpacity - minOpacity) * pulse;
}

export function createRouteHeadMarker(
  options: CreateRouteHeadMarkerOptions,
): RouteHeadMarker {
  const { scene, config } = options;
  const object3D = new THREE.Group();
  object3D.name = 'route-head-marker';
  object3D.visible = false;
  const directionCueObject3D = new THREE.Group();
  directionCueObject3D.name = 'route-direction-cue';

  const coreGeometry = new THREE.SphereGeometry(
    config.radiusMeters,
    20,
    12,
  );
  const glowGeometry = new THREE.SphereGeometry(
    config.glowRadiusMeters,
    20,
    12,
  );
  const coreMaterial = new THREE.MeshBasicMaterial({
    color: config.color,
    depthTest: true,
    depthWrite: false,
  });
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: config.color,
    transparent: true,
    opacity: config.glowOpacity,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  glow.name = 'route-head-glow';
  glow.renderOrder = 1;

  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  core.name = 'route-head-core';
  core.renderOrder = 2;

  object3D.add(glow, core);
  const dashGeometry = new THREE.SphereGeometry(
    config.directionCue.radiusMeters,
    12,
    8,
  );
  const dashMaterials = Array.from(
    { length: config.directionCue.dashCount },
    () =>
      new THREE.MeshBasicMaterial({
        color: config.color,
        transparent: true,
        opacity: config.directionCue.minOpacity,
        depthTest: true,
        depthWrite: false,
      }),
  );
  const dashes = dashMaterials.map((material, dashIndex) => {
    const dash = new THREE.Mesh(dashGeometry, material);
    dash.name = `route-direction-dash-${dashIndex + 1}`;
    dash.renderOrder = 1;
    dash.visible = false;
    directionCueObject3D.add(dash);
    return dash;
  });
  scene.add(object3D, directionCueObject3D);

  return {
    object3D,
    directionCueObject3D,
    updatePosition(position: Vec3, visible: boolean): void {
      object3D.position.set(position.x, position.y, position.z);
      object3D.visible = config.enabled && visible;
    },
    updateDirectionDashes(
      transforms: RouteDirectionDashTransform[],
      elapsedMs: number,
    ): void {
      dashes.forEach((dash, dashIndex) => {
        const transform = transforms[dashIndex];
        dash.visible =
          config.enabled &&
          transform?.visible === true &&
          transform.position !== undefined;
        if (dash.visible && transform.position) {
          dash.position.set(
            transform.position.x,
            transform.position.y,
            transform.position.z,
          );
        }
        dashMaterials[dashIndex].opacity =
          computeRouteDirectionDashOpacity(elapsedMs, dashIndex, config);
      });
    },
    dispose(): void {
      scene.remove(object3D, directionCueObject3D);
      coreGeometry.dispose();
      glowGeometry.dispose();
      dashGeometry.dispose();
      coreMaterial.dispose();
      glowMaterial.dispose();
      dashMaterials.forEach((material) => material.dispose());
    },
  };
}
