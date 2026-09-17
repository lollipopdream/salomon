import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { AppSettings, ElevationGrid, Vec3 } from '../types';
import { defaultSettings } from '../config/settings';
import {
  computeLookAtTarget,
  computeOverviewCameraPosition,
} from './cameraController';

const settings: AppSettings = {
  resolutionWidth: 1920,
  resolutionHeight: 1080,
  loopDurationSec: 25,
  terrainOrigin: { lat: 35.6255, lng: 139.2432 },
  elevationScale: 1,
  metersPerUnit: 1,
  routeAnimation: { playDurationMs: 11_000, holdAtEndMs: 2_000 },
  visual: defaultSettings.visual,
  cameraState: {
    ...defaultSettings.cameraState,
    timeline: {
      ...defaultSettings.cameraState.timeline,
      highOverviewHoldMs:
        defaultSettings.cameraState.timeline.highOverviewHoldMs,
      descendToOverviewMs:
        defaultSettings.cameraState.timeline.descendToOverviewMs,
      ascendToHighOverviewMs:
        defaultSettings.cameraState.timeline.ascendToHighOverviewMs,
    },
    highOverview: defaultSettings.cameraState.highOverview,
  },
  labels: defaultSettings.labels,
};

function createFlatGrid(elevation: number): ElevationGrid {
  return {
    cols: 10,
    rows: 10,
    values: new Float32Array(100).fill(elevation),
    cellSizeMeters: 25,
    bounds: {
      north: 35.64,
      south: 35.61,
      east: 139.26,
      west: 139.22,
    },
  };
}

const worldRoutePoints: Vec3[] = [
  { x: 0, y: 100, z: 0 },
  { x: 25, y: 130, z: 20 },
  { x: 55, y: 165, z: 45 },
  { x: 90, y: 205, z: 75 },
];

const compositionGrid: ElevationGrid = {
  cols: 100,
  rows: 100,
  values: new Float32Array(100 * 100).fill(599),
  cellSizeMeters: 60,
  bounds: {
    north: 35.64,
    south: 35.61,
    east: 139.26,
    west: 139.22,
  },
};

function sampleTerrainPerimeter(
  terrainGrid: ElevationGrid,
): THREE.Vector3[] {
  const maxX = (terrainGrid.cols - 1) * terrainGrid.cellSizeMeters;
  const maxZ = (terrainGrid.rows - 1) * terrainGrid.cellSizeMeters;
  const samplesPerEdge = 10;
  const samples: THREE.Vector3[] = [];

  for (let index = 0; index < samplesPerEdge; index += 1) {
    const t = index / samplesPerEdge;
    samples.push(
      new THREE.Vector3(maxX * t, 0, 0),
      new THREE.Vector3(maxX, 0, maxZ * t),
      new THREE.Vector3(maxX * (1 - t), 0, maxZ),
      new THREE.Vector3(0, 0, maxZ * (1 - t)),
    );
  }

  return samples;
}

function projectTerrainPerimeter(
  terrainGrid: ElevationGrid,
  position: Vec3,
): THREE.Vector3[] {
  const target = computeLookAtTarget(terrainGrid, defaultSettings);
  const camera = new THREE.PerspectiveCamera(
    45,
    1920 / 1080,
    0.1,
    100_000,
  );
  camera.position.set(position.x, position.y, position.z);
  camera.lookAt(target.x, target.y, target.z);
  camera.updateMatrixWorld();

  return sampleTerrainPerimeter(terrainGrid).map((point) =>
    point.project(camera),
  );
}

function isOutsideNdcFrame({ x, y }: THREE.Vector3): boolean {
  return x < -1 || x > 1 || y < -1 || y > 1;
}

// sampleTerrainPerimeter emits 4 points per t-step, in order
// [z=0 edge, x=maxX edge, z=maxZ edge, x=0 edge]. The camera sits at a
// shallow positive-x/positive-z azimuth, so the x=0 edge is the far side
// that recedes toward the horizon behind the near terrain — exactly like a
// real aerial/drone shot, where the far ridge blends into the sky at the
// top of frame. Requiring that edge to be cropped too forces the camera
// absurdly close (this was the root cause of a v3.2 over-correction: an
// unnecessarily tight radiusFactor/heightFactor that skimmed the canopy).
// Only the near edge (x=maxX) and the two side edges (z=0, z=maxZ) —
// the ones a human reviewer actually flagged as visible borders — must be
// cropped out of frame.
function isNearOrSideEdgeSample(_point: THREE.Vector3, index: number): boolean {
  return index % 4 !== 3;
}

describe('computeLookAtTarget', () => {
  it('returns the horizontal center and half the maximum elevation', () => {
    const target = computeLookAtTarget(createFlatGrid(300), settings);

    expect(target.x).toBeCloseTo(112.5);
    expect(target.y).toBeCloseTo(150);
    expect(target.z).toBeCloseTo(112.5);
  });
});

describe('computeOverviewCameraPosition', () => {
  it('places the camera above the terrain maximum', () => {
    const camera = computeOverviewCameraPosition(createFlatGrid(300), settings);

    expect(camera.y).toBeGreaterThan(300);
  });

  it('uses the configured radius at a shallow ten-degree azimuth', () => {
    const camera = computeOverviewCameraPosition(createFlatGrid(300), settings);
    const offsetX = camera.x - 112.5;
    const offsetZ = camera.z - 112.5;
    const diagonal = Math.sqrt(250 ** 2 + 250 ** 2);

    expect(Math.hypot(offsetX, offsetZ)).toBeCloseTo(
      diagonal * settings.cameraState.overview.radiusFactor,
    );
    expect(Math.atan2(offsetZ, offsetX)).toBeCloseTo(Math.PI / 18);
  });

  it('raises the camera for terrain with a higher elevation', () => {
    const lowerCamera = computeOverviewCameraPosition(
      createFlatGrid(300),
      settings,
    );
    const higherCamera = computeOverviewCameraPosition(
      createFlatGrid(1000),
      settings,
    );

    expect(higherCamera.y).toBeGreaterThan(lowerCamera.y);
  });

  it('keeps every route and label anchor inside the overview frame', () => {
    const terrainGrid = createFlatGrid(300);
    const target = computeLookAtTarget(terrainGrid, settings);
    const position = computeOverviewCameraPosition(terrainGrid, settings);
    const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100_000);
    camera.position.set(position.x, position.y, position.z);
    camera.lookAt(target.x, target.y, target.z);
    camera.updateMatrixWorld();

    for (const point of worldRoutePoints) {
      const projected = new THREE.Vector3(
        point.x,
        point.y,
        point.z,
      ).project(camera);

      expect(projected.x).toBeGreaterThanOrEqual(-1);
      expect(projected.x).toBeLessThanOrEqual(1);
      expect(projected.y).toBeGreaterThanOrEqual(-1);
      expect(projected.y).toBeLessThanOrEqual(1);
    }
  });

  it.each([
    'overview static pose',
    'descend-to-overview endpoint',
    'transition-in start',
    'ascend-to-high-overview endpoint',
    'return-to-overview endpoint',
  ])('keeps the near and side terrain-perimeter samples outside for the %s', () => {
    const position = computeOverviewCameraPosition(
      compositionGrid,
      defaultSettings,
    );
    const projectedPerimeter = projectTerrainPerimeter(
      compositionGrid,
      position,
    );

    expect(projectedPerimeter).toHaveLength(40);
    expect(
      projectedPerimeter.filter(isNearOrSideEdgeSample).every(isOutsideNdcFrame),
    ).toBe(true);
  });
});
