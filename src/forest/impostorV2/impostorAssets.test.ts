// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import { loadImpostorAssets } from './impostorAssets';
import type { ForestImpostorV2Config, ImpostorKindsFlag } from './types';

// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
const metaPath = `${process.cwd()}/outputs/matsu-h01-realtime-forest-whole-tree-impostor-v2/bake/impostor-atlas-meta.json`;
const rawMeta = JSON.parse(readFileSync(metaPath, 'utf8')) as unknown;

function config(): ForestImpostorV2Config {
  return {
    assets: { metaUrl: '/meta.json', groveAtlasUrl: '/grove.png', treeAtlasUrl: '/tree.png' },
    cellSelection: {
      grove: { configs: ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'], yawDegrees: [0, 90, 180, 270] },
      tree: { variants: ['FIR_A', 'FIR_C', 'BL'], yawDegrees: [0, 90, 180, 270] },
    },
  } as unknown as ForestImpostorV2Config;
}

function texture(): THREE.Texture { return new THREE.Texture(); }

async function load(
  kinds: ImpostorKindsFlag,
  loadTexture = vi.fn<(url: string) => Promise<THREE.Texture>>(async () => texture()),
) {
  const value = config();
  const fetchJson = vi.fn(async () => rawMeta);
  const assets = await loadImpostorAssets({ config: value, kinds, fetchJson, loadTexture });
  return { assets, fetchJson, loadTexture, value };
}

describe('loadImpostorAssets', () => {
  it('fetches configured metadata and both configured atlas URLs', async () => {
    const { assets, fetchJson, loadTexture, value } = await load('both');
    expect(fetchJson).toHaveBeenCalledWith(value.assets.metaUrl);
    expect(loadTexture.mock.calls.map(([url]) => url)).toEqual([value.assets.groveAtlasUrl, value.assets.treeAtlasUrl]);
    expect(assets.textures.grove).toBeDefined();
    expect(assets.textures.tree).toBeDefined();
  });

  it('loads no tree atlas for grove-only requests', async () => {
    const { assets, loadTexture, value } = await load('grove');
    expect(loadTexture.mock.calls.map(([url]) => url)).toEqual([value.assets.groveAtlasUrl]);
    expect(assets.textures.tree).toBeUndefined();
  });

  it('loads no grove atlas for tree-only requests', async () => {
    const { assets, loadTexture, value } = await load('tree');
    expect(loadTexture.mock.calls.map(([url]) => url)).toEqual([value.assets.treeAtlasUrl]);
    expect(assets.textures.grove).toBeUndefined();
  });

  it('rejects invalid metadata before any texture load is started', async () => {
    const loadTexture = vi.fn<(url: string) => Promise<THREE.Texture>>(async () => texture());
    await expect(loadImpostorAssets({ config: config(), kinds: 'both', fetchJson: async () => ({}), loadTexture }))
      .rejects.toThrow();
    expect(loadTexture).not.toHaveBeenCalled();
  });

  it('propagates a URL-bearing metadata fetch failure', async () => {
    const value = config();
    await expect(loadImpostorAssets({ config: value, kinds: 'both',
      fetchJson: async (url) => { throw new Error(`[forest-impostor-v2] metadata request failed ${url} 503`); },
      loadTexture: async () => texture(),
    })).rejects.toThrow(value.assets.metaUrl);
  });

  it('disposes already loaded textures when a later texture load fails', async () => {
    const first = texture(); const dispose = vi.spyOn(first, 'dispose');
    const loadTexture = vi.fn(async (url: string) => {
      if (url === '/tree.png') throw new Error('tree unavailable');
      return first;
    });
    await expect(loadImpostorAssets({ config: config(), kinds: 'both', fetchJson: async () => rawMeta, loadTexture }))
      .rejects.toThrow('tree unavailable');
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('selects 36 default cells and configures loaded textures', async () => {
    const { assets } = await load('both');
    expect(assets.cells).toHaveLength(36);
    expect(assets.textures.grove?.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(assets.textures.tree?.colorSpace).toBe(THREE.SRGBColorSpace);
  });

  it('disposes all textures exactly once', async () => {
    const grove = texture(); const tree = texture();
    const groveDispose = vi.spyOn(grove, 'dispose'); const treeDispose = vi.spyOn(tree, 'dispose');
    const assets = await loadImpostorAssets({ config: config(), kinds: 'both', fetchJson: async () => rawMeta,
      loadTexture: async (url) => url === '/grove.png' ? grove : tree });
    assets.dispose(); assets.dispose();
    expect(groveDispose).toHaveBeenCalledTimes(1);
    expect(treeDispose).toHaveBeenCalledTimes(1);
  });

  it('contains none of the disallowed source terms', () => {
    // @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
    const source = readFileSync(`${process.cwd()}/src/forest/impostorV2/impostorAssets.ts`, 'utf8');
    for (const term of ['Math.' + 'random', 'forest' + 'Candidate', 'forest/' + 'candidate',
      'on' + 'BeforeCompile', 'Shader' + 'Material']) expect(source).not.toContain(term);
  });
});
