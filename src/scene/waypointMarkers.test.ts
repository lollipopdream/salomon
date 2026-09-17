import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { waypointDefaults } from '../config/defaults/labels';
import { SPOT_ARRIVAL_VISUAL_DEFAULTS } from '../config/defaults/spotArrival';
import {
  createIdleSpotArrivalStates,
  type SpotArrivalState,
} from '../route/spotArrival';
import {
  computeMarkerTransform,
  createWaypointMarkers,
  isEmphasizedPoi,
  resolveEmphasisOpacityMultipliers,
  resolveEmphasisScaleMultiplier,
} from './waypointMarkers';

const pinStandConfig = waypointDefaults;

function createArrivalState(
  poiId: string,
  overrides: Partial<SpotArrivalState> = {},
): SpotArrivalState {
  return {
    poiId,
    tier: 'primary',
    phase: 'idle',
    intensity: 0,
    isActive: false,
    isPrimaryActive: false,
    ...overrides,
  };
}

function getMarkerMesh(
  marker: THREE.Object3D,
  name: string,
): THREE.Mesh {
  const mesh = marker.children.find(
    (child): child is THREE.Mesh => child instanceof THREE.Mesh && child.name === name,
  );
  if (mesh === undefined) {
    throw new Error(`Expected ${name} mesh`);
  }
  return mesh;
}

function getBasicMaterial(mesh: THREE.Mesh): THREE.MeshBasicMaterial {
  if (!(mesh.material instanceof THREE.MeshBasicMaterial)) {
    throw new Error('Expected a MeshBasicMaterial');
  }
  return mesh.material;
}

describe('waypoint marker emphasis', () => {
  it('identifies only POIs included in emphasizedPoiIds', () => {
    const config = {
      ...pinStandConfig,
      emphasizedPoiIds: ['summit'],
    };

    expect(isEmphasizedPoi('summit', config)).toBe(true);
    expect(isEmphasizedPoi('kiyotaki', config)).toBe(false);
    expect(isEmphasizedPoi('summit', {
      ...config,
      emphasizedPoiIds: undefined,
    })).toBe(false);
  });

  it('resolves configured multipliers for emphasized POIs and neutral values otherwise', () => {
    const config = {
      ...pinStandConfig,
      emphasizedPoiIds: ['summit'],
      emphasis: {
        scaleMultiplier: 1.25,
        glowOpacityMultiplier: 1.4,
        beaconOpacityMultiplier: 1.35,
      },
    };

    expect(resolveEmphasisScaleMultiplier('summit', config)).toBe(1.25);
    expect(resolveEmphasisOpacityMultipliers('summit', config)).toEqual({
      glow: 1.4,
      beacon: 1.35,
    });
    expect(resolveEmphasisScaleMultiplier('kiyotaki', config)).toBe(1);
    expect(resolveEmphasisOpacityMultipliers('kiyotaki', config)).toEqual({
      glow: 1,
      beacon: 1,
    });
  });

  it('uses default multipliers when emphasis settings are omitted', () => {
    const config = {
      ...pinStandConfig,
      emphasizedPoiIds: ['summit'],
      emphasis: undefined,
    };

    expect(resolveEmphasisScaleMultiplier('summit', config)).toBe(1.15);
    expect(resolveEmphasisOpacityMultipliers('summit', config)).toEqual({
      glow: 1.3,
      beacon: 1.2,
    });
  });
});

describe('computeMarkerTransform', () => {
  it('deterministically derives pin positions and scales from its anchor and config', () => {
    const transform = computeMarkerTransform(
      { x: 120, y: 640, z: 80 },
      pinStandConfig,
    );

    expect(transform).toMatchObject({
      position: { x: 120, y: 640, z: 80 },
      head: {
        position: { x: 0, y: 12.5, z: 0 },
      },
      pole: {
        position: { x: 0, y: 4.5, z: 0 },
      },
      shadow: {
        position: { x: 0, y: 0.2, z: 0 },
      },
    });
    expect(transform.head.scale).toEqual({ x: 3.5, y: 3.5, z: 1.26 });
    expect(transform.pole.scale.y).toBe(9);
    expect(transform.pole.scale.x).toBeCloseTo(0.35);
    expect(transform.pole.scale.z).toBeCloseTo(0.35);
    expect(transform.shadow.scale).toEqual({ x: 2.625, y: 2.625, z: 1 });
  });

  it('selects distinct shape proportions for the extensible anchor-box style', () => {
    const anchorBoxTransform = computeMarkerTransform(
      { x: 120, y: 640, z: 80 },
      { ...pinStandConfig, style: 'anchor-box' },
    );

    expect(anchorBoxTransform.head.scale.z).toBeCloseTo(0.63);
    expect(anchorBoxTransform.pole.scale.x).toBeCloseTo(0.28);
    expect(anchorBoxTransform.shadow.scale.x).toBeCloseTo(2.45);
  });

  it('derives glow and beacon-ring transforms from their configured factors', () => {
    const transform = computeMarkerTransform(
      { x: 120, y: 640, z: 80 },
      {
        ...pinStandConfig,
        glow: {
          enabled: true,
          color: 0xffd166,
          radiusFactor: 2.2,
          opacity: 0.35,
        },
        beaconRing: {
          enabled: true,
          color: 0xffd166,
          innerRadiusFactor: 3,
          outerRadiusFactor: 4.2,
          opacity: 0.4,
        },
      },
    );

    expect(transform.glow?.position).toEqual({ x: 0, y: 12.5, z: 0 });
    expect(transform.glow?.scale.x).toBeCloseTo(7.7);
    expect(transform.glow?.scale.y).toBeCloseTo(7.7);
    expect(transform.glow?.scale.z).toBeCloseTo(7.7);
    expect(transform.beaconRing).toEqual({
      position: { x: 0, y: 0.2, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    });
  });
});

describe('createWaypointMarkers', () => {
  it('scales only emphasized marker visuals without moving their anchors', () => {
    const scene = new THREE.Scene();
    const config = {
      ...pinStandConfig,
      emphasizedPoiIds: ['summit'],
      emphasis: {
        scaleMultiplier: 1.25,
        glowOpacityMultiplier: 1.4,
        beaconOpacityMultiplier: 1.35,
      },
    };
    const markers = createWaypointMarkers({
      scene,
      anchors: [
        {
          anchor: { x: 120, y: 640, z: 80 },
          displayText: '山頂',
          poiId: 'summit',
        },
        {
          anchor: { x: 140, y: 650, z: 90 },
          displayText: '清滝駅',
          poiId: 'kiyotaki',
        },
      ],
      config,
    });
    const emphasizedMarker = markers.object3D.children[0];
    const regularMarker = markers.object3D.children[1];

    expect(emphasizedMarker.scale.toArray()).toEqual([1.25, 1.25, 1.25]);
    expect(regularMarker.scale.toArray()).toEqual([1, 1, 1]);
    expect(emphasizedMarker.position.toArray()).toEqual([120, 640, 80]);
    expect(regularMarker.position.toArray()).toEqual([140, 650, 90]);
    expect(getBasicMaterial(
      getMarkerMesh(emphasizedMarker, 'waypoint-marker-glow'),
    ).opacity).toBeCloseTo(config.glow!.opacity * 1.4);
    expect(getBasicMaterial(
      getMarkerMesh(emphasizedMarker, 'waypoint-marker-beacon-ring'),
    ).opacity).toBeCloseTo(config.beaconRing!.opacity * 1.35);
    expect(getBasicMaterial(
      getMarkerMesh(regularMarker, 'waypoint-marker-glow'),
    ).opacity).toBeCloseTo(config.glow!.opacity);
    expect(getBasicMaterial(
      getMarkerMesh(regularMarker, 'waypoint-marker-beacon-ring'),
    ).opacity).toBeCloseTo(config.beaconRing!.opacity);

    markers.dispose();
  });

  it('preserves the legacy four-child pin structure without glow or beacon-ring config', () => {
    const scene = new THREE.Scene();
    const markers = createWaypointMarkers({
      scene,
      anchors: [{
        anchor: { x: 120, y: 640, z: 80 },
        displayText: '清滝駅',
        poiId: 'kiyotaki',
      }],
      config: {
        ...pinStandConfig,
        glow: undefined,
        beaconRing: undefined,
      },
    });

    expect(markers.object3D.children).toHaveLength(1);
    expect(markers.object3D.children[0].children).toHaveLength(4);
    expect(markers.object3D.children[0].children.map((child) => child.type)).toEqual([
      'Mesh',
      'Mesh',
      'Mesh',
      'Mesh',
    ]);

    markers.dispose();
  });

  it('scales the matching marker and its glow from arrival intensity', () => {
    const scene = new THREE.Scene();
    const markers = createWaypointMarkers({
      scene,
      anchors: [{
        anchor: { x: 120, y: 640, z: 80 },
        displayText: '清滝駅',
        poiId: 'kiyotaki',
      }],
      config: pinStandConfig,
    });
    const marker = markers.object3D.children[0];
    const head = getMarkerMesh(marker, 'waypoint-marker-head');
    const glow = getMarkerMesh(marker, 'waypoint-marker-glow');
    const ring = getMarkerMesh(marker, 'waypoint-marker-beacon-ring');
    const initialHeadScale = head.scale.x;
    const initialGlowScale = glow.scale.x;
    const initialRingScale = ring.scale.x;

    markers.updateArrivalStates([
      createArrivalState('kiyotaki', {
        phase: 'arrive',
        intensity: 0.5,
        isActive: true,
        isPrimaryActive: true,
      }),
    ], 0);

    const expectedScale = THREE.MathUtils.lerp(
      1,
      SPOT_ARRIVAL_VISUAL_DEFAULTS.markerScalePeak,
      0.5,
    );
    expect(head.scale.x).toBeCloseTo(initialHeadScale * expectedScale);
    expect(glow.scale.x).toBeCloseTo(initialGlowScale * expectedScale);
    expect(head.scale.x).toBeGreaterThan(initialHeadScale);
    expect(head.scale.x).toBeLessThanOrEqual(
      initialHeadScale * SPOT_ARRIVAL_VISUAL_DEFAULTS.markerScalePeak,
    );
    expect(ring.scale.x).toBeCloseTo(
      initialRingScale * (1 + SPOT_ARRIVAL_VISUAL_DEFAULTS.ringPulseAmplitude),
    );

    markers.dispose();
  });

  it('dims non-primary marker glow and beacon-ring opacity during an arrival', () => {
    const scene = new THREE.Scene();
    const markers = createWaypointMarkers({
      scene,
      anchors: [
        {
          anchor: { x: 120, y: 640, z: 80 },
          displayText: '清滝駅',
          poiId: 'kiyotaki',
        },
        {
          anchor: { x: 140, y: 640, z: 80 },
          displayText: '山頂',
          poiId: 'summit',
        },
      ],
      config: pinStandConfig,
    });
    const otherMarker = markers.object3D.children[1];
    const otherGlow = getBasicMaterial(
      getMarkerMesh(otherMarker, 'waypoint-marker-glow'),
    );
    const otherRing = getBasicMaterial(
      getMarkerMesh(otherMarker, 'waypoint-marker-beacon-ring'),
    );
    const primaryMarker = markers.object3D.children[0];
    const primaryGlow = getBasicMaterial(
      getMarkerMesh(primaryMarker, 'waypoint-marker-glow'),
    );
    const primaryRing = getBasicMaterial(
      getMarkerMesh(primaryMarker, 'waypoint-marker-beacon-ring'),
    );

    expect(otherGlow).not.toBe(primaryGlow);
    expect(otherRing).not.toBe(primaryRing);

    markers.updateArrivalStates([
      createArrivalState('kiyotaki', {
        phase: 'arrive',
        intensity: 1,
        isActive: true,
        isPrimaryActive: true,
      }),
      createArrivalState('summit'),
    ], 100);

    expect(otherGlow.opacity).toBeCloseTo(
      pinStandConfig.glow!.opacity
        * pinStandConfig.emphasis!.glowOpacityMultiplier!
        * SPOT_ARRIVAL_VISUAL_DEFAULTS.otherSpotDimOpacity,
    );
    expect(otherRing.opacity).toBeCloseTo(
      pinStandConfig.beaconRing!.opacity
        * pinStandConfig.emphasis!.beaconOpacityMultiplier!
        * SPOT_ARRIVAL_VISUAL_DEFAULTS.otherSpotDimOpacity,
    );

    markers.dispose();
  });

  it('restores all marker visuals for idle states without allocating render resources', () => {
    const scene = new THREE.Scene();
    const markers = createWaypointMarkers({
      scene,
      anchors: [
        {
          anchor: { x: 120, y: 640, z: 80 },
          displayText: '清滝駅',
          poiId: 'kiyotaki',
        },
        {
          anchor: { x: 140, y: 640, z: 80 },
          displayText: '山頂',
          poiId: 'summit',
        },
      ],
      config: pinStandConfig,
    });
    const firstMarker = markers.object3D.children[0];
    const firstHead = getMarkerMesh(firstMarker, 'waypoint-marker-head');
    const firstGlow = getMarkerMesh(firstMarker, 'waypoint-marker-glow');
    const firstRing = getMarkerMesh(firstMarker, 'waypoint-marker-beacon-ring');
    const glowMaterial = firstGlow.material;
    const ringMaterial = firstRing.material;
    const glowGeometry = firstGlow.geometry;
    const ringGeometry = firstRing.geometry;
    const baseHeadScale = firstHead.scale.x;

    markers.updateArrivalStates([
      createArrivalState('kiyotaki', {
        phase: 'arrive',
        intensity: 1,
        isActive: true,
        isPrimaryActive: true,
      }),
      createArrivalState('summit'),
    ], 0);
    markers.updateArrivalStates([
      createArrivalState('kiyotaki', {
        phase: 'arrive',
        intensity: 1,
        isActive: true,
        isPrimaryActive: true,
      }),
      createArrivalState('summit'),
    ], 350);
    markers.updateArrivalStates(createIdleSpotArrivalStates([
      { poiId: 'kiyotaki', progressAt: 0.1, tier: 'primary' },
      { poiId: 'summit', progressAt: 0.9, tier: 'primary' },
    ]), 700);

    expect(firstHead.scale.x).toBeCloseTo(baseHeadScale);
    expect(getBasicMaterial(firstGlow).opacity).toBeCloseTo(
      pinStandConfig.glow!.opacity,
    );
    expect(getBasicMaterial(firstRing).opacity).toBeCloseTo(
      pinStandConfig.beaconRing!.opacity,
    );
    expect(firstGlow.material).toBe(glowMaterial);
    expect(firstRing.material).toBe(ringMaterial);
    expect(firstGlow.geometry).toBe(glowGeometry);
    expect(firstRing.geometry).toBe(ringGeometry);

    markers.dispose();
  });
});

describe('waypointDefaults', () => {
  it('keeps waypoint dimensions within a subtle trail-marker range', () => {
    expect(waypointDefaults.headRadiusMeters).toBeGreaterThanOrEqual(1);
    expect(waypointDefaults.headRadiusMeters).toBeLessThanOrEqual(10);
    expect(waypointDefaults.standHeightMeters).toBeGreaterThanOrEqual(1);
    expect(waypointDefaults.standHeightMeters).toBeLessThanOrEqual(10);
  });
});
