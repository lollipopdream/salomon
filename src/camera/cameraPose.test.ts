import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { cycleDurationMs } from '../animation/progress';
import { cameraGuidanceDefaults } from '../config/defaults/cameraGuidance';
import { defaultSettings } from '../config/settings';
import { resampleRouteToWorldPoints } from '../route/routePath';
import { computeCameraGuidancePath } from '../route/routeGuidance';
import { computeCumulativeDistances } from '../route/routeProgress';
import { takaoTrail1Route } from '../route/takaoTrail1Route';
import { computeCellSizeMeters } from '../terrain/demLoader';
import type { CameraStateConfig, ElevationGrid, Vec3 } from '../types';
import { lengthVec3, subtractVec3 } from '../utils/vecMath';
import {
  computeLookAtTarget,
  computeOverviewCameraPosition,
} from './cameraController';
import {
  computeCameraPose,
  type CameraPose,
  type CameraPoseInput,
} from './cameraPose';
import {
  computeCameraPhase,
  computeRouteFollowStartMs,
  type CameraPhaseResult,
} from './cameraTimeline';
import { computeHighOverviewCameraPosition } from './highOverviewCamera';
import {
  buildCameraRail,
  evaluateRailPosition,
  evaluateRailTarget,
} from './routeFollowRail';

const grid: ElevationGrid = {
  cols: 5,
  rows: 4,
  values: new Float32Array([
    100, 105, 110, 115, 120,
    110, 120, 130, 140, 150,
    125, 140, 155, 170, 185,
    140, 160, 180, 200, 220,
  ]),
  cellSizeMeters: 25,
  bounds: {
    north: 35.64,
    south: 35.61,
    east: 139.26,
    west: 139.22,
  },
};

const worldRoutePoints: Vec3[] = [
  { x: 0, y: 100, z: 0 },
  { x: 25, y: 130, z: 20 },
  { x: 55, y: 165, z: 45 },
  { x: 90, y: 205, z: 75 },
];
const cumulativeDistances = computeCumulativeDistances(worldRoutePoints);
const routeGuidance = computeCameraGuidancePath(
  worldRoutePoints,
  cumulativeDistances,
  cameraGuidanceDefaults,
);
const animationConfig = defaultSettings.routeAnimation;
const cameraState = defaultSettings.cameraState;
const cameraRail = buildCameraRail(
  worldRoutePoints,
  cumulativeDistances,
  worldRoutePoints,
  cumulativeDistances,
  cameraState.rail,
);
const guidanceCameraRail = buildCameraRail(
  worldRoutePoints,
  cumulativeDistances,
  routeGuidance.points,
  routeGuidance.cumulativeDistances,
  cameraState.rail,
);

function poseAt(elapsedMs: number) {
  const input: CameraPoseInput = {
    phase: computeCameraPhase(
      elapsedMs,
      animationConfig,
      cameraState.timeline,
    ),
    elapsedMs,
    animationConfig,
    grid,
    settings: defaultSettings,
    worldRoutePoints,
    cumulativeDistances,
    routeGuidancePoints: worldRoutePoints,
    routeGuidanceCumulativeDistances: cumulativeDistances,
    cameraRail,
    cameraState,
  };

  return computeCameraPose(input);
}

function poseForPhase(
  phase: CameraPhaseResult,
  cameraStateOverride = cameraState,
) {
  return computeCameraPose({
    phase,
    elapsedMs: 0,
    animationConfig,
    grid,
    settings: defaultSettings,
    worldRoutePoints,
    cumulativeDistances,
    routeGuidancePoints: worldRoutePoints,
    routeGuidanceCumulativeDistances: cumulativeDistances,
    cameraRail,
    cameraState: cameraStateOverride,
  });
}

function guidancePoseForPhase(phase: CameraPhaseResult) {
  return computeCameraPose({
    phase,
    elapsedMs: 0,
    animationConfig,
    grid,
    settings: defaultSettings,
    worldRoutePoints,
    cumulativeDistances,
    routeGuidancePoints: routeGuidance.points,
    routeGuidanceCumulativeDistances: routeGuidance.cumulativeDistances,
    cameraRail: guidanceCameraRail,
    cameraState,
  });
}

function poseDistance(
  a: ReturnType<typeof computeCameraPose>,
  b: ReturnType<typeof computeCameraPose>,
): number {
  return Math.max(
    lengthVec3(subtractVec3(a.position, b.position)),
    lengthVec3(subtractVec3(a.target, b.target)),
  );
}

describe('computeCameraPose', () => {
  const timeline = cameraState.timeline;
  const epsilonMs = 0.001;
  const boundaries = [
    ['overview -> transition-in', timeline.overviewHoldMs],
    [
      'transition-in -> route-follow',
      computeRouteFollowStartMs(timeline),
    ],
    [
      'route-follow -> transition-to-summit',
      animationConfig.playDurationMs,
    ],
    [
      'transition-to-summit -> summit-hold',
      animationConfig.playDurationMs + timeline.transitionToSummitMs,
    ],
    [
      'summit-hold -> return-to-overview',
      animationConfig.playDurationMs
        + timeline.transitionToSummitMs
        + timeline.summitHoldMs,
    ],
  ] as const;

  it.each(boundaries)('is continuous at %s', (_label, boundaryMs) => {
    const before = poseAt(boundaryMs - epsilonMs);
    const after = poseAt(boundaryMs + epsilonMs);

    expect(poseDistance(before, after)).toBeLessThan(0.01);
  });

  it('keeps the route-follow -> transition-to-summit boundary continuous', () => {
    const boundaryMs = animationConfig.playDurationMs;

    expect(
      poseDistance(
        poseAt(boundaryMs - epsilonMs),
        poseAt(boundaryMs + epsilonMs),
      ),
    ).toBeLessThan(0.01);
  });

  it.each([
    {
      label: 'transition-in -> route-follow',
      before: { kind: 'transition-in', t: 1 } as CameraPhaseResult,
      after: { kind: 'route-follow', progress: 0 } as CameraPhaseResult,
    },
    {
      label: 'route-follow -> transition-to-summit',
      before: { kind: 'route-follow', progress: 1 } as CameraPhaseResult,
      after: { kind: 'transition-to-summit', t: 0 } as CameraPhaseResult,
    },
  ])('keeps camera-rail-based $label boundary poses continuous', ({ before, after }) => {
    expect(routeGuidance.points).not.toEqual(worldRoutePoints);
    expect(
      poseDistance(
        guidancePoseForPhase(before),
        guidancePoseForPhase(after),
      ),
    ).toBeLessThan(1e-10);
  });

  it('starts route-follow near the beginning of the route, not partway through (BUG-V3-04)', () => {
    const routeFollowStartMs = computeRouteFollowStartMs(timeline);
    const phaseAtStart = computeCameraPhase(
      routeFollowStartMs,
      animationConfig,
      timeline,
    );
    const startMs = routeFollowStartMs + epsilonMs;
    const phase = computeCameraPhase(startMs, animationConfig, timeline);
    const pose = poseAt(startMs);
    const routeStartPose = poseForPhase({
      kind: 'route-follow',
      progress: 0,
    });
    const totalRouteLength =
      cumulativeDistances[cumulativeDistances.length - 1];

    expect(phaseAtStart).toEqual({ kind: 'route-follow', progress: 0 });
    expect(phase.kind).toBe('route-follow');
    if (phase.kind !== 'route-follow') {
      throw new Error('Expected route-follow phase at its start boundary');
    }
    const expectedProgress =
      epsilonMs
      / (animationConfig.playDurationMs - routeFollowStartMs);

    expect(phase.progress).toBeCloseTo(expectedProgress, 10);
    expect(
      phase.progress * totalRouteLength,
    ).toBeLessThan(totalRouteLength * 0.1);
    expect(poseDistance(pose, routeStartPose)).toBeLessThan(0.01);
  });

  it('evaluates route-follow position and target from the camera rail', () => {
    const progress = 0.42;
    const pose = poseForPhase({ kind: 'route-follow', progress });

    expect(pose).toEqual({
      position: evaluateRailPosition(cameraRail, progress),
      target: evaluateRailTarget(cameraRail, progress),
    });
  });

  it('matches overview and route-entry poses at transition-in endpoints', () => {
    expect(
      poseDistance(
        poseForPhase({ kind: 'transition-in', t: 0 }),
        poseForPhase({ kind: 'overview' }),
      ),
    ).toBeLessThan(1e-6);
    expect(
      poseDistance(
        poseForPhase({ kind: 'transition-in', t: 1 }),
        poseForPhase({ kind: 'route-follow', progress: 0 }),
      ),
    ).toBeLessThan(1e-6);
  });

  it('matches route-end and summit poses at transition-to-summit endpoints', () => {
    expect(
      poseDistance(
        poseForPhase({ kind: 'transition-to-summit', t: 0 }),
        poseForPhase({ kind: 'route-follow', progress: 1 }),
      ),
    ).toBeLessThan(1e-6);
    expect(
      poseDistance(
        poseForPhase({ kind: 'transition-to-summit', t: 1 }),
        poseForPhase({ kind: 'summit-hold' }),
      ),
    ).toBeLessThan(1e-6);
  });

  it('adds arc lift above linear interpolation during transition-in', () => {
    const from = poseForPhase({ kind: 'transition-in', t: 0 });
    const midpoint = poseForPhase({ kind: 'transition-in', t: 0.5 });
    const to = poseForPhase({ kind: 'transition-in', t: 1 });
    const linearMidpointY = (from.position.y + to.position.y) / 2;

    expect(cameraState.timeline.arcLiftMeters).toBeGreaterThan(0);
    expect(midpoint.position.y).toBeGreaterThan(linearMidpointY);
  });

  it('adds arc lift above linear interpolation during transition-to-summit', () => {
    const from = poseForPhase({ kind: 'transition-to-summit', t: 0 });
    const midpoint = poseForPhase({
      kind: 'transition-to-summit',
      t: 0.5,
    });
    const to = poseForPhase({ kind: 'transition-to-summit', t: 1 });
    const linearMidpointY = (from.position.y + to.position.y) / 2;

    expect(cameraState.timeline.arcLiftMeters).toBeGreaterThan(0);
    expect(midpoint.position.y).toBeGreaterThan(linearMidpointY);
  });

  it('is continuous across the return-to-overview -> next overview loop seam', () => {
    const beforeLoop = poseAt(cycleDurationMs(animationConfig) - epsilonMs);
    const nextOverview = poseAt(0);

    expect(poseDistance(beforeLoop, nextOverview)).toBeLessThan(0.01);
  });

  it.each([
    { kind: 'high-overview-hold', t: 0.5 },
    { kind: 'descend-to-overview', t: 0.5 },
    { kind: 'ascend-to-high-overview', t: 0.5 },
  ] satisfies CameraPhaseResult[])(
    'returns finite coordinates for $kind',
    (phase) => {
      const pose = poseForPhase(phase);

      expect([
        pose.position.x,
        pose.position.y,
        pose.position.z,
        pose.target.x,
        pose.target.y,
        pose.target.z,
      ].every(Number.isFinite)).toBe(true);
    },
  );

  it('computes the high-overview-hold t=0 and t=1 poses explicitly', () => {
    const orbitingCameraState = {
      ...cameraState,
      highOverview: {
        ...cameraState.highOverview,
        orbitDegrees: 135,
      },
    };
    const target = computeLookAtTarget(grid, defaultSettings);

    expect(
      poseForPhase(
        { kind: 'high-overview-hold', t: 0 },
        orbitingCameraState,
      ),
    ).toEqual({
      position: computeHighOverviewCameraPosition(
        grid,
        defaultSettings,
        orbitingCameraState.highOverview,
        0,
        0,
      ),
      target,
    });
    expect(
      poseForPhase(
        { kind: 'high-overview-hold', t: 1 },
        orbitingCameraState,
      ),
    ).toEqual({
      position: computeHighOverviewCameraPosition(
        grid,
        defaultSettings,
        orbitingCameraState.highOverview,
        orbitingCameraState.highOverview.orbitDegrees,
      ),
      target,
    });
  });

  it('keeps high-overview-hold t=1 continuous with descend-to-overview t=0', () => {
    expect(
      poseForPhase({ kind: 'descend-to-overview', t: 0 }),
    ).toEqual(poseForPhase({ kind: 'high-overview-hold', t: 1 }));
  });

  it('keeps descend-to-overview t=1 continuous with overview', () => {
    expect(
      poseForPhase({ kind: 'descend-to-overview', t: 1 }),
    ).toEqual(poseForPhase({ kind: 'overview' }));
  });

  it('keeps overview continuous with ascend-to-high-overview t=0', () => {
    expect(
      poseForPhase({ kind: 'ascend-to-high-overview', t: 0 }),
    ).toEqual({
      position: computeOverviewCameraPosition(grid, defaultSettings),
      target: computeLookAtTarget(grid, defaultSettings),
    });
  });

  it('keeps ascend-to-high-overview t=1 continuous with the next loop', () => {
    expect(
      poseForPhase({ kind: 'ascend-to-high-overview', t: 1 }),
    ).toEqual(poseForPhase({ kind: 'high-overview-hold', t: 0 }));
  });

  it('returns only finite coordinates in every phase', () => {
    const sampleElapsedMs = [
      0,
      timeline.overviewHoldMs + timeline.transitionInMs / 2,
      timeline.overviewHoldMs + timeline.transitionInMs + 100,
      animationConfig.playDurationMs
        + timeline.transitionToSummitMs / 2,
      animationConfig.playDurationMs
        + timeline.transitionToSummitMs
        + timeline.summitHoldMs / 2,
      animationConfig.playDurationMs
        + timeline.transitionToSummitMs
        + timeline.summitHoldMs
        + timeline.returnToOverviewMs / 2,
    ];

    for (const elapsedMs of sampleElapsedMs) {
      const pose = poseAt(elapsedMs);
      expect([
        pose.position.x,
        pose.position.y,
        pose.position.z,
        pose.target.x,
        pose.target.y,
        pose.target.z,
      ].every(Number.isFinite)).toBe(true);
    }
  });

  it('looks downward during summit-hold instead of nearly horizontally', () => {
    const summitHoldMs =
      animationConfig.playDurationMs + timeline.transitionToSummitMs;
    const pose = poseAt(summitHoldMs);
    const heightDifference = pose.position.y - pose.target.y;
    const horizontalDistance = Math.hypot(
      pose.position.x - pose.target.x,
      pose.position.z - pose.target.z,
    );

    expect(heightDifference).toBeGreaterThan(0);
    expect(heightDifference / horizontalDistance).toBeGreaterThan(0.25);
  });
});

// CR8: regression coverage for the full-route reveal at the shared
// high-overview start pose (ascend-to-high-overview t=1, which is identical
// to high-overview-hold t=0 via the loop-seam continuity guaranteed above).
// The start azimuth eases from the CR8-PRECHECK-validated side-on route
// direction back to the unchanged fixed 10° base azimuth across the hold.
// These use the real takaoTrail1Route lat/lng points resampled onto a grid
// whose bounds/dimensions exactly match production's real DEM coverage: the
// same z=14 x=[14528..14530] y=[6453..6455] tile grid sceneSetup.ts's
// DEM_TILE_URLS fetches (public/data/dem/14/...), reduced through the same
// tile-bounds and downsampleElevationGrid math as demLoader.ts's
// loadRealDemTiles (Canvas/fetch APIs aren't available in this Node test
// environment, so the actual pixel-decoded elevation values are replaced by
// a synthetic radial profile in the same style as generateSyntheticElevationGrid
// -- only the terrain footprint's real-world size/position, which is what
// drives the camera's radiusFactor/heightFactor framing math, needs to match
// production). worldRoutePoints are built via resampleRouteToWorldPoints
// exactly as production's sceneSetup.ts does so they are geometrically
// consistent with this grid.
describe('ascend-to-high-overview full-route reveal framing (CR8)', () => {
  function tileYToLatitudeDegrees(y: number, zoom: number): number {
    const n = 2 ** zoom;
    const mercator = Math.PI * (1 - (2 * y) / n);
    return (Math.atan(Math.sinh(mercator)) * 180) / Math.PI;
  }

  // Mirrors sceneSetup.ts's DEM_TILE_URLS: zoom 14, x=[14528,14529,14530],
  // y=[6453,6454,6455].
  const demZoom = 14;
  const demMinTileX = 14528;
  const demMaxTileX = 14530;
  const demMinTileY = 6453;
  const demMaxTileY = 6455;
  const demTileSizePixels = 256;
  const realRouteBounds = {
    north: tileYToLatitudeDegrees(demMinTileY, demZoom),
    south: tileYToLatitudeDegrees(demMaxTileY + 1, demZoom),
    west: (demMinTileX / 2 ** demZoom) * 360 - 180,
    east: ((demMaxTileX + 1) / 2 ** demZoom) * 360 - 180,
  };
  const demCanvasWidthPixels =
    (demMaxTileX - demMinTileX + 1) * demTileSizePixels;
  const demCanvasHeightPixels =
    (demMaxTileY - demMinTileY + 1) * demTileSizePixels;
  // Mirrors demLoader.ts's loadRealDemTiles stride/downsample computation
  // (MAX_GRID_DIMENSION=150).
  const demStride = Math.max(
    1,
    Math.ceil(Math.max(demCanvasWidthPixels, demCanvasHeightPixels) / 150),
  );
  const realRouteGridDimension =
    Math.floor((demCanvasWidthPixels - 1) / demStride) + 1;
  const realRouteCellSizeMeters = computeCellSizeMeters(
    realRouteBounds,
    demCanvasWidthPixels,
    demCanvasHeightPixels,
    demStride,
  );

  function buildRadialElevationValues(
    cols: number,
    rows: number,
  ): Float32Array {
    const centerCol = (cols - 1) / 2;
    const centerRow = (rows - 1) / 2;
    const scaleCol = Math.max(centerCol, 1);
    const scaleRow = Math.max(centerRow, 1);
    const baseElevationMeters = 200;
    const peakElevationMeters = 599;
    const values = new Float32Array(cols * rows);

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const dx = (col - centerCol) / scaleCol;
        const dy = (row - centerRow) / scaleRow;
        const radiusSquared = dx * dx + dy * dy;

        values[row * cols + col] =
          baseElevationMeters
          + (peakElevationMeters - baseElevationMeters)
            * Math.exp(-4 * radiusSquared);
      }
    }

    return values;
  }

  const realRouteGrid: ElevationGrid = {
    cols: realRouteGridDimension,
    rows: realRouteGridDimension,
    values: buildRadialElevationValues(
      realRouteGridDimension,
      realRouteGridDimension,
    ),
    cellSizeMeters: realRouteCellSizeMeters,
    bounds: realRouteBounds,
  };

  // Mirrors sceneSetup.ts's production call exactly (heightOffsetMeters=5,
  // maxSampleSpacingMeters=cellSizeMeters*0.5).
  const realWorldRoutePoints = resampleRouteToWorldPoints(
    takaoTrail1Route,
    realRouteGrid,
    defaultSettings,
    5,
    realRouteGrid.cellSizeMeters * 0.5,
  );
  const realCumulativeDistances = computeCumulativeDistances(
    realWorldRoutePoints,
  );

  function fullRouteRevealPose(
    cameraStateOverride: CameraStateConfig,
  ): CameraPose {
    return computeCameraPose({
      phase: { kind: 'ascend-to-high-overview', t: 1 },
      elapsedMs: 0,
      animationConfig,
      grid: realRouteGrid,
      settings: defaultSettings,
      worldRoutePoints: realWorldRoutePoints,
      cumulativeDistances: realCumulativeDistances,
      routeGuidancePoints: realWorldRoutePoints,
      routeGuidanceCumulativeDistances: realCumulativeDistances,
      cameraState: cameraStateOverride,
    });
  }

  function projectRealRoutePointsNdc(pose: CameraPose): THREE.Vector3[] {
    const camera = new THREE.PerspectiveCamera(45, 1920 / 1080, 0.1, 100_000);

    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    camera.up.set(0, 1, 0);
    camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();

    return realWorldRoutePoints.map((point) =>
      new THREE.Vector3(point.x, point.y, point.z).project(camera),
    );
  }

  it('keeps the entire real route (including its start point) inside the frame at ascend-to-high-overview t=1', () => {
    const pose = fullRouteRevealPose(cameraState);
    const ndcPoints = projectRealRoutePointsNdc(pose);
    const minNdcX = Math.min(...ndcPoints.map((point) => point.x));
    const maxNdcX = Math.max(...ndcPoints.map((point) => point.x));
    const minNdcY = Math.min(...ndcPoints.map((point) => point.y));
    const maxNdcY = Math.max(...ndcPoints.map((point) => point.y));

    expect(realWorldRoutePoints.length).toBeGreaterThan(1);
    expect(minNdcX).toBeGreaterThanOrEqual(-0.95);
    expect(maxNdcX).toBeLessThanOrEqual(0.95);
    expect(minNdcY).toBeGreaterThanOrEqual(-0.95);
    expect(maxNdcY).toBeLessThanOrEqual(0.95);
  });

  it('is identical to the shared high-overview-hold t=0 pose (loop seam), so the reveal fix cannot desync the seam', () => {
    const revealPose = fullRouteRevealPose(cameraState);
    const holdStartPose = computeCameraPose({
      phase: { kind: 'high-overview-hold', t: 0 },
      elapsedMs: 0,
      animationConfig,
      grid: realRouteGrid,
      settings: defaultSettings,
      worldRoutePoints: realWorldRoutePoints,
      cumulativeDistances: realCumulativeDistances,
      routeGuidancePoints: realWorldRoutePoints,
      routeGuidanceCumulativeDistances: realCumulativeDistances,
      cameraState,
    });

    expect(revealPose).toEqual(holdStartPose);
  });

  it('keeps the high-overview-hold end pose (t=1) exactly at the fixed base azimuth/radius/height regardless of the hold-drift-start config', () => {
    // Recomputed directly from radiusFactor/heightFactor (not from
    // computeHighOverviewCameraPosition's internal eased===1 branch), so
    // this regresses independently of that implementation detail.
    const target = computeLookAtTarget(grid, defaultSettings);
    const terrainWidth = grid.cols * grid.cellSizeMeters;
    const terrainDepth = grid.rows * grid.cellSizeMeters;
    const diagonal = Math.sqrt(
      terrainWidth * terrainWidth + terrainDepth * terrainDepth,
    );
    let maxElevation = -Infinity;
    for (let i = 0; i < grid.values.length; i += 1) {
      if (grid.values[i] > maxElevation) {
        maxElevation = grid.values[i];
      }
    }
    maxElevation *= defaultSettings.elevationScale;
    const { radiusFactor, heightFactor, orbitDegrees } =
      cameraState.highOverview;
    const baseAngleRad = Math.PI / 18;
    const horizontalDistanceFromTarget = diagonal * radiusFactor;
    const expectedPosition: Vec3 = {
      x: target.x + horizontalDistanceFromTarget * Math.cos(baseAngleRad),
      y: maxElevation * 1.5 + diagonal * heightFactor,
      z: target.z + horizontalDistanceFromTarget * Math.sin(baseAngleRad),
    };

    // orbitDegrees is 0 in the real defaults, so t=1's orbit angle (t *
    // orbitDegrees) is also 0 and the rotateAroundY call is a no-op; this
    // assertion documents that assumption so a future orbitDegrees change
    // doesn't silently invalidate the expectedPosition computed above.
    expect(orbitDegrees).toBe(0);

    const pose = poseForPhase({ kind: 'high-overview-hold', t: 1 });

    expect(pose).toEqual({ position: expectedPosition, target });
  });

  it('eases the high-overview azimuth continuously across the hold', () => {
    const poses = [0, 0.25, 0.5, 0.75, 1].map((t) =>
      poseForPhase({ kind: 'high-overview-hold', t }),
    );

    for (const pose of poses) {
      expect([
        pose.position.x,
        pose.position.y,
        pose.position.z,
        pose.target.x,
        pose.target.y,
        pose.target.z,
      ].every(Number.isFinite)).toBe(true);
    }

    const deltas = poses.slice(1).map((pose, index) =>
      lengthVec3(subtractVec3(pose.position, poses[index].position)),
    );

    for (let index = 0; index < deltas.length; index += 1) {
      expect(deltas[index]).toBeGreaterThan(0);
      if (index > 0) {
        expect(deltas[index]).toBeLessThan(deltas[index - 1]);
        expect(deltas[index - 1] / deltas[index]).toBeLessThan(20);
      }
    }
  });

  it('would have left the route start point below the frame with the pre-CR8 fixed 10° azimuth (known-bad canary)', () => {
    const preFixCameraState: CameraStateConfig = {
      ...cameraState,
      highOverview: {
        ...cameraState.highOverview,
        holdDriftStartRadiusFactor: 0.15 * 1.08,
        holdDriftStartAzimuthDegrees: undefined,
      },
    };
    const pose = fullRouteRevealPose(preFixCameraState);
    const ndcPoints = projectRealRoutePointsNdc(pose);
    const minNdcY = Math.min(...ndcPoints.map((point) => point.y));

    expect(minNdcY).toBeLessThan(-0.95);
  });
});
