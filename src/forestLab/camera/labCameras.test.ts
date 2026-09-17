import { describe, expect, it } from 'vitest';

import {
  CANOPY_HEIGHT_METERS,
  EDGE_TAPER_WIDTH_METERS,
  OVERVIEW_CAMERA,
  PRIMARY_CAMERA,
} from '../labConstants';
import { PATCH_MANIFEST_JSON } from '../scene/labDataSources';
import {
  computeClosePoseFromPatch,
  resolveCameraPose,
  resolveClosePose,
  resolveOverviewPose,
  resolvePrimaryPose,
} from './labCameras';

describe('lab cameras', () => {
  it('keeps PRIMARY position/fov exact and applies its zero delta', () => {
    const pose = resolvePrimaryPose(PATCH_MANIFEST_JSON);
    expect(pose.position).toEqual({
      x: 3762.40026479884,
      y: 742.5773908062001,
      z: 2669.094871624622,
    });
    expect(pose.fov).toBe(45);
    expect(PATCH_MANIFEST_JSON.cameraTargetAdjustment.PRIMARY).toEqual({ x: 0, y: 0, z: 0 });
    expect(pose.target).toEqual({
      x: PRIMARY_CAMERA.target[0],
      y: PRIMARY_CAMERA.target[1],
      z: PRIMARY_CAMERA.target[2],
    });
  });

  it('keeps OVERVIEW position/fov and adds the manifest target delta', () => {
    const pose = resolveOverviewPose(PATCH_MANIFEST_JSON);
    expect(pose.position).toEqual({
      x: 4891.096657075987,
      y: 1978.5250967097782,
      z: 4850.570741825779,
    });
    expect(pose.fov).toBe(45);
    const delta = PATCH_MANIFEST_JSON.cameraTargetAdjustment.OVERVIEW;
    expect(pose.target).toEqual({
      x: OVERVIEW_CAMERA.target[0] + delta.x,
      y: OVERVIEW_CAMERA.target[1] + delta.y,
      z: OVERVIEW_CAMERA.target[2] + delta.z,
    });
  });

  it('recomputes CLOSE from the fixed patch formula', () => {
    const expected = PATCH_MANIFEST_JSON.closeCamera;
    const result = computeClosePoseFromPatch({
      patch: PATCH_MANIFEST_JSON.patches[0],
      coverageAt: (x, z) => x === expected.anchor.x && z === expected.anchor.z ? 1 : 0,
      laplacianAt: () => 1,
      terrainYAt: (x, z) => x === expected.anchor.x && z === expected.anchor.z
        ? expected.anchor.y - CANOPY_HEIGHT_METERS
        : 0,
    });
    for (const key of ['x', 'y', 'z'] as const) {
      expect(result.position[key]).toBeCloseTo(expected.position[key], 9);
      expect(result.target[key]).toBeCloseTo(expected.target[key], 9);
    }
    expect(Math.hypot(
      result.position.x - result.target.x,
      result.position.z - result.target.z,
    )).toBeCloseTo(2 * EDGE_TAPER_WIDTH_METERS, 12);
    expect(180 / Math.PI * Math.atan(
      CANOPY_HEIGHT_METERS / (2 * EDGE_TAPER_WIDTH_METERS),
    )).toBeCloseTo(16.73, 2);
    expect(resolveClosePose(PATCH_MANIFEST_JSON)).toBe(PATCH_MANIFEST_JSON.closeCamera);
    expect(resolveCameraPose('CLOSE', PATCH_MANIFEST_JSON)).toBe(PATCH_MANIFEST_JSON.closeCamera);
  });
});
