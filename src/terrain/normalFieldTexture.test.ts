import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import type {
  CanopyDetailNormalConfig,
  TangentNormalField,
} from '../types';
import {
  combineTangentNormalFields,
  createNormalMapDataTexture,
  encodeTangentNormalFieldToRgba,
  resampleTangentNormalField,
  resolveNormalFieldTargetSize,
} from './normalFieldTexture';

function field(
  cols: number,
  rows: number,
  values: number[],
): TangentNormalField {
  return { cols, rows, values: new Float32Array(values) };
}

function expectUnitNormals(normalField: TangentNormalField): void {
  for (let offset = 0; offset < normalField.values.length; offset += 3) {
    const length = Math.hypot(
      normalField.values[offset],
      normalField.values[offset + 1],
      normalField.values[offset + 2],
    );
    expect(length).toBeCloseTo(1, 6);
  }
}

describe('normal field texture utilities', () => {
  it('encodes every neutral texel as opaque neutral-normal RGBA', () => {
    const neutral = field(2, 2, [
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
    ]);

    expect(Array.from(encodeTangentNormalFieldToRgba(neutral))).toEqual([
      128, 128, 255, 255,
      128, 128, 255, 255,
      128, 128, 255, 255,
      128, 128, 255, 255,
    ]);
  });

  it('writes southern field rows first for bottom-up encoding', () => {
    const northThenSouth = field(1, 2, [
      0, 0, 1,
      0.6, 0, 0.8,
    ]);

    // Most important regression guard: this reversal prevents a north/south-flipped normal map.
    expect(Array.from(encodeTangentNormalFieldToRgba(
      northThenSouth,
      { rowOrder: 'bottom-up' },
    ))).toEqual([
      204, 128, 230, 255,
      128, 128, 255, 255,
    ]);
  });

  it('copies values exactly when resampling to identical dimensions', () => {
    const original = field(2, 2, [
      0, 0, 1,
      0.6, 0, 0.8,
      0, 0.8, 0.6,
      -0.6, 0, 0.8,
    ]);

    const result = resampleTangentNormalField(original, 2, 2);

    expect(result).not.toBe(original);
    expect(result.values).not.toBe(original.values);
    expect(result.values).toEqual(original.values);
  });

  it('renormalizes every normal when resampling from 2x2 to 4x4', () => {
    const original = field(2, 2, [
      -0.6, 0, 0.8,
      0.6, 0, 0.8,
      0, -0.6, 0.8,
      0, 0.6, 0.8,
    ]);

    const result = resampleTangentNormalField(original, 4, 4);

    expect(result.cols).toBe(4);
    expect(result.rows).toBe(4);
    expectUnitNormals(result);
  });

  it('preserves base normals for zero weight and neutral detail, and normalizes output', () => {
    const base = field(2, 1, [
      0.6, 0, 0.8,
      0, -0.6, 0.8,
    ]);
    const nonNeutralDetail = field(2, 1, [
      -0.6, 0, 0.8,
      0, 0.6, 0.8,
    ]);
    const neutralDetail = field(2, 1, [
      0, 0, 1,
      0, 0, 1,
    ]);

    const zeroWeight = combineTangentNormalFields(base, nonNeutralDetail, 0);
    const neutralResult = combineTangentNormalFields(base, neutralDetail, 1);
    const combined = combineTangentNormalFields(base, nonNeutralDetail, 0.5);

    expect(zeroWeight.values).toEqual(base.values);
    expect(neutralResult.values).toEqual(base.values);
    expectUnitNormals(combined);
  });

  it('rejects mismatched dimensions when combining fields', () => {
    const base = field(2, 1, [0, 0, 1, 0, 0, 1]);
    const detail = field(1, 2, [0, 0, 1, 0, 0, 1]);

    expect(() => combineTangentNormalFields(base, detail, 1)).toThrow(RangeError);
  });

  it('resolves normal-map size across canopy branches and override precedence', () => {
    const canopy: CanopyDetailNormalConfig = {
      resolution: 1536,
      blurRadiusTexels: 4,
      heightScale: 8,
      weight: 0.5,
    };
    const config = { normalMapResolution: 768, canopy };

    expect(resolveNormalFieldTargetSize(config, { canopyDetailNormal: false })).toBe(768);
    expect(resolveNormalFieldTargetSize(config, { canopyDetailNormal: true })).toBe(1536);
    expect(resolveNormalFieldTargetSize(config, { canopyDetailNormal: true }, 3072)).toBe(3072);
  });

  it('always encodes alpha as 255', () => {
    const normals = field(3, 1, [
      -1, 0, 0,
      0, 1, 0,
      0, 0, 1,
    ]);

    const rgba = encodeTangentNormalFieldToRgba(normals);

    expect([rgba[3], rgba[7], rgba[11]]).toEqual([255, 255, 255]);
  });
});

describe('createNormalMapDataTexture', () => {
  const cols = 2;
  const rows = 2;
  const rgba = new Uint8ClampedArray([
    128, 128, 255, 255,
    255, 128, 128, 255,
    128, 255, 128, 255,
    0, 128, 255, 255,
  ]);

  it('uses no color space because sRGB gamma conversion corrupts normal maps', () => {
    // Setting sRGB causes normal components to be gamma-converted and the normal map to break.
    const texture = createNormalMapDataTexture(rgba, cols, rows);

    expect(texture.colorSpace).toBe(THREE.NoColorSpace);
    expect(texture.colorSpace).not.toBe(THREE.SRGBColorSpace);
  });

  it('does not flip rows because bottom-up encoding preserves geographic north/south', () => {
    // flipY=true reverses north and south; this pairs with encode's rowOrder: 'bottom-up'.
    const texture = createNormalMapDataTexture(rgba, cols, rows);

    expect(texture.flipY).toBe(false);
  });

  it('uses linear mipmaps, linear magnification, and clamp-to-edge wrapping', () => {
    const texture = createNormalMapDataTexture(rgba, cols, rows);

    expect(texture.minFilter).toBe(THREE.LinearMipmapLinearFilter);
    expect(texture.generateMipmaps).toBe(true);
    expect(texture.magFilter).toBe(THREE.LinearFilter);
    expect(texture.wrapS).toBe(THREE.ClampToEdgeWrapping);
    expect(texture.wrapT).toBe(THREE.ClampToEdgeWrapping);
  });

  it('clamps anisotropy to 16 and preserves the DataTexture default when omitted', () => {
    expect(createNormalMapDataTexture(rgba, cols, rows, 64).anisotropy).toBe(16);
    expect(createNormalMapDataTexture(rgba, cols, rows, 4).anisotropy).toBe(4);
    expect(createNormalMapDataTexture(rgba, cols, rows).anisotropy).toBe(1);
  });

  it('retains the supplied RGBA image dimensions and marks the texture for upload', () => {
    const descriptor = Object.getOwnPropertyDescriptor(THREE.Texture.prototype, 'needsUpdate');
    if (descriptor?.set === undefined) {
      throw new Error('Three.js Texture.needsUpdate setter is unavailable.');
    }

    let assignedNeedsUpdate: boolean | undefined;
    Object.defineProperty(THREE.Texture.prototype, 'needsUpdate', {
      configurable: true,
      set(value: boolean) {
        assignedNeedsUpdate = value;
        descriptor.set?.call(this, value);
      },
    });

    try {
      const texture = createNormalMapDataTexture(rgba, cols, rows);

      expect(texture.image.width).toBe(cols);
      expect(texture.image.height).toBe(rows);
      expect(texture.image.data).toBe(rgba);
      // Three.js implements needsUpdate as setter-only, so assert it is assigned true directly.
      expect(assignedNeedsUpdate).toBe(true);
      expect(texture.version).toBe(1);
    } finally {
      Object.defineProperty(THREE.Texture.prototype, 'needsUpdate', descriptor);
    }
  });
});
