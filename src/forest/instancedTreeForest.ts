import * as THREE from 'three';

import type { ForestTreeConfig } from '../types';
import { createSingleMeshBuild, type ForestVariantBuild } from './forestBuild';
import { computeSizeFromUnit } from './forestDensity';
import type { ForestPlacementResult } from './forestPlacement';
import { createTreeGeometry } from './treeGeometry';

export function createInstancedTreeForest(
  placement: ForestPlacementResult,
  config: ForestTreeConfig,
  now: () => number,
): ForestVariantBuild {
  const startedAt = now();
  const geometry = createTreeGeometry(config);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0,
    vertexColors: true,
    flatShading: true,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, placement.count);
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();

  for (let index = 0; index < placement.count; index += 1) {
    position.set(
      placement.positions[index * 3],
      placement.positions[index * 3 + 1],
      placement.positions[index * 3 + 2],
    );
    const halfRotationY = placement.rotationsY[index] * 0.5;
    rotation.set(0, Math.sin(halfRotationY), 0, Math.cos(halfRotationY));
    const size = computeSizeFromUnit(
      placement.sizeUnits[index],
      config.minHeightMeters,
      config.maxHeightMeters,
    );
    scale.setScalar(size);
    matrix.compose(position, rotation, scale);
    mesh.setMatrixAt(index, matrix);
    setInstanceColor(color, placement.colorUnits[index], config.colorJitterStrength);
    mesh.setColorAt(index, color);
  }

  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor!.needsUpdate = true;
  mesh.computeBoundingSphere();

  return createSingleMeshBuild({
    mesh,
    stats: {
      variantId: 'instanced',
      instanceCount: placement.count,
      trianglesPerInstance: 30,
      totalTriangles: placement.count * 30,
      drawCalls: 1,
      instanceMatrixBytes: placement.count * 64,
      textureBytes: 0,
      buildElapsedMs: now() - startedAt,
    },
  });
}

function setInstanceColor(color: THREE.Color, unit: number, strength: number): void {
  const variation = (unit - 0.5) * strength;
  color.setHSL(0.32 + variation * 0.08, 0.12 + strength * 0.12, 0.82 + variation * 0.3);
}
