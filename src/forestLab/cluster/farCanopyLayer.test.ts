import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { defaultSettings } from '../../config/settings';
import { forestImpostorV2Defaults } from '../../config/defaults/forestImpostorV2';
import {
  R5_FAR_CANOPY_OPACITY_MAX,
  R5_FAR_CANOPY_OPACITY_MIN,
} from '../appearance/appearanceConstants';
import type { ElevationGrid } from '../../types';
import {
  CANONICAL_CELL_SIZE_METERS,
  CANONICAL_COLS,
  CANONICAL_ROWS,
} from '../labConstants';
import type { PatchSpec } from '../labTypes';
import { buildPatchIndices, buildPatchTerrainVertices } from '../patch/patchGrid';
import { DEFAULT_MACRO_SHADE_CONFIG } from '../r10/macroShade';
import { createShellVertexColors } from '../scene/labTerrain';
import { PATCH_MANIFEST_JSON } from '../scene/labDataSources';
import {
  createFarCanopyOverlay,
  farOverlayUvs,
  FAR_CANOPY_META_URL,
  FAR_CANOPY_R1_META_URL,
  FAR_CANOPY_R1_TEXTURE_URL,
  FAR_CANOPY_R2_META_URL,
  FAR_CANOPY_R2_TEXTURE_URL,
  FAR_CANOPY_R4_META_URL,
  FAR_CANOPY_R4_TEXTURE_URL,
  FAR_CANOPY_R5_META_URL,
  FAR_CANOPY_R5_TEXTURE_URL,
  FAR_CANOPY_TEXTURE_URL,
  loadFarCanopyTexture,
} from './farCanopyLayer';
import { R5_FAR_CANOPY_ANISOTROPY } from '../appearance/appearanceConstants';

const manifestPatch = PATCH_MANIFEST_JSON.patches[0];
const patch: PatchSpec = {
  id: manifestPatch.id,
  rowStart: manifestPatch.rowStart,
  rowEnd: manifestPatch.rowEnd,
  colStart: manifestPatch.colStart,
  colEnd: manifestPatch.colEnd,
};
const worldBbox = manifestPatch.worldBbox;

function syntheticGrid(): ElevationGrid {
  const values = new Float32Array(CANONICAL_ROWS * CANONICAL_COLS);
  for (let row = 0; row < CANONICAL_ROWS; row += 1) {
    for (let col = 0; col < CANONICAL_COLS; col += 1) {
      values[row * CANONICAL_COLS + col] = 240 + row * 0.75 - col * 0.25 + (row + col) % 11;
    }
  }
  return {
    rows: CANONICAL_ROWS,
    cols: CANONICAL_COLS,
    values,
    cellSizeMeters: CANONICAL_CELL_SIZE_METERS,
    bounds: { north: 2, south: 1, east: 4, west: 3 },
  };
}

function syntheticVertexColors(): Float32Array {
  const colors = new Float32Array(CANONICAL_ROWS * CANONICAL_COLS * 3);
  for (let index = 0; index < CANONICAL_ROWS * CANONICAL_COLS; index += 1) {
    colors[index * 3] = (index % 17) / 16;
    colors[index * 3 + 1] = (index % 29) / 28;
    colors[index * 3 + 2] = (index % 37) / 36;
  }
  return colors;
}

function createOverlay() {
  return createFarCanopyOverlay({
    grid: syntheticGrid(),
    patch,
    vertexColors: syntheticVertexColors(),
    texture: new THREE.Texture(),
    worldBbox,
  });
}

function expectArraysToBeEqual(
  actual: ArrayLike<number>,
  expected: ArrayLike<number>,
): void {
  expect(actual.length).toBe(expected.length);
  // 要素ごとの厳密一致(=== 相当)を保ちつつ、`expect` を要素数ぶん呼ばない。
  // 97x97 patch では 28,227〜56,000 要素あり、毎要素 expect すると 1 件あたり数秒かかって
  // マシン負荷次第で timeout する(実測でそうなった)。不一致の最初の位置だけを報告する。
  let firstMismatch = -1;
  for (let index = 0; index < expected.length; index += 1) {
    if (!Object.is(actual[index], expected[index])) {
      firstMismatch = index;
      break;
    }
  }
  if (firstMismatch >= 0) {
    expect(
      `index ${firstMismatch}: ${actual[firstMismatch]}`,
    ).toBe(`index ${firstMismatch}: ${expected[firstMismatch]}`);
  }
  expect(firstMismatch).toBe(-1);
}

describe('FAR canopy overlay', () => {
  it('uses production terrain positions exactly, element by element', () => {
    const grid = syntheticGrid();
    const mesh = createFarCanopyOverlay({
      grid,
      patch,
      vertexColors: syntheticVertexColors(),
      texture: new THREE.Texture(),
      worldBbox,
    });
    const actual = mesh.geometry.getAttribute('position').array;
    const expected = buildPatchTerrainVertices(grid, patch, defaultSettings);
    expectArraysToBeEqual(actual, expected);
    mesh.geometry.dispose();
    mesh.material.dispose();
  });

  it('uses the production terrain index order exactly', () => {
    const mesh = createOverlay();
    const sizeCells = patch.rowEnd - patch.rowStart;
    expectArraysToBeEqual(mesh.geometry.getIndex()!.array, buildPatchIndices(sizeCells));
    mesh.geometry.dispose();
    mesh.material.dispose();
  });

  it('uses shell color sampling at subdivision one exactly', () => {
    const vertexColors = syntheticVertexColors();
    const mesh = createFarCanopyOverlay({
      grid: syntheticGrid(),
      patch,
      vertexColors,
      texture: new THREE.Texture(),
      worldBbox,
    });
    expectArraysToBeEqual(
      mesh.geometry.getAttribute('color').array,
      createShellVertexColors(vertexColors, patch, 1),
    );
    mesh.geometry.dispose();
    mesh.material.dispose();
  });

  it('maps the four patch corners to the full texture and bounds every UV', () => {
    const uvs = farOverlayUvs(patch, worldBbox);
    const rowLength = patch.colEnd - patch.colStart + 1;
    const bottomLeftOffset = (patch.rowEnd - patch.rowStart) * rowLength * 2;
    const bottomRightOffset = uvs.length - 2;
    expect(uvs[0]).toBeCloseTo(0, 6);
    expect(uvs[1]).toBeCloseTo(0, 6);
    expect(uvs[(rowLength - 1) * 2]).toBeCloseTo(1, 6);
    expect(uvs[(rowLength - 1) * 2 + 1]).toBeCloseTo(0, 6);
    expect(uvs[bottomLeftOffset]).toBeCloseTo(0, 6);
    expect(uvs[bottomLeftOffset + 1]).toBeCloseTo(1, 6);
    expect(uvs[bottomRightOffset]).toBeCloseTo(1, 6);
    expect(uvs[bottomRightOffset + 1]).toBeCloseTo(1, 6);

    const positionVertexCount = buildPatchTerrainVertices(
      syntheticGrid(),
      patch,
      defaultSettings,
    ).length / 3;
    expect(uvs.length).toBe(positionVertexCount * 2);
    for (const value of uvs) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('uses the locked unlit opaque material and mesh settings', () => {
    const mesh = createOverlay();
    expect(mesh.material).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(mesh.material.transparent).toBe(false);
    expect(mesh.material.depthWrite).toBe(true);
    expect(mesh.material.depthTest).toBe(true);
    expect(mesh.material.side).toBe(THREE.FrontSide);
    expect(mesh.material.alphaTest).toBe(0.45);
    expect(mesh.material.vertexColors).toBe(true);
    expect(mesh.material.polygonOffset).toBe(true);
    expect(mesh.material.polygonOffsetFactor).toBe(-1);
    expect(mesh.material.polygonOffsetUnits).toBe(-1);
    expect(mesh.material.fog).toBe(true);
    expect(mesh.renderOrder).toBe(1);
    expect(mesh.name).toBe('forest-lab-far-canopy');
    expect(mesh.frustumCulled).toBe(true);
    mesh.geometry.dispose();
    mesh.material.dispose();
  });

  // reviewer #5 / R5 §2.2: this is the ONE relationship that makes the R5 distance gate safe.
  //
  // The FAR overlay is an opaque material with alphaTest, so three.js compares
  //   diffuseColor.a = opacity * texel.a
  // against alphaTest. If the gate's floor opacity ever drops to or below alphaTest, then even a
  // fully opaque texel (texel.a = 1) fails the test and EVERY texel is discarded: the overlay does
  // not fade, it vanishes, exposing bare ground across the whole patch. That regression actually
  // shipped once in this phase (floor 0.1 vs alphaTest 0.45) and was caught only by eye.
  //
  // A comment could not prevent it. This assert can.
  it('keeps the R5 opacity floor strictly above the overlay alphaTest so the gate fades instead of vanishing', () => {
    const alphaTest = forestImpostorV2Defaults.material.groveAlphaTest;

    expect(createOverlay().material.alphaTest).toBe(alphaTest);
    expect(R5_FAR_CANOPY_OPACITY_MIN).toBeGreaterThan(alphaTest);
    expect(R5_FAR_CANOPY_OPACITY_MAX).toBeLessThanOrEqual(1);
    expect(R5_FAR_CANOPY_OPACITY_MIN).toBeLessThanOrEqual(R5_FAR_CANOPY_OPACITY_MAX);

    // The surviving-texel threshold implied by the floor: only texels with
    // alpha > alphaTest / floor still render at maximum distance attenuation.
    // Keep it a real fraction -- if it reached 1 the overlay would again be all-or-nothing.
    expect(alphaTest / R5_FAR_CANOPY_OPACITY_MIN).toBeLessThan(1);
  });

  it('loads, orients, configures, and describes the generated texture', async () => {
    const texture = new THREE.Texture();
    const result = await loadFarCanopyTexture({
      loadTexture: async () => texture,
      fetchJson: async () => ({ output: { sha256: 'stub-sha256' }, size: 2048 }),
    });
    expect(result.texture).toBe(texture);
    expect(result.texture.flipY).toBe(false);
    expect(result.sha256).toBe('stub-sha256');
    expect(result.width).toBe(2048);
    expect(result.height).toBe(2048);
    texture.dispose();
  });

  it('falls back to image dimensions and a null digest when metadata fails', async () => {
    const texture = new THREE.Texture();
    texture.image = { width: 640, height: 320 };
    const result = await loadFarCanopyTexture({
      loadTexture: async () => texture,
      fetchJson: async () => { throw new Error('metadata unavailable'); },
    });
    expect(result.sha256).toBeNull();
    expect(result.width).toBe(640);
    expect(result.height).toBe(320);
    texture.dispose();
  });

  it('selects the R1 texture/meta URLs when appearance is R1', async () => {
    const texture = new THREE.Texture();
    const loadedUrls: string[] = [];
    const fetchedUrls: string[] = [];
    const result = await loadFarCanopyTexture('R1', {
      loadTexture: async (url) => {
        loadedUrls.push(url);
        return texture;
      },
      fetchJson: async (url) => {
        fetchedUrls.push(url);
        return { output: { sha256: 'r1-stub-sha256' }, size: 2048 };
      },
    });
    expect(loadedUrls).toEqual([FAR_CANOPY_R1_TEXTURE_URL]);
    expect(fetchedUrls).toEqual([FAR_CANOPY_R1_META_URL]);
    expect(FAR_CANOPY_R1_TEXTURE_URL.endsWith('far-canopy-r1-2048.png')).toBe(true);
    expect(FAR_CANOPY_R1_META_URL.endsWith('far-canopy-r1-meta.json')).toBe(true);
    expect(result.sha256).toBe('r1-stub-sha256');
    expect(result.texture.anisotropy).toBe(1);
    texture.dispose();
  });

  it('selects the R2 texture/meta URLs when appearance is R2', async () => {
    const texture = new THREE.Texture();
    const loadedUrls: string[] = [];
    const fetchedUrls: string[] = [];
    const result = await loadFarCanopyTexture('R2', {
      loadTexture: async (url) => {
        loadedUrls.push(url);
        return texture;
      },
      fetchJson: async (url) => {
        fetchedUrls.push(url);
        return { output: { sha256: 'r2-stub-sha256' }, size: 2048 };
      },
    });
    expect(loadedUrls).toEqual([FAR_CANOPY_R2_TEXTURE_URL]);
    expect(fetchedUrls).toEqual([FAR_CANOPY_R2_META_URL]);
    expect(FAR_CANOPY_R2_TEXTURE_URL.endsWith('far-canopy-r2-2048.png')).toBe(true);
    expect(FAR_CANOPY_R2_META_URL.endsWith('far-canopy-r2-meta.json')).toBe(true);
    expect(result.sha256).toBe('r2-stub-sha256');
    expect(result.texture.anisotropy).toBe(1);
    texture.dispose();
  });

  it('keeps R3 on the R2 FAR asset unchanged (R3 only changes the grove-card texture)', async () => {
    const texture = new THREE.Texture();
    const loadedUrls: string[] = [];
    const fetchedUrls: string[] = [];
    const result = await loadFarCanopyTexture('R3', {
      loadTexture: async (url) => {
        loadedUrls.push(url);
        return texture;
      },
      fetchJson: async (url) => {
        fetchedUrls.push(url);
        return { output: { sha256: 'r3-stub-sha256' }, size: 2048 };
      },
    });
    expect(loadedUrls).toEqual([FAR_CANOPY_R2_TEXTURE_URL]);
    expect(fetchedUrls).toEqual([FAR_CANOPY_R2_META_URL]);
    expect(result.texture.anisotropy).toBe(1);
    texture.dispose();
  });

  it('selects the dedicated R4 texture/meta URLs when appearance is R4', async () => {
    const texture = new THREE.Texture();
    const loadedUrls: string[] = [];
    const fetchedUrls: string[] = [];
    const result = await loadFarCanopyTexture('R4', {
      loadTexture: async (url) => {
        loadedUrls.push(url);
        return texture;
      },
      fetchJson: async (url) => {
        fetchedUrls.push(url);
        return { output: { sha256: 'r4-stub-sha256' }, size: 2048 };
      },
    });
    expect(loadedUrls).toEqual([FAR_CANOPY_R4_TEXTURE_URL]);
    expect(fetchedUrls).toEqual([FAR_CANOPY_R4_META_URL]);
    expect(FAR_CANOPY_R4_TEXTURE_URL.endsWith('far-canopy-r4-2048.png')).toBe(true);
    expect(FAR_CANOPY_R4_META_URL.endsWith('far-canopy-r4-meta.json')).toBe(true);
    expect(FAR_CANOPY_R4_TEXTURE_URL).not.toBe(FAR_CANOPY_R2_TEXTURE_URL);
    expect(FAR_CANOPY_R4_META_URL).not.toBe(FAR_CANOPY_R2_META_URL);
    expect(result.sha256).toBe('r4-stub-sha256');
    expect(result.texture.anisotropy).toBe(1);
    texture.dispose();
  });

  it('selects the dedicated R5 texture/meta URLs and applies the R5-only anisotropy', async () => {
    const texture = new THREE.Texture();
    const loadedUrls: string[] = [];
    const fetchedUrls: string[] = [];
    const result = await loadFarCanopyTexture('R5', {
      loadTexture: async (url) => {
        loadedUrls.push(url);
        return texture;
      },
      fetchJson: async (url) => {
        fetchedUrls.push(url);
        return { output: { sha256: 'r5-stub-sha256' }, size: 2048 };
      },
    });
    expect(loadedUrls).toEqual([FAR_CANOPY_R5_TEXTURE_URL]);
    expect(fetchedUrls).toEqual([FAR_CANOPY_R5_META_URL]);
    expect(FAR_CANOPY_R5_TEXTURE_URL.endsWith('far-canopy-r5-2048.png')).toBe(true);
    expect(FAR_CANOPY_R5_META_URL.endsWith('far-canopy-r5-meta.json')).toBe(true);
    expect(FAR_CANOPY_R5_TEXTURE_URL).not.toBe(FAR_CANOPY_R2_TEXTURE_URL);
    expect(FAR_CANOPY_R5_TEXTURE_URL).not.toBe(FAR_CANOPY_R4_TEXTURE_URL);
    expect(FAR_CANOPY_R5_META_URL).not.toBe(FAR_CANOPY_R2_META_URL);
    expect(FAR_CANOPY_R5_META_URL).not.toBe(FAR_CANOPY_R4_META_URL);
    expect(result.sha256).toBe('r5-stub-sha256');
    // R5-only anisotropic filtering (design §T3); every other appearance keeps the texture's
    // default anisotropy of 1 (see the assertions on the BASELINE/R1/R2/R3/R4 tests above).
    expect(result.texture.anisotropy).toBe(R5_FAR_CANOPY_ANISOTROPY);
    texture.dispose();
  });

  it('selects the BASELINE texture/meta URLs by default and for any non-R1 appearance', async () => {
    const texture = new THREE.Texture();
    const loadedUrls: string[] = [];
    const fetchedUrls: string[] = [];
    const result = await loadFarCanopyTexture('BASELINE', {
      loadTexture: async (url) => {
        loadedUrls.push(url);
        return texture;
      },
      fetchJson: async (url) => {
        fetchedUrls.push(url);
        return { output: { sha256: 'baseline-stub-sha256' }, size: 2048 };
      },
    });
    expect(loadedUrls).toEqual([FAR_CANOPY_TEXTURE_URL]);
    expect(fetchedUrls).toEqual([FAR_CANOPY_META_URL]);
    expect(FAR_CANOPY_TEXTURE_URL.endsWith('far-canopy-2048.png')).toBe(true);
    expect(FAR_CANOPY_TEXTURE_URL.endsWith('far-canopy-r1-2048.png')).toBe(false);
    expect(FAR_CANOPY_META_URL.endsWith('far-canopy-meta.json')).toBe(true);
    expect(FAR_CANOPY_META_URL.endsWith('far-canopy-r1-meta.json')).toBe(false);
    expect(result.texture.anisotropy).toBe(1);
    texture.dispose();
  });

  it('leaves vertex colors unchanged when macroShade is omitted or disabled', () => {
    const variedTerrainY = (x: number, z: number): number =>
      200 + 40 * Math.sin(x / 300) + 25 * Math.cos(z / 250);
    const baseline = createFarCanopyOverlay({
      grid: syntheticGrid(),
      patch,
      vertexColors: syntheticVertexColors(),
      texture: new THREE.Texture(),
      worldBbox,
    });
    const macroShadeOmitted = createFarCanopyOverlay({
      grid: syntheticGrid(),
      patch,
      vertexColors: syntheticVertexColors(),
      texture: new THREE.Texture(),
      worldBbox,
      terrainYAt: variedTerrainY,
    });
    const macroShadeDisabled = createFarCanopyOverlay({
      grid: syntheticGrid(),
      patch,
      vertexColors: syntheticVertexColors(),
      texture: new THREE.Texture(),
      worldBbox,
      macroShade: { ...DEFAULT_MACRO_SHADE_CONFIG, enabled: false },
      terrainYAt: variedTerrainY,
    });
    const noTerrainYAt = createFarCanopyOverlay({
      grid: syntheticGrid(),
      patch,
      vertexColors: syntheticVertexColors(),
      texture: new THREE.Texture(),
      worldBbox,
      macroShade: { ...DEFAULT_MACRO_SHADE_CONFIG, enabled: true },
    });

    const baselineColors = baseline.geometry.getAttribute('color').array;
    for (const candidate of [macroShadeOmitted, macroShadeDisabled, noTerrainYAt]) {
      expectArraysToBeEqual(candidate.geometry.getAttribute('color').array, baselineColors);
      candidate.geometry.dispose();
      candidate.material.dispose();
    }
    baseline.geometry.dispose();
    baseline.material.dispose();
  });

  it('changes vertex colors while keeping vertex/index counts unchanged when macroShade is enabled', () => {
    const variedTerrainY = (x: number, z: number): number =>
      200 + 40 * Math.sin(x / 300) + 25 * Math.cos(z / 250);
    const baseline = createFarCanopyOverlay({
      grid: syntheticGrid(),
      patch,
      vertexColors: syntheticVertexColors(),
      texture: new THREE.Texture(),
      worldBbox,
    });
    const shaded = createFarCanopyOverlay({
      grid: syntheticGrid(),
      patch,
      vertexColors: syntheticVertexColors(),
      texture: new THREE.Texture(),
      worldBbox,
      macroShade: { ...DEFAULT_MACRO_SHADE_CONFIG, enabled: true },
      terrainYAt: variedTerrainY,
    });

    const baselineColors = baseline.geometry.getAttribute('color').array;
    const shadedColors = shaded.geometry.getAttribute('color').array;
    expect(shadedColors.length).toBe(baselineColors.length);
    expect(shaded.geometry.getAttribute('position').count)
      .toBe(baseline.geometry.getAttribute('position').count);
    expect(shaded.geometry.getIndex()!.count).toBe(baseline.geometry.getIndex()!.count);

    let hasDifference = false;
    for (let i = 0; i < shadedColors.length; i += 1) {
      if (shadedColors[i] !== baselineColors[i]) {
        hasDifference = true;
        break;
      }
    }
    expect(hasDifference).toBe(true);

    baseline.geometry.dispose();
    baseline.material.dispose();
    shaded.geometry.dispose();
    shaded.material.dispose();
  });

  it('does not change the terrain elevation range', () => {
    const grid = syntheticGrid();
    const mesh = createFarCanopyOverlay({
      grid,
      patch,
      vertexColors: syntheticVertexColors(),
      texture: new THREE.Texture(),
      worldBbox,
    });
    const actual = mesh.geometry.getAttribute('position').array;
    const expected = buildPatchTerrainVertices(grid, patch, defaultSettings);
    const yRange = (values: ArrayLike<number>) => {
      let min = Infinity;
      let max = -Infinity;
      for (let index = 1; index < values.length; index += 3) {
        min = Math.min(min, values[index]);
        max = Math.max(max, values[index]);
      }
      return { min, max };
    };
    expect(yRange(actual).min).toBe(yRange(expected).min);
    expect(yRange(actual).max).toBe(yRange(expected).max);
    mesh.geometry.dispose();
    mesh.material.dispose();
  });
});
