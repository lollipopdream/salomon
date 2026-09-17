import * as THREE from 'three';

import { createCrossedQuadGeometry } from './impostorGeometry';
import type { ImpostorCellRef, ImpostorPlacementResult } from './types';

export interface ImpostorMeshBuild {
  object3D: THREE.Group;
  meshes: readonly THREE.InstancedMesh[];
  stats: {
    instanceCount: number; drawCalls: number; triangles: number;
    vertices: number; instanceBytes: number;
    perCell: readonly { key: string; count: number }[];
  };
  dispose(): void;
}

export function createImpostorMeshes(args: {
  placement: ImpostorPlacementResult;
  cells: readonly ImpostorCellRef[];
  materialFor: (cell: ImpostorCellRef) => THREE.Material;
  shades?: Float32Array;
  tints?: Float32Array;
}): ImpostorMeshBuild {
  const { placement, cells, materialFor, shades, tints } = args;
  const counts = new Uint32Array(cells.length);
  for (let index = 0; index < placement.count; index += 1) counts[placement.cellSlots[index]] += 1;

  const group = new THREE.Group();
  group.name = 'forest-impostor-v2';
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
      const count = counts[slot];
      if (count === 0) continue;
      const geometry = createCrossedQuadGeometry(cells[slot]);
      geometries.push(geometry);
      const mesh = new THREE.InstancedMesh(geometry, materialFor(cells[slot]), count);
      mesh.name = `forest-impostor-v2-${cells[slot].key}`;
      mesh.frustumCulled = true;
      meshForSlot[slot] = mesh;
      meshes.push(mesh);
      group.add(mesh);
    }

    for (let index = 0; index < placement.count; index += 1) {
      const slot = placement.cellSlots[index];
      const mesh = meshForSlot[slot]!;
      const offset = index * 3;
      const sign = placement.mirrored[index] === 1 ? -1 : 1;
      position.set(placement.positions[offset], placement.positions[offset + 1], placement.positions[offset + 2]);
      rotation.setFromAxisAngle(axis, placement.yawRadians[index]);
      scale.set(placement.widthMeters[index] * sign, placement.heightMeters[index], placement.widthMeters[index]);
      matrix.compose(position, rotation, scale);
      const localIndex = localIndices[slot];
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

  const perCell = cells.flatMap((cell, slot) => (
    counts[slot] === 0 ? [] : [{ key: cell.key, count: counts[slot] }]
  ));
  let disposed = false;
  return {
    object3D: group,
    meshes,
    stats: {
      instanceCount: placement.count,
      drawCalls: meshes.length,
      triangles: placement.count * 4,
      vertices: placement.count * 8,
      instanceBytes: placement.count * (shades ? 76 : 64),
      perCell,
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      for (const geometry of geometries) geometry.dispose();
    },
  };
}
