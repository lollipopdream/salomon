import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { cameraGuidanceDefaults } from '../config/defaults/cameraGuidance';
import { cinematicRailDefaults } from '../config/defaults/cameraRail';
import { latLngToVec3 } from '../geo/coords';
import { computeCameraGuidancePath } from '../route/routeGuidance';
import { computeCumulativeDistances } from '../route/routeProgress';
import { takaoTrail1Route } from '../route/takaoTrail1Route';
import type { Vec3 } from '../types';
import { lengthVec3, subtractVec3 } from '../utils/vecMath';
import { computeRouteFollowAnchor } from './routeFollowCamera';
import {
  buildCameraRail,
  evaluateRailPosition,
  evaluateRailTarget,
} from './routeFollowRail';

const routeOrigin = takaoTrail1Route.points[0];
const worldRoutePoints: Vec3[] = takaoTrail1Route.points.map(
  (point, index) => ({
    ...latLngToVec3(point, routeOrigin, 1),
    y: 200 + 400 * index / (takaoTrail1Route.points.length - 1),
  }),
);
const cumulativeDistances = computeCumulativeDistances(worldRoutePoints);
const guidance = computeCameraGuidancePath(
  worldRoutePoints,
  cumulativeDistances,
  cameraGuidanceDefaults,
);
const rail = buildCameraRail(
  worldRoutePoints,
  cumulativeDistances,
  guidance.points,
  guidance.cumulativeDistances,
  cinematicRailDefaults,
);

function distanceBetween(a: Vec3, b: Vec3): number {
  return lengthVec3(subtractVec3(a, b));
}

describe('route-follow camera framing', () => {
  it('keeps the real-route moving head comfortably inside the frame', () => {
    const camera = new THREE.PerspectiveCamera(
      45,
      1920 / 1080,
      0.1,
      100_000,
    );

    for (let step = 0; step <= 100; step += 1) {
      const progress = step / 100;
      const currentPoint = computeRouteFollowAnchor(
        worldRoutePoints,
        cumulativeDistances,
        progress,
      );
      const camPos = evaluateRailPosition(rail, progress);
      const camTarget = evaluateRailTarget(rail, progress);

      camera.position.set(camPos.x, camPos.y, camPos.z);
      camera.up.set(0, 1, 0);
      camera.lookAt(camTarget.x, camTarget.y, camTarget.z);
      camera.updateMatrixWorld(true);
      camera.updateProjectionMatrix();

      const cameraToPoint = new THREE.Vector3(
        currentPoint.x - camPos.x,
        currentPoint.y - camPos.y,
        currentPoint.z - camPos.z,
      );
      const cameraForward = new THREE.Vector3(0, 0, -1)
        .applyQuaternion(camera.quaternion);
      const forwardDistance = cameraToPoint.dot(cameraForward);
      const ndc = new THREE.Vector3(
        currentPoint.x,
        currentPoint.y,
        currentPoint.z,
      ).project(camera);
      const context = `route progress ${progress.toFixed(2)}`;

      expect(forwardDistance, `${context}: moving head is behind the camera`)
        .toBeGreaterThan(0);
      expect(Math.abs(ndc.x), `${context}: |NDC x| = ${Math.abs(ndc.x)}`)
        .toBeLessThanOrEqual(0.90);
      expect(ndc.y, `${context}: NDC y = ${ndc.y}`)
        .toBeGreaterThanOrEqual(-0.90);
      expect(ndc.y, `${context}: NDC y = ${ndc.y}`)
        .toBeLessThanOrEqual(0.90);
    }
  });

  it('keeps the real-route moving head inside the composition safe zone', () => {
    const camera = new THREE.PerspectiveCamera(
      45,
      1920 / 1080,
      0.1,
      100_000,
    );

    for (let step = 0; step <= 100; step += 1) {
      const progress = step / 100;
      const currentPoint = computeRouteFollowAnchor(
        worldRoutePoints,
        cumulativeDistances,
        progress,
      );
      const camPos = evaluateRailPosition(rail, progress);
      const camTarget = evaluateRailTarget(rail, progress);

      camera.position.set(camPos.x, camPos.y, camPos.z);
      camera.up.set(0, 1, 0);
      camera.lookAt(camTarget.x, camTarget.y, camTarget.z);
      camera.updateMatrixWorld(true);
      camera.updateProjectionMatrix();

      const ndc = new THREE.Vector3(
        currentPoint.x,
        currentPoint.y,
        currentPoint.z,
      ).project(camera);
      const context = `route progress ${progress.toFixed(2)}`;

      expect(Math.abs(ndc.x), `${context}: |NDC x| = ${Math.abs(ndc.x)}`)
        .toBeLessThanOrEqual(0.65);
      expect(ndc.y, `${context}: NDC y = ${ndc.y}`)
        .toBeGreaterThanOrEqual(-0.80);
      expect(ndc.y, `${context}: NDC y = ${ndc.y}`)
        .toBeLessThanOrEqual(-0.10);
    }
  });

  it('keeps the real-route look-ahead point inside the hard visibility bound', () => {
    const camera = new THREE.PerspectiveCamera(
      45,
      1920 / 1080,
      0.1,
      100_000,
    );

    for (let step = 0; step <= 100; step += 1) {
      const progress = step / 100;
      const lookAheadPoint = computeRouteFollowAnchor(
        worldRoutePoints,
        cumulativeDistances,
        Math.min(1, progress + 0.08),
      );
      const camPos = evaluateRailPosition(rail, progress);
      const camTarget = evaluateRailTarget(rail, progress);

      camera.position.set(camPos.x, camPos.y, camPos.z);
      camera.up.set(0, 1, 0);
      camera.lookAt(camTarget.x, camTarget.y, camTarget.z);
      camera.updateMatrixWorld(true);
      camera.updateProjectionMatrix();

      const cameraToPoint = new THREE.Vector3(
        lookAheadPoint.x - camPos.x,
        lookAheadPoint.y - camPos.y,
        lookAheadPoint.z - camPos.z,
      );
      const cameraForward = new THREE.Vector3(0, 0, -1)
        .applyQuaternion(camera.quaternion);
      const forwardDistance = cameraToPoint.dot(cameraForward);
      const ndc = new THREE.Vector3(
        lookAheadPoint.x,
        lookAheadPoint.y,
        lookAheadPoint.z,
      ).project(camera);
      const context = `route progress ${progress.toFixed(2)}`;

      expect(forwardDistance, `${context}: look-ahead point is behind the camera`)
        .toBeGreaterThan(0);
      expect(Math.abs(ndc.x), `${context}: look-ahead |NDC x| = ${Math.abs(ndc.x)}`)
        .toBeLessThanOrEqual(0.90);
      expect(ndc.y, `${context}: look-ahead NDC y = ${ndc.y}`)
        .toBeGreaterThanOrEqual(-0.90);
      expect(ndc.y, `${context}: look-ahead NDC y = ${ndc.y}`)
        .toBeLessThanOrEqual(0.90);
    }
  });

  it('retains forward route context at representative progress values', () => {
    for (const progress of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const camPos = evaluateRailPosition(rail, progress);
      const currentPoint = computeRouteFollowAnchor(
        worldRoutePoints,
        cumulativeDistances,
        progress,
      );
      const lookAheadPoint = computeRouteFollowAnchor(
        worldRoutePoints,
        cumulativeDistances,
        Math.min(1, progress + 0.08),
      );

      expect(
        distanceBetween(camPos, lookAheadPoint),
        `route progress ${progress.toFixed(2)}: look-ahead distance`,
      ).toBeGreaterThan(distanceBetween(camPos, currentPoint));
    }
  });
});
