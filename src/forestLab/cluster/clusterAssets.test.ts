// @ts-expect-error This project intentionally has no Node type dependency.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { IMPOSTOR_V2_GROVE_TOP_ASSET_URLS } from '../scene/labDataSources';

import { forestImpostorV2Defaults } from '../../config/defaults/forestImpostorV2';
import {
  parseImpostorAtlasMeta,
  selectImpostorCells,
} from '../../forest/impostorV2/impostorAtlasMeta';
import type { ImpostorAssets } from '../../forest/impostorV2/impostorAssets';
import {
  CLUSTER_ASSET_CONFIG,
  CLUSTER_CELL_COUNT,
  CLUSTER_GROVE_CONFIGS,
  CLUSTER_GROVE_YAWS,
  CLUSTER_TREE_VARIANTS,
  CLUSTER_TREE_YAWS,
  R3_CLUSTER_GROVE_ATLAS_URL,
  R4_CLUSTER_GROVE_ATLAS_URL,
  R4_CLUSTER_TREE_ATLAS_URL,
  cellWidthOf,
  groveCellSlot,
  loadClusterAssets,
  treeCellSlot,
} from './clusterAssets';

const rawTopMeta = JSON.parse(readFileSync(
  new URL('../../../public/data/forest/impostor-v2/grove_top_atlas_meta.json', import.meta.url),
  'utf8',
)) as unknown;
const rawMeta = JSON.parse(readFileSync(
  new URL('../../../public/data/forest/impostor-v2/impostor-atlas-meta.json', import.meta.url),
  'utf8',
)) as unknown;
const meta = parseImpostorAtlasMeta(rawMeta);
const cells = selectImpostorCells(meta, CLUSTER_ASSET_CONFIG.cellSelection, 'both');

describe('cluster assets', () => {
  it('selects every required side-atlas cell and omits top-atlas asset keys', () => {
    expect(CLUSTER_ASSET_CONFIG.cellSelection.grove.configs).toEqual(CLUSTER_GROVE_CONFIGS);
    expect(CLUSTER_ASSET_CONFIG.cellSelection.grove.yawDegrees).toEqual(CLUSTER_GROVE_YAWS);
    expect(CLUSTER_ASSET_CONFIG.cellSelection.tree.variants).toEqual(CLUSTER_TREE_VARIANTS);
    expect(CLUSTER_ASSET_CONFIG.cellSelection.tree.yawDegrees).toEqual(CLUSTER_TREE_YAWS);
    expect(CLUSTER_GROVE_CONFIGS.length * CLUSTER_GROVE_YAWS.length
      + CLUSTER_TREE_VARIANTS.length * CLUSTER_TREE_YAWS.length).toBe(CLUSTER_CELL_COUNT);
    expect(Object.prototype.hasOwnProperty.call(
      CLUSTER_ASSET_CONFIG.assets,
      'groveTopAtlasUrl',
    )).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(
      CLUSTER_ASSET_CONFIG.assets,
      'groveTopMetaUrl',
    )).toBe(false);
  });

  it('maps every grove and tree slot to the production-selected cell order', () => {
    expect(cells).toHaveLength(CLUSTER_CELL_COUNT);
    for (let grove = 0; grove < CLUSTER_GROVE_CONFIGS.length; grove += 1) {
      for (let yaw = 0; yaw < CLUSTER_GROVE_YAWS.length; yaw += 1) {
        const cell = cells[groveCellSlot(grove, yaw)];
        expect(cell.groveConfig).toBe(CLUSTER_GROVE_CONFIGS[grove]);
        expect(cell.yawDeg).toBe(CLUSTER_GROVE_YAWS[yaw]);
      }
    }
    for (let variant = 0; variant < CLUSTER_TREE_VARIANTS.length; variant += 1) {
      for (let yaw = 0; yaw < CLUSTER_TREE_YAWS.length; yaw += 1) {
        const cell = cells[treeCellSlot(variant, yaw)];
        expect(cell.sourceVariant).toBe(CLUSTER_TREE_VARIANTS[variant]);
        expect(cell.yawDeg).toBe(CLUSTER_TREE_YAWS[yaw]);
      }
    }
  });

  it('rejects out-of-range slots and reads a valid cell width', () => {
    const assets: ImpostorAssets = {
      meta,
      cells,
      textures: {},
      dispose() {},
    };
    expect(cellWidthOf(assets, 0)).toBe(cells[0].tightWorldWidth);
    expect(() => groveCellSlot(-1, 0)).toThrow(RangeError);
    expect(() => groveCellSlot(CLUSTER_GROVE_CONFIGS.length, 0)).toThrow(RangeError);
    expect(() => groveCellSlot(0, CLUSTER_GROVE_YAWS.length)).toThrow(RangeError);
    expect(() => treeCellSlot(-1, 0)).toThrow(RangeError);
    expect(() => treeCellSlot(CLUSTER_TREE_VARIANTS.length, 0)).toThrow(RangeError);
    expect(() => treeCellSlot(0, CLUSTER_TREE_YAWS.length)).toThrow(RangeError);
    expect(() => cellWidthOf(assets, -1)).toThrow(RangeError);
    expect(() => cellWidthOf(assets, cells.length)).toThrow(RangeError);
  });

  it('does not alter production cell-selection defaults', () => {
    expect(forestImpostorV2Defaults.cellSelection.tree.variants).toHaveLength(3);
    expect(forestImpostorV2Defaults.cellSelection.tree.yawDegrees).toHaveLength(4);
    expect(forestImpostorV2Defaults.cellSelection.grove.configs).toHaveLength(6);
    expect(CLUSTER_ASSET_CONFIG.cellSelection)
      .not.toBe(forestImpostorV2Defaults.cellSelection);
  });

  it('changes only the grove texture URL for R3 and preserves the default calling form', async () => {
    const loadDefaultUrls: string[] = [];
    const defaultAssets = await loadClusterAssets({
      fetchJson: async (url) => {
        expect(url).toBe(CLUSTER_ASSET_CONFIG.assets.metaUrl);
        return rawMeta;
      },
      loadTexture: async (url) => {
        loadDefaultUrls.push(url);
        return new (await import('three')).Texture();
      },
    });
    expect(loadDefaultUrls).toEqual([
      CLUSTER_ASSET_CONFIG.assets.groveAtlasUrl,
      CLUSTER_ASSET_CONFIG.assets.treeAtlasUrl,
    ]);
    defaultAssets.dispose();

    const loadR3Urls: string[] = [];
    const r3Assets = await loadClusterAssets('R3', {
      fetchJson: async (url) => {
        expect(url).toBe(CLUSTER_ASSET_CONFIG.assets.metaUrl);
        return rawMeta;
      },
      loadTexture: async (url) => {
        loadR3Urls.push(url);
        return new (await import('three')).Texture();
      },
    });
    expect(loadR3Urls).toEqual([
      R3_CLUSTER_GROVE_ATLAS_URL,
      CLUSTER_ASSET_CONFIG.assets.treeAtlasUrl,
    ]);
    expect(R3_CLUSTER_GROVE_ATLAS_URL)
      .toMatch(/grove-atlas-r3-dense-broadleaf-3072x2048\.png$/);
    r3Assets.dispose();
  });

  it('changes both the grove and tree texture URLs for R4, and leaves the meta URL unchanged', async () => {
    const loadR4Urls: string[] = [];
    const fetchedUrls: string[] = [];
    const r4Assets = await loadClusterAssets('R4', {
      fetchJson: async (url) => {
        fetchedUrls.push(url);
        return rawMeta;
      },
      loadTexture: async (url) => {
        loadR4Urls.push(url);
        return new (await import('three')).Texture();
      },
    });
    expect(loadR4Urls).toEqual([
      R4_CLUSTER_GROVE_ATLAS_URL,
      R4_CLUSTER_TREE_ATLAS_URL,
    ]);
    // metadata URL must stay the production one for every appearance (the composited cells'
    // alpha tight bounds were matched to the production pixel_content_bounds exactly).
    expect(fetchedUrls).toEqual([CLUSTER_ASSET_CONFIG.assets.metaUrl]);
    expect(R4_CLUSTER_GROVE_ATLAS_URL)
      .toMatch(/grove-atlas-r4-fine-grain-3072x2048\.png$/);
    expect(R4_CLUSTER_TREE_ATLAS_URL)
      .toMatch(/tree-atlas-r4-crown-dominant-2048x2048\.png$/);
    r4Assets.dispose();
  });

  it(
    'binds the R3 grove atlas and R4 tree atlas for R5, and leaves the meta URL unchanged',
    async () => {
      const loadR5Urls: string[] = [];
      const fetchedUrls: string[] = [];
      const r5Assets = await loadClusterAssets('R5', {
        fetchJson: async (url) => {
          fetchedUrls.push(url);
          return rawMeta;
        },
        loadTexture: async (url) => {
          loadR5Urls.push(url);
          return new (await import('three')).Texture();
        },
      });
      expect(loadR5Urls).toEqual([
        R3_CLUSTER_GROVE_ATLAS_URL,
        R4_CLUSTER_TREE_ATLAS_URL,
      ]);
      // R5 explicitly reuses the R3 dense-broadleaf grove atlas (not the R4 fine-grain one).
      expect(R3_CLUSTER_GROVE_ATLAS_URL)
        .toMatch(/grove-atlas-r3-dense-broadleaf-3072x2048\.png$/);
      expect(loadR5Urls[0]).not.toMatch(/grove-atlas-r4-fine-grain/);
      expect(fetchedUrls).toEqual([CLUSTER_ASSET_CONFIG.assets.metaUrl]);
      r5Assets.dispose();
    },
  );

  // R6 phase reviewer #4: R3/R4/R5 には asset bind のテストがあるのに R6 だけ無かった。
  it(
    'binds the R3 grove atlas for R6 and additionally loads exactly the grove top-cap atlas and meta',
    async () => {
      const loadedTextureUrls: string[] = [];
      const fetchedUrls: string[] = [];
      const r6Assets = await loadClusterAssets('R6', {
        fetchJson: async (url) => {
          fetchedUrls.push(url);
          return url === IMPOSTOR_V2_GROVE_TOP_ASSET_URLS.groveTopMetaUrl ? rawTopMeta : rawMeta;
        },
        loadTexture: async (url) => {
          loadedTextureUrls.push(url);
          return new (await import('three')).Texture();
        },
      });

      // R6 は R3 と同じ grove atlas を使い、tree atlas は既定のまま。
      expect(loadedTextureUrls[0]).toBe(R3_CLUSTER_GROVE_ATLAS_URL);
      expect(loadedTextureUrls).not.toContain(R4_CLUSTER_TREE_ATLAS_URL);
      // 追加で読むのは top-cap atlas 1 枚だけ。
      expect(loadedTextureUrls).toContain(IMPOSTOR_V2_GROVE_TOP_ASSET_URLS.groveTopAtlasUrl);
      expect(fetchedUrls).toEqual([
        CLUSTER_ASSET_CONFIG.assets.metaUrl,
        IMPOSTOR_V2_GROVE_TOP_ASSET_URLS.groveTopMetaUrl,
      ]);
      expect((r6Assets as { topCap?: unknown }).topCap).toBeDefined();
      r6Assets.dispose();
    },
  );

  it('never loads the grove top-cap atlas for any appearance other than R6', async () => {
    for (const appearance of ['BASELINE', 'R1', 'R2', 'R3', 'R4', 'R5'] as const) {
      const loadedTextureUrls: string[] = [];
      const fetchedUrls: string[] = [];
      const assets = await loadClusterAssets(appearance, {
        fetchJson: async (url) => {
          fetchedUrls.push(url);
          return rawMeta;
        },
        loadTexture: async (url) => {
          loadedTextureUrls.push(url);
          return new (await import('three')).Texture();
        },
      });
      expect(fetchedUrls).toEqual([CLUSTER_ASSET_CONFIG.assets.metaUrl]);
      expect(loadedTextureUrls)
        .not.toContain(IMPOSTOR_V2_GROVE_TOP_ASSET_URLS.groveTopAtlasUrl);
      expect((assets as { topCap?: unknown }).topCap).toBeUndefined();
      assets.dispose();
    }
  });

  // 部分的に読み込んだ asset を取りこぼさないこと。top-cap の取得に失敗したら
  // side assets を dispose してから throw する契約である。
  it('disposes the side assets when the R6 top-cap load fails', async () => {
    let disposedTextures = 0;
    await expect(loadClusterAssets('R6', {
      fetchJson: async (url) => {
        if (url === IMPOSTOR_V2_GROVE_TOP_ASSET_URLS.groveTopMetaUrl) {
          throw new Error('simulated top-cap meta failure');
        }
        return rawMeta;
      },
      loadTexture: async () => {
        const texture = new (await import('three')).Texture();
        const originalDispose = texture.dispose.bind(texture);
        texture.dispose = () => { disposedTextures += 1; originalDispose(); };
        return texture;
      },
    })).rejects.toThrow();
    expect(disposedTextures).toBeGreaterThan(0);
  });
});
