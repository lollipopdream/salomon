import * as THREE from 'three';

import type { GroveTopCapCell } from './groveTopCapMeta';
import type { ImpostorCellRef } from './types';

export function createGroveTopCapGeometry(
  sideCell: ImpostorCellRef,
  top: GroveTopCapCell,
): THREE.BufferGeometry {
  const sx = 1 / sideCell.tightWorldWidth;
  const sy = 1 / sideCell.tightWorldHeight;
  const xMin = top.tightWorldBounds.rightMin * sx;
  const xMax = top.tightWorldBounds.rightMax * sx;
  const zMin = -top.tightWorldBounds.depthMax * sx;
  const zMax = -top.tightWorldBounds.depthMin * sx;
  const y = top.capHeightWorld * sy;
  const { u0: tu0, v0: tv0, u1: tu1, v1: tv1 } = top.alphaTightBoundsUV;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    xMin, y, zMax,
    xMax, y, zMax,
    xMax, y, zMin,
    xMin, y, zMin,
  ], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([
    tu0, tv0, tu1, tv0, tu1, tv1, tu0, tv1,
  ], 2));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
  ], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeBoundingSphere();
  geometry.name = `forest-impostor-v2-top-cap-${top.cellId}`;
  return geometry;
}
