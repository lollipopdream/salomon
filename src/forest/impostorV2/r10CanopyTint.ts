import { hashIndexTo01 } from '../forestRandom';
import { macroValueNoise } from './macroNoise';

export interface CanopyTintEntry {
  /** 重み（すべての entry の合計が 1 になること）。 */
  weight: number;
  /** 乗算 tint。パレット全体の加重平均が (1,1,1) になるよう正規化して使う。 */
  rgb: readonly [number, number, number];
}

export interface CanopyTintConfig {
  palette: readonly CanopyTintEntry[];
  /** 黄葉のまとまりの空間スケール（メートル）。96m cell 境界より大きく取る。 */
  fieldMeters: number;
  /** 境界をぼかすインスタンス単位ジッタの幅。 */
  jitter: number;
  /** value noise の seed に XOR する定数。 */
  seedSalt: number;
  /** 受光量バイアスの強さ。0 で無効（従来と同一）。 */
  lightBias: number;
}

/** パレットの加重平均が厳密に (1,1,1) になるよう正規化した配列を返す。純粋関数。 */
export function normalizeTintPalette(
  palette: readonly CanopyTintEntry[],
): readonly CanopyTintEntry[] {
  let totalWeight = 0;
  let meanR = 0;
  let meanG = 0;
  let meanB = 0;
  for (const entry of palette) {
    totalWeight += entry.weight;
    meanR += entry.weight * entry.rgb[0];
    meanG += entry.weight * entry.rgb[1];
    meanB += entry.weight * entry.rgb[2];
  }
  meanR /= totalWeight;
  meanG /= totalWeight;
  meanB /= totalWeight;
  return palette.map((entry) => ({
    weight: entry.weight,
    rgb: [entry.rgb[0] / meanR, entry.rgb[1] / meanG, entry.rgb[2] / meanB] as const,
  }));
}

export const R10_CANOPY_TINT: Readonly<CanopyTintConfig> = {
  palette: normalizeTintPalette([
    { weight: 0.34, rgb: [0.86, 1.02, 1.02] },
    { weight: 0.34, rgb: [0.97, 1.03, 0.96] },
    { weight: 0.20, rgb: [1.10, 1.02, 0.83] },
    { weight: 0.08, rgb: [1.28, 1.00, 0.70] },
    { weight: 0.04, rgb: [1.42, 0.90, 0.62] },
  ]),
  fieldMeters: 260,
  jitter: 0.16,
  seedSalt: 0x27d4eb2f,
  lightBias: 0.55,
};

interface TintFieldQuantile {
  probability: number;
  value: number;
}

/**
 * seed 20260913、jitterUnit 0.5 で、0..5940 m を 29.7 m 間隔の 200 x 200
 * 格子として下記の合成場を実測し、ソート済み 40,000 値を線形補間して得た分位点。
 * 基本の 5% 刻み 21 点に、palette の累積境界を正確に保つ 4 点を加えている。
 */
const TINT_FIELD_QUANTILES: readonly TintFieldQuantile[] = [
  { probability: 0.00, value: 0.0500055379 },
  { probability: 0.05, value: 0.2246460909 },
  { probability: 0.10, value: 0.2788116703 },
  { probability: 0.15, value: 0.3174083952 },
  { probability: 0.20, value: 0.3509716609 },
  { probability: 0.25, value: 0.3799352981 },
  { probability: 0.30, value: 0.4069453213 },
  { probability: 0.34, value: 0.4273210593 },
  { probability: 0.35, value: 0.4321448552 },
  { probability: 0.40, value: 0.4564189782 },
  { probability: 0.45, value: 0.4788440967 },
  { probability: 0.50, value: 0.5016653793 },
  { probability: 0.55, value: 0.5247299776 },
  { probability: 0.60, value: 0.5472612203 },
  { probability: 0.65, value: 0.5695418807 },
  { probability: 0.68, value: 0.5832760832 },
  { probability: 0.70, value: 0.5921353903 },
  { probability: 0.75, value: 0.6163947326 },
  { probability: 0.80, value: 0.6424064361 },
  { probability: 0.85, value: 0.6722079544 },
  { probability: 0.88, value: 0.6929297652 },
  { probability: 0.90, value: 0.7093347857 },
  { probability: 0.95, value: 0.7592387144 },
  { probability: 0.96, value: 0.7734864122 },
  { probability: 1.00, value: 0.9642212678 },
];

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function quantileProbability(value: number): number {
  if (value <= TINT_FIELD_QUANTILES[0].value) return 0;
  const last = TINT_FIELD_QUANTILES[TINT_FIELD_QUANTILES.length - 1];
  if (value >= last.value) return 1;
  for (let index = 1; index < TINT_FIELD_QUANTILES.length; index += 1) {
    const upper = TINT_FIELD_QUANTILES[index];
    if (value > upper.value) continue;
    const lower = TINT_FIELD_QUANTILES[index - 1];
    const fraction = (value - lower.value) / (upper.value - lower.value);
    return lower.probability + fraction * (upper.probability - lower.probability);
  }
  return 1;
}

function canopyTintProbability(
  x: number,
  z: number,
  seed: number,
  jitterUnit: number,
  config: Readonly<CanopyTintConfig>,
): number {
  const u = clamp01(
    macroValueNoise(
      x / config.fieldMeters,
      z / config.fieldMeters,
      (seed ^ config.seedSalt) >>> 0,
    ) * 0.7
    + macroValueNoise(
      x / (config.fieldMeters * 0.4) + 53.1,
      z / (config.fieldMeters * 0.4) - 29.7,
      (seed ^ config.seedSalt ^ 0x165667b1) >>> 0,
    ) * 0.3
    + (jitterUnit - 0.5) * config.jitter,
  );
  return quantileProbability(u);
}

function selectPaletteTint(
  probability: number,
  config: Readonly<CanopyTintConfig>,
): readonly [number, number, number] {
  let cumulativeWeight = 0;
  for (const entry of config.palette) {
    cumulativeWeight += entry.weight;
    if (probability < cumulativeWeight) return entry.rgb;
  }
  return config.palette[config.palette.length - 1].rgb;
}

/** 世界座標 (x,z) と jitter から tint を 1 つ選ぶ。決定論的。 */
export function selectCanopyTint(
  x: number,
  z: number,
  seed: number,
  jitterUnit: number,
  config: Readonly<CanopyTintConfig>,
): readonly [number, number, number] {
  return selectPaletteTint(
    canopyTintProbability(x, z, seed, jitterUnit, config),
    config,
  );
}

/** placement の全インスタンス分の tint を global index 順で計算する。 */
export function computePlacementCanopyTints(
  positions: Float32Array,
  count: number,
  seed: number,
  config: Readonly<CanopyTintConfig> = R10_CANOPY_TINT,
  shades?: Float32Array,
): Float32Array {
  const result = new Float32Array(count * 3);

  // shades がない場合と bias 無効時は従来の選択経路をそのまま通す。
  if (shades === undefined || config.lightBias === 0) {
    for (let index = 0; index < count; index += 1) {
      const offset = index * 3;
      const tint = selectCanopyTint(
        positions[offset],
        positions[offset + 2],
        seed,
        hashIndexTo01(index, seed),
        config,
      );
      result[offset] = tint[0];
      result[offset + 1] = tint[1];
      result[offset + 2] = tint[2];
    }
    return result;
  }

  let shadeMean = 0;
  for (const shade of shades) shadeMean += shade;
  shadeMean /= shades.length;
  const shadeDenominator = Math.max(shadeMean, 1e-6);

  let litMean = 0;
  for (let index = 0; index < count; index += 1) {
    litMean += clamp01((shades[index] / shadeDenominator - 0.75) / 0.70);
  }
  litMean /= count;

  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    const probability = canopyTintProbability(
      positions[offset],
      positions[offset + 2],
      seed,
      hashIndexTo01(index, seed),
      config,
    );
    const lit = clamp01((shades[index] / shadeDenominator - 0.75) / 0.70);
    // 方法 (a): lit の実測平均を 0.5 に再中心化する。選択後の RGB を変えず、
    // 各 tint を正規化済みパレット値のまま保てるため、後段での色補正より適する。
    const centeredLit = lit - litMean + 0.5;
    const biasedProbability = clamp01(
      probability + (centeredLit - 0.5) * config.lightBias,
    );
    const tint = selectPaletteTint(biasedProbability, config);
    result[offset] = tint[0];
    result[offset + 1] = tint[1];
    result[offset + 2] = tint[2];
  }
  return result;
}
