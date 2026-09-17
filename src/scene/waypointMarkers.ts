import * as THREE from 'three';

import { SPOT_ARRIVAL_VISUAL_DEFAULTS } from '../config/defaults/spotArrival';
import type { SpotArrivalState } from '../route/spotArrival';
import type { Vec3, WaypointMarkerConfig } from '../types';

export interface WaypointMarkerTransform {
  position: Vec3;
  head: {
    position: Vec3;
    scale: Vec3;
  };
  pole: {
    position: Vec3;
    scale: Vec3;
  };
  shadow: {
    position: Vec3;
    scale: Vec3;
  };
  glow?: {
    position: Vec3;
    scale: Vec3;
  };
  beaconRing?: {
    position: Vec3;
    scale: Vec3;
  };
}

export interface WaypointMarkers {
  object3D: THREE.Group;
  updateArrivalStates(states: SpotArrivalState[], elapsedMs: number): void;
  dispose(): void;
}

export interface CreateWaypointMarkersOptions {
  scene: THREE.Scene;
  anchors: Array<{ anchor: Vec3; displayText: string; poiId: string }>;
  config: WaypointMarkerConfig;
}

interface ArrivalMarkerMeshes {
  poiId: string;
  head: THREE.Mesh;
  headBaseScale: THREE.Vector3;
  glow?: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  glowBaseScale?: THREE.Vector3;
  glowBaseOpacity?: number;
  beaconRing?: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  beaconRingBaseScale?: THREE.Vector3;
  beaconRingBaseOpacity?: number;
}

const ARRIVAL_OPACITY_BOOST = 1.5;

function clampIntensity(intensity: number): number {
  return THREE.MathUtils.clamp(intensity, 0, 1);
}

function setMeshScale(
  mesh: THREE.Mesh,
  baseScale: THREE.Vector3,
  multiplier: number,
): void {
  mesh.scale.set(
    baseScale.x * multiplier,
    baseScale.y * multiplier,
    baseScale.z * multiplier,
  );
}

export function isEmphasizedPoi(
  poiId: string,
  config: WaypointMarkerConfig,
): boolean {
  return config.emphasizedPoiIds?.includes(poiId) ?? false;
}

export function resolveEmphasisScaleMultiplier(
  poiId: string,
  config: WaypointMarkerConfig,
): number {
  return isEmphasizedPoi(poiId, config)
    ? (config.emphasis?.scaleMultiplier ?? 1.15)
    : 1;
}

export function resolveEmphasisOpacityMultipliers(
  poiId: string,
  config: WaypointMarkerConfig,
): { glow: number; beacon: number } {
  if (!isEmphasizedPoi(poiId, config)) return { glow: 1, beacon: 1 };
  return {
    glow: config.emphasis?.glowOpacityMultiplier ?? 1.3,
    beacon: config.emphasis?.beaconOpacityMultiplier ?? 1.2,
  };
}

export function computeMarkerTransform(
  anchor: Vec3,
  config: WaypointMarkerConfig,
): WaypointMarkerTransform {
  const poleRadiusFactor = config.style === 'pin-stand' ? 0.1 : 0.08;
  const headDepthFactor = config.style === 'pin-stand' ? 0.36 : 0.18;
  const shadowRadiusFactor = config.style === 'pin-stand' ? 0.75 : 0.7;

  const transform: WaypointMarkerTransform = {
    position: { ...anchor },
    head: {
      position: {
        x: 0,
        y: config.standHeightMeters + config.headRadiusMeters,
        z: 0,
      },
      scale: {
        x: config.headRadiusMeters,
        y: config.headRadiusMeters,
        z: config.headRadiusMeters * headDepthFactor,
      },
    },
    pole: {
      position: { x: 0, y: config.standHeightMeters / 2, z: 0 },
      scale: {
        x: config.headRadiusMeters * poleRadiusFactor,
        y: config.standHeightMeters,
        z: config.headRadiusMeters * poleRadiusFactor,
      },
    },
    shadow: {
      position: { x: 0, y: 0.2, z: 0 },
      scale: {
        x: config.headRadiusMeters * shadowRadiusFactor,
        y: config.headRadiusMeters * shadowRadiusFactor,
        z: 1,
      },
    },
  };

  if (config.glow?.enabled) {
    const glowRadius = config.headRadiusMeters * config.glow.radiusFactor;
    transform.glow = {
      position: { ...transform.head.position },
      scale: { x: glowRadius, y: glowRadius, z: glowRadius },
    };
  }

  if (config.beaconRing?.enabled) {
    transform.beaconRing = {
      position: { ...transform.shadow.position },
      // The ring geometry uses the configured radii directly.
      scale: { x: 1, y: 1, z: 1 },
    };
  }

  return transform;
}

export function createWaypointMarkers(
  options: CreateWaypointMarkersOptions,
): WaypointMarkers {
  const { scene, anchors, config } = options;
  const object3D = new THREE.Group();
  object3D.name = 'waypoint-markers';
  scene.add(object3D);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const arrivalMarkers: ArrivalMarkerMeshes[] = [];

  if (config.enabled) {
    switch (config.style) {
      case 'pin-stand': {
        const headGeometry = new THREE.SphereGeometry(1, 24, 16);
        const poleGeometry = new THREE.CylinderGeometry(1, 1, 1, 12);
        const badgeGeometry = new THREE.CircleGeometry(1, 24);
        const shadowGeometry = new THREE.CircleGeometry(1, 24);
        shadowGeometry.rotateX(-Math.PI / 2);
        const glowGeometry = config.glow?.enabled
          ? new THREE.SphereGeometry(1, 20, 12)
          : undefined;
        const beaconRingGeometry = config.beaconRing?.enabled
          ? new THREE.RingGeometry(
              config.headRadiusMeters * config.beaconRing.innerRadiusFactor,
              config.headRadiusMeters * config.beaconRing.outerRadiusFactor,
              32,
            )
          : undefined;
        beaconRingGeometry?.rotateX(-Math.PI / 2);
        geometries.push(
          headGeometry,
          poleGeometry,
          badgeGeometry,
          shadowGeometry,
        );
        if (glowGeometry) {
          geometries.push(glowGeometry);
        }
        if (beaconRingGeometry) {
          geometries.push(beaconRingGeometry);
        }

        const markerMaterial = new THREE.MeshStandardMaterial({
          color: config.color,
          roughness: 0.6,
          metalness: 0.05,
        });
        const badgeMaterial = new THREE.MeshBasicMaterial({
          color: 0x20252b,
          depthWrite: false,
        });
        const shadowMaterial = new THREE.MeshBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
        });
        materials.push(markerMaterial, badgeMaterial, shadowMaterial);
        const glowMaterial = config.glow?.enabled
          ? new THREE.MeshBasicMaterial({
              color: config.glow.color,
              transparent: true,
              opacity: config.glow.opacity,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
              depthTest: true,
            })
          : undefined;
        const beaconRingMaterial = config.beaconRing?.enabled
          ? new THREE.MeshBasicMaterial({
              color: config.beaconRing.color,
              transparent: true,
              opacity: config.beaconRing.opacity,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
              depthTest: true,
            })
          : undefined;
        if (glowMaterial) {
          materials.push(glowMaterial);
        }
        if (beaconRingMaterial) {
          materials.push(beaconRingMaterial);
        }

        for (const { anchor, displayText, poiId } of anchors) {
          const transform = computeMarkerTransform(anchor, config);
          const opacityMultipliers = resolveEmphasisOpacityMultipliers(
            poiId,
            config,
          );
          const marker = new THREE.Group();
          marker.name = `waypoint-marker:${displayText}`;
          marker.position.set(
            transform.position.x,
            transform.position.y,
            transform.position.z,
          );

          const pole = new THREE.Mesh(poleGeometry, markerMaterial);
          pole.position.set(
            transform.pole.position.x,
            transform.pole.position.y,
            transform.pole.position.z,
          );
          pole.scale.set(
            transform.pole.scale.x,
            transform.pole.scale.y,
            transform.pole.scale.z,
          );

          const head = new THREE.Mesh(headGeometry, markerMaterial);
          head.name = 'waypoint-marker-head';
          head.position.set(
            transform.head.position.x,
            transform.head.position.y,
            transform.head.position.z,
          );
          head.scale.set(
            transform.head.scale.x,
            transform.head.scale.y,
            transform.head.scale.z,
          );

          const markerGlowMaterial = glowMaterial?.clone();
          if (markerGlowMaterial) {
            markerGlowMaterial.opacity *= opacityMultipliers.glow;
            materials.push(markerGlowMaterial);
          }
          const glow =
            glowGeometry && markerGlowMaterial && transform.glow
              ? new THREE.Mesh(glowGeometry, markerGlowMaterial)
              : undefined;
          if (glow && transform.glow) {
            glow.name = 'waypoint-marker-glow';
            glow.position.set(
              transform.glow.position.x,
              transform.glow.position.y,
              transform.glow.position.z,
            );
            glow.scale.set(
              transform.glow.scale.x,
              transform.glow.scale.y,
              transform.glow.scale.z,
            );
          }

          const badge = new THREE.Mesh(badgeGeometry, badgeMaterial);
          badge.position.set(
            transform.head.position.x,
            transform.head.position.y,
            transform.head.position.z + transform.head.scale.z + 0.05,
          );
          badge.scale.setScalar(config.headRadiusMeters * 0.45);

          const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
          shadow.position.set(
            transform.shadow.position.x,
            transform.shadow.position.y,
            transform.shadow.position.z,
          );
          shadow.scale.set(
            transform.shadow.scale.x,
            transform.shadow.scale.y,
            transform.shadow.scale.z,
          );

          const markerBeaconRingMaterial = beaconRingMaterial?.clone();
          if (markerBeaconRingMaterial) {
            markerBeaconRingMaterial.opacity *= opacityMultipliers.beacon;
            materials.push(markerBeaconRingMaterial);
          }
          const beaconRing =
            beaconRingGeometry
            && markerBeaconRingMaterial
            && transform.beaconRing
              ? new THREE.Mesh(beaconRingGeometry, markerBeaconRingMaterial)
              : undefined;
          if (beaconRing && transform.beaconRing) {
            beaconRing.name = 'waypoint-marker-beacon-ring';
            beaconRing.position.set(
              transform.beaconRing.position.x,
              transform.beaconRing.position.y,
              transform.beaconRing.position.z,
            );
            beaconRing.scale.set(
              transform.beaconRing.scale.x,
              transform.beaconRing.scale.y,
              transform.beaconRing.scale.z,
            );
          }

          if (beaconRing) {
            marker.add(beaconRing);
          }
          marker.add(shadow, pole);
          if (glow) {
            marker.add(glow);
          }
          marker.add(head, badge);
          const scaleMultiplier = resolveEmphasisScaleMultiplier(poiId, config);
          if (scaleMultiplier !== 1) {
            marker.scale.setScalar(scaleMultiplier);
          }
          object3D.add(marker);
          arrivalMarkers.push({
            poiId,
            head,
            headBaseScale: head.scale.clone(),
            ...(glow
              ? {
                  glow,
                  glowBaseScale: glow.scale.clone(),
                  glowBaseOpacity: glow.material.opacity,
                }
              : {}),
            ...(beaconRing
              ? {
                  beaconRing,
                  beaconRingBaseScale: beaconRing.scale.clone(),
                  beaconRingBaseOpacity: beaconRing.material.opacity,
                }
              : {}),
          });
        }
        break;
      }
      case 'anchor-box':
        // Reserved for the alternate ArcGIS-inspired direction.
        break;
    }
  }

  return {
    object3D,
    updateArrivalStates(states: SpotArrivalState[], elapsedMs: number): void {
      const hasPrimaryActive = states.some((state) => state.isPrimaryActive);

      for (const marker of arrivalMarkers) {
        const state = states.find(
          (candidate) => candidate.poiId === marker.poiId,
        );
        const intensity = hasPrimaryActive && state !== undefined
          ? clampIntensity(state.intensity)
          : 0;
        const scaleMultiplier = THREE.MathUtils.lerp(
          1,
          SPOT_ARRIVAL_VISUAL_DEFAULTS.markerScalePeak,
          intensity,
        );
        const isPrimaryMarker = state?.isPrimaryActive === true;
        const opacityMultiplier = hasPrimaryActive && !isPrimaryMarker
          ? SPOT_ARRIVAL_VISUAL_DEFAULTS.otherSpotDimOpacity
          : THREE.MathUtils.lerp(1, ARRIVAL_OPACITY_BOOST, intensity);

        setMeshScale(marker.head, marker.headBaseScale, scaleMultiplier);

        if (
          marker.glow
          && marker.glowBaseScale
          && marker.glowBaseOpacity !== undefined
        ) {
          setMeshScale(marker.glow, marker.glowBaseScale, scaleMultiplier);
          marker.glow.material.opacity = Math.min(
            1,
            marker.glowBaseOpacity * opacityMultiplier,
          );
        }

        if (
          marker.beaconRing
          && marker.beaconRingBaseScale
          && marker.beaconRingBaseOpacity !== undefined
        ) {
          const pulseMultiplier = state?.phase === 'arrive'
            ? 1
              + SPOT_ARRIVAL_VISUAL_DEFAULTS.ringPulseAmplitude
                * (0.5
                  + 0.5
                    * Math.cos(
                      (Math.PI * 2 * elapsedMs)
                      / SPOT_ARRIVAL_VISUAL_DEFAULTS.ringPulsePeriodMs,
                    ))
            : 1;
          setMeshScale(
            marker.beaconRing,
            marker.beaconRingBaseScale,
            pulseMultiplier,
          );
          marker.beaconRing.material.opacity = Math.min(
            1,
            marker.beaconRingBaseOpacity * opacityMultiplier,
          );
        }
      }
    },
    dispose(): void {
      scene.remove(object3D);
      for (const geometry of geometries) {
        geometry.dispose();
      }
      for (const material of materials) {
        material.dispose();
      }
    },
  };
}
