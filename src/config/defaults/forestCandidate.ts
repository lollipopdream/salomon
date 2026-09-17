import type { ForestCandidateConfig } from '../../forest/candidate/types';

import { assetUrl } from '../assetBase';

export const forestCandidateDefaults: ForestCandidateConfig = {
  mask: {
    url: '/data/forest/takao-forest-mask.png',
    extentMeters: 5940.950684,
    size: 1024,
  },
  foliage: {
    conifer: {
      diffUrl: assetUrl('/data/forest/foliage/fir_twig_diff_512.png'),
      alphaUrl: assetUrl('/data/forest/foliage/fir_twig_alpha_512.png'),
    },
    broadleaf: {
      diffUrl: assetUrl('/data/forest/foliage/broadleaf_diff_512.png'),
      alphaUrl: assetUrl('/data/forest/foliage/broadleaf_alpha_512.png'),
    },
  },
  atlas: { cellSize: 256, columns: 4, variantsPerSpecies: 4 },
  sprites: {
    alphaThreshold: 40,
    minAreaPixels: 500,
    maxSprites: 16,
    paddingPixels: 2,
  },
  crown: {
    conifer: {
      spriteCount: 34,
      baseScale: 0.42,
      scaleJitter: 0.30,
      envelopeExponent: 0.78,
      bottomFraction: 0.05,
      topFraction: 1.0,
      radiusRatio: 0.46,
      rotationJitterRad: 0.55,
      bottomBrightness: 0.40,
      topBrightness: 1.0,
    },
    broadleaf: {
      spriteCount: 150,
      baseScale: 0.17,
      scaleJitter: 0.35,
      envelopeExponent: 0.55,
      bottomFraction: 0.16,
      topFraction: 1.0,
      radiusRatio: 0.48,
      rotationJitterRad: 3.14159,
      bottomBrightness: 0.42,
      topBrightness: 1.0,
    },
  },
  placement: {
    seed: 20260912,
    // 実画面観察(2026-09-12): 13 m では近景で樹冠が閉じず「まばらな木」に見えたため
    // 11 m を既定とする。9 m はさらに閉じるが instance 数が約 1.5 倍になる。
    spacingMeters: 11,
    jitterRatio: 0.55,
    maxInstances: 260000,
    minCoverage: 0.12,
    slopeFullDeg: 40,
    slopeZeroDeg: 60,
    routeClearanceMeters: 10,
    routeDistanceCellMeters: 16,
    coniferFraction: 0.62,
    sinkMeters: 0.4,
  },
  size: {
    conifer: { minHeightMeters: 17, maxHeightMeters: 27, widthRatio: 0.55 },
    broadleaf: { minHeightMeters: 11, maxHeightMeters: 18, widthRatio: 0.95 },
  },
  material: {
    alphaTest: 0.42,
    tintJitter: 0.16,
    coniferTint: 0xdfe6d8,
    broadleafTint: 0xeef0e4,
  },
};
