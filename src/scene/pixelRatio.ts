export interface PixelRatioVariantOptions {
  hardCapRatio?: number; // 既存の安全上限。既定2(現行挙動)
  variantCapRatio?: number; // P0-C候補用の追加cap(例1.5)。undefinedなら追加capなし
}

export function computeEffectivePixelRatio(
  devicePixelRatio: number,
  options: PixelRatioVariantOptions = {},
): number {
  const hardCap = options.hardCapRatio ?? 2;
  const cappedByHardLimit = Math.min(devicePixelRatio, hardCap);
  return options.variantCapRatio === undefined
    ? cappedByHardLimit
    : Math.min(cappedByHardLimit, options.variantCapRatio);
}
