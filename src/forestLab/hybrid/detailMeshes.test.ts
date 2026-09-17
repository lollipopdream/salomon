// @ts-expect-error This project intentionally has no Node type dependency.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import { IMPOSTOR_V2_SIDE_ASSET_CONFIG } from '../scene/labDataSources';
import type { DetailPlacement } from './detailPlacement';
import {
  createDetailMeshes,
  disposeDetailMeshes,
  loadDetailAssets,
} from './detailMeshes';

function placement(
  n: number,
  kind: 'grove' | 'tree',
  variantIndex: number,
  yawIndex: number,
): DetailPlacement {
  return {
    n,
    cx: n * 40,
    cz: n * 20,
    score: 1 - n * 0.1,
    ridgeTerm: 1,
    nearTerm: 1,
    silhouetteTerm: 1,
    kind,
    variantIndex,
    yawIndex,
  };
}

async function assets() {
  const meta = JSON.parse(readFileSync(
    new URL('../../../public/data/forest/impostor-v2/impostor-atlas-meta.json', import.meta.url),
    'utf8',
  )) as unknown;
  return loadDetailAssets({
    fetchJson: async () => meta,
    loadTexture: async () => new THREE.Texture(),
  });
}

describe('hybrid detail meshes', () => {
  it('structurally omits both top-atlas asset keys', () => {
    expect(Object.prototype.hasOwnProperty.call(
      IMPOSTOR_V2_SIDE_ASSET_CONFIG.assets,
      'groveTopAtlasUrl',
    )).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(
      IMPOSTOR_V2_SIDE_ASSET_CONFIG.assets,
      'groveTopMetaUrl',
    )).toBe(false);
  });

  it('builds at most one unlit mesh per side-atlas cell', async () => {
    const loaded = await assets();
    const placements = [placement(0, 'grove', 0, 0), placement(1, 'tree', 0, 0)];
    const meshes = createDetailMeshes({ assets: loaded, placements, terrainYAt: () => 12 });
    expect(meshes.length).toBeLessThanOrEqual(36);
    expect(meshes.reduce((sum, mesh) => sum + mesh.count, 0)).toBe(placements.length);
    for (const mesh of meshes) {
      const material = mesh.material as THREE.MeshBasicMaterial;
      expect(material).toBeInstanceOf(THREE.MeshBasicMaterial);
      expect(material.alphaTest).toBe(mesh.name.includes('grove') ? 0.45 : 0.5);
      expect(material.side).toBe(THREE.DoubleSide);
      expect(material.transparent).toBe(false);
      expect(material.depthWrite).toBe(true);
      expect(mesh.castShadow).toBe(false);
      expect(mesh.receiveShadow).toBe(false);
    }
    disposeDetailMeshes(meshes, loaded);
  });

  it('disposes mesh resources and loaded assets', async () => {
    const loaded = await assets();
    const assetsDispose = vi.spyOn(loaded, 'dispose');
    const meshes = createDetailMeshes({
      assets: loaded,
      placements: [placement(0, 'grove', 2, 3)],
      terrainYAt: () => 0,
    });
    const geometryDispose = vi.spyOn(meshes[0].geometry, 'dispose');
    const materialDispose = vi.spyOn(meshes[0].material as THREE.Material, 'dispose');
    disposeDetailMeshes(meshes, loaded);
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(assetsDispose).toHaveBeenCalledOnce();
  });
});
