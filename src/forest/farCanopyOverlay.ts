import * as THREE from 'three';

import type { FarCanopyConfig } from '../config/defaults/farCanopy';
import { terrainMaterialDefaults } from '../config/defaults/terrainVisual';
import { computeTerrainVertexColors } from '../terrain/terrainMaterial';
import { computeTerrainVertices } from '../terrain/terrainMesh';
import type { AppSettings, ElevationGrid } from '../types';

import {
  computeRawMacroShade,
  normalizeMacroShade,
  type MacroShadeConfig,
} from './macroShade';
import { applyR10DepthHaze } from './impostorV2/r10DepthHaze';
import { applyR10TonePreset } from './impostorV2/r10TonePreset';

/**
 * R10 final の FAR canopy layer を actual app へ preview-only で載せる。
 *
 * 目的: 遠景の山肌が航空写真のまま露出するのを解消する。card instance を 1 つも増やさずに
 * 森林マスク領域を覆えるのがこの層の役割で、R10 final でも同じ役割を担っていた。
 *
 * 仕組みは lab 版（`src/forestLab/cluster/farCanopyLayer.ts`）と同一:
 * 地形に一致する mesh を張り、unlit（`MeshBasicMaterial`）＋ alphaTest ＋ 頂点色で描く。
 * texture の alpha が canonical forest mask と一致しているため、非森林 texel は
 * alphaTest で捨てられ、地肌がそのまま見える。
 *
 * lab 版との唯一の違いは対象範囲で、lab は patch A、ここは DEM 全域。
 */
export interface FarCanopyFlags {
  enabled: boolean;
}

/**
 * preview-only の opt-in。`?r10far=1` のときだけ有効になる。
 * パラメータが無ければ既定の production 挙動は 1 命令も変わらない。
 */
export function resolveFarCanopyFlags(query: URLSearchParams): FarCanopyFlags {
  return { enabled: query.get('r10far') === '1' };
}

/**
 * FAR canopy overlay の UV。world 位置を texture 範囲 0..extent へ線形写像する。
 *
 * texture は `pngRowZeroIsZMin: true` で焼かれているため、v は z の増加方向と同じ向きに取り、
 * 呼び出し側は `texture.flipY = false` を設定する（lab 版と同じ contract）。
 */
export function computeFarCanopyUVs(
  grid: ElevationGrid,
  extentMeters: number,
): Float32Array {
  const uvs = new Float32Array(grid.rows * grid.cols * 2);
  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      const offset = (row * grid.cols + col) * 2;
      uvs[offset] = (col * grid.cellSizeMeters) / extentMeters;
      uvs[offset + 1] = (row * grid.cellSizeMeters) / extentMeters;
    }
  }
  return uvs;
}

/**
 * FAR canopy の頂点色へ R10 macro shade を乗算する。
 *
 * 正規化は FAR の頂点集合の平均で独立に行う（lab 版
 * `applyMacroShadeToFarVertexColors` と同じ方針）。`colors` は in-place で書き換える。
 */
export function applyMacroShadeToFarVertexColors(
  colors: Float32Array,
  grid: ElevationGrid,
  macroShade: MacroShadeConfig,
  terrainYAt: (x: number, z: number) => number,
): { mean: number; min: number; max: number; shadeMinFraction: number; shadeMaxFraction: number } {
  const vertexCount = grid.rows * grid.cols;
  const rawShade = new Float32Array(vertexCount);
  for (let row = 0; row < grid.rows; row += 1) {
    const z = row * grid.cellSizeMeters;
    for (let col = 0; col < grid.cols; col += 1) {
      const x = col * grid.cellSizeMeters;
      rawShade[row * grid.cols + col] = computeRawMacroShade(macroShade, terrainYAt, x, z);
    }
  }
  const multiplier = normalizeMacroShade(rawShade, macroShade);
  let sum = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let shadeMinCount = 0;
  let shadeMaxCount = 0;
  for (let i = 0; i < vertexCount; i += 1) {
    const m = multiplier[i];
    sum += m;
    min = Math.min(min, m);
    max = Math.max(max, m);
    if (Math.abs(m - macroShade.shadeMin) <= 1e-6) shadeMinCount += 1;
    if (Math.abs(m - macroShade.shadeMax) <= 1e-6) shadeMaxCount += 1;
    colors[i * 3] *= m;
    colors[i * 3 + 1] *= m;
    colors[i * 3 + 2] *= m;
  }
  return { mean: sum / vertexCount, min, max,
    shadeMinFraction: shadeMinCount / vertexCount, shadeMaxFraction: shadeMaxCount / vertexCount };
}

/** FAR canopy overlay の geometry を組み立てる（material を持たない純粋な構築）。 */
export function buildFarCanopyGeometry(args: {
  grid: ElevationGrid;
  settings: AppSettings;
  config: FarCanopyConfig;
  macroShade?: MacroShadeConfig;
  terrainYAt?: (x: number, z: number) => number;
}): THREE.BufferGeometry {
  const { grid, settings, config, macroShade, terrainYAt } = args;

  // 頂点色は terrain と同じ関数・同じ config で作る（lab 版と同一の入力）。
  const textureVertexColorConfig = {
    ...terrainMaterialDefaults,
    hillshadeMinFactor: terrainMaterialDefaults.textureHillshadeMinFactor ?? 1,
    hillshadeMaxFactor: terrainMaterialDefaults.textureHillshadeMaxFactor ?? 1,
  };
  const colors = computeTerrainVertexColors(
    grid,
    settings,
    textureVertexColorConfig,
    settings.visual.lighting.directionalPosition,
    terrainMaterialDefaults.textureTintStrength,
  );

  const baseVertexColorMean = meanChannels(colors);
  const macroShadeStats = macroShade?.enabled && terrainYAt
    ? applyMacroShadeToFarVertexColors(colors, grid, macroShade, terrainYAt)
    : undefined;

  const geometry = new THREE.BufferGeometry();
  // terrain とまったく同じ頂点位置を使うため、地形から浮かない/沈まない。
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(computeTerrainVertices(grid, settings), 3),
  );
  geometry.setAttribute(
    'uv',
    new THREE.BufferAttribute(computeFarCanopyUVs(grid, config.extentMeters), 2),
  );
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.userData.toneDiagnostics = {
    baseVertexColorMean,
    shadedVertexColorMean: meanChannels(colors),
    macroShadeStats,
  };

  const indices: number[] = [];
  for (let row = 0; row < grid.rows - 1; row += 1) {
    for (let col = 0; col < grid.cols - 1; col += 1) {
      const topLeft = row * grid.cols + col;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + grid.cols;
      const bottomRight = bottomLeft + 1;
      // terrain と同じ巻き方向（上から見て反時計回り）。
      indices.push(topLeft, bottomLeft, topRight);
      indices.push(topRight, bottomLeft, bottomRight);
    }
  }
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

/**
 * FAR canopy overlay mesh を作る。
 *
 * material は R10 final の FAR overlay と同一構成:
 * unlit / vertexColors / alphaTest / fog 有効 / polygonOffset で terrain の上に載せる。
 */
export function createFarCanopyOverlay(args: {
  grid: ElevationGrid;
  settings: AppSettings;
  config: FarCanopyConfig;
  texture: THREE.Texture;
  macroShade?: MacroShadeConfig;
  terrainYAt?: (x: number, z: number) => number;
  tone?: boolean;
  haze?: boolean;
}): THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> {
  const { texture, config } = args;
  const geometry = buildFarCanopyGeometry(args);

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    vertexColors: true,
    color: 0xffffff,
    alphaTest: config.alphaTest,
    transparent: false,
    depthWrite: true,
    depthTest: true,
    side: THREE.FrontSide,
    fog: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  if (args.tone) {
    const color = applyR10TonePreset({ r: 1, g: 1, b: 1 }, true);
    material.color.setRGB(color.r, color.g, color.b);
  }
  applyR10DepthHaze(material, args.haze === true);

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'forest-far-canopy';
  mesh.renderOrder = 1;
  mesh.frustumCulled = true;
  return mesh;
}

function meanChannels(colors: Float32Array): { r: number; g: number; b: number } {
  const count = colors.length / 3;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let offset = 0; offset < colors.length; offset += 3) {
    r += colors[offset];
    g += colors[offset + 1];
    b += colors[offset + 2];
  }
  return { r: r / count, g: g / count, b: b / count };
}
