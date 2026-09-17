/**
 * R10: opt-in な「山体スケールの低周波 macro shading」を per-instance 色 /
 * FAR canopy 頂点色へ乗算するための純粋関数群。
 *
 * 背景: grove/tree card と FAR canopy は THREE.MeshBasicMaterial(unlit)であり、
 * scene の DirectionalLight / HemisphereLight を一切評価しない。そのため森林
 * ピクセルには尾根・谷の陰影が乗らず山全体が平たく見える(terrain 側は
 * MeshStandardMaterial なので陰影を持つ)。material は unlit のまま変えず、
 * instanceColor と FAR canopy の頂点色に linear light の輝度係数を乗算する
 * ことでこれを補う。
 *
 * このモジュールは THREE に一切依存しない(テスト容易性のため)。乱数は
 * 使わない。同じ入力に対して必ず同じ出力を返す(決定論的)。
 */

export interface MacroShadeConfig {
  enabled: boolean;
  /** 太陽方向(面から光源へ向かう単位ベクトル) */
  sun: { x: number; y: number; z: number };
  /** 環境項。0..1 */
  ambient: number;
  /** 直射項。0..1 */
  direct: number;
  /** 谷暗化の重み。0 で無効 */
  valleyWeight: number;
  /** macro normal を作る中央差分のステップ(m) */
  normalStepMeters: number;
  /** 谷/尾根判定に使うリング半径(m) */
  valleyRadiusMeters: number;
  /** 相対高さの正規化スケール(m) */
  reliefScaleMeters: number;
  /**
   * 正規化(平均 1.0 化)後に乗じる gain。既定 1.0(=無補正、既存挙動と数値的に完全同一)。
   * 明部(p95)を reference 方向へ押し上げるための調整項(§gain 実測根拠を参照)。
   * 適用順序は「正規化 → gain → shadeMin/shadeMax クランプ」で、gain はクランプの前に効く。
   */
  gain: number;
  /** 正規化後のクランプ範囲 */
  shadeMin: number;
  shadeMax: number;
}

function normalizeVec3(x: number, y: number, z: number): { x: number; y: number; z: number } {
  const length = Math.sqrt(x * x + y * y + z * z);
  return { x: x / length, y: y / length, z: z / length };
}

/**
 * 既存 contract の太陽方向をそのまま使う。新しい太陽方向を発明しない
 * (正規化前: (-3600, 3200, -2400)。正規化後は約 (-0.6689, 0.5946, -0.4459))。
 */
const DEFAULT_SUN_DIRECTION = normalizeVec3(-3600, 3200, -2400);

export const DEFAULT_MACRO_SHADE_CONFIG: MacroShadeConfig = {
  enabled: false,
  sun: DEFAULT_SUN_DIRECTION,
  ambient: 0.6,
  direct: 0.4,
  valleyWeight: 0.25,
  normalStepMeters: 90,
  valleyRadiusMeters: 260,
  reliefScaleMeters: 90,
  gain: 1.0,
  shadeMin: 0.55,
  shadeMax: 1.55,
};

/** fail-safe な数値化: 有限でなければ fallback を返す。 */
function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const RING_DIRECTION_COUNT = 8;

/**
 * 1 点 (x, z) における macro shade の raw(未正規化)値を計算する。
 *
 *   dx = (h(x+Rn, z) - h(x-Rn, z)) / (2 Rn)
 *   dz = (h(x, z+Rn) - h(x, z-Rn)) / (2 Rn)
 *   N  = normalize(-dx, 1, -dz)
 *   ndl = max(0, dot(N, sun))
 *   hRef = 半径 Rv のリング上 8 方向(0°,45°,…,315°)の h の平均
 *   rel  = clamp((h(x,z) - hRef) / reliefScaleMeters, -1, 1)
 *   raw  = (ambient + direct * ndl) * (1 + valleyWeight * rel)
 *
 * terrainYAt が NaN / Infinity を返しても、この関数は常に有限値を返す
 * (fail-safe: 計算不能なら raw = 1 = 無補正相当を返す)。
 */
export function computeRawMacroShade(
  config: MacroShadeConfig,
  terrainYAt: (x: number, z: number) => number,
  x: number,
  z: number,
): number {
  const stepMeters = config.normalStepMeters;
  const hEast = terrainYAt(x + stepMeters, z);
  const hWest = terrainYAt(x - stepMeters, z);
  const hSouth = terrainYAt(x, z + stepMeters);
  const hNorth = terrainYAt(x, z - stepMeters);
  const hCenter = terrainYAt(x, z);

  const dx = finiteOr((hEast - hWest) / (2 * stepMeters), 0);
  const dz = finiteOr((hSouth - hNorth) / (2 * stepMeters), 0);

  const normalLength = Math.sqrt(dx * dx + 1 + dz * dz);
  const nx = finiteOr(-dx / normalLength, 0);
  const ny = finiteOr(1 / normalLength, 1);
  const nz = finiteOr(-dz / normalLength, 0);

  const dot = nx * config.sun.x + ny * config.sun.y + nz * config.sun.z;
  const ndl = finiteOr(Math.max(0, dot), 0);

  let ringSum = 0;
  for (let k = 0; k < RING_DIRECTION_COUNT; k += 1) {
    const angle = (k * 2 * Math.PI) / RING_DIRECTION_COUNT;
    const ringX = x + config.valleyRadiusMeters * Math.cos(angle);
    const ringZ = z + config.valleyRadiusMeters * Math.sin(angle);
    ringSum += finiteOr(terrainYAt(ringX, ringZ), 0);
  }
  const hRef = ringSum / RING_DIRECTION_COUNT;

  const rawRel = (finiteOr(hCenter, 0) - hRef) / config.reliefScaleMeters;
  const rel = finiteOr(clamp(rawRel, -1, 1), 0);

  const raw = (config.ambient + config.direct * ndl) * (1 + config.valleyWeight * rel);
  return finiteOr(raw, 1);
}

/**
 * raw shade の集合を、平均が 1 になるよう正規化し、`gain` を乗じてからクランプする。
 * 正規化(平均 1.0 化)は patch 全体の平均輝度を baseline から動かさないために行い、
 * `gain` はその後(クランプの前)に効く明部/暗部の一律な押し上げ・押し下げ項。
 *
 * 適用順序は必ず「正規化 → gain → shadeMin/shadeMax クランプ」(この順序が重要)。
 *
 * `gain` が非有限(NaN/Infinity)の場合は既存の `finiteOr` 方針にあわせ、fallback 1.0
 * (=無補正)として扱う。`gain` が 1.0 のときは常に乗算自体は実行する(スキップしない)が、
 * IEEE754 の仕様上 `x * 1.0` は任意の有限 `x` に対して `x` と bit-for-bit 同一のため、
 * 既存挙動と数値的に完全に同一になる。
 *
 * 平均が 0、または非有限の場合は fail-safe として全要素 1(無補正)を返す。
 */
export function normalizeMacroShade(
  rawValues: Float32Array | number[],
  config: MacroShadeConfig,
): Float32Array {
  const count = rawValues.length;
  const result = new Float32Array(count);
  if (count === 0) return result;

  let sum = 0;
  for (let i = 0; i < count; i += 1) sum += rawValues[i];
  const mean = sum / count;

  if (!Number.isFinite(mean) || mean === 0) {
    result.fill(1);
    return result;
  }

  const gain = finiteOr(config.gain, 1);

  for (let i = 0; i < count; i += 1) {
    const normalized = finiteOr(rawValues[i] / mean, 1);
    const gained = finiteOr(normalized * gain, 1);
    result[i] = clamp(gained, config.shadeMin, config.shadeMax);
  }
  return result;
}
