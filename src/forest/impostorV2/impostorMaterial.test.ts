// @ts-expect-error This project deliberately has no Node type dependency.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { configureImpostorTexture, createImpostorMaterial } from './impostorMaterial';
import { R10_TONE_PRESET } from './r10TonePreset';

describe('impostor material helpers', () => {
  it('configures texture without changing its vertical convention', () => {
    const texture = configureImpostorTexture(new THREE.Texture());
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(texture.premultiplyAlpha).toBe(false);
    expect(texture.wrapS).toBe(THREE.ClampToEdgeWrapping);
    expect(texture.wrapT).toBe(THREE.ClampToEdgeWrapping);
    expect(texture.generateMipmaps).toBe(true);
    expect(texture.minFilter).toBe(THREE.LinearMipmapLinearFilter);
    expect(texture.magFilter).toBe(THREE.LinearFilter);
    expect(texture.flipY).toBe(true);
  });

  it('creates an opaque double-sided Lambert material', () => {
    const texture = new THREE.Texture();
    const material = createImpostorMaterial(texture, 0.5, 'tree');
    expect(material).toBeInstanceOf(THREE.MeshLambertMaterial);
    expect(material.transparent).toBe(false);
    expect(material.depthWrite).toBe(true);
    expect(material.depthTest).toBe(true);
    expect(material.side).toBe(THREE.DoubleSide);
    expect(material.vertexColors).toBe(false);
    expect(material.premultipliedAlpha).toBe(false);
    expect(material.fog).toBe(true);
    expect(material.alphaTest).toBe(0.5);
    expect(material.map).toBe(texture);
    expect(material.name).toContain('tree');
  });

  it('creates a basic material in unlit mode', () => {
    const material = createImpostorMaterial(new THREE.Texture(), 0.5, 'tree', 'unlit');
    expect(material).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(material.name).toContain('tree');
    expect(material.name).toContain('unlit');
  });

  it('keeps the current exact white material color when tone is off', () => {
    for (const kind of ['grove', 'tree'] as const) {
      const material = createImpostorMaterial(new THREE.Texture(), 0.5, kind, 'unlit', false);
      expect(material.color.r).toBe(1);
      expect(material.color.g).toBe(1);
      expect(material.color.b).toBe(1);
    }
  });

  it('uses the per-channel linear gains for grove and tree when tone is on', () => {
    for (const kind of ['grove', 'tree'] as const) {
      const material = createImpostorMaterial(new THREE.Texture(), 0.5, kind, 'unlit', true);
      expect(material.color.r).toBeCloseTo(R10_TONE_PRESET.linearGain.r, 12);
      expect(material.color.g).toBeCloseTo(R10_TONE_PRESET.linearGain.g, 12);
      expect(material.color.b).toBeCloseTo(R10_TONE_PRESET.linearGain.b, 12);
    }
  });

  it('keeps all non-lighting material properties identical across modes', () => {
    const texture = new THREE.Texture();
    const lambert = createImpostorMaterial(texture, 0.42, 'grove', 'lambert');
    const unlit = createImpostorMaterial(texture, 0.42, 'grove', 'unlit');
    const properties = ['alphaTest', 'transparent', 'depthWrite', 'depthTest', 'side',
      'vertexColors', 'premultipliedAlpha', 'fog', 'opacity', 'toneMapped', 'map'] as const;
    for (const property of properties) expect(unlit[property]).toBe(lambert[property]);
    expect(unlit.color.getHex()).toBe(lambert.color.getHex());
    expect(unlit.map).toBe(texture);
  });

  it('contains none of the disallowed source APIs or vertical setting', () => {
    // @ts-expect-error This project deliberately has no Node type dependency.
    const root = process.cwd();
    const source = readFileSync(`${root}/src/forest/impostorV2/impostorMaterial.ts`, 'utf8');
    for (const term of ['on' + 'BeforeCompile', 'Shader' + 'Material', 'Raw' + 'Shader' + 'Material',
      'cast' + 'Shadow', 'receive' + 'Shadow', 'shadow' + 'Map', 'Math.' + 'random',
      'forest' + 'Candidate', 'flip' + 'Y', 'Mesh' + 'Standard' + 'Material',
      'Mesh' + 'Physical' + 'Material', 'Mesh' + 'Phong' + 'Material', 'emissive']) {
      expect(source).not.toContain(term);
    }
  });
});
