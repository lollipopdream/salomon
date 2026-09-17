import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { ImpostorCellRef } from '../../forest/impostorV2/types';
import { createCrossedQuadGeometry } from '../../forest/impostorV2/impostorGeometry';
import { createBiViewCrossedQuadGeometry, PLANE_B_BAKE_YAW_OFFSET_DEG } from './biViewGeometry';
import { CLUSTER_GROVE_YAWS } from './clusterAssets';

/**
 * R7 STEP 1 -- yaw offset proof.
 *
 * `PLANE_B_BAKE_YAW_OFFSET_DEG` was previously "derived but unconfirmed": the
 * winding argument was written in prose, and the A/B images at 270 and 90 could
 * not be told apart by eye. Prose and eyes are the wrong instruments for a
 * coordinate contract, so this file decides it numerically instead.
 *
 * The proof needs NO assumption about how Blender's bake compass maps onto the
 * three.js world, because the offset is a RELATIVE quantity:
 *
 *   - `clusterMeshes` orients every grove instance with
 *     `rotation.setFromAxisAngle((0,1,0), degToRad(cell.yawDeg))`, i.e. R_Y(theta).
 *   - Plane A's front normal in local space is nA; plane B's is nB.
 *   - If R_Y(theta) * nB == R_Y(theta + d) * nA for some fixed d, then plane B at
 *     cell yaw theta is pointing exactly where plane A would point at cell yaw
 *     theta + d. Whatever real-world direction production means by "cell yaw",
 *     plane B must therefore display the baked view of cell yaw theta + d.
 *
 * So `d` IS the required offset, and `d` is fully determined by the two front
 * normals, which are in turn fully determined by the position and index arrays.
 */

function cellRef(key: string, yawDeg: number, u0: number): ImpostorCellRef {
  return {
    key,
    kind: 'grove',
    atlas: 'grove',
    groveConfig: 'G4',
    yawDeg,
    uv: { u0, v0: 0.25, u1: u0 + 0.1, v1: 0.45 },
    tightWorldWidth: 22.7,
    tightWorldHeight: 16.3,
    groundPivotInTight: { u: 0.5, v: 0.08 },
  } as unknown as ImpostorCellRef;
}

/** Front normal of the triangle fan starting at `indexOffset`, from the real arrays. */
function frontNormal(geometry: THREE.BufferGeometry, indexOffset: number): THREE.Vector3 {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex()!;
  const a = new THREE.Vector3().fromBufferAttribute(position, index.getX(indexOffset));
  const b = new THREE.Vector3().fromBufferAttribute(position, index.getX(indexOffset + 1));
  const c = new THREE.Vector3().fromBufferAttribute(position, index.getX(indexOffset + 2));
  // Right-handed winding: counter-clockwise seen from the front.
  return new THREE.Vector3()
    .subVectors(b, a)
    .cross(new THREE.Vector3().subVectors(c, b))
    .normalize();
}

function rotateY(vector: THREE.Vector3, degrees: number): THREE.Vector3 {
  return vector.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(degrees));
}

describe('R7 bi-view plane B yaw offset', () => {
  const planeA = cellRef('G4@0', 0, 0.0);
  const planeB = cellRef('G4@270', 270, 0.2);

  it('reads plane A front normal +Z and plane B front normal -X straight from the arrays', () => {
    const geometry = createBiViewCrossedQuadGeometry(planeA, planeB);
    const nA = frontNormal(geometry, 0);
    const nB = frontNormal(geometry, 6);

    expect(nA.x).toBeCloseTo(0, 12);
    expect(nA.y).toBeCloseTo(0, 12);
    expect(nA.z).toBeCloseTo(1, 12);

    expect(nB.x).toBeCloseTo(-1, 12);
    expect(nB.y).toBeCloseTo(0, 12);
    expect(nB.z).toBeCloseTo(0, 12);
    geometry.dispose();
  });

  it('production crossed quad has the SAME two normals, so the offset is about UV only', () => {
    const production = createCrossedQuadGeometry(planeA);
    const biView = createBiViewCrossedQuadGeometry(planeA, planeB);
    expect(frontNormal(production, 0).toArray()).toEqual(frontNormal(biView, 0).toArray());
    expect(frontNormal(production, 6).toArray()).toEqual(frontNormal(biView, 6).toArray());
    // And positions/indices are untouched: no extra plane, vertex or triangle.
    expect(Array.from(production.getAttribute('position').array))
      .toEqual(Array.from(biView.getAttribute('position').array));
    expect(Array.from(production.getIndex()!.array)).toEqual(Array.from(biView.getIndex()!.array));
    production.dispose();
    biView.dispose();
  });

  it('solves the offset: R_Y(theta)*nB equals R_Y(theta + 270)*nA for every cell yaw', () => {
    const geometry = createBiViewCrossedQuadGeometry(planeA, planeB);
    const nA = frontNormal(geometry, 0);
    const nB = frontNormal(geometry, 6);

    for (const theta of CLUSTER_GROVE_YAWS) {
      const planeBWorld = rotateY(nB, theta);
      // Search all four bake yaws; exactly one may match.
      const matches = CLUSTER_GROVE_YAWS.filter(
        (candidate) => rotateY(nA, theta + candidate).dot(planeBWorld) > 0.999999,
      );
      expect(matches, `cell yaw ${theta} must have exactly one matching offset`).toHaveLength(1);
      expect(matches[0], `cell yaw ${theta} resolves to offset ${matches[0]}`)
        .toBe(PLANE_B_BAKE_YAW_OFFSET_DEG);
    }
    geometry.dispose();
  });

  it('rejects the alternative sign: offset 90 points plane B the opposite way', () => {
    const geometry = createBiViewCrossedQuadGeometry(planeA, planeB);
    const nA = frontNormal(geometry, 0);
    const nB = frontNormal(geometry, 6);
    // 90 is the value the images could not rule out. Numerically it is 180 deg off.
    expect(rotateY(nA, 90).dot(rotateY(nB, 0))).toBeCloseTo(-1, 12);
    expect(rotateY(nA, 270).dot(rotateY(nB, 0))).toBeCloseTo(1, 12);
    geometry.dispose();
  });

  it('the offset constant is 270', () => {
    expect(PLANE_B_BAKE_YAW_OFFSET_DEG).toBe(270);
  });
});
