import { describe, expect, it } from 'vitest';

import { forestImpostorV2Defaults } from '../../config/defaults/forestImpostorV2';
import { createR10AtlasPreset } from './r10AtlasPreset';
import { createR10WidePreset } from './r10WidePreset';

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('createR10AtlasPreset', () => {
  it('changes only the R10 side-atlas URLs and leaves its input unchanged', () => {
    const input = jsonClone(forestImpostorV2Defaults);
    const before = jsonClone(input);
    const result = createR10AtlasPreset(input);
    const expected = jsonClone(input);
    expected.assets.groveAtlasUrl = '/data/forest/r10/grove-atlas-r8-i1-skylight-blue-3072x2048.png';
    expected.assets.treeAtlasUrl = '/data/forest/r10/tree-atlas-r8-i2b-pervariant-blue-2048x2048.png';

    expect(result).toEqual(expected);
    expect(input).toEqual(before);
  });

  it('returns a fully independent deep clone', () => {
    const input = jsonClone(forestImpostorV2Defaults);
    const result = createR10AtlasPreset(input);

    expect(result).not.toBe(input);
    expect(result.assets).not.toBe(input.assets);
    expect(result.mask).not.toBe(input.mask);
    expect(result.cellSelection).not.toBe(input.cellSelection);
    expect(result.cellSelection.grove).not.toBe(input.cellSelection.grove);
    expect(result.cellSelection.grove.configs).not.toBe(input.cellSelection.grove.configs);
    expect(result.cellSelection.tree).not.toBe(input.cellSelection.tree);
    expect(result.cellSelection.tree.variants).not.toBe(input.cellSelection.tree.variants);
    expect(result.macro).not.toBe(input.macro);
    expect(result.macro.patchThreshold).not.toBe(input.macro.patchThreshold);
    expect(result.corridor).not.toBe(input.corridor);
    expect(result.grove).not.toBe(input.grove);
    expect(result.grove.speciesGroups).not.toBe(input.grove.speciesGroups);
    expect(result.grove.speciesGroups.conifer).not.toBe(input.grove.speciesGroups.conifer);
    expect(result.grove.speciesGroupSplit).not.toBe(input.grove.speciesGroupSplit);
    expect(result.tree).not.toBe(input.tree);
    expect(result.tree.variantWeights).not.toBe(input.tree.variantWeights);
    expect(result.material).not.toBe(input.material);
    expect(result.limits).not.toBe(input.limits);
  });

  it('composes with R10 wide coverage in deterministic order', () => {
    const first = createR10AtlasPreset(createR10WidePreset(forestImpostorV2Defaults));
    const second = createR10AtlasPreset(createR10WidePreset(forestImpostorV2Defaults));

    expect(first).toEqual(second);
    expect(first.assets.groveAtlasUrl).toBe('/data/forest/r10/grove-atlas-r8-i1-skylight-blue-3072x2048.png');
    expect(first.assets.treeAtlasUrl).toBe('/data/forest/r10/tree-atlas-r8-i2b-pervariant-blue-2048x2048.png');
    expect(first.corridor.corridorMaxMeters).toBe(7000);
    expect(first.corridor.ridgeMeters).toBe(6500);
    expect(first.macro.ridgeScoreMin).toBe(0);
    expect(first.grove.spacingRidgeMeters).toBe(54);
  });
});
