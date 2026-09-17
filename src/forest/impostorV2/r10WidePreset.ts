import type { ForestImpostorV2Config } from './types';

export const R10_WIDE_DEFAULT_PATCH_THRESHOLD = {
  near: 0,
  mid: 0,
  ridge: 0,
} as const;

export interface R10WidePresetOptions {
  patchThreshold?: ForestImpostorV2Config['macro']['patchThreshold'];
}

/**
 * Preview-only: expands the route-banded card domain to every mask-eligible
 * mountain cell, while retaining the production near/mid density boundaries.
 */
export function createR10WidePreset(
  config: ForestImpostorV2Config,
  options: R10WidePresetOptions = {},
): ForestImpostorV2Config {
  const patchThreshold = options.patchThreshold ?? R10_WIDE_DEFAULT_PATCH_THRESHOLD;

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
    macro: {
      ...config.macro,
      patchThreshold: { ...patchThreshold },
      ridgeScoreMin: 0,
    },
    corridor: {
      ...config.corridor,
      ridgeMeters: 6500,
      corridorMaxMeters: 7000,
    },
    grove: {
      ...config.grove,
      // 実機実測(densityScale=25): accepted 3,227 cells の内訳は near 105 / mid 364 /
      // ridge 2,758（面積の85%）。従来は near 16m→実効3.2m（96m cell あたり target 900）、
      // mid 16m→30m→実効3.2m→6.0m（target 900→256）、ridge 160m→実効32m（target 9）で、
      // 面積の85%を占める ridge が mid の1/28の密度だった。54m は実効10.8m、target 約79となり、
      // mid との密度比を28倍から約3.2倍へ縮める。現行実測は grove 184,875 / tree 100,000 /
      // triangles 1,786,682 / drawCalls 107。
      spacingRidgeMeters: 54,
      // macroPatchField(cellX, cellZ, ...) は96m cell単位で階段状に変化し、spacing への寄与が
      // 大きいほど cell 境界の密度段差が見えるため、continuity のため 0.35 から下げる。
      patchSpacingBoost: 0.10,
      speciesGroups: {
        conifer: [...config.grove.speciesGroups.conifer],
        mixed: [...config.grove.speciesGroups.mixed],
        broadleaf: [...config.grove.speciesGroups.broadleaf],
      },
      speciesGroupSplit: { ...config.grove.speciesGroupSplit },
    },
    tree: {
      ...config.tree,
      variantWeights: { ...config.tree.variantWeights },
    },
    material: { ...config.material },
    limits: { ...config.limits },
  };
}
