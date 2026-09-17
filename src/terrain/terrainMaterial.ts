import * as THREE from 'three';

import { elevationToWorldHeight } from '../geo/elevation';
import type {
  AppSettings,
  ElevationGrid,
  TerrainMaterialConfig,
  Vec3,
} from '../types';
import { computeEdgeFadeFactors } from './terrainEdgeFade';
import { applyTerrainTextureColorAdjustment } from './terrainTextureAdjust';

const NEIGHBOR_STEP = 2;

function colorToNormalizedRgb(color: number): [number, number, number] {
  return [
    ((color >> 16) & 0xff) / 255,
    ((color >> 8) & 0xff) / 255,
    (color & 0xff) / 255,
  ];
}

/** Compute row-major per-vertex colors by interpolating across elevations. */
export function computeElevationTintColors(
  grid: ElevationGrid,
  config: TerrainMaterialConfig,
): Float32Array {
  const vertexCount = grid.rows * grid.cols;
  let minElevation = Number.POSITIVE_INFINITY;
  let maxElevation = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < vertexCount; index += 1) {
    const elevation = grid.values[index];
    if (elevation < minElevation) {
      minElevation = elevation;
    }
    if (elevation > maxElevation) {
      maxElevation = elevation;
    }
  }

  const colors = new Float32Array(vertexCount * 3);
  const low = colorToNormalizedRgb(config.lowElevationColor);
  const high = colorToNormalizedRgb(config.highElevationColor);
  const elevationRange = maxElevation - minElevation;

  for (let index = 0; index < vertexCount; index += 1) {
    const interpolation = elevationRange === 0
      ? 0
      : (grid.values[index] - minElevation) / elevationRange;
    const offset = index * 3;

    colors[offset] = low[0] + (high[0] - low[0]) * interpolation;
    colors[offset + 1] = low[1] + (high[1] - low[1]) * interpolation;
    colors[offset + 2] = low[2] + (high[2] - low[2]) * interpolation;
  }

  return colors;
}

/** Compute approximate row-major per-vertex normals from elevation gradients. */
export function computeVertexNormalsApprox(
  grid: ElevationGrid,
  settings: AppSettings,
): Float32Array {
  const normals = new Float32Array(grid.rows * grid.cols * 3);

  for (let row = 0; row < grid.rows; row += 1) {
    const upRow = Math.max(row - NEIGHBOR_STEP, 0);
    const downRow = Math.min(row + NEIGHBOR_STEP, grid.rows - 1);

    for (let col = 0; col < grid.cols; col += 1) {
      const leftCol = Math.max(col - NEIGHBOR_STEP, 0);
      const rightCol = Math.min(col + NEIGHBOR_STEP, grid.cols - 1);
      const hLeft = elevationToWorldHeight(
        grid.values[row * grid.cols + leftCol],
        settings.elevationScale,
      );
      const hRight = elevationToWorldHeight(
        grid.values[row * grid.cols + rightCol],
        settings.elevationScale,
      );
      const hUp = elevationToWorldHeight(
        grid.values[upRow * grid.cols + col],
        settings.elevationScale,
      );
      const hDown = elevationToWorldHeight(
        grid.values[downRow * grid.cols + col],
        settings.elevationScale,
      );
      const dHdCol = (hRight - hLeft)
        / ((rightCol - leftCol) * grid.cellSizeMeters);
      const dHdRow = (hDown - hUp)
        / ((downRow - upRow) * grid.cellSizeMeters);
      const normalX = -dHdCol;
      const normalY = 1;
      const normalZ = -dHdRow;
      const normalLength = Math.hypot(normalX, normalY, normalZ);
      const offset = (row * grid.cols + col) * 3;

      normals[offset] = normalX / normalLength;
      normals[offset + 1] = normalY / normalLength;
      normals[offset + 2] = normalZ / normalLength;
    }
  }

  return normals;
}

/** Compute one contrast-stretched relief factor (0..1) per vertex normal. */
export function computeHillshadeFactors(
  normals: Float32Array,
  lightDirection: Vec3,
): Float32Array {
  const vertexCount = normals.length / 3;
  const lightLength = Math.sqrt(
    lightDirection.x ** 2 + lightDirection.y ** 2 + lightDirection.z ** 2,
  );
  const lx = lightDirection.x / lightLength;
  const ly = lightDirection.y / lightLength;
  const lz = lightDirection.z / lightLength;

  // Pass 1: compute the dot product for every vertex and find the actual observed min/max.
  const dots = new Float32Array(vertexCount);
  let minDot = Number.POSITIVE_INFINITY;
  let maxDot = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < vertexCount; i += 1) {
    const offset = i * 3;
    const dot =
      normals[offset] * lx + normals[offset + 1] * ly + normals[offset + 2] * lz;
    dots[i] = dot;
    if (dot < minDot) minDot = dot;
    if (dot > maxDot) maxDot = dot;
  }

  const range = maxDot - minDot;
  const factors = new Float32Array(vertexCount);
  for (let i = 0; i < vertexCount; i += 1) {
    // Stretch the actually observed dot-product range [minDot, maxDot] to [0,1] (contrast stretch).
    // If range is ~0 (e.g. fully flat/uniform-slope terrain), stretching is impossible, so fall back
    // to the raw dot value clamped to [0,1] (degenerate case fallback; there is no contrast to add).
    const normalizedDot =
      range > 1e-6 ? (dots[i] - minDot) / range : Math.max(0, Math.min(1, dots[i]));
    factors[i] = Math.max(0, Math.min(1, normalizedDot));
  }

  return factors;
}

/** Layer hillshade brightness modulation onto elevation-based vertex colors. */
export function computeTerrainVertexColors(
  grid: ElevationGrid,
  settings: AppSettings,
  config: TerrainMaterialConfig,
  lightDirection: Vec3,
  textureTintStrength?: number,
): Float32Array {
  const elevationColors = computeElevationTintColors(grid, config);

  if (textureTintStrength !== undefined) {
    for (let offset = 0; offset < elevationColors.length; offset += 1) {
      elevationColors[offset] = 1 - (1 - elevationColors[offset]) * textureTintStrength;
    }
  }

  const normals = computeVertexNormalsApprox(grid, settings);
  const hillshade = computeHillshadeFactors(normals, lightDirection);
  const colors = new Float32Array(elevationColors.length);
  const { hillshadeMinFactor, hillshadeMaxFactor } = config;
  const factorRange = hillshadeMaxFactor - hillshadeMinFactor;

  for (let vertexIndex = 0; vertexIndex < hillshade.length; vertexIndex += 1) {
    const factor = hillshadeMinFactor + hillshade[vertexIndex] * factorRange;
    const offset = vertexIndex * 3;

    colors[offset] = Math.min(1, elevationColors[offset] * factor);
    colors[offset + 1] = Math.min(1, elevationColors[offset + 1] * factor);
    colors[offset + 2] = Math.min(1, elevationColors[offset + 2] * factor);
  }

  if (config.edgeFade?.enabled) {
    const edgeFadeFactors = computeEdgeFadeFactors(grid, config.edgeFade);
    const fadeColor = colorToNormalizedRgb(config.edgeFade.fadeColor);

    for (let vertexIndex = 0; vertexIndex < edgeFadeFactors.length; vertexIndex += 1) {
      const fadeFactor = edgeFadeFactors[vertexIndex];
      const offset = vertexIndex * 3;

      colors[offset] = fadeColor[0] + (colors[offset] - fadeColor[0]) * fadeFactor;
      colors[offset + 1] = fadeColor[1]
        + (colors[offset + 1] - fadeColor[1]) * fadeFactor;
      colors[offset + 2] = fadeColor[2]
        + (colors[offset + 2] - fadeColor[2]) * fadeFactor;
    }
  }

  return colors;
}

/** Attach elevation tint and hillshade colors and create the terrain material. */
export function applyTerrainMaterial(
  geometry: THREE.BufferGeometry,
  grid: ElevationGrid,
  settings: AppSettings,
  config: TerrainMaterialConfig,
  lightDirection: Vec3,
  texture?: THREE.Texture,
): THREE.MeshStandardMaterial {
  // A real aerial photo already contains natural shadow detail and the standard
  // material adds lighting from the accurate mesh normals. Keep the stronger
  // procedural hillshade only for the no-texture fallback, where it supplies
  // the depth cue that the elevation tint cannot provide by itself. When a
  // texture is present, textureHillshadeMinFactor/MaxFactor allow a light
  // hillshade overlay (default 1/1 = no overlay) instead of always forcing
  // it fully off.
  const vertexColorConfig = texture === undefined
    ? config
    : {
        ...config,
        hillshadeMinFactor: config.textureHillshadeMinFactor ?? 1,
        hillshadeMaxFactor: config.textureHillshadeMaxFactor ?? 1,
      };
  const colors = computeTerrainVertexColors(
    grid,
    settings,
    vertexColorConfig,
    lightDirection,
    texture === undefined ? undefined : config.textureTintStrength,
  );
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  if (texture !== undefined && config.textureColorAdjust !== undefined) {
    // Near-field texture detail (F4): anisotropic filtering (already wired up
    // where the texture is loaded) plus this saturation/contrast adjustment
    // give a meaningful sharpness/richness improvement for close-up shots.
    // Adding textureRepeat-based tiling was considered but rejected: this
    // scene uses a single bespoke aerial photo asset, and tiling it would
    // introduce visible seams/repetition artifacts that are a larger visual
    // regression risk than the near-field softness they'd be fixing.
    applyTerrainTextureColorAdjustment(texture, config.textureColorAdjust);
  }

  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    color: 0xffffff,
    roughness: config.roughness,
    metalness: config.metalness,
    map: texture ?? null,
  });
}
