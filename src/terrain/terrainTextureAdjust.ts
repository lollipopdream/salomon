import type * as THREE from 'three';

import type { TerrainTextureColorAdjustConfig } from '../types';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Adjust RGBA pixel data in-place with contrast, saturation, then brightness
 * applied in that order (each step clamped to 0..1 before the next). Alpha
 * is left untouched.
 */
export function adjustImageDataColor(
  data: Uint8ClampedArray,
  config: TerrainTextureColorAdjustConfig,
): void {
  const pixelCount = data.length / 4;

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const offset = pixelIndex * 4;

    let r = data[offset] / 255;
    let g = data[offset + 1] / 255;
    let b = data[offset + 2] / 255;

    // 1) contrast: stretch/compress around the mid-gray point.
    r = clamp01((r - 0.5) * config.contrast + 0.5);
    g = clamp01((g - 0.5) * config.contrast + 0.5);
    b = clamp01((b - 0.5) * config.contrast + 0.5);

    // 2) saturation: blend toward (or away from) the perceptual luminance.
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = clamp01(luminance + (r - luminance) * config.saturation);
    g = clamp01(luminance + (g - luminance) * config.saturation);
    b = clamp01(luminance + (b - luminance) * config.saturation);

    // 3) brightness: uniform multiplier.
    r = clamp01(r * config.brightness);
    g = clamp01(g * config.brightness);
    b = clamp01(b * config.brightness);

    data[offset] = Math.round(r * 255);
    data[offset + 1] = Math.round(g * 255);
    data[offset + 2] = Math.round(b * 255);
    // alpha (offset + 3) intentionally left unchanged.
  }
}

/**
 * Apply saturation/contrast/brightness adjustment directly to a loaded
 * Three.js texture's image by drawing it into a Canvas2D, adjusting the
 * pixel data, and swapping the texture's image for the adjusted canvas.
 *
 * This relies on the DOM Canvas 2D API and is therefore only exercised via
 * manual Chrome verification, not unit tests (vitest runs in a `node`
 * environment with no `document`).
 */
export function applyTerrainTextureColorAdjustment(
  texture: THREE.Texture,
  config: TerrainTextureColorAdjustConfig,
): void {
  const image = texture.image as
    | { width?: number; height?: number }
    | undefined;

  if (
    image === undefined
    || typeof image.width !== 'number'
    || typeof image.height !== 'number'
    || image.width <= 0
    || image.height <= 0
    || typeof document === 'undefined'
  ) {
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');

  if (context === null) {
    return;
  }

  context.drawImage(image as CanvasImageSource, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  adjustImageDataColor(imageData.data, config);
  context.putImageData(imageData, 0, 0);

  texture.image = canvas;
  texture.needsUpdate = true;
}
