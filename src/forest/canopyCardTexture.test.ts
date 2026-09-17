import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { forestDefaults } from '../config/defaults/forest';
import { createCanopyCardTexture, createCanopyCardTextureData } from './canopyCardTexture';

describe('canopy card texture', () => {
  it('generates deterministic tree-shaped RGBA data in the target coverage range', () => {
    const first = createCanopyCardTextureData(forestDefaults.billboard);
    const second = createCanopyCardTextureData(forestDefaults.billboard);
    expect(first.data.length).toBe(first.size * first.size * 4);
    expect(first.data).toEqual(second.data);
    let covered = 0; let weightedY = 0;
    for (let index = 0; index < first.size * first.size; index += 1) {
      if (first.data[index * 4 + 3] > 0) { covered += 1; weightedY += Math.floor(index / first.size); }
    }
    expect(covered / (first.size * first.size)).toBeGreaterThanOrEqual(0.25);
    expect(covered / (first.size * first.size)).toBeLessThanOrEqual(0.65);
    expect(weightedY / covered).toBeGreaterThan((first.size - 1) * 0.5);
  });

  it('dilates opaque RGB into adjacent transparent texels', () => {
    const { data, size } = createCanopyCardTextureData(forestDefaults.billboard);
    for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      if (data[offset + 3] !== 0) continue;
      let adjacentOpaque = false;
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        const nx = x + dx; const ny = y + dy;
        if (nx >= 0 && nx < size && ny >= 0 && ny < size && data[(ny * size + nx) * 4 + 3] > 0) adjacentOpaque = true;
      }
      if (adjacentOpaque) expect(data[offset] + data[offset + 1] + data[offset + 2]).toBeGreaterThan(0);
    }
  });

  it('configures a mipmapped sRGB DataTexture', () => {
    const value = createCanopyCardTextureData(forestDefaults.billboard);
    const texture = createCanopyCardTexture(value);
    expect(texture.generateMipmaps).toBe(true);
    expect(texture.minFilter).toBe(THREE.LinearMipmapLinearFilter);
    expect(texture.magFilter).toBe(THREE.LinearFilter);
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(texture.image.width).toBe(value.size);
  });
});
