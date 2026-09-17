export interface LabelLayerPromotionFlags {
  /** ラベル要素を独自 compositor layer へ昇格させるか。既定 false。 */
  promoteLabelLayers: boolean;
}

/**
 * 2026-09-12 の route playback 1080p 実測では、mean は BEFORE 30.72/37.28 ms に対し
 * AFTER 35.50 ms、p95 は BEFORE 70.6/94.7 ms に対し AFTER 99.7 ms で、noise envelope 内かつ
 * 非改善だったため既定 OFF。実験は `?labelLayerPromote=1` (DEV のみ) で再現できる。
 */
export function resolveLabelLayerPromotionFlags(
  query: URLSearchParams,
  isDev: boolean,
): LabelLayerPromotionFlags {
  return {
    promoteLabelLayers: isDev && query.get('labelLayerPromote') === '1',
  };
}

/** 昇格時に要素へ適用すべき style プロパティ(適用側でそのまま代入する)。 */
export const LABEL_LAYER_PROMOTION_STYLE: { willChange: string } = {
  willChange: 'transform',
};
