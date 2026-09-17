import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadAsyncMock = vi.hoisted(() => vi.fn());

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();

  return {
    ...actual,
    TextureLoader: class {
      loadAsync = loadAsyncMock;
    },
  };
});

import { loadTerrainTexture } from './terrainTexture';

describe('loadTerrainTexture', () => {
  beforeEach(() => {
    loadAsyncMock.mockReset();
  });

  it('loads the requested URL and applies terrain color-texture defaults', async () => {
    const texture = new THREE.Texture();
    loadAsyncMock.mockResolvedValueOnce(texture);

    const result = await loadTerrainTexture('/data/terrain-texture/takao.webp');

    expect(loadAsyncMock).toHaveBeenCalledOnce();
    expect(loadAsyncMock).toHaveBeenCalledWith(
      '/data/terrain-texture/takao.webp',
    );
    expect(result).toBe(texture);
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(texture.wrapS).toBe(THREE.RepeatWrapping);
    expect(texture.wrapT).toBe(THREE.RepeatWrapping);
    expect(texture.magFilter).toBe(THREE.LinearFilter);
    expect(texture.minFilter).toBe(THREE.LinearMipmapLinearFilter);
    expect(texture.version).toBe(1);
  });

  it('rejects with the original loading error instead of choosing a fallback', async () => {
    const loadingError = new Error('texture decode failed');
    loadAsyncMock.mockRejectedValueOnce(loadingError);

    await expect(
      loadTerrainTexture('/data/terrain-texture/broken.webp'),
    ).rejects.toBe(loadingError);
  });

  it('preserves default anisotropy unless requested and clamps requested anisotropy', async () => {
    const defaultTexture = new THREE.Texture();
    const defaultAnisotropy = defaultTexture.anisotropy;
    const setAnisotropy = vi.fn();
    Object.defineProperty(defaultTexture, 'anisotropy', {
      configurable: true,
      get: () => defaultAnisotropy,
      set: setAnisotropy,
    });
    loadAsyncMock.mockResolvedValueOnce(defaultTexture);

    await loadTerrainTexture('/data/terrain-texture/default.webp');

    expect(setAnisotropy).not.toHaveBeenCalled();

    const requestedTexture = new THREE.Texture();
    loadAsyncMock.mockResolvedValueOnce(requestedTexture);

    await loadTerrainTexture('/data/terrain-texture/requested.webp', 8);

    expect(requestedTexture.anisotropy).toBe(8);

    const clampedTexture = new THREE.Texture();
    loadAsyncMock.mockResolvedValueOnce(clampedTexture);

    await loadTerrainTexture('/data/terrain-texture/clamped.webp', 999);

    expect(clampedTexture.anisotropy).toBe(16);
  });
});
