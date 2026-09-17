import { assetUrl } from '../../config/assetBase';
import type { ForestImpostorV2Config } from './types';

const R10_GROVE_ATLAS_URL = assetUrl(
  '/data/forest/r10/grove-atlas-r8-i1-skylight-blue-3072x2048.png',
);
const R10_TREE_ATLAS_URL = assetUrl(
  '/data/forest/r10/tree-atlas-r8-i2b-pervariant-blue-2048x2048.png',
);

/** Preview-only R10 side-atlas swap. The production atlas metadata is compatible. */
export function createR10AtlasPreset(config: ForestImpostorV2Config): ForestImpostorV2Config {
  return {
    assets: {
      ...config.assets,
      groveAtlasUrl: R10_GROVE_ATLAS_URL,
      treeAtlasUrl: R10_TREE_ATLAS_URL,
    },
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
      speciesGroups: {
        conifer: [...config.grove.speciesGroups.conifer],
        mixed: [...config.grove.speciesGroups.mixed],
        broadleaf: [...config.grove.speciesGroups.broadleaf],
      },
      speciesGroupSplit: { ...config.grove.speciesGroupSplit },
    },
    tree: { ...config.tree, variantWeights: { ...config.tree.variantWeights } },
    material: { ...config.material },
    limits: { ...config.limits },
  };
}
