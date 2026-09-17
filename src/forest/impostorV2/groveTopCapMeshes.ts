import * as THREE from 'three';

import { createGroveTopCapGeometry } from './groveTopCapGeometry';
import type { GroveTopCapMapping } from './groveTopCapMeta';
import { applyR10DepthHaze } from './r10DepthHaze';
import { applyR10TonePreset } from './r10TonePreset';
import type { ImpostorCellRef, ImpostorPlacementResult } from './types';

export interface GroveTopCapMeshBuild {
  object3D: THREE.Group;
  meshes: readonly THREE.InstancedMesh[];
  stats: { primitiveCount: number; drawCalls: number; triangles: number; vertices: number };
  dispose(): void;
}

export function createGroveTopCapMaterial(
  texture: THREE.Texture,
  alphaTest: number,
  tone = false,
  haze = false,
): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    alphaTest,
    transparent: false,
    depthWrite: true,
    depthTest: true,
    side: THREE.FrontSide,
    vertexColors: false,
    fog: true,
  });
  if (tone) {
    const color = applyR10TonePreset({ r: 1, g: 1, b: 1 }, true);
    material.color.setRGB(color.r, color.g, color.b);
  }
  material.premultipliedAlpha = false;
  material.name = 'forest-impostor-v2-grove-top-cap';
  applyR10DepthHaze(material, haze);
  return material;
}

export function createGroveTopCapMeshes(args: {
  placement: ImpostorPlacementResult;
  cells: readonly ImpostorCellRef[];
  mapping: GroveTopCapMapping;
  material: THREE.MeshBasicMaterial;
  shades?: Float32Array;
  tints?: Float32Array;
}): GroveTopCapMeshBuild {
  const { placement, cells, mapping, material, shades, tints } = args;
  const counts = new Uint32Array(cells.length);
  let primitiveCount = 0;
  for (let index = 0; index < placement.count; index += 1) {
    const slot = placement.cellSlots[index];
    if (cells[slot]?.kind !== 'grove') continue;
    counts[slot] += 1;
    primitiveCount += 1;
  }

  const group = new THREE.Group();
  group.name = 'forest-impostor-v2-top-cap';
  const meshes: THREE.InstancedMesh[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const meshForSlot = new Array<THREE.InstancedMesh | undefined>(cells.length);
  const localIndices = new Uint32Array(cells.length);
  const position = new THREE.Vector3();
  const axis = new THREE.Vector3(0, 1, 0);
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const color = shades ? new THREE.Color() : undefined;

  try {
    for (let slot = 0; slot < cells.length; slot += 1) {
      if (counts[slot] === 0) continue;
      const cell = cells[slot];
      const top = mapping.get(cell.key);
      if (cell.kind !== 'grove' || !top) throw new Error(`missing top cap mapping for ${cell.key}`);
      const geometry = createGroveTopCapGeometry(cell, top);
      geometries.push(geometry);
      const mesh = new THREE.InstancedMesh(geometry, material, counts[slot]);
      mesh.name = `forest-impostor-v2-top-cap-${cell.key}`;
      mesh.frustumCulled = true;
      meshForSlot[slot] = mesh;
      meshes.push(mesh);
      group.add(mesh);
    }

    for (let index = 0; index < placement.count; index += 1) {
      const slot = placement.cellSlots[index];
      if (cells[slot]?.kind !== 'grove') continue;
      const offset = index * 3;
      position.set(placement.positions[offset], placement.positions[offset + 1], placement.positions[offset + 2]);
      rotation.setFromAxisAngle(axis, placement.yawRadians[index]);
      // side の mirror sign は水平 quad の determinant と上面 winding を反転させるため、
      // cap は同じ width source を常に正値で使い、FrontSide の上面を維持する。
      scale.set(placement.widthMeters[index], placement.heightMeters[index], placement.widthMeters[index]);
      matrix.compose(position, rotation, scale);
      const localIndex = localIndices[slot];
      const mesh = meshForSlot[slot]!;
      mesh.setMatrixAt(localIndex, matrix);
      if (shades) {
        const shade = shades[index];
        if (tints) {
          color!.setRGB(
            shade * tints[index * 3],
            shade * tints[index * 3 + 1],
            shade * tints[index * 3 + 2],
          );
        } else {
          color!.setScalar(shade);
        }
        mesh.setColorAt(localIndex, color!);
      }
      localIndices[slot] += 1;
    }
    for (const mesh of meshes) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  } catch (error) {
    for (const geometry of geometries) geometry.dispose();
    throw error;
  }

  let disposed = false;
  return {
    object3D: group,
    meshes,
    stats: { primitiveCount, drawCalls: meshes.length, triangles: primitiveCount * 2, vertices: primitiveCount * 4 },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      for (const geometry of geometries) geometry.dispose();
    },
  };
}
