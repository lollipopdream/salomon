import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import { forestCandidateDefaults } from '../../config/defaults/forestCandidate';
import type { CanopyCardAtlasResult } from './canopyCardAtlas';
import {
  createForestCandidate,
  type ForestCandidateImage,
} from './forestCandidateController';
import type { ForestCandidateConfig, ForestCandidateFlags } from './types';
import type { TerrainGridLike } from '../terrainHeightSampler';

interface FakeImage {
  width: number;
  height: number;
  url: string;
}

const enabled: ForestCandidateFlags = { enabled: true, densityScale: 1 };
const grid: TerrainGridLike = {
  values: new Float32Array(64).fill(100),
  cols: 8,
  rows: 8,
  cellSizeMeters: 4,
};

function config(): ForestCandidateConfig {
  return {
    ...forestCandidateDefaults,
    mask: { ...forestCandidateDefaults.mask, size: 4, extentMeters: 32 },
    sprites: {
      ...forestCandidateDefaults.sprites,
      alphaThreshold: 40,
      minAreaPixels: 1,
    },
    placement: {
      ...forestCandidateDefaults.placement,
      spacingMeters: 8,
      jitterRatio: 0,
      maxInstances: 100,
      routeDistanceCellMeters: 2,
    },
  };
}

function fakeImage(url: string): ForestCandidateImage {
  return { width: 4, height: 4, url } as unknown as ForestCandidateImage;
}

function rgba(red: number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(4 * 4 * 4);
  for (let index = 0; index < 16; index += 1) {
    pixels[index * 4] = red;
    pixels[index * 4 + 1] = red;
    pixels[index * 4 + 2] = red;
    pixels[index * 4 + 3] = 255;
  }
  return pixels;
}

function fakeAtlas(dispose = vi.fn()): CanopyCardAtlasResult {
  return {
    texture: new THREE.CanvasTexture({} as HTMLCanvasElement),
    uvRects: Float32Array.from([
      0, 0.5, 0.25, 0.5, 0.25, 0.5, 0.25, 0.5,
      0.5, 0.5, 0.25, 0.5, 0.75, 0.5, 0.25, 0.5,
      0, 0, 0.25, 0.5, 0.25, 0, 0.25, 0.5,
      0.5, 0, 0.25, 0.5, 0.75, 0, 0.25, 0.5,
    ]),
    cellSize: 256,
    columns: 4,
    rows: 2,
    dispose,
  };
}

function dependencies(scene: THREE.Scene, overrides: Record<string, unknown> = {}) {
  return {
    scene,
    grid,
    elevationScale: 1,
    routePointsXZ: [],
    config: config(),
    flags: enabled,
    loadImage: async (url: string) => fakeImage(url),
    readPixels: (image: ForestCandidateImage) => {
      const fake = image as unknown as FakeImage;
      return rgba(fake.url.includes('alpha') ? 255 : 255);
    },
    bakeAtlas: () => fakeAtlas(),
    now: () => 0,
    ...overrides,
  };
}

describe('createForestCandidate', () => {
  it('returns immediately without loading or changing the scene when disabled', async () => {
    const scene = new THREE.Scene();
    const loadImage = vi.fn(async (url: string) => fakeImage(url));
    const result = await createForestCandidate(dependencies(scene, {
      flags: { enabled: false, densityScale: 1 },
      loadImage,
    }));
    expect(result).toBeUndefined();
    expect(loadImage).not.toHaveBeenCalled();
    expect(scene.children).toHaveLength(0);
  });

  it('adds exactly one group and reports its two draw calls', async () => {
    const scene = new THREE.Scene();
    const result = await createForestCandidate(dependencies(scene));
    expect(result).toBeDefined();
    expect(scene.children).toEqual([result!.object3D]);
    expect(result!.summary.instanceCount).toBeGreaterThan(0);
    expect(result!.summary.drawCalls).toBe(2);
  });

  it('fails open with one warning when loading rejects', async () => {
    const scene = new THREE.Scene();
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const result = await createForestCandidate(dependencies(scene, {
      loadImage: async () => { throw new Error('network unavailable'); },
    }));
    expect(result).toBeUndefined();
    expect(scene.children).toHaveLength(0);
    expect(warning).toHaveBeenCalledTimes(1);
    warning.mockRestore();
  });

  it('fails open when an all-zero mask produces no instances', async () => {
    const scene = new THREE.Scene();
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const candidateConfig = config();
    const result = await createForestCandidate(dependencies(scene, {
      readPixels: (image: ForestCandidateImage) => {
        const fake = image as unknown as FakeImage;
        return rgba(fake.url === candidateConfig.mask.url ? 0 : 255);
      },
    }));
    expect(result).toBeUndefined();
    expect(scene.children).toHaveLength(0);
    expect(warning).toHaveBeenCalledTimes(1);
    warning.mockRestore();
  });

  it('disposes mesh and atlas resources and removes the group', async () => {
    const scene = new THREE.Scene();
    const atlasDispose = vi.fn();
    const result = await createForestCandidate(dependencies(scene, {
      bakeAtlas: () => fakeAtlas(atlasDispose),
    }));
    expect(result).toBeDefined();
    const meshDisposals = (result!.object3D as THREE.Group).children.map((child) =>
      vi.spyOn((child as THREE.InstancedMesh).geometry, 'dispose'));
    result!.dispose();
    result!.dispose();
    expect(scene.children).toHaveLength(0);
    expect(atlasDispose).toHaveBeenCalledTimes(1);
    for (const disposal of meshDisposals) expect(disposal).toHaveBeenCalledTimes(1);
  });
});
