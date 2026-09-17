// @ts-expect-error This project intentionally has no Node type dependency.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class FakeWebGLRenderer {
    readonly domElement = { style: {} as Record<string, string> };
    readonly constructorOptions: unknown;
    clearColor: [number, number] | undefined;
    pixelRatio: number | undefined;
    size: [number, number, boolean] | undefined;

    constructor(options: unknown) {
      this.constructorOptions = options;
    }

    setClearColor(color: number, alpha: number): void { this.clearColor = [color, alpha]; }
    setPixelRatio(ratio: number): void { this.pixelRatio = ratio; }
    setSize(width: number, height: number, updateStyle: boolean): void {
      this.size = [width, height, updateStyle];
    }
  }
  return { ...actual, WebGLRenderer: FakeWebGLRenderer };
});

import * as THREE from 'three';
import { CANONICAL_CELL_SIZE_METERS } from '../labConstants';
import { PATCH_MANIFEST_JSON } from './labDataSources';
import { createLabFog, createLabRenderer, LAB_FOG_GRID } from './labRenderer';
import { createPatchTerrainMesh, createShellVertexColors } from './labTerrain';

describe('lab renderer and terrain adapters', () => {
  it('derives fog from the canonical 256x256 grid', () => {
    expect(LAB_FOG_GRID).toEqual({
      cols: 256,
      rows: 256,
      cellSizeMeters: CANONICAL_CELL_SIZE_METERS,
    });
    const fog = createLabFog();
    expect(fog.near).toBeCloseTo(4639.096493545203, 9);
    expect(fog.far).toBeCloseTo(16025.969704974334, 9);
  });

  it('creates the fixed capture renderer, camera, background, and two lights', () => {
    const appended: unknown[] = [];
    const container = {
      style: {} as Record<string, string>,
      appendChild: (child: unknown) => appended.push(child),
    } as unknown as HTMLElement;
    const result = createLabRenderer(container, { capture: true });
    const renderer = result.renderer as unknown as {
      constructorOptions: unknown;
      clearColor: unknown;
      pixelRatio: unknown;
      size: unknown;
      domElement: { style: Record<string, string> };
    };
    expect(renderer.constructorOptions).toEqual({ antialias: true, alpha: true });
    expect(renderer.clearColor).toEqual([0, 0]);
    expect(renderer.pixelRatio).toBe(1);
    expect(renderer.size).toEqual([1920, 1080, false]);
    expect(renderer.domElement.style).toMatchObject({ width: '1920px', height: '1080px' });
    expect(result.camera).toBeInstanceOf(THREE.PerspectiveCamera);
    expect([result.camera.fov, result.camera.aspect, result.camera.near, result.camera.far])
      .toEqual([45, 1920 / 1080, 0.1, 100000]);
    expect(result.scene.background).toBeNull();
    expect(result.scene.fog).toBeInstanceOf(THREE.Fog);
    expect(result.scene.children).toEqual([result.lights.hemisphere, result.lights.directional]);
    expect(result.lights.directional.position.toArray()).toEqual([-3600, 3200, -2400]);
    expect(appended).toEqual([renderer.domElement]);
  });

  it('embeds an exact manifest copy and samples shell colors bilinearly', () => {
    const manifest = JSON.parse(readFileSync(
      new URL('../../../outputs/matsu-h01-takao-forest-visual-lab-architecture-bakeoff/forest-lab-patch-manifest.json', import.meta.url),
      'utf8',
    ));
    expect(PATCH_MANIFEST_JSON).toEqual(manifest);

    const colors = new Float32Array(256 * 256 * 3);
    for (let row = 0; row < 256; row += 1) {
      for (let col = 0; col < 256; col += 1) {
        const offset = (row * 256 + col) * 3;
        colors[offset] = col;
        colors[offset + 1] = row;
        colors[offset + 2] = col + row;
      }
    }
    const sampled = createShellVertexColors(
      colors,
      { id: 'A', rowStart: 1, rowEnd: 2, colStart: 3, colEnd: 4 },
      2,
    );
    expect(Array.from(sampled.slice(12, 15))).toEqual([3.5, 1.5, 5]);
  });

  it('creates a canonical-indexed patch mesh with the shared texture', () => {
    const values = new Float32Array(256 * 256);
    const grid = {
      rows: 256,
      cols: 256,
      values,
      cellSizeMeters: CANONICAL_CELL_SIZE_METERS,
      bounds: { north: 1, south: 0, east: 1, west: 0 },
    };
    const colors = new Float32Array(256 * 256 * 3).fill(1);
    const texture = new THREE.Texture();
    const mesh = createPatchTerrainMesh(
      grid,
      { id: 'A', rowStart: 1, rowEnd: 3, colStart: 2, colEnd: 4 },
      colors,
      texture,
    );
    expect(mesh.geometry.getAttribute('position').count).toBe(9);
    expect(mesh.geometry.getIndex()!.count).toBe(24);
    expect(mesh.material.map).toBe(texture);
    mesh.geometry.dispose();
    mesh.material.dispose();
  });
});
