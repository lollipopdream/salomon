import type * as THREE from 'three';

import {
  loadImpostorAssets,
  type ImpostorAssets,
} from '../../forest/impostorV2/impostorAssets';
import { loadGroveTopCapAssets } from '../../forest/impostorV2/groveTopCapAssets';
import {
  createGroveTopCapMapping,
  type GroveTopCapMapping,
} from '../../forest/impostorV2/groveTopCapMeta';
import type {
  ForestImpostorV2Config,
  ImpostorCellSelection,
} from '../../forest/impostorV2/types';
import type { AppearanceId } from '../appearance/appearanceModel';
import {
  IMPOSTOR_V2_GROVE_TOP_ASSET_URLS,
  IMPOSTOR_V2_SIDE_ASSET_CONFIG,
} from '../scene/labDataSources';

export const R3_CLUSTER_GROVE_ATLAS_URL = new URL(
  '../generated/grove-atlas-r3-dense-broadleaf-3072x2048.png',
  import.meta.url,
).href;

export const R4_CLUSTER_GROVE_ATLAS_URL = new URL(
  '../generated/grove-atlas-r4-fine-grain-3072x2048.png',
  import.meta.url,
).href;

/**
 * R7: R3 の dense-broadleaf atlas の G4 4 cell だけを、offline bake 由来の
 * real-3D cluster proxy へ差し替えた phase-local atlas。
 * G1/G2/G3/G5/G6 は R3 と pixel-identical(compose 側が 5,242,880 画素で検証)。
 * impostor-atlas-meta.json は byte-identical のまま使う。
 *
 * v1 は 12 本・樹冠平均 12.64 m の cluster で、木 1 本が cluster 幅の 72.6 % を占め
 * 単一の塊として読めた。v2(micro-canopy)は同じ physical frame のまま 20 本・
 * 樹冠平均 4.33 m へ細粒化したもの。v3(densify)はさらに 32 本・樹冠 1.6〜4.6 m
 * まで細かくし、infill tier を sub-cluster 中心へ寄せて幹を樹冠の裏へ隠したもの。
 * bake 実測で coverage は 4 yaw とも上がり(平均 0.379→0.419)、trunk は
 * yaw0 で 0.0310→0.0063 まで下がった。
 * 三つとも残してあるので、採用候補の切り替えは下の R7_CLUSTER_GROVE_ATLAS_URL の
 * 1 行だけで戻せる。
 */
export const R7_V1_CLUSTER_GROVE_ATLAS_URL = new URL(
  '../generated/grove-atlas-r7-g4-real3d-3072x2048.png',
  import.meta.url,
).href;

export const R7_V2_CLUSTER_GROVE_ATLAS_URL = new URL(
  '../generated/grove-atlas-r7-g4v2-micro-canopy-3072x2048.png',
  import.meta.url,
).href;

export const R7_V3_CLUSTER_GROVE_ATLAS_URL = new URL(
  '../generated/grove-atlas-r7-g4v3-densify-3072x2048.png',
  import.meta.url,
).href;

/**
 * v4(canopy chroma)は v3 と **layout が完全に同一**で、違いは bake の光の色だけ。
 * canonical reference の森林部を実測すると v3 の明度は既に範囲内(L* 24.9 対 19.4〜26.1)
 * である一方、色差はほぼ全部が黄色軸に乗っていた(Δb* +8.1 / ΔE 9.5)。原因は葉の
 * albedo の青不足(B/G 0.489〜0.566、reference の森林は 0.609〜0.791)で、
 * lighting・color management・atlas compose・runtime はいずれも実測で除外済み。
 * v4 は sun と world の青成分だけを同じ係数で 1.55 倍しており、bake 実測で
 * B/G は 0.520→0.650(yaw0)へ動き、coverage・trunk・silhouette は完全に不変。
 */
export const R7_V4_CLUSTER_GROVE_ATLAS_URL = new URL(
  '../generated/grove-atlas-r7-g4v4-canopy-chroma-3072x2048.png',
  import.meta.url,
).href;

/**
 * R8 iteration 1(skylight blue)。v4 atlas を base に、**非 G4 の grove cell 20 枚
 * (G1/G2/G3/G5/G6 × yaw 0/90/180/270)だけ** の青チャネルへ、linear light で
 * 単一の加算オフセット c = 0.0180 を足したもの。R/G/alpha は 1 byte も変えていない。
 *
 * 根拠: reference forest を実測すると b* は明るさに強く依存し(L*=5 で −4.6、L*=63 で +37.9)、
 * **暗い森ほど青い**。一方 v4 の非 G4 cell は L* 17〜38 の全域で b* 13〜27 のカーキのままで、
 * 同じ L* における reference の期待値から +8.9〜+15.1 ずれていた。
 * 必要な補正量を linear light の加算量へ換算すると 5 family すべてで 0.017〜0.023 に収まり、
 * 乗算では説明できない(必要倍率は 1.37〜2.57 倍とばらばら)。
 * これは bake に「青い天空光による陰の埋め」が欠けていることの署名である。
 *
 * 結果(atlas 実測): B/G は G1 0.457→0.940 / G2 0.525→0.895 / G3 0.438→0.995 /
 * G5 0.475→0.643 / G6 0.537→0.860 となり、reference 目標との差は −0.013〜+0.046 に収まった。
 * **G4 は 1 画素も変更していない**(mismatch 0)。alpha も全画素 byte 一致。
 */
export const R8_I1_CLUSTER_GROVE_ATLAS_URL = new URL(
  '../generated/grove-atlas-r8-i1-skylight-blue-3072x2048.png',
  import.meta.url,
).href;

/** 現在の R7 候補。best-so-far を v4 へ戻すならこの 1 行を差し替える。 */
export const R7_CLUSTER_GROVE_ATLAS_URL = R8_I1_CLUSTER_GROVE_ATLAS_URL;

/**
 * R8 iteration 2b(tree layer skylight blue)。
 *
 * appearance R7 の tree layer は **production default asset**
 * `/data/forest/impostor-v2/tree_atlas_2048.png` をそのまま使っていた(R8 で実測して判明)。
 * production asset は書き換えられないので、それを読み取り専用の入力として
 * phase-local な別ファイルを生成し、Lab 側の selector だけを差し替える。
 *
 * 変換は grove(iteration 1)と同一機構 — linear light での加算青オフセット。
 * ただし c は **variant ごと**に fit した。単一 c だと texel 数の多い FIR に引かれて
 * BL だけ reference を越えて青へ過補正されたため(§125)。
 *   FIR_A / FIR_B / FIR_C = 0.0180(**grove と同じ値**)、BL = 0.0105
 * FIR と grove が同じ 0.0180 に独立して到達したことは、
 * 「同時期の bake が同じだけ天空光の埋めを欠いている」という単一原因の裏づけになる。
 * BL は元から B/G 0.623 と目標に近く、欠けている量が小さい。
 *
 * 結果(atlas 実測、B/G 前 → 後 / 目標): BL 0.623 → 0.720 / 0.693、
 * FIR_A 0.421 → 0.938 / 0.940、FIR_B 0.439 → 0.907 / 0.934、FIR_C 0.539 → 0.898 / 0.907。
 * alpha は全画素 byte 一致、cell 矩形外も不一致 0。入力 production asset は実行前後で SHA 一致。
 */
export const R8_I2B_CLUSTER_TREE_ATLAS_URL = new URL(
  '../generated/tree-atlas-r8-i2b-pervariant-blue-2048x2048.png',
  import.meta.url,
).href;

/** 現在の R7 tree 候補。production default へ戻すならこの 1 行を消す。 */
export const R7_CLUSTER_TREE_ATLAS_URL = R8_I2B_CLUSTER_TREE_ATLAS_URL;

export const R4_CLUSTER_TREE_ATLAS_URL = new URL(
  '../generated/tree-atlas-r4-crown-dominant-2048x2048.png',
  import.meta.url,
).href;

export const CLUSTER_GROVE_CONFIGS = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'] as const;
export const CLUSTER_GROVE_YAWS = [0, 90, 180, 270] as const;
export const CLUSTER_TREE_VARIANTS = ['FIR_A', 'FIR_B', 'FIR_C', 'BL'] as const;
export const CLUSTER_TREE_YAWS = [0, 45, 90, 135, 180, 225, 270, 315] as const;
export const CLUSTER_CELL_COUNT = 56;

export const CLUSTER_CELL_SELECTION: ImpostorCellSelection = {
  grove: {
    configs: CLUSTER_GROVE_CONFIGS,
    yawDegrees: CLUSTER_GROVE_YAWS,
  },
  tree: {
    variants: CLUSTER_TREE_VARIANTS,
    yawDegrees: CLUSTER_TREE_YAWS,
  },
};

export const CLUSTER_ASSET_CONFIG: ForestImpostorV2Config = {
  ...IMPOSTOR_V2_SIDE_ASSET_CONFIG,
  cellSelection: CLUSTER_CELL_SELECTION,
};

export interface ClusterTopCapAssets {
  mapping: GroveTopCapMapping;
  texture: THREE.Texture;
}

export interface ClusterAssets extends ImpostorAssets {
  topCap?: ClusterTopCapAssets;
}

interface ClusterAssetLoadDependencies {
  fetchJson?: (url: string) => Promise<unknown>;
  loadTexture?: (url: string) => Promise<THREE.Texture>;
}

export async function loadClusterAssets(
  appearanceOrDependencies: AppearanceId | ClusterAssetLoadDependencies = 'BASELINE',
  suppliedDependencies?: ClusterAssetLoadDependencies,
): Promise<ClusterAssets> {
  const appearance = typeof appearanceOrDependencies === 'string'
    ? appearanceOrDependencies
    : 'BASELINE';
  const dependencies = typeof appearanceOrDependencies === 'string'
    ? suppliedDependencies
    : appearanceOrDependencies;
  const config = appearance === 'R7'
    ? {
      ...CLUSTER_ASSET_CONFIG,
      assets: {
        ...CLUSTER_ASSET_CONFIG.assets,
        groveAtlasUrl: R7_CLUSTER_GROVE_ATLAS_URL,
        treeAtlasUrl: R7_CLUSTER_TREE_ATLAS_URL,
      },
    }
    : appearance === 'R3' || appearance === 'R6'
    ? {
      ...CLUSTER_ASSET_CONFIG,
      assets: {
        ...CLUSTER_ASSET_CONFIG.assets,
        groveAtlasUrl: R3_CLUSTER_GROVE_ATLAS_URL,
      },
    }
    : appearance === 'R4'
      ? {
        ...CLUSTER_ASSET_CONFIG,
        assets: {
          ...CLUSTER_ASSET_CONFIG.assets,
          groveAtlasUrl: R4_CLUSTER_GROVE_ATLAS_URL,
          treeAtlasUrl: R4_CLUSTER_TREE_ATLAS_URL,
        },
      }
      : appearance === 'R5'
        // R5 = R3 の dense-broadleaf grove atlas + R4 の crown-dominant tree atlas.
        ? {
          ...CLUSTER_ASSET_CONFIG,
          assets: {
            ...CLUSTER_ASSET_CONFIG.assets,
            groveAtlasUrl: R3_CLUSTER_GROVE_ATLAS_URL,
            treeAtlasUrl: R4_CLUSTER_TREE_ATLAS_URL,
          },
        }
        : CLUSTER_ASSET_CONFIG;
  const assets = await loadImpostorAssets({
    config,
    kinds: 'both',
    ...dependencies,
  });
  if (appearance !== 'R6') return assets;

  const topResult = await loadGroveTopCapAssets({
    config: {
      ...config,
      assets: { ...config.assets, ...IMPOSTOR_V2_GROVE_TOP_ASSET_URLS },
    },
    ...dependencies,
  });
  if (!topResult.ok) {
    assets.dispose();
    throw new Error(`Failed to load R6 grove top-cap assets: ${topResult.reason}.`);
  }
  const mapping = createGroveTopCapMapping(topResult.meta, assets.cells);
  if (!mapping) {
    topResult.dispose();
    assets.dispose();
    throw new Error('Failed to map R6 grove top-cap cells to side cells.');
  }
  let disposed = false;
  return {
    ...assets,
    topCap: { mapping, texture: topResult.texture },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      topResult.dispose();
      assets.dispose();
    },
  };
}

function assertIndex(index: number, length: number, label: string): void {
  if (!Number.isInteger(index) || index < 0 || index >= length) {
    throw new RangeError(`${label} is out of range.`);
  }
}

export function groveCellSlot(groveIndex: number, yawIndex: number): number {
  assertIndex(groveIndex, CLUSTER_GROVE_CONFIGS.length, 'Grove index');
  assertIndex(yawIndex, CLUSTER_GROVE_YAWS.length, 'Grove yaw index');
  return groveIndex * CLUSTER_GROVE_YAWS.length + yawIndex;
}

export function treeCellSlot(variantIndex: number, yawIndex: number): number {
  assertIndex(variantIndex, CLUSTER_TREE_VARIANTS.length, 'Tree variant index');
  assertIndex(yawIndex, CLUSTER_TREE_YAWS.length, 'Tree yaw index');
  return CLUSTER_GROVE_CONFIGS.length * CLUSTER_GROVE_YAWS.length
    + variantIndex * CLUSTER_TREE_YAWS.length
    + yawIndex;
}

export function cellWidthOf(assets: ImpostorAssets, cellSlot: number): number {
  assertIndex(cellSlot, assets.cells.length, 'Cell slot');
  return assets.cells[cellSlot].tightWorldWidth;
}
