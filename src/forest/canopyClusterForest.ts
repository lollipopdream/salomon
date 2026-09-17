import * as THREE from 'three';

import type { ForestCanopyConfig } from '../types';
import { createSingleMeshBuild, type ForestVariantBuild } from './forestBuild';
import { computeSizeFromUnit } from './forestDensity';
import type { ForestPlacementResult } from './forestPlacement';
import { createCanopyBlobGeometry } from './canopyBlobGeometry';

const UP_AXIS = new THREE.Vector3(0, 1, 0);

export function createCanopyClusterForest(
  placement: ForestPlacementResult,
  config: ForestCanopyConfig,
  now: () => number,
): ForestVariantBuild {
  const startedAt = now();
  const geometry = createCanopyBlobGeometry(config);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0,
    vertexColors: true,
    flatShading: true,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, placement.count);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(placement.count * 3), 3);
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();

  for (let index = 0; index < placement.count; index += 1) {
    const radius = computeSizeFromUnit(
      placement.sizeUnits[index],
      config.minRadiusMeters,
      config.maxRadiusMeters,
    );
    position.set(
      placement.positions[index * 3],
      placement.positions[index * 3 + 1],
      placement.positions[index * 3 + 2],
    );
    rotation.setFromAxisAngle(UP_AXIS, placement.rotationsY[index]);
    scale.set(radius, radius * config.heightRatio, radius);
    matrix.compose(position, rotation, scale);
    mesh.setMatrixAt(index, matrix);
    setInstanceColor(color, config.color, placement.colorUnits[index], config.colorJitterStrength);
    mesh.setColorAt(index, color);
  }

  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();

  return createSingleMeshBuild({
    mesh,
    stats: {
      variantId: 'canopy',
      instanceCount: placement.count,
      trianglesPerInstance: 20,
      totalTriangles: placement.count * 20,
      drawCalls: 1,
      instanceMatrixBytes: placement.count * 64,
      textureBytes: 0,
      buildElapsedMs: now() - startedAt,
    },
  });
}

function setInstanceColor(color: THREE.Color, baseColor: number, unit: number, strength: number): void {
  const variation = (unit - 0.5) * strength;
  color.set(baseColor);
  color.offsetHSL(variation * 0.08, 0, variation * 0.2);
}
