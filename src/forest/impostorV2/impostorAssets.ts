import * as THREE from 'three';

import { parseImpostorAtlasMeta, selectImpostorCells } from './impostorAtlasMeta';
import { configureImpostorTexture } from './impostorMaterial';
import type {
  ForestImpostorV2Config,
  ImpostorAtlasId,
  ImpostorAtlasMeta,
  ImpostorCellRef,
  ImpostorKindsFlag,
} from './types';

export interface ImpostorAssets {
  meta: ImpostorAtlasMeta;
  cells: readonly ImpostorCellRef[];
  textures: Partial<Record<ImpostorAtlasId, THREE.Texture>>;
  dispose(): void;
}

interface LoadImpostorAssetsDependencies {
  config: ForestImpostorV2Config;
  kinds: ImpostorKindsFlag;
  fetchJson?: (url: string) => Promise<unknown>;
  loadTexture?: (url: string) => Promise<THREE.Texture>;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`[forest-impostor-v2] metadata request failed for ${url}: ${response.status}`);
  }
  return response.json();
}

async function loadTexture(url: string): Promise<THREE.Texture> {
  try {
    return await new THREE.TextureLoader().loadAsync(url);
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : '';
    throw new Error(`[forest-impostor-v2] texture load failed for ${url}${detail}`);
  }
}

function requestedAtlases(kinds: ImpostorKindsFlag): readonly ImpostorAtlasId[] {
  if (kinds === 'grove') return ['grove'];
  if (kinds === 'tree') return ['tree'];
  return ['grove', 'tree'];
}

export async function loadImpostorAssets({
  config,
  kinds,
  fetchJson: fetchJsonDependency = fetchJson,
  loadTexture: loadTextureDependency = loadTexture,
}: LoadImpostorAssetsDependencies): Promise<ImpostorAssets> {
  const rawMeta = await fetchJsonDependency(config.assets.metaUrl);
  const meta = parseImpostorAtlasMeta(rawMeta);
  const cells = selectImpostorCells(meta, config.cellSelection, kinds);
  const textures: Partial<Record<ImpostorAtlasId, THREE.Texture>> = {};
  let disposed = false;

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    for (const texture of Object.values(textures)) texture.dispose();
  };

  try {
    for (const atlas of requestedAtlases(kinds)) {
      const url = atlas === 'grove' ? config.assets.groveAtlasUrl : config.assets.treeAtlasUrl;
      const texture = await loadTextureDependency(url);
      textures[atlas] = texture;
      configureImpostorTexture(texture);
    }
  } catch (error) {
    dispose();
    throw error;
  }

  return { meta, cells, textures, dispose };
}
