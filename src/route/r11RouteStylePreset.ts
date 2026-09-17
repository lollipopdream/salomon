import type { RouteVisualConfig } from '../types';

export interface RouteStyleFlags {
  /** `?routeWhite=1` のときだけ true。 */
  whiteThick: boolean;
}

/** preview-only の opt-in。完全一致のみ true。 */
export function resolveRouteStyleFlags(
  query: URLSearchParams,
): RouteStyleFlags {
  return { whiteThick: query.get('routeWhite') === '1' };
}

/**
 * 実線部（base / core）の widthPx に掛ける倍率。
 * 「太くしてほしい」という要望に直接応えるのはこの 2 レイヤなので、厳密に 2 倍。
 */
export const R11_ROUTE_WIDTH_SCALE = 2;

/**
 * halo（光彩）の倍率と opacity 倍率。
 *
 * 初回案では halo も一律 2 倍（14.0px / 22px）かつ opacity 据え置きにしたが、
 * reviewer の実測で 2 件の実害が出たため 1 回だけ調整した。
 *
 * 1. POI ラベル板のコントラスト劣化
 *    22px の白 halo が半透明ラベル板の裏へ回り込み、OVERVIEW の
 *    「高尾山駅・霞台」板内側の背景輝度が **77 → 156** に上昇。
 *    白文字に対するコントラスト比が約 5:1 → 約 1.6:1 まで落ちて読めなくなった。
 * 2. switchback 密集部の塊状化
 *    高尾山駅〜霞台の折り返しで halo 同士が結合して一枚の白面になり、
 *    折り返しの間の暗い尾根が塗り潰されて zigzag 構造が読めなくなった。
 *    近景でも halo が「光彩」ではなく硬いエッジの「塗り」になっていた。
 *
 * base 4px / core 7.2px（いずれも厳密 2 倍）はそのまま維持するので
 * 「白く、明確に太い」という要望は損なわれない。halo だけを光彩へ戻す。
 */
export const R11_ROUTE_HALO_WIDTH_SCALE = 1.6;
export const R11_ROUTE_HALO_OPACITY_SCALE = 0.55;

/**
 * 白く太いルート線の preview-only config を新規に返す。入力は変更しない。
 *
 * `routeVisual.ts` の LineMaterial は `worldUnits: false` のため、widthPx は
 * world unit ではなく screen-space の CSS ピクセルである。実測した既定値は
 * baseLayer: 0xf7c56b / 0.9 / 2px、halo 外: 0xffb84d / 0.14 / 11px、
 * halo 内: 0xffb84d / 0.32 / 7px、core: 0xffffff / 1 / 3.6px。
 * core だけが白く細く、base と halo が暖色なので、線全体が金色〜アンバーに
 * 見えていた。そこで全レイヤを白にし、CSS ピクセル幅を 2 倍にする。
 */
export function createWhiteThickRoutePreset(
  config: RouteVisualConfig,
): RouteVisualConfig {
  return {
    baseLayer: {
      ...config.baseLayer,
      color: 0xffffff,
      widthPx: config.baseLayer.widthPx * R11_ROUTE_WIDTH_SCALE,
    },
    coreColor: 0xffffff,
    coreWidthPx: config.coreWidthPx * R11_ROUTE_WIDTH_SCALE,
    // routeVisual.ts が描画順のために幅の降順へ sort する。ここでは入力順を保つ。
    // halo は実線部より控えめな倍率にし、opacity も下げて「塗り」ではなく
    // 「光彩」に戻す（上の定数コメントの実測根拠を参照）。
    haloLayers: config.haloLayers.map((layer) => ({
      ...layer,
      color: 0xffffff,
      widthPx: layer.widthPx * R11_ROUTE_HALO_WIDTH_SCALE,
      opacity: layer.opacity * R11_ROUTE_HALO_OPACITY_SCALE,
    })),
  };
}
