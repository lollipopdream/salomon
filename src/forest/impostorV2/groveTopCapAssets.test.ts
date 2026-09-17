// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import { loadGroveTopCapAssets } from './groveTopCapAssets';
import type { ForestImpostorV2Config } from './types';

// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
const rawMeta = JSON.parse(readFileSync(`${process.cwd()}/public/data/forest/impostor-v2/grove_top_atlas_meta.json`, 'utf8')) as unknown;
const config = { assets: {
  groveTopMetaUrl: '/grove-top.json', groveTopAtlasUrl: '/grove-top.png',
} } as ForestImpostorV2Config;

describe('loadGroveTopCapAssets', () => {
  it('loads, parses, configures, and idempotently disposes the top assets', async () => {
    const texture = new THREE.Texture();
    const dispose = vi.spyOn(texture, 'dispose');
    const fetchJson = vi.fn(async () => rawMeta);
    const loadTexture = vi.fn(async () => texture);
    const result = await loadGroveTopCapAssets({ config, fetchJson, loadTexture });
    expect(result.ok).toBe(true);
    expect(fetchJson).toHaveBeenCalledWith('/grove-top.json');
    expect(loadTexture).toHaveBeenCalledWith('/grove-top.png');
    if (!result.ok) throw new Error('expected success');
    expect(result.meta.cells).toHaveLength(24);
    expect(result.texture.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(result.texture.minFilter).toBe(THREE.LinearMipmapLinearFilter);
    result.dispose(); result.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('returns meta-load-failed and never starts texture load after fetch failure', async () => {
    const loadTexture = vi.fn(async () => new THREE.Texture());
    const result = await loadGroveTopCapAssets({ config,
      fetchJson: async () => { throw new Error('offline'); }, loadTexture });
    expect(result).toEqual({ ok: false, reason: 'meta-load-failed' });
    expect(loadTexture).not.toHaveBeenCalled();
  });

  it('returns meta-invalid and never starts texture load for invalid metadata', async () => {
    const loadTexture = vi.fn(async () => new THREE.Texture());
    const result = await loadGroveTopCapAssets({ config, fetchJson: async () => ({}), loadTexture });
    expect(result).toEqual({ ok: false, reason: 'meta-invalid' });
    expect(loadTexture).not.toHaveBeenCalled();
  });

  it('returns texture-load-failed without leaking an exception', async () => {
    const result = await loadGroveTopCapAssets({ config, fetchJson: async () => rawMeta,
      loadTexture: async () => { throw new Error('decode failed'); } });
    expect(result).toEqual({ ok: false, reason: 'texture-load-failed' });
  });
});
