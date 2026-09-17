import * as THREE from 'three';

import type { ForestTreeConfig } from '../types';

/** Creates one normalized, deterministic low-poly tree (30 triangles). */
export function createTreeGeometry(config: ForestTreeConfig): THREE.BufferGeometry {
  const crownHeight = 1 - config.crownBaseRatio;
  const crown = new THREE.ConeGeometry(
    config.crownRadiusRatio,
    crownHeight,
    config.crownRadialSegments,
    config.crownHeightSegments,
    true,
  );
  const crownPosition = crown.getAttribute('position');
  const crownNormal = crown.getAttribute('normal');
  const crownIndex = crown.index!;
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const crownColor = new THREE.Color(config.crownColor);
  const trunkColor = new THREE.Color(config.trunkColor);

  for (let index = 0; index < crownPosition.count; index += 1) {
    const x = crownPosition.getX(index);
    const y = crownPosition.getY(index) + config.crownBaseRatio + crownHeight / 2;
    const z = crownPosition.getZ(index);
    const shade = config.crownBottomShade + (1 - config.crownBottomShade) * (
      (y - config.crownBaseRatio) / crownHeight
    );
    positions.push(x, y, z);
    normals.push(crownNormal.getX(index), crownNormal.getY(index), crownNormal.getZ(index));
    colors.push(crownColor.r * shade, crownColor.g * shade, crownColor.b * shade);
  }
  for (let index = 0; index < crownIndex.count; index += 1) indices.push(crownIndex.getX(index));

  const crownBaseVertex = positions.length / 3;
  addVertex(positions, normals, colors, 0, config.crownBaseRatio, 0, 0, -1, 0, crownColor, config.crownBottomShade);
  for (let side = 0; side < config.crownRadialSegments; side += 1) {
    const angle = (side / config.crownRadialSegments) * Math.PI * 2;
    addVertex(
      positions,
      normals,
      colors,
      Math.cos(angle) * config.crownRadiusRatio,
      config.crownBaseRatio,
      Math.sin(angle) * config.crownRadiusRatio,
      0,
      -1,
      0,
      crownColor,
      config.crownBottomShade,
    );
  }
  for (let side = 0; side < config.crownRadialSegments; side += 1) {
    indices.push(crownBaseVertex, crownBaseVertex + 1 + ((side + 1) % config.crownRadialSegments), crownBaseVertex + 1 + side);
  }

  const trunkBaseVertex = positions.length / 3;
  for (const y of [0, config.crownBaseRatio]) {
    for (let side = 0; side < 3; side += 1) {
      const angle = (side / 3) * Math.PI * 2;
      addVertex(
        positions,
        normals,
        colors,
        Math.cos(angle) * config.trunkRadiusRatio,
        y,
        Math.sin(angle) * config.trunkRadiusRatio,
        Math.cos(angle),
        0,
        Math.sin(angle),
        trunkColor,
        1,
      );
    }
  }
  for (let side = 0; side < 3; side += 1) {
    const next = (side + 1) % 3;
    indices.push(trunkBaseVertex + side, trunkBaseVertex + next, trunkBaseVertex + 3 + next);
    indices.push(trunkBaseVertex + side, trunkBaseVertex + 3 + next, trunkBaseVertex + 3 + side);
  }

  crown.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  return geometry;
}

function addVertex(
  positions: number[],
  normals: number[],
  colors: number[],
  x: number,
  y: number,
  z: number,
  normalX: number,
  normalY: number,
  normalZ: number,
  color: THREE.Color,
  shade: number,
): void {
  positions.push(x, y, z);
  normals.push(normalX, normalY, normalZ);
  colors.push(color.r * shade, color.g * shade, color.b * shade);
}
