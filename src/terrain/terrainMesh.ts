import * as THREE from 'three';

import { elevationToWorldHeight } from '../geo/elevation';
import type { AppSettings, ElevationGrid } from '../types';
import { computeTerrainUVs } from './terrainUv';

/** Compute row-major terrain vertex positions in the local world coordinate system. */
export function computeTerrainVertices(
  grid: ElevationGrid,
  settings: AppSettings,
): Float32Array {
  const vertices = new Float32Array(grid.rows * grid.cols * 3);

  for (let index = 0; index < grid.rows * grid.cols; index += 1) {
    const row = Math.floor(index / grid.cols);
    const col = index % grid.cols;
    const vertexOffset = index * 3;

    vertices[vertexOffset] = col * grid.cellSizeMeters;
    vertices[vertexOffset + 1] = elevationToWorldHeight(
      grid.values[index],
      settings.elevationScale,
    );
    vertices[vertexOffset + 2] = row * grid.cellSizeMeters;
  }

  return vertices;
}

/**
 * Build the Three.js geometry integration layer from computed vertex and UV data.
 */
export function buildTerrainGeometry(
  grid: ElevationGrid,
  settings: AppSettings,
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(computeTerrainVertices(grid, settings), 3),
  );
  geometry.setAttribute(
    'uv',
    new THREE.BufferAttribute(computeTerrainUVs(grid), 2),
  );

  const indices: number[] = [];
  for (let row = 0; row < grid.rows - 1; row += 1) {
    for (let col = 0; col < grid.cols - 1; col += 1) {
      const topLeft = row * grid.cols + col;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + grid.cols;
      const bottomRight = bottomLeft + 1;

      // Counter-clockwise from above so a flat terrain's normals point upward.
      indices.push(topLeft, bottomLeft, topRight);
      indices.push(topRight, bottomLeft, bottomRight);
    }
  }

  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}
