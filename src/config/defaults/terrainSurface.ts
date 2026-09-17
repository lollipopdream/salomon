import type { TerrainSurfaceConfig } from '../../types';

export const terrainSurfaceDefaults: TerrainSurfaceConfig = {
  // A/B確定(2026-09-10): 'c3' = DEM-derived normal map + multi-scale hillshade を採用。
  // 'c4'(+ aerial由来canopy detail normal)は視覚差がc3に対して小さい一方で
  // 初期化コストが約2.9倍(実測 2424ms → 6933ms)になるため既定にしない。
  // `?terrainSurface=baseline|c1|c2|c3|c4` で実行時比較が可能。
  // 判断根拠: outputs/matsu-h01-reference-driven-terrain/decision.md
  defaultVariant: 'c3',
  hillshade: {
    // 実効基線長 = 2 * stepPixels * 7.766 m
    scales: [
      { stepPixels: 12, weight: 0.5 }, // 186.4 m — 主稜線・主谷
      { stepPixels: 4, weight: 0.3 }, //  62.1 m — 支尾根・沢筋
      { stepPixels: 1, weight: 0.2 }, //  15.5 m — 斜面の細かな凹凸
    ],
    slopeExaggeration: 1.0,
    // 平坦面(法線 +Y)での factor が約 0.995 になるよう選定している:
    //   L = (-3600, 3200, -2400), |L| = 5381.4, Ly = 0.5947
    //   factor = 0.62 + 0.5947 * (1.25 - 0.62) = 0.9947
    // すなわち「平地はほぼ素通し、斜面だけが明暗する」性質を持つ。
    minFactor: 0.62,
    maxFactor: 1.25,
  },
  demNormal: {
    coarseStepPixels: 3, // = 現行 mesh stride。23.3 m より長い波長は geometry が担当
    strength: 1.6,
  },
  canopy: {
    resolution: 1536, // 3.883 m/texel
    blurRadiusTexels: 3,
    heightScale: 12.0,
    weight: 0.55,
  },
  normalMapResolution: 768, // = DEM full-res 解像度(7.766 m/texel)
  normalScale: 1.0,
};
