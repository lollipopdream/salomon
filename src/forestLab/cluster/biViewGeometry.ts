import * as THREE from 'three';

import type { ImpostorCellRef } from '../../forest/impostorV2/types';

/**
 * Lab-only crossed-quad geometry that lets the TWO planes sample TWO DIFFERENT
 * baked views of the same cluster.
 *
 * WHY THIS EXISTS.
 * `createCrossedQuadGeometry` (production) gives both planes the SAME cell UV:
 *
 *   uv: [u0,v0, u1,v0, u1,v1, u0,v1,     <- plane A, spans +X, front normal +Z
 *        u0,v0, u1,v0, u1,v1, u0,v1]     <- plane B, spans +Z, front normal -X
 *
 * With `side: THREE.DoubleSide` that means every grove instance is literally two
 * copies of one ~20 m picture crossing at 90 degrees. At CLOSE range that reads as
 * a large vertical card / slab and a visible X, which is exactly the dominant
 * artifact in R7-G4 v1.
 *
 * R7 baked FOUR real-3D views of the G4 cluster (yaw 0/90/180/270, camera 18 deg
 * above the horizon, `camera_direction(yaw) = (sin y cos e, -cos y cos e, sin e)`
 * so the bake yaw IS the compass position of the camera). Giving plane B the view
 * that belongs to ITS orientation turns the pair into a coherent representation
 * instead of one picture shown twice.
 *
 * GEOMETRY, DERIVED NOT GUESSED.
 * Plane A vertices run xLow -> xHigh at yLow then back at yHigh; with index order
 * (0,1,2)(0,2,3) that winds counter-clockwise seen from +Z, so plane A's FRONT
 * normal is +Z and its texture "right" is +X.
 * Plane B vertices run zLow -> zHigh; edge0->1 is +Z and edge1->2 is +Y, and
 * Z x Y = -X, so plane B's FRONT normal is -X and its texture "right" is +Z.
 * Rotating +Z about +Y by phi gives (sin phi, 0, cos phi); that equals -X at
 * phi = -90 degrees. So plane B faces 90 degrees CLOCKWISE from plane A, and the
 * baked view it should display is the one whose camera sits there.
 *
 * The offset is a named constant rather than an inlined number because the sign
 * is the one thing a reader cannot verify by eye.
 *
 * VERIFIED, NOT ASSUMED (biViewYawOffset.test.ts).
 * An earlier revision of this comment called the sign "derived but unconfirmed",
 * because the 270 and 90 CLOSE renders differ on only 6.97% of pixels and neither
 * looks broken to the eye. Eyes were the wrong instrument. The offset is a
 * RELATIVE quantity and is fully determined by the two front normals:
 *   clusterMeshes orients each instance with R_Y(cell.yawDeg), so plane B at cell
 *   yaw theta points where plane A would point at cell yaw theta + d, where d is
 *   fixed by R_Y(theta) * nB == R_Y(theta + d) * nA.
 * Reading nA and nB out of the actual position/index arrays gives nA = +Z and
 * nB = -X, hence d = 270 for every cell yaw, and 90 is exactly 180 degrees wrong
 * (dot product -1). No assumption about the offline bake compass is needed.
 */
export const PLANE_B_BAKE_YAW_OFFSET_DEG = 270;

/** Plane A keeps `cell`; plane B samples `planeBCell`. Positions are untouched. */
export function createBiViewCrossedQuadGeometry(
  cell: ImpostorCellRef,
  planeBCell: ImpostorCellRef,
): THREE.BufferGeometry {
  const dU = cell.groundPivotInTight.u - 0.5;
  const dV = cell.groundPivotInTight.v;
  const xLow = -0.5 - dU;
  const xHigh = 0.5 - dU;
  const yLow = -dV;
  const yHigh = 1 - dV;
  const a = cell.uv;
  const b = planeBCell.uv;
  const geometry = new THREE.BufferGeometry();

  // Positions, normals and indices are byte-for-byte the production layout: this
  // adds no plane, no vertex and no triangle. Only plane B's UV differs.
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    xLow, yLow, 0, xHigh, yLow, 0, xHigh, yHigh, 0, xLow, yHigh, 0,
    0, yLow, xLow, 0, yLow, xHigh, 0, yHigh, xHigh, 0, yHigh, xLow,
  ], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([
    a.u0, a.v0, a.u1, a.v0, a.u1, a.v1, a.u0, a.v1,
    b.u0, b.v0, b.u1, b.v0, b.u1, b.v1, b.u0, b.v1,
  ], 2));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
  ], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  geometry.computeBoundingSphere();
  geometry.name = `forest-lab-bi-view-${cell.key}+${planeBCell.key}`;
  return geometry;
}
