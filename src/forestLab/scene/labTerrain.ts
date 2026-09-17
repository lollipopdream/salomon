import * as THREE from 'three';

import { terrainMaterialDefaults } from '../../config/defaults/terrainVisual';
import { defaultSettings } from '../../config/settings';
import type { ForestMaskV2Data } from '../../forest/impostorV2/types';
import { loadForestMaskV2 } from '../../forest/impostorV2/forestMaskV2';
import { takaoTrail1Route } from '../../route/takaoTrail1Route';
import { resampleRouteToWorldPoints } from '../../route/routePath';
import { loadDemTilesWithFullResolution } from '../../terrain/demLoader';
import { computeTerrainVertexColors } from '../../terrain/terrainMaterial';
import { loadTerrainTexture } from '../../terrain/terrainTexture';
import type { ElevationGrid, Vec3 } from '../../types';
import { CANONICAL_COLS, CANONICAL_ROWS } from '../labConstants';
import type { PatchSpec } from '../labTypes';
import {
  buildPatchIndices,
  buildPatchTerrainUvs,
  buildPatchTerrainVertices,
} from '../patch/patchGrid';
import {
  DEM_TILE_URLS,
  FOREST_MASK_EXTENT_METERS,
  FOREST_MASK_SIZE,
  FOREST_MASK_URL,
  TERRAIN_TEXTURE_URL,
} from './labDataSources';

export interface LabTerrainData {
  grid: ElevationGrid;
  texture: THREE.Texture;
  mask: ForestMaskV2Data;
  vertexColors: Float32Array;
}

export async function loadLabTerrainData(maxAnisotropy?: number): Promise<LabTerrainData> {
  const [{ grid }, texture, mask] = await Promise.all([
    loadDemTilesWithFullResolution(DEM_TILE_URLS, defaultSettings.terrainOrigin, 256),
    loadTerrainTexture(TERRAIN_TEXTURE_URL, maxAnisotropy),
    loadForestMaskV2(FOREST_MASK_URL, FOREST_MASK_SIZE, FOREST_MASK_EXTENT_METERS),
  ]);
  const textureVertexColorConfig = {
    ...terrainMaterialDefaults,
    hillshadeMinFactor: terrainMaterialDefaults.textureHillshadeMinFactor ?? 1,
    hillshadeMaxFactor: terrainMaterialDefaults.textureHillshadeMaxFactor ?? 1,
  };
  const vertexColors = computeTerrainVertexColors(
    grid,
    defaultSettings,
    textureVertexColorConfig,
    defaultSettings.visual.lighting.directionalPosition,
    terrainMaterialDefaults.textureTintStrength,
  );
  return { grid, texture, mask, vertexColors };
}

function patchColors(vertexColors: Float32Array, patch: PatchSpec): Float32Array {
  if (vertexColors.length !== CANONICAL_ROWS * CANONICAL_COLS * 3) {
    throw new RangeError('Canonical terrain vertex colors have an unexpected length.');
  }
  const sizeRows = patch.rowEnd - patch.rowStart;
  const sizeCols = patch.colEnd - patch.colStart;
  const colors = new Float32Array((sizeRows + 1) * (sizeCols + 1) * 3);
  for (let localRow = 0; localRow <= sizeRows; localRow += 1) {
    for (let localCol = 0; localCol <= sizeCols; localCol += 1) {
      const canonicalIndex = (patch.rowStart + localRow) * CANONICAL_COLS
        + patch.colStart + localCol;
      const localIndex = localRow * (sizeCols + 1) + localCol;
      colors.set(
        vertexColors.subarray(canonicalIndex * 3, canonicalIndex * 3 + 3),
        localIndex * 3,
      );
    }
  }
  return colors;
}

export function createPatchTerrainMesh(
  grid: ElevationGrid,
  patch: PatchSpec,
  vertexColors: Float32Array,
  texture: THREE.Texture,
): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> {
  const sizeRows = patch.rowEnd - patch.rowStart;
  const sizeCols = patch.colEnd - patch.colStart;
  if (sizeRows !== sizeCols) throw new RangeError('Patch terrain must be square.');
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(buildPatchTerrainVertices(grid, patch, defaultSettings), 3),
  );
  geometry.setAttribute('uv', new THREE.BufferAttribute(buildPatchTerrainUvs(patch), 2));
  geometry.setAttribute('color', new THREE.BufferAttribute(patchColors(vertexColors, patch), 3));
  geometry.setIndex(new THREE.BufferAttribute(buildPatchIndices(sizeRows), 1));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    color: 0xffffff,
    roughness: terrainMaterialDefaults.roughness,
    metalness: terrainMaterialDefaults.metalness,
    map: texture,
  });
  return new THREE.Mesh(geometry, material);
}

interface ClippedSegment { start: Vec3; end: Vec3 }

function clipSegmentToPatch(a: Vec3, b: Vec3, patch: PatchSpec, cell: number): ClippedSegment | null {
  const xMin = patch.colStart * cell;
  const xMax = patch.colEnd * cell;
  const zMin = patch.rowStart * cell;
  const zMax = patch.rowEnd * cell;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  let enter = 0;
  let exit = 1;
  const boundaries: readonly [number, number][] = [
    [-dx, a.x - xMin],
    [dx, xMax - a.x],
    [-dz, a.z - zMin],
    [dz, zMax - a.z],
  ];
  for (const [p, q] of boundaries) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const ratio = q / p;
    if (p < 0) enter = Math.max(enter, ratio);
    else exit = Math.min(exit, ratio);
    if (enter > exit) return null;
  }
  const pointAt = (amount: number): Vec3 => ({
    x: a.x + (b.x - a.x) * amount,
    y: a.y + (b.y - a.y) * amount,
    z: a.z + (b.z - a.z) * amount,
  });
  return { start: pointAt(enter), end: pointAt(exit) };
}

export function createPatchRouteLine(
  grid: ElevationGrid,
  patch: PatchSpec,
): THREE.Line | null {
  const points = resampleRouteToWorldPoints(
    takaoTrail1Route,
    grid,
    defaultSettings,
    5,
    grid.cellSizeMeters * 0.5,
  );
  const positions: number[] = [];
  for (let index = 0; index + 1 < points.length; index += 1) {
    const clipped = clipSegmentToPatch(
      points[index],
      points[index + 1],
      patch,
      grid.cellSizeMeters,
    );
    if (!clipped) continue;
    positions.push(
      clipped.start.x, clipped.start.y, clipped.start.z,
      clipped.end.x, clipped.end.y, clipped.end.z,
    );
  }
  if (positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: defaultSettings.visual.route.coreColor,
    fog: true,
  });
  return new THREE.LineSegments(geometry, material);
}

export function createShellVertexColors(
  vertexColors: Float32Array,
  patch: PatchSpec,
  subdivision: number,
): Float32Array {
  if (vertexColors.length !== CANONICAL_ROWS * CANONICAL_COLS * 3) {
    throw new RangeError('Canonical terrain vertex colors have an unexpected length.');
  }
  if (!Number.isInteger(subdivision) || subdivision <= 0) {
    throw new RangeError('Shell subdivision must be a positive integer.');
  }
  const rows = (patch.rowEnd - patch.rowStart) * subdivision + 1;
  const cols = (patch.colEnd - patch.colStart) * subdivision + 1;
  const result = new Float32Array(rows * cols * 3);
  for (let j = 0; j < rows; j += 1) {
    const row = patch.rowStart + j / subdivision;
    const row0 = Math.floor(row);
    const row1 = Math.min(row0 + 1, CANONICAL_ROWS - 1);
    const ty = row - row0;
    for (let i = 0; i < cols; i += 1) {
      const col = patch.colStart + i / subdivision;
      const col0 = Math.floor(col);
      const col1 = Math.min(col0 + 1, CANONICAL_COLS - 1);
      const tx = col - col0;
      const target = (j * cols + i) * 3;
      for (let channel = 0; channel < 3; channel += 1) {
        const topLeft = vertexColors[(row0 * CANONICAL_COLS + col0) * 3 + channel];
        const topRight = vertexColors[(row0 * CANONICAL_COLS + col1) * 3 + channel];
        const bottomLeft = vertexColors[(row1 * CANONICAL_COLS + col0) * 3 + channel];
        const bottomRight = vertexColors[(row1 * CANONICAL_COLS + col1) * 3 + channel];
        const top = topLeft + (topRight - topLeft) * tx;
        const bottom = bottomLeft + (bottomRight - bottomLeft) * tx;
        result[target + channel] = top + (bottom - top) * ty;
      }
    }
  }
  return result;
}
