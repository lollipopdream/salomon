import * as THREE from 'three';

import type { ImpostorCellRef } from './types';

export function createCrossedQuadGeometry(cell: ImpostorCellRef): THREE.BufferGeometry {
  const dU = cell.groundPivotInTight.u - 0.5;
  const dV = cell.groundPivotInTight.v;
  const xLow = -0.5 - dU;
  const xHigh = 0.5 - dU;
  const yLow = -dV;
  const yHigh = 1 - dV;
  const { u0, v0, u1, v1 } = cell.uv;
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    xLow, yLow, 0, xHigh, yLow, 0, xHigh, yHigh, 0, xLow, yHigh, 0,
    0, yLow, xLow, 0, yLow, xHigh, 0, yHigh, xHigh, 0, yHigh, xLow,
  ], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([
    u0, v0, u1, v0, u1, v1, u0, v1,
    u0, v0, u1, v0, u1, v1, u0, v1,
  ], 2));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
  ], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  geometry.computeBoundingSphere();
  geometry.name = `forest-impostor-v2-${cell.key}`;
  return geometry;
}
