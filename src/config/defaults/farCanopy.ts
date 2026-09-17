import { assetUrl } from '../assetBase';

/**
 * R9/R10 final で採用された FAR canopy layer を actual app へ preview-only で載せるための設定。
 *
 * texture は R9-i3 で採用された補正機構（linear-light blue offset +0.023）を、
 * 全山 extent へ焼き直したもの。生成は既存 project asset
 * （`grove_top_atlas_3072x2048.png` + canonical `takao-forest-mask.png`）のみを入力とし、
 * 既存の in-repo 生成器を再利用している。外部 asset は一切使っていない。
 *
 * - 生成器: `outputs/matsu-h01-r10-actual-app-vps-preview-deploy/tools/generateFarCanopyFullMountain.mjs`
 * - 補正:   `outputs/matsu-h01-r10-actual-app-vps-preview-deploy/tools/applyR9I3ToFullMountain.mjs`
 *           （補正本体は R9 phase の採用実装 `transformBlueOnly` を import して再利用）
 *
 * lab 版（patch A 専用・1.0921 m/texel）との違いは **extent だけ**で、
 * SEED / mask threshold / stamp spacing / scale / prefilter などの world-space パラメータは
 * R9/R10 採用時から一切変更していない。
 */
export interface FarCanopyConfig {
  /** FAR canopy texture の URL。 */
  textureUrl: string;
  /** texture が覆う world 範囲（正方形、メートル）。DEM extent と一致する。 */
  extentMeters: number;
  /**
   * alphaTest。R10 final の FAR overlay と同じく grove の alphaTest を共有する
   * （lab: `forestImpostorV2Defaults.material.groveAlphaTest`）。
   */
  alphaTest: number;
}

export const farCanopyDefaults: FarCanopyConfig = {
  textureUrl: assetUrl('/data/forest/far-canopy-fullmountain-r9i3-2048.png'),
  // DEM 実測 (cols - 1) * cellSizeMeters = 255 * 23.297845093498204。
  extentMeters: 5940.950498842042,
  alphaTest: 0.45,
};
