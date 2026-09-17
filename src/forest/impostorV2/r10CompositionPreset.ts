import { macroValueNoise } from './macroNoise';
import type { ForestImpostorV2Config } from './types';

/**
 * Preview-only の広葉樹主体 preset。
 * atlas 実データでは G1/G3 が針葉樹のみ、G2/G4 が混交、G5 が広葉樹優勢で、
 * G6 にも BL が含まれる。また BL の crown_width_over_height は約 0.94 と、
 * 針葉樹の約 0.35--0.44 より横に広い。この構成と樹冠形状を反映し、G4/G5/G6 と
 * BL を主体にしつつ、G1/G3 と FIR を低比率のアクセントとして残す。
 * 空間比率は conifer 8%、mixed 30%、broadleaf 62% を基準とする。
 */

export interface R10CompositionField {
  /** 種構成フィールドの空間スケール(メートル)。96m cell 境界より十分大きく取る。 */
  fieldMeters: number;
  /** フィールド値がこれ未満なら針葉樹グループ。 */
  coniferThreshold: number;
  /** フィールド値がこれ未満なら混交グループ（coniferThreshold 以上のとき）。 */
  mixedThreshold: number;
  /** 境界をぼかすインスタンス単位ジッタの幅（フィールド値へ加算される範囲 ±jitter/2）。 */
  jitter: number;
  /** value noise の seed に XOR する定数。 */
  seedSalt: number;
}

export const R10_COMPOSITION_FIELD: Readonly<R10CompositionField> = {
  fieldMeters: 420,
  // computeSpeciesField は 2 つの value noise の加重和（0.7a + 0.3b）なので 0.5 付近へ集中し、
  // 閾値はそのまま「比率」にならない。実測 90,000 サンプルの分位点表
  // （q05=0.21974 / q12=0.28574 / q30=0.40618 / q40=0.46166）から線形補間して、
  // 針葉樹 8% / 混交 30% / 広葉樹 62% に対応する値を求めた。
  //   q08 = q05 + (0.03/0.07) * (q12 - q05) = 0.2480
  //   q38 = q30 + (0.08/0.10) * (q40 - q30) = 0.4506
  coniferThreshold: 0.2480,
  mixedThreshold: 0.4506,
  jitter: 0.14,
  seedSalt: 0x5bd1e995,
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** 世界座標 (x,z) における連続的な樹種フィールド値 0..1 を返す。決定論的・純粋関数。 */
export function computeSpeciesField(
  x: number,
  z: number,
  seed: number,
  field: Readonly<R10CompositionField>,
): number {
  const a = macroValueNoise(
    x / field.fieldMeters,
    z / field.fieldMeters,
    (seed ^ field.seedSalt) >>> 0,
  );
  const b = macroValueNoise(
    x / (field.fieldMeters * 0.45) + 31.7,
    z / (field.fieldMeters * 0.45) - 17.3,
    (seed ^ field.seedSalt ^ 0x1b873593) >>> 0,
  );
  return clamp01(0.7 * a + 0.3 * b);
}

/** フィールド値とジッタ（0..1 の一様乱数）から species group 名を返す。 */
export function selectSpeciesGroupKey(
  fieldValue: number,
  jitterUnit: number,
  field: Readonly<R10CompositionField>,
): 'conifer' | 'mixed' | 'broadleaf' {
  const jittered = clamp01(fieldValue + (jitterUnit - 0.5) * field.jitter);
  if (jittered < field.coniferThreshold) return 'conifer';
  if (jittered < field.mixedThreshold) return 'mixed';
  return 'broadleaf';
}

/** production default を変更せず、広葉樹主体の preview-only config を新規に返す。 */
export function createR10CompositionPreset(
  config: ForestImpostorV2Config,
): ForestImpostorV2Config {
  return {
    assets: { ...config.assets },
    mask: { ...config.mask },
    cellSelection: {
      grove: {
        configs: [...config.cellSelection.grove.configs],
        yawDegrees: [...config.cellSelection.grove.yawDegrees],
      },
      tree: {
        variants: [...config.cellSelection.tree.variants],
        yawDegrees: [...config.cellSelection.tree.yawDegrees],
      },
    },
    macro: { ...config.macro, patchThreshold: { ...config.macro.patchThreshold } },
    corridor: { ...config.corridor },
    grove: {
      ...config.grove,
      // 現行構成は config 選択率で加重すると個体数ベースで針葉樹 59.0% だった
      // (G1 4/4・G2 4/5・G3 5/5・G4 3/5・G5 1/4・G6 2/3 を、G1 4.10% /
      // G2 9.95% / G3 4.10% / G4 33.90% / G5 24.10% / G6 23.85% で加重)。
      // 「G1+G3 = 8.19% だから針葉樹は脇役」という以前の記述は、個体数を無視した誤り。
      // FIR は高さ 14--19m・crown 幅/高さ 0.35--0.44、BL は scale 後 10--13m・0.94。
      // 背の高い細い針葉樹が広葉樹の塊の上に突き出すため、樹冠面積比 14.9% でも
      // シルエットを支配する。
      //
      // ただし G5 偏重（実測 76%）にすると別の FAIL が出た。G5 は樹冠が隙間なく
      // 詰まった板状の card なので、PRIMARY 距離では隣接 card が融合して
      // 「粒のない一様なビロード状の面」になり、canonical reference の
      // 「midground でも forest grain が残る」条件に反する（実測 capture
      // `visual/r11i-primary.png` で確認）。
      //
      // 一方 G4 は広葉樹 2 本（scale 2.9 / 2.2）が作る丸い塊で、
      // PRIMARY 距離でも粒が残る。そこで G4 を主体、G5 を副とする配分にする。
      //   conifer   ['G1','G3']        = 8%   -> G1 4% / G3 4%
      //   mixed     ['G4','G6']        = 30%  -> G4 15% / G6 15%
      //   broadleaf ['G5','G4']        = 62%  -> G5 31% / G4 31%
      //   => G4 46% / G5 31% / G6 15% / G1 4% / G3 4%
      //
      // この配分の個体数ベース針葉樹比率は実機実測 52.1% で、G5 偏重の 39% より高い。
      // それでも尖ったシルエットが問題にならないのは、突き出す尖りの主因が
      // grove 内の FIR ではなく **tree layer の単木 FIR** だったためで、
      // そちらは下の variantWeights で 30% -> 8% に落としてある。
      //
      // scale 拡大と minSpacingRatio 低下は樹冠を重ね、closed canopy に近づけるため。
      scaleMin: 0.82,
      scaleMax: 1.78,
      minSpacingRatio: 0.54,
      speciesGroups: {
        conifer: ['G1', 'G3'],
        mixed: ['G4', 'G6'],
        broadleaf: ['G5', 'G4'],
      },
      speciesGroupSplit: {
        conifer: 0.08,
        mixed: 0.38,
      },
    },
    tree: {
      ...config.tree,
      // canonical reference の large / medium / small crown の混在に合わせ、現行の狭い
      // 幅（比 1.44）を、平均をほぼ保った比 2.39 へ拡大して規則性を抑える。
      scaleMin: 0.62,
      scaleMax: 1.48,
      variantWeights: { BL: 0.92, FIR_A: 0.05, FIR_C: 0.03 },
      nearRouteBroadleafFraction: 0.85,
    },
    material: { ...config.material },
    limits: { ...config.limits },
  };
}
