import type { ClusterPlacementResult } from '../cluster/clusterTypes';

/**
 * design §7.3 の closure 保全検証、および §7.4 の color luminance 検証に使う
 * runtime metrics。作業1 で candidateController.ts から二重 build を除去したため、
 * BASELINE と R1 の比較(footprint width の比)は runtime では算出せず、
 * この helper を使って test 側(appearanceInvariants.test.ts の I-12)で算出する。
 * `OUT/forest-appearance-metrics.json` へ実測値を書き出す際にも利用できる。
 */
export interface AppearanceScaleMetrics {
  baselineMeanSquareScale: number;
  r1MeanSquareScale: number;
  meanSquareScaleRatio: number;
  baselineMeanSquareFootprintWidth: number;
  r1MeanSquareFootprintWidth: number;
  meanSquareFootprintWidthRatio: number;
  baselineMeanFootprintWidth: number;
  r1MeanFootprintWidth: number;
  meanFootprintWidthRatio: number;
}

function requireFootprintWidthStats(placement: ClusterPlacementResult): ClusterPlacementResult['stats'] & {
  meanSquareFootprintWidth: number;
  meanFootprintWidth: number;
} {
  const { stats } = placement;
  if (!('meanSquareFootprintWidth' in stats) || !('meanFootprintWidth' in stats)) {
    throw new Error('Cluster placement is missing footprint-width metrics.');
  }
  return stats;
}

/**
 * design §11.1 の「R2 は彩度を減衰しない」を実測するための helper。
 * member ごとの `max(r,g,b) - min(r,g,b)`(color multiplier の彩度幅)の平均を返す。
 * R1/R2 それぞれに適用して比較できるよう export する
 * (appearanceInvariants.test.ts の "wider mean max-min color multiplier span" test で使用)。
 */
export function computeMeanColorMultiplierSpan(placement: ClusterPlacementResult): number {
  let total = 0;
  for (let i = 0; i < placement.memberCount; i += 1) {
    const r = placement.memberColorR[i];
    const g = placement.memberColorG[i];
    const b = placement.memberColorB[i];
    total += Math.max(r, g, b) - Math.min(r, g, b);
  }
  return placement.memberCount === 0 ? 0 : total / placement.memberCount;
}

export function computeAppearanceScaleMetrics(
  baseline: ClusterPlacementResult,
  r1: ClusterPlacementResult,
): AppearanceScaleMetrics {
  const baselineMeanSquareScale = baseline.stats.meanSquareScale;
  const r1MeanSquareScale = r1.stats.meanSquareScale;
  const meanSquareScaleRatio = baselineMeanSquareScale === 0
    ? 0
    : r1MeanSquareScale / baselineMeanSquareScale;
  const baselineFootprintStats = requireFootprintWidthStats(baseline);
  const r1FootprintStats = requireFootprintWidthStats(r1);
  const baselineMeanSquareFootprintWidth = baselineFootprintStats.meanSquareFootprintWidth;
  const r1MeanSquareFootprintWidth = r1FootprintStats.meanSquareFootprintWidth;
  const meanSquareFootprintWidthRatio = baselineMeanSquareFootprintWidth === 0
    ? 0
    : r1MeanSquareFootprintWidth / baselineMeanSquareFootprintWidth;
  const baselineMeanFootprintWidth = baselineFootprintStats.meanFootprintWidth;
  const r1MeanFootprintWidth = r1FootprintStats.meanFootprintWidth;
  const meanFootprintWidthRatio = baselineMeanFootprintWidth === 0
    ? 0
    : r1MeanFootprintWidth / baselineMeanFootprintWidth;
  return {
    baselineMeanSquareScale,
    r1MeanSquareScale,
    meanSquareScaleRatio,
    baselineMeanSquareFootprintWidth,
    r1MeanSquareFootprintWidth,
    meanSquareFootprintWidthRatio,
    baselineMeanFootprintWidth,
    r1MeanFootprintWidth,
    meanFootprintWidthRatio,
  };
}
