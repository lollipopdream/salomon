/** Linear-light RGB values used by forest materials. Values above 1 are intentional. */
export interface LinearRgb {
  r: number;
  g: number;
  b: number;
}

/**
 * Preview-only R10 forest tone calibration.
 *
 * Three.js material colors operate in the working linear color space, so no
 * sRGB conversion is applied here and values above 1 must not be clamped.
 * 旧 gain は「針葉樹主体で暗かった構成」用の較正で、広葉樹主体への構成変更後は無効になった。
 * linear light 実測では canonical reference / 現行(r10broad) が mean RGB =
 * R 0.07031 / 0.11727、G 0.07227 / 0.14391、B 0.03709 / 0.06452、mean Y =
 * 0.06931 / 0.13252（1.91 倍）、Y > 0.60 の画素比 = 0.373% / 1.224%（3.3 倍の
 * クリップ）、R/G = 0.973 / 0.815、B/G = 0.513 / 0.448 だった。旧 gain に
 * scale_r = 0.5996 / scale_g = 0.5022 / scale_b = 0.5748 を乗じた gain
 * (1.427, 1.190, 1.299) は mean linear RGB を reference に一致させた。
 *
 * ただしその gain は R/G = 1.199 と暖色に寄っており、平均だけが合っていて
 * 画素の色分布が reference と違っていた。R11-F で per-instance tint を入れた後に
 * CLOSE を再実測した結果（reference / R11-F）:
 *
 *   mean Y            0.07155 / 0.07041
 *   mean 彩度         0.625   / 0.578
 *   R/G               0.959   / 1.184
 *   B/G               0.548   / 0.416
 *   暖色画素(R>1.1G)  13.5%   / 48.7%
 *   緑画素(G>1.1R)    72.6%   / 20.5%
 *
 * reference は「緑が 7 割強、暖色が 1 割強」であるのに対し、暖色 gain の上に
 * tint の暖色 entry が積み上がって暖色が半分を占めていた。
 *
 * そこで gain 側の暖色バイアスを取り除き、暖色は tint palette にだけ担わせる。
 * R11-F 実測から gain 適用前の scene mean linear RGB を逆算すると
 * R0 = 0.05861 / G0 = 0.05935 / B0 = 0.02262。
 *
 * ここで B/G も reference（0.548）に合わせようとして gb/gg = 1.4377
 * （gain (1.222, 1.259, 1.809)）を試したが、**却下した**。実測 R11-G:
 *
 *   mean Y 0.07156（reference 0.07155・完全一致）
 *   R/G 0.978（0.959）、B/G 0.541（0.548）… ここまでは一致するが
 *   mean 彩度 0.489（0.625）… R11-F の 0.578 より悪化
 *   低彩度画素(sat<0.30) 17.9%（4.4%）… 4 倍
 *
 * つまり青を一律に持ち上げると B/G は合うが葉が灰色に寄り、彩度が壊れる。
 * reference の B/G 0.548 は「霞んだ遠景」や「空が覗く隙間」といった特定の画素が
 * 作っている値で、全画素の一律な青ではない。3 チャンネルの global gain では
 * B/G と彩度を同時に満たせない。したがって **B/G は global gain の目標にしない**。
 *
 * 採用: R/G と mean Y だけを合わせ、B は R11-F の比率（gb/gg = 1.0916）を維持する。
 *   gr/gg = 0.959 / (R0/G0) = 0.971
 *   gb/gg = 1.299 / 1.190 = 1.0916（据え置き）
 *   mean Y を 0.0716 にする全体倍率 k = 1.2711
 * 新 gain = k × (0.971, 1.0, 1.0916) = (1.234, 1.271, 1.388)。
 *
 * 既知のトレードオフ: この gain の B/G は約 0.42 で reference の 0.548 より低い。
 * ただし §禁止事項は「森林全体が cyan / blue-green」であって青不足ではなく、
 * 青を落とすほど葉の彩度は reference 側へ寄る。彩度（0.625 目標）と
 * 緑優位（reference 72.6%）を優先する判断である。
 */
export const R10_TONE_PRESET = Object.freeze({
  linearGain: Object.freeze({ r: 1.234, g: 1.271, b: 1.388 }),
});

function finiteChannel(value: number): number {
  return Number.isFinite(value) ? value : 1;
}

/** Pure, deterministic RGB multiplication used by every forest-only layer. */
export function applyR10TonePreset(
  input: Readonly<LinearRgb>,
  enabled: boolean,
): LinearRgb {
  const r = finiteChannel(input.r);
  const g = finiteChannel(input.g);
  const b = finiteChannel(input.b);
  if (!enabled) return { r, g, b };
  return {
    r: r * R10_TONE_PRESET.linearGain.r,
    g: g * R10_TONE_PRESET.linearGain.g,
    b: b * R10_TONE_PRESET.linearGain.b,
  };
}
