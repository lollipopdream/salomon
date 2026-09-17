import * as THREE from 'three';

import type { ForestBillboardConfig } from '../types';
import { createCanopyCardTexture, createCanopyCardTextureData } from './canopyCardTexture';
import { createSingleMeshBuild, type ForestVariantBuild } from './forestBuild';
import { computeSizeFromUnit } from './forestDensity';
import type { ForestPlacementResult } from './forestPlacement';

const UP_AXIS = new THREE.Vector3(0, 1, 0);

export function createBillboardForest(
  placement: ForestPlacementResult,
  config: ForestBillboardConfig,
  now: () => number,
): ForestVariantBuild {
  const startedAt = now();
  const textureData = createCanopyCardTextureData(config);
  const texture = createCanopyCardTexture(textureData);
  const geometry = createCrossQuadGeometry(config);
  const material = new THREE.MeshStandardMaterial({
    map: texture, alphaTest: config.alphaTest, transparent: false, side: THREE.DoubleSide,
    roughness: 0.9, metalness: 0, color: config.tintColor, vertexColors: true, flatShading: false,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, placement.count);
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();

  for (let index = 0; index < placement.count; index += 1) {
    position.set(placement.positions[index * 3], placement.positions[index * 3 + 1], placement.positions[index * 3 + 2]);
    rotation.setFromAxisAngle(UP_AXIS, placement.rotationsY[index]);
    const height = computeSizeFromUnit(placement.sizeUnits[index], config.minHeightMeters, config.maxHeightMeters);
    scale.setScalar(height);
    matrix.compose(position, rotation, scale);
    mesh.setMatrixAt(index, matrix);
    setInstanceColor(color, placement.colorUnits[index], config.colorJitterStrength);
    mesh.setColorAt(index, color);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor!.needsUpdate = true;
  mesh.computeBoundingSphere();

  return createSingleMeshBuild({
    mesh, textures: [texture],
    stats: {
      variantId: 'billboard', instanceCount: placement.count, trianglesPerInstance: 6,
      totalTriangles: placement.count * 6, drawCalls: 1, instanceMatrixBytes: placement.count * 64,
      textureBytes: textureData.size * textureData.size * 4, buildElapsedMs: now() - startedAt,
    },
  });
}

function createCrossQuadGeometry(config: ForestBillboardConfig): THREE.BufferGeometry {
  const halfWidth = config.aspectRatio * 0.5;
  const topHalfWidth = config.aspectRatio * config.topCardSizeRatio * 0.5;
  const topY = config.topCardHeightRatio;
  const positions = new Float32Array([
    -halfWidth, 0, 0, halfWidth, 0, 0, halfWidth, 1, 0, -halfWidth, 1, 0,
    0, 0, -halfWidth, 0, 0, halfWidth, 0, 1, halfWidth, 0, 1, -halfWidth,
    -topHalfWidth, topY, -topHalfWidth, topHalfWidth, topY, -topHalfWidth,
    topHalfWidth, topY, topHalfWidth, -topHalfWidth, topY, topHalfWidth,
  ]);
  const normals = new Float32Array(36);
  for (let index = 0; index < 12; index += 1) normals[index * 3 + 1] = 1;
  const uvs = new Float32Array([
    0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11]);
  geometry.computeBoundingSphere();
  return geometry;
}

function setInstanceColor(color: THREE.Color, unit: number, strength: number): void {
  const variation = (unit - 0.5) * strength;
  color.setHSL(0.32 + variation * 0.08, 0.12 + strength * 0.12, 0.82 + variation * 0.3);
}
