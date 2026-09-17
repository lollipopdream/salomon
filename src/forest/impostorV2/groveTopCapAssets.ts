import * as THREE from 'three';

import { configureImpostorTexture } from './impostorMaterial';
import { parseGroveTopCapMeta, type GroveTopCapMeta } from './groveTopCapMeta';
import type { ForestImpostorV2Config } from './types';

export type GroveTopCapAssetFailureReason = 'meta-load-failed' | 'meta-invalid' | 'texture-load-failed';

export interface GroveTopCapAssets {
  ok: true;
  meta: GroveTopCapMeta;
  texture: THREE.Texture;
  dispose(): void;
}

export type GroveTopCapAssetsResult = GroveTopCapAssets | {
  ok: false;
  reason: GroveTopCapAssetFailureReason;
};

interface LoadGroveTopCapAssetsDependencies {
  config: ForestImpostorV2Config;
  fetchJson?: (url: string) => Promise<unknown>;
  loadTexture?: (url: string) => Promise<THREE.Texture>;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`metadata request failed: ${response.status}`);
  return response.json();
}

async function loadTexture(url: string): Promise<THREE.Texture> {
  return new THREE.TextureLoader().loadAsync(url);
}

export async function loadGroveTopCapAssets({
  config,
  fetchJson: fetchJsonDependency = fetchJson,
  loadTexture: loadTextureDependency = loadTexture,
}: LoadGroveTopCapAssetsDependencies): Promise<GroveTopCapAssetsResult> {
  const metaUrl = config.assets.groveTopMetaUrl;
  const atlasUrl = config.assets.groveTopAtlasUrl;
  if (!metaUrl) return { ok: false, reason: 'meta-load-failed' };
  let raw: unknown;
  try {
    raw = await fetchJsonDependency(metaUrl);
  } catch {
    return { ok: false, reason: 'meta-load-failed' };
  }
  const meta = parseGroveTopCapMeta(raw);
  if (!meta) return { ok: false, reason: 'meta-invalid' };
  if (!atlasUrl) return { ok: false, reason: 'texture-load-failed' };
  let texture: THREE.Texture | undefined;
  try {
    texture = await loadTextureDependency(atlasUrl);
    configureImpostorTexture(texture);
  } catch {
    texture?.dispose();
    return { ok: false, reason: 'texture-load-failed' };
  }
  let disposed = false;
  return {
    ok: true,
    meta,
    texture,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      texture.dispose();
    },
  };
}
