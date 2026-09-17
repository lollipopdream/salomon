import * as THREE from 'three';

import type { ForestBillboardConfig } from '../types';
import { createSeededRandom } from './forestRandom';

export interface CanopyCardTextureData {
  size: number;
  data: Uint8Array;
}

export function createCanopyCardTextureData(config: ForestBillboardConfig): CanopyCardTextureData {
  const size = config.textureSize;
  const data = new Uint8Array(size * size * 4);
  const random = createSeededRandom(config.textureSeed);
  const blobCount = 40 + Math.floor(random() * 31);

  for (let blob = 0; blob < blobCount; blob += 1) {
    const height = 0.08 + Math.pow(random(), 0.72) * 0.84;
    const crownWidth = 0.10 + (1 - height) * 0.36;
    const centerX = 0.5 + (random() * 2 - 1) * crownWidth * 0.72;
    const radiusX = 0.045 + random() * 0.075 + (1 - height) * 0.025;
    const radiusY = 0.035 + random() * 0.065;
    const alphaStrength = 145 + Math.floor(random() * 111);
    const red = height > 0.68 ? 69 : height > 0.34 ? 55 : 43;
    const green = height > 0.68 ? 112 : height > 0.34 ? 94 : 78;
    const blue = height > 0.68 ? 54 : height > 0.34 ? 43 : 37;
    const minX = Math.max(0, Math.floor((centerX - radiusX) * size));
    const maxX = Math.min(size - 1, Math.ceil((centerX + radiusX) * size));
    const minY = Math.max(0, Math.floor((height - radiusY) * size));
    const maxY = Math.min(size - 1, Math.ceil((height + radiusY) * size));

    for (let y = minY; y <= maxY; y += 1) {
      const dy = ((y + 0.5) / size - height) / radiusY;
      for (let x = minX; x <= maxX; x += 1) {
        const dx = ((x + 0.5) / size - centerX) / radiusX;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared >= 1) continue;
        const offset = (y * size + x) * 4;
        const contribution = Math.ceil((1 - distanceSquared) * alphaStrength);
        const oldAlpha = data[offset + 3];
        if (contribution >= oldAlpha) {
          data[offset] = red;
          data[offset + 1] = green;
          data[offset + 2] = blue;
        }
        data[offset + 3] = Math.min(255, oldAlpha + contribution);
      }
    }
  }

  dilateTransparentRgb(data, size);
  return { size, data };
}

function dilateTransparentRgb(data: Uint8Array, size: number): void {
  const pixelCount = size * size;
  const queue = new Int32Array(pixelCount);
  const visited = new Uint8Array(pixelCount);
  let head = 0;
  let tail = 0;
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    if (data[pixel * 4 + 3] > 0) {
      visited[pixel] = 1;
      queue[tail] = pixel;
      tail += 1;
    }
  }
  while (head < tail) {
    const pixel = queue[head];
    head += 1;
    const x = pixel % size;
    const y = Math.floor(pixel / size);
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if ((dx === 0 && dy === 0) || x + dx < 0 || x + dx >= size || y + dy < 0 || y + dy >= size) continue;
        const neighbor = (y + dy) * size + x + dx;
        if (visited[neighbor] !== 0) continue;
        visited[neighbor] = 1;
        const sourceOffset = pixel * 4;
        const targetOffset = neighbor * 4;
        data[targetOffset] = data[sourceOffset];
        data[targetOffset + 1] = data[sourceOffset + 1];
        data[targetOffset + 2] = data[sourceOffset + 2];
        queue[tail] = neighbor;
        tail += 1;
      }
    }
  }
}

export function createCanopyCardTexture(data: CanopyCardTextureData): THREE.DataTexture {
  const texture = new THREE.DataTexture(data.data, data.size, data.size, THREE.RGBAFormat);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
