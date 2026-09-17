import * as THREE from 'three';

import { forestImpostorV2Defaults } from '../../config/defaults/forestImpostorV2';
import { defaultSettings } from '../../config/settings';
import { configureImpostorTexture } from '../../forest/impostorV2/impostorMaterial';
import type { ElevationGrid } from '../../types';
import type { AppearanceId } from '../appearance/appearanceModel';
import { R5_FAR_CANOPY_ANISOTROPY } from '../appearance/appearanceConstants';
import { CANONICAL_CELL_SIZE_METERS } from '../labConstants';
import type { PatchSpec } from '../labTypes';
import { buildPatchIndices, buildPatchTerrainVertices } from '../patch/patchGrid';
import {
  computeRawMacroShade,
  normalizeMacroShade,
  type MacroShadeConfig,
} from '../r10/macroShade';
import { createShellVertexColors } from '../scene/labTerrain';

export const FAR_CANOPY_TEXTURE_URL = new URL(
  '../generated/far-canopy-2048.png',
  import.meta.url,
).href;
export const FAR_CANOPY_META_URL = new URL(
  '../generated/far-canopy-meta.json',
  import.meta.url,
).href;
export const FAR_CANOPY_R1_TEXTURE_URL = new URL(
  '../generated/far-canopy-r1-2048.png',
  import.meta.url,
).href;
export const FAR_CANOPY_R1_META_URL = new URL(
  '../generated/far-canopy-r1-meta.json',
  import.meta.url,
).href;
export const FAR_CANOPY_R2_TEXTURE_URL = new URL(
  '../generated/far-canopy-r2-2048.png',
  import.meta.url,
).href;
export const FAR_CANOPY_R2_META_URL = new URL(
  '../generated/far-canopy-r2-meta.json',
  import.meta.url,
).href;
export const FAR_CANOPY_R4_TEXTURE_URL = new URL(
  '../generated/far-canopy-r4-2048.png',
  import.meta.url,
).href;
export const FAR_CANOPY_R4_META_URL = new URL(
  '../generated/far-canopy-r4-meta.json',
  import.meta.url,
).href;
export const FAR_CANOPY_R5_TEXTURE_URL = new URL(
  '../generated/far-canopy-r5-2048.png',
  import.meta.url,
).href;
export const FAR_CANOPY_R5_META_URL = new URL(
  '../generated/far-canopy-r5-meta.json',
  import.meta.url,
).href;

/**
 * R9 iteration 1(far canopy skylight blue / calibration probe)。
 *
 * canonical `far-canopy-2048.png` を **読み取り専用の入力**として、linear light で
 * 青チャネルへ単一の加算オフセットを足した phase-local な far canopy。
 * 機構は R8 の grove(i1)/ tree(i2b)と同一 — sRGB→linear→B+=c→clamp→sRGB。
 * R / G / alpha は 1 byte も変えていない(実測 mismatch 0 / 0 / 0)。
 * alpha==0 の texel は canonical の convention どおり RGB=(0,0,0) のまま
 * (593,814 texel すべて維持。bleed-safe colour は元から持たない)。
 *
 * 根拠: R8 best 到達後、reference との輝度対応 Δb* の dominant residual は FARCANOPY へ移った
 * (CLOSE +15.71 / PRIMARY +14.82 / OVERVIEW +14.15、寄与率で CLOSE 50.4 % / PRIMARY 65.6 % /
 * OVERVIEW 80.2 %)。reference forest は暗い森ほど青いのに対し far canopy は全域でカーキのままである。
 *
 * **注意: c = 0.0180 は R8 の grove/tree の値であって、far canopy の答えではない。**
 * far canopy の material は `vertexColors: true` かつ `fog: true` で、texture へ足した c は
 * vertexColor と fog で減衰してから画面に届く。したがってこの i1 は
 * **実効 gain を実測するための calibration probe** であり、最終 c は測定値から解く。
 */
export const FAR_CANOPY_R9_I1_TEXTURE_URL = new URL(
  '../generated/far-canopy-r9-i1-skylight-blue-2048.png',
  import.meta.url,
).href;
export const FAR_CANOPY_R9_I1_META_URL = new URL(
  '../generated/far-canopy-r9-i1-skylight-blue-meta.json',
  import.meta.url,
).href;

/**
 * R9 iteration 2(far canopy fit)。i1 と同一機構・同一実装で、offset だけを
 * **far canopy 自身の実測から解いた値** c = 0.0218 にしたもの。
 *
 * 決め方(§25 Stage B/C): i1(c = 0.0180)を実際に render し、FARCANOPY が所有する
 * 画面画素の Δb*(輝度対応・R8 convention)がどれだけ動いたかを camera ごとに実測した。
 *   CLOSE  +15.711 -> +4.328(gain 632.40 b* per unit c)
 *   PRIMARY +14.823 -> +5.542(gain 515.64 同)
 *   OVERVIEW +14.148 -> +5.687(gain 470.09 同)
 * gain が camera ごとに違うのは、far canopy が `vertexColors` 乗算と fog 合成を
 * 挟んでから画面に出るためで、これは grove/tree の atlas 経路には無い性質である。
 * したがって **R8 の 0.0180 をそのまま使うことはできない**(§13)。
 *
 * c = 0.0218 は「FARCANOPY の寄与が最大の OVERVIEW(残差の 80.2 %)を、R8 で補正済みの
 * component と同じ帯(+1.4〜+3.9)の上端 +3.9 まで下げる」条件から解いた値。
 * この c では 3 camera とも帯に入り、どれも負(過補正・青すぎ)側へ渡らない。
 * CLOSE が 0 を割るのは c ≈ 0.0248 以上であり、0.0218 はその手前の保守側にある(§28 / §97)。
 */
export const FAR_CANOPY_R9_I2_TEXTURE_URL = new URL(
  '../generated/far-canopy-r9-i2-farcanopy-fit-2048.png',
  import.meta.url,
).href;
export const FAR_CANOPY_R9_I2_META_URL = new URL(
  '../generated/far-canopy-r9-i2-farcanopy-fit-meta.json',
  import.meta.url,
).href;

/**
 * R9 iteration 3(far canopy fit / 最終候補)。i2 と同一機構で c = 0.0230。
 *
 * i2(c = 0.0218)の実測は CLOSE +2.430 / PRIMARY +3.933 / OVERVIEW +4.213 で、
 * CLOSE は R8 で補正済みの component の帯(+1.4〜+3.9)の中央に入ったが、
 * PRIMARY と OVERVIEW は帯の上端にわずかに残っていた。
 * i2 の実測 gain(CLOSE 609.23 / PRIMARY 499.56 / OVERVIEW 455.76、いずれも b* per unit c)から
 * 3 camera すべてを帯の内側へ入れる c として 0.0230 を解いた。
 *
 * **0 を狙っていないことに注意(§96 / §124)。** 周囲の grove/tree は R8 補正後も +1.4〜+3.9 にあり、
 * far canopy だけを 0 へ落とすと far canopy が周囲より明らかに青くなり、
 * forest 全体の色の整合(§92-C)と境界の自然さ(§47)をかえって損なう。
 * 目標は「周囲と同じ帯へ入れる」ことである。
 */
export const FAR_CANOPY_R9_I3_TEXTURE_URL = new URL(
  '../generated/far-canopy-r9-i3-farcanopy-fit-2048.png',
  import.meta.url,
).href;
export const FAR_CANOPY_R9_I3_META_URL = new URL(
  '../generated/far-canopy-r9-i3-farcanopy-fit-meta.json',
  import.meta.url,
).href;

/**
 * appearance R7(= R8 best を描画している Lab appearance)が使う far canopy。
 * production default(BASELINE)と R1〜R6 は一切変えない。R8 best へ戻すには
 * この 1 行を `FAR_CANOPY_TEXTURE_URL` / `FAR_CANOPY_META_URL` へ差し替えるだけでよい。
 */
export const R7_FAR_CANOPY_TEXTURE_URL = FAR_CANOPY_R9_I3_TEXTURE_URL;
export const R7_FAR_CANOPY_META_URL = FAR_CANOPY_R9_I3_META_URL;

interface FarCanopyWorldBbox {
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
}

export function farOverlayUvs(
  patch: PatchSpec,
  worldBbox: FarCanopyWorldBbox,
): Float32Array {
  const sizeRows = patch.rowEnd - patch.rowStart;
  const sizeCols = patch.colEnd - patch.colStart;
  const rowLength = sizeCols + 1;
  const side = worldBbox.xMax - worldBbox.xMin;
  const uvs = new Float32Array((sizeRows + 1) * rowLength * 2);

  for (let localRow = 0; localRow <= sizeRows; localRow += 1) {
    for (let localCol = 0; localCol <= sizeCols; localCol += 1) {
      const x = (patch.colStart + localCol) * CANONICAL_CELL_SIZE_METERS;
      const z = (patch.rowStart + localRow) * CANONICAL_CELL_SIZE_METERS;
      const offset = (localRow * rowLength + localCol) * 2;
      uvs[offset] = (x - worldBbox.xMin) / side;
      uvs[offset + 1] = (z - worldBbox.zMin) / side;
    }
  }

  return uvs;
}

/**
 * R10(opt-in): FAR canopy の頂点色へ、cluster 側と同じ関数・同じ config で
 * macro shade を乗算する。正規化は FAR 頂点集合の平均で行う(cluster 側とは
 * 独立に平均 1 へ正規化する)。`colors` は in-place で書き換える。
 */
function applyMacroShadeToFarVertexColors(
  colors: Float32Array,
  patch: PatchSpec,
  macroShade: MacroShadeConfig,
  terrainYAt: (x: number, z: number) => number,
): void {
  const sizeRows = patch.rowEnd - patch.rowStart;
  const sizeCols = patch.colEnd - patch.colStart;
  const rowLength = sizeCols + 1;
  const vertexCount = (sizeRows + 1) * rowLength;
  const rawShade = new Float32Array(vertexCount);
  for (let localRow = 0; localRow <= sizeRows; localRow += 1) {
    const z = (patch.rowStart + localRow) * CANONICAL_CELL_SIZE_METERS;
    for (let localCol = 0; localCol <= sizeCols; localCol += 1) {
      const x = (patch.colStart + localCol) * CANONICAL_CELL_SIZE_METERS;
      rawShade[localRow * rowLength + localCol] = computeRawMacroShade(
        macroShade,
        terrainYAt,
        x,
        z,
      );
    }
  }
  const multiplier = normalizeMacroShade(rawShade, macroShade);
  for (let i = 0; i < vertexCount; i += 1) {
    const m = multiplier[i];
    colors[i * 3] *= m;
    colors[i * 3 + 1] *= m;
    colors[i * 3 + 2] *= m;
  }
}

export function createFarCanopyOverlay(args: {
  grid: ElevationGrid;
  patch: PatchSpec;
  vertexColors: Float32Array;
  texture: THREE.Texture;
  worldBbox: FarCanopyWorldBbox;
  /**
   * R10(opt-in)。省略、または `enabled: false` のときはこの関数の結果は
   * 既存コードパスと完全に同一になる。有効化するには `terrainYAt` も渡す必要
   * がある(両方揃わない限り macro shade は適用されない)。
   */
  macroShade?: MacroShadeConfig;
  terrainYAt?: (x: number, z: number) => number;
}): THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> {
  const { grid, patch, vertexColors, texture, worldBbox, macroShade, terrainYAt } = args;
  const sizeRows = patch.rowEnd - patch.rowStart;
  const sizeCols = patch.colEnd - patch.colStart;
  if (sizeRows !== sizeCols) throw new RangeError('FAR canopy patch must be square.');

  const colors = createShellVertexColors(vertexColors, patch, 1);
  if (macroShade?.enabled && terrainYAt) {
    applyMacroShadeToFarVertexColors(colors, patch, macroShade, terrainYAt);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(buildPatchTerrainVertices(grid, patch, defaultSettings), 3),
  );
  geometry.setAttribute('uv', new THREE.BufferAttribute(farOverlayUvs(patch, worldBbox), 2));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(buildPatchIndices(sizeRows), 1));
  geometry.computeVertexNormals();

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    vertexColors: true,
    color: 0xffffff,
    alphaTest: forestImpostorV2Defaults.material.groveAlphaTest,
    transparent: false,
    depthWrite: true,
    depthTest: true,
    side: THREE.FrontSide,
    fog: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'forest-lab-far-canopy';
  mesh.renderOrder = 1;
  mesh.frustumCulled = true;
  return mesh;
}

function textureImageSize(texture: THREE.Texture): { width: number; height: number } {
  const image = texture.image as { width?: unknown; height?: unknown } | undefined;
  return {
    width: typeof image?.width === 'number' ? image.width : 0,
    height: typeof image?.height === 'number' ? image.height : 0,
  };
}

interface FarCanopyLoadDependencies {
  loadTexture?: (url: string) => Promise<THREE.Texture>;
  fetchJson?: (url: string) => Promise<unknown>;
}

export async function loadFarCanopyTexture(
  appearanceOrDependencies: AppearanceId | FarCanopyLoadDependencies = 'BASELINE',
  suppliedDependencies?: FarCanopyLoadDependencies,
): Promise<{ texture: THREE.Texture; sha256: string | null; width: number; height: number }> {
  const appearance = typeof appearanceOrDependencies === 'string'
    ? appearanceOrDependencies
    : 'BASELINE';
  const dependencies = typeof appearanceOrDependencies === 'string'
    ? suppliedDependencies
    : appearanceOrDependencies;
  const loadTexture = dependencies?.loadTexture
    ?? ((url: string) => new THREE.TextureLoader().loadAsync(url));
  const fetchJson = dependencies?.fetchJson
    ?? ((url: string) => fetch(url).then((response) => response.json()));
  // R3 intentionally keeps R2's FAR asset so this phase isolates the grove-card texture.
  const usesR2Asset = appearance === 'R2' || appearance === 'R3';
  // R4 uses its own dedicated FAR asset (BRIGHT_BROADLEAF stamps drawn from the baked
  // BROADLEAF_ROUND_LIGHT top cells); R3 above is left untouched and keeps the R2 asset.
  // R5 uses its own dedicated FAR asset (fine-grain crown stamps + narrower bright-family
  // footprint); R2/R3/R4 above are left untouched.
  const textureUrl = appearance === 'R1'
    ? FAR_CANOPY_R1_TEXTURE_URL
    : appearance === 'R4'
      ? FAR_CANOPY_R4_TEXTURE_URL
      : appearance === 'R5'
        ? FAR_CANOPY_R5_TEXTURE_URL
        // R9: appearance R7 のみ phase-local candidate へ。他の appearance は不変。
        : appearance === 'R7'
          ? R7_FAR_CANOPY_TEXTURE_URL
          : usesR2Asset ? FAR_CANOPY_R2_TEXTURE_URL : FAR_CANOPY_TEXTURE_URL;
  const metaUrl = appearance === 'R1'
    ? FAR_CANOPY_R1_META_URL
    : appearance === 'R4'
      ? FAR_CANOPY_R4_META_URL
      : appearance === 'R5'
        ? FAR_CANOPY_R5_META_URL
        // R9: appearance R7 のみ phase-local candidate へ。他の appearance は不変。
        : appearance === 'R7'
          ? R7_FAR_CANOPY_META_URL
          : usesR2Asset ? FAR_CANOPY_R2_META_URL : FAR_CANOPY_META_URL;
  const texture = await loadTexture(textureUrl);
  texture.flipY = false;
  configureImpostorTexture(texture);
  if (appearance === 'R5') {
    // R5-only: FAR is a steep, oblique overlay whose minified detail was being lost to the
    // default anisotropy of 1 (see R5_FAR_CANOPY_ANISOTROPY doc comment for why a fixed value
    // is used instead of renderer.capabilities.getMaxAnisotropy()). This never touches R1-R4.
    texture.anisotropy = R5_FAR_CANOPY_ANISOTROPY;
  }

  try {
    const metadata = await fetchJson(metaUrl);
    if (typeof metadata !== 'object' || metadata === null) throw new TypeError('Invalid metadata.');
    const record = metadata as { output?: { sha256?: unknown }; size?: unknown };
    if (typeof record.output?.sha256 !== 'string' || typeof record.size !== 'number') {
      throw new TypeError('Invalid metadata fields.');
    }
    return {
      texture,
      sha256: record.output.sha256,
      width: record.size,
      height: record.size,
    };
  } catch {
    const { width, height } = textureImageSize(texture);
    return { texture, sha256: null, width, height };
  }
}
