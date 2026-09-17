import * as THREE from 'three';

import { terrainMaterialDefaults } from '../../config/defaults/terrainVisual';
import {
  CANONICAL_CELL_SIZE_METERS,
  TERRAIN_UV_EXTENT_METERS,
} from '../labConstants';
import type { PatchSpec } from '../labTypes';

export interface BuildShellGeometryOptions {
  shellY: Float32Array;
  taper: Float32Array;
  patch: PatchSpec;
  subdivision: number;
  shellColors: Float32Array;
}

export interface CreateShellMeshOptions extends BuildShellGeometryOptions {
  texture: THREE.Texture;
}

function validateShellInput(options: BuildShellGeometryOptions): number {
  const rows = (options.patch.rowEnd - options.patch.rowStart) * options.subdivision + 1;
  const cols = (options.patch.colEnd - options.patch.colStart) * options.subdivision + 1;
  const count = rows * cols;
  if (!Number.isInteger(options.subdivision) || options.subdivision <= 0) {
    throw new RangeError('Shell subdivision must be a positive integer.');
  }
  if (options.shellY.length !== count || options.taper.length !== count) {
    throw new RangeError('Shell height and taper fields must match the shell grid.');
  }
  if (options.shellColors.length !== count * 3) {
    throw new RangeError('Shell colors must contain RGB values for every shell vertex.');
  }
  return cols;
}

export function buildShellGeometry(options: BuildShellGeometryOptions): THREE.BufferGeometry {
  const { shellY, taper, patch, subdivision, shellColors } = options;
  const side = validateShellInput(options);
  const rows = (patch.rowEnd - patch.rowStart) * subdivision + 1;
  const sourcePositions = new Float32Array(shellY.length * 3);
  const sourceUvs = new Float32Array(shellY.length * 2);

  for (let j = 0; j < rows; j += 1) {
    const z = (patch.rowStart + j / subdivision) * CANONICAL_CELL_SIZE_METERS;
    for (let i = 0; i < side; i += 1) {
      const sourceIndex = j * side + i;
      const x = (patch.colStart + i / subdivision) * CANONICAL_CELL_SIZE_METERS;
      const positionOffset = sourceIndex * 3;
      const uvOffset = sourceIndex * 2;
      sourcePositions[positionOffset] = x;
      sourcePositions[positionOffset + 1] = shellY[sourceIndex];
      sourcePositions[positionOffset + 2] = z;
      sourceUvs[uvOffset] = x / TERRAIN_UV_EXTENT_METERS;
      sourceUvs[uvOffset + 1] = 1 - z / TERRAIN_UV_EXTENT_METERS;
    }
  }

  const keptSourceIndices: number[] = [];
  const remap = new Int32Array(shellY.length).fill(-1);
  const indices: number[] = [];
  const addTriangle = (a: number, b: number, c: number): void => {
    if (taper[a] === 0 && taper[b] === 0 && taper[c] === 0) return;
    for (const sourceIndex of [a, b, c]) {
      if (remap[sourceIndex] === -1) {
        remap[sourceIndex] = keptSourceIndices.length;
        keptSourceIndices.push(sourceIndex);
      }
      indices.push(remap[sourceIndex]);
    }
  };

  for (let j = 0; j < rows - 1; j += 1) {
    for (let i = 0; i < side - 1; i += 1) {
      const topLeft = j * side + i;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + side;
      const bottomRight = bottomLeft + 1;
      addTriangle(topLeft, bottomLeft, topRight);
      addTriangle(topRight, bottomLeft, bottomRight);
    }
  }

  const positions = new Float32Array(keptSourceIndices.length * 3);
  const uvs = new Float32Array(keptSourceIndices.length * 2);
  const colors = new Float32Array(keptSourceIndices.length * 3);
  keptSourceIndices.forEach((sourceIndex, targetIndex) => {
    positions.set(sourcePositions.subarray(sourceIndex * 3, sourceIndex * 3 + 3), targetIndex * 3);
    uvs.set(sourceUvs.subarray(sourceIndex * 2, sourceIndex * 2 + 2), targetIndex * 2);
    colors.set(shellColors.subarray(sourceIndex * 3, sourceIndex * 3 + 3), targetIndex * 3);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
  geometry.computeVertexNormals();
  return geometry;
}

export function createShellMaterial(texture: THREE.Texture): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: texture,
    vertexColors: true,
    color: 0xffffff,
    roughness: terrainMaterialDefaults.roughness,
    metalness: terrainMaterialDefaults.metalness,
    side: THREE.FrontSide,
    transparent: false,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

export function createShellMesh(
  options: CreateShellMeshOptions,
): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
export function createShellMesh(
  options: BuildShellGeometryOptions,
  texture: THREE.Texture,
): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
export function createShellMesh(
  options: BuildShellGeometryOptions | CreateShellMeshOptions,
  texture?: THREE.Texture,
): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> {
  const resolvedTexture = texture ?? ('texture' in options ? options.texture : undefined);
  if (!resolvedTexture) throw new TypeError('Aerial texture is required for the shell mesh.');
  const mesh = new THREE.Mesh(
    buildShellGeometry(options),
    createShellMaterial(resolvedTexture),
  );
  mesh.frustumCulled = true;
  mesh.name = 'forest-lab-shell';
  return mesh;
}

export function disposeShell(mesh: THREE.Mesh): void {
  mesh.removeFromParent();
  mesh.geometry.dispose();
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const material of materials) material.dispose();
}
