import { CLUSTER_SPACING_M } from '../cluster/clusterConstants';

export const APPEARANCE_IDS = ['BASELINE', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'] as const;

/** R1 の既存 macro field。R1 の結果を bit-for-bit 維持する。 */
export const R1_MACRO_FIELD_OCTAVES = [
  { wavelengthMeters: CLUSTER_SPACING_M * 8, weight: 0.55, rotationDeg: 0, offsetX: 0, offsetZ: 0 },
  { wavelengthMeters: CLUSTER_SPACING_M * 4, weight: 0.32, rotationDeg: 31, offsetX: 137.0, offsetZ: -211.0 },
  { wavelengthMeters: CLUSTER_SPACING_M * 1, weight: 0.13, rotationDeg: 67, offsetX: -523.0, offsetZ: 389.0 },
] as const;

/** R2 は O2 の region scale と重みだけを design §11.2 の確定値へ差し替える。 */
export const R2_MACRO_FIELD_OCTAVES = [
  { wavelengthMeters: CLUSTER_SPACING_M * 8, weight: 0.48, rotationDeg: 0, offsetX: 0, offsetZ: 0 },
  { wavelengthMeters: CLUSTER_SPACING_M * 4, weight: 0.30, rotationDeg: 31, offsetX: 137.0, offsetZ: -211.0 },
  { wavelengthMeters: CLUSTER_SPACING_M * 0.35, weight: 0.22, rotationDeg: 67, offsetX: -523.0, offsetZ: 389.0 },
] as const;

export const R3_MACRO_FIELD_OCTAVES = R2_MACRO_FIELD_OCTAVES;

/** R4 は R3(=R2)の macro field octaves を変更なしで alias する(texture のみが差分)。 */
export const R4_MACRO_FIELD_OCTAVES = R3_MACRO_FIELD_OCTAVES;

/**
 * R5 も R2/R3/R4 の macro field octaves を変更なしで alias する。
 * R5 は grove=R3 atlas / tree=R4 atlas / FAR=新規 R5 asset の組み合わせであり、
 * macro field octaves 自体(cluster placement / selection に使う数値)は R2 から動かさない。
 */
export const R5_MACRO_FIELD_OCTAVES = R4_MACRO_FIELD_OCTAVES;

/** R6 は R3 の数値パラメータを変更せず、grove top-cap のみを追加する。 */
export const R6_MACRO_FIELD_OCTAVES = R3_MACRO_FIELD_OCTAVES;

/**
 * R7 も R3 の macro field octaves を変更なしで alias する。
 * R7 の差分は G4 grove cell の pixel(offline で焼いた real-3D cluster proxy)だけで、
 * placement / selection に使う数値は R3 から 1 つも動かさない。
 */
export const R7_MACRO_FIELD_OCTAVES = R3_MACRO_FIELD_OCTAVES;

export const MACRO_FIELD_OCTAVES_BY_APPEARANCE = {
  R1: R1_MACRO_FIELD_OCTAVES,
  R2: R2_MACRO_FIELD_OCTAVES,
  R3: R3_MACRO_FIELD_OCTAVES,
  R4: R4_MACRO_FIELD_OCTAVES,
  R5: R5_MACRO_FIELD_OCTAVES,
  R6: R6_MACRO_FIELD_OCTAVES,
  R7: R7_MACRO_FIELD_OCTAVES,
} as const;

// 既存 import の互換性。R1 の値・配列順序は変更しない。
export const MACRO_FIELD_OCTAVES = R1_MACRO_FIELD_OCTAVES;

export const FAMILY_IDS = ['DARK_CONIFER', 'MIXED', 'BRIGHT_BROADLEAF'] as const;
export const DARK_CONIFER_THRESHOLD = 0.40;
export const BRIGHT_BROADLEAF_THRESHOLD = 0.60;
export const R2_DARK_CONIFER_THRESHOLD = 0.3892;
export const R2_BRIGHT_BROADLEAF_THRESHOLD = 0.6137;
export const R3_DARK_CONIFER_THRESHOLD = R2_DARK_CONIFER_THRESHOLD;
export const R3_BRIGHT_BROADLEAF_THRESHOLD = R2_BRIGHT_BROADLEAF_THRESHOLD;
export const R4_DARK_CONIFER_THRESHOLD = R3_DARK_CONIFER_THRESHOLD;
export const R4_BRIGHT_BROADLEAF_THRESHOLD = R3_BRIGHT_BROADLEAF_THRESHOLD;
export const R5_DARK_CONIFER_THRESHOLD = R4_DARK_CONIFER_THRESHOLD;
export const R5_BRIGHT_BROADLEAF_THRESHOLD = R4_BRIGHT_BROADLEAF_THRESHOLD;
export const R6_DARK_CONIFER_THRESHOLD = R3_DARK_CONIFER_THRESHOLD;
export const R6_BRIGHT_BROADLEAF_THRESHOLD = R3_BRIGHT_BROADLEAF_THRESHOLD;

export const GROVE_WEIGHTS_BY_FAMILY = [
  [0.30, 0.10, 0.45, 0.03, 0.02, 0.10],
  [0.15, 0.20, 0.10, 0.25, 0.18, 0.12],
  [0.03, 0.07, 0.02, 0.30, 0.50, 0.08],
] as const;

export const TREE_WEIGHTS_BY_FAMILY = [
  [0.40, 0.30, 0.25, 0.05],
  [0.20, 0.22, 0.28, 0.30],
  [0.08, 0.10, 0.17, 0.65],
] as const;

export const CONIFER_SCALE_RANGE_BY_FAMILY = [
  [0.93, 1.12],
  [0.74, 1.12],
  [0.74, 0.93],
] as const;

export const BROADLEAF_SCALE_RANGE_BY_FAMILY = [
  [2.20, 2.65],
  [2.20, 3.10],
  [2.65, 3.10],
] as const;

export const COLOR_ANCHORS = [
  { field: 0.3111, id: 'A0', name: 'DARK', r: 0.6204, g: 0.7700, b: 0.9233 },
  { field: 0.4786, id: 'A1', name: 'MID', r: 0.9758, g: 0.9983, b: 1.0247 },
  { field: 0.6517, id: 'A2', name: 'BRIGHT', r: 1.3114, g: 1.2493, b: 1.1497 },
] as const;

/**
 * R2 は design §11.1 の通り gamma = 0.35 を luminance 成分にだけ適用する。
 * chromaticity は reference 由来の raw 値を保ち、等重み平均 luminance は 1.000 に正規化済み。
 */
export const R2_COLOR_ANCHORS = [
  // 表示用の design §11 値は各成分を小数第4位へ丸めたもの。
  // ここは導出値を保持して、等重み平均 luminance = 1.000000 ± 1e-6 を満たす。
  { field: 0.3232, id: 'A0', name: 'DARK', r: 0.427798, g: 0.793242, b: 1.332398 },
  { field: 0.4825, id: 'A1', name: 'MID', r: 0.937507, g: 1.000528, b: 1.077988 },
  { field: 0.6409, id: 'A2', name: 'BRIGHT', r: 1.416025, g: 1.232618, b: 0.972103 },
] as const;

export const R3_COLOR_ANCHORS = R2_COLOR_ANCHORS;

/** R4 は R3(=R2)の color anchors を変更なしで alias する(texture のみが差分)。 */
export const R4_COLOR_ANCHORS = R3_COLOR_ANCHORS;

/** R5 も R2/R3/R4 の color anchors を変更なしで alias する(grove=R3 atlas / tree=R4 atlas / FAR=新規)。 */
export const R5_COLOR_ANCHORS = R4_COLOR_ANCHORS;

/** R6 は R3 の color anchors を変更なしで alias する。 */
export const R6_COLOR_ANCHORS = R3_COLOR_ANCHORS;

/** R7 も R3 の color anchors を変更なしで alias する(差分は G4 の pixel のみ)。 */
export const R7_COLOR_ANCHORS = R3_COLOR_ANCHORS;

export const COLOR_ANCHORS_BY_APPEARANCE = {
  R1: COLOR_ANCHORS,
  R2: R2_COLOR_ANCHORS,
  R3: R3_COLOR_ANCHORS,
  R4: R4_COLOR_ANCHORS,
  R5: R5_COLOR_ANCHORS,
  R6: R6_COLOR_ANCHORS,
  R7: R7_COLOR_ANCHORS,
} as const;

export const COLOR_DAMPING_GAMMA = 0.35;

/** R1/R2 で共有し、R2 では変更禁止の selection / scale parameter object。 */
const R1_FAMILY_PARAMETERS = {
  groveWeights: GROVE_WEIGHTS_BY_FAMILY,
  treeWeights: TREE_WEIGHTS_BY_FAMILY,
  coniferScaleRange: CONIFER_SCALE_RANGE_BY_FAMILY,
  broadleafScaleRange: BROADLEAF_SCALE_RANGE_BY_FAMILY,
  colorDampingGamma: COLOR_DAMPING_GAMMA,
} as const;

const R2_FAMILY_PARAMETERS = {
  groveWeights: GROVE_WEIGHTS_BY_FAMILY,
  treeWeights: TREE_WEIGHTS_BY_FAMILY,
  coniferScaleRange: CONIFER_SCALE_RANGE_BY_FAMILY,
  broadleafScaleRange: BROADLEAF_SCALE_RANGE_BY_FAMILY,
  colorDampingGamma: COLOR_DAMPING_GAMMA,
} as const;

export const SHARED_FAMILY_PARAMETERS_BY_APPEARANCE = {
  R1: R1_FAMILY_PARAMETERS,
  R2: R2_FAMILY_PARAMETERS,
  R3: R2_FAMILY_PARAMETERS,
  // R4 は R3 と数値パラメータが完全に同一(差分は texture bind のみ)。同一 object を参照する。
  R4: R2_FAMILY_PARAMETERS,
  // R5 も同様に R2 と数値パラメータが完全に同一(差分は grove=R3 / tree=R4 / FAR=新規の asset bind のみ)。
  R5: R2_FAMILY_PARAMETERS,
  // R6 も R3 と同じ selection / scale parameter object を参照する。
  R6: R2_FAMILY_PARAMETERS,
  // R7 も同様に R2 と数値パラメータが完全に同一(差分は G4 grove atlas cell のみ)。
  R7: R2_FAMILY_PARAMETERS,
} as const;

/**
 * R5 FAR canopy texture 専用の anisotropic filtering 設定値(design §T3)。
 *
 * `configureImpostorTexture`(src/forest/impostorV2/impostorMaterial.ts)は colorSpace / wrap /
 * mipmap / minFilter / magFilter を明示設定するが anisotropy は設定しておらず既定値 1 のまま。
 * `renderer.capabilities.getMaxAnisotropy()` は forestLabMain.ts の `loadLabTerrainData` へは
 * 渡っているが、`createCandidateController` / `farCanopyLayer` へは渡っていない(既存の seam
 * では届かない。forestLabMain.ts は本タスクの変更許可ファイルに含まれないため、そちら側の配線変更は
 * 行わない)。そのため実際の renderer capability を問い合わせる代わりに、安全な固定値を採用する。
 * FAR overlay は斜め見下ろし面なので視線方向の細部が等方縮小フィルタで潰れやすく、8x は
 * 一般的な GPU が確実にサポートする値でありながら効果が確認しやすい水準として選んだ。
 */
export const R5_FAR_CANOPY_ANISOTROPY = 8;

/**
 * R5 限定の FAR 距離ゲート(design §T4)。
 *
 * outputs/matsu-h01-r4-canopy-continuity-lab/r4-canopy-continuity-capture-state.json の
 * CLOSE / PRIMARY / OVERVIEW camera position と、far-canopy-r5-meta.json の world ブロックから
 * 求めた FAR patch 中心((xMin+xMax)/2, (zMin+zMax)/2) = (1957.018987853849, 3261.6983130897484)
 * までの実測 XZ 平面距離は次の通り(2026-09-14 実測):
 *   CLOSE    ≈  654.71 m
 *   PRIMARY  ≈ 1900.15 m
 *   OVERVIEW ≈ 3336.66 m
 * near/far の閾値は「CLOSE は確実に下回り、OVERVIEW は確実に上回り、PRIMARY がその中間の
 * 遷移帯に収まる」ように選んだ。
 */
export const R5_FAR_CANOPY_OPACITY_NEAR_METERS = 900;
export const R5_FAR_CANOPY_OPACITY_FAR_METERS = 2400;
// FAR overlay の material は alphaTest 0.45 の opaque material なので、three.js の
// shader では diffuseColor.a = opacity * texel.a が alphaTest と比較される。
// したがって opacity が 0.45 を下回ると **全 texel が discard され FAR が完全に消える**。
// 初版の 0.1 は CLOSE で FAR を消し去り、それまで canopy が覆っていた地表が
// 青灰色の裸地として広範囲に露出した(canonical reference の支配的特徴 F
// 「地面の大きな gap が支配的に見えない」に反する objective failure)。
// 下限を alphaTest より上へ置くことで、CLOSE では FAR が「消える」のではなく
// 「薄くなる」(alpha > 0.45/0.60 = 0.75 の濃い texel だけが残る)。
// この値を 0.45 以下へ下げないこと。
export const R5_FAR_CANOPY_OPACITY_MIN = 0.6;
export const R5_FAR_CANOPY_OPACITY_MAX = 1;

/**
 * COLOR_ANCHORS の field 位置は、PATCH A の cluster lattice 3,025 点で実測した
 * macro field の p10 / p50 / p90(0.3111 / 0.4786 / 0.6517)である。
 * この実測は R1 を一度も描画する前に行った(design §7.4 / PARAMETER FIX LOG FIX-2)。
 */
export const MACRO_FIELD_ANCHOR_PERCENTILES = {
  sampleCount: 3025,
  p10: 0.3111,
  p50: 0.4786,
  p90: 0.6517,
} as const;
