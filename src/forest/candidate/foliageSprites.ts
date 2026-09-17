import type { SpriteRect } from './types';

export interface SpriteExtractionOptions {
  alphaThreshold: number;
  minAreaPixels: number;
  maxSprites: number;
  paddingPixels: number;
}

interface ComponentBounds extends SpriteRect {
  area: number;
}

export function extractAlphaChannel(
  rgba: Uint8Array | Uint8ClampedArray,
  channelOffset = 0,
): Uint8Array {
  if (!Number.isInteger(channelOffset) || channelOffset < 0 || channelOffset > 3) {
    throw new Error(`RGBA channel offset must be an integer from 0 to 3; received ${channelOffset}.`);
  }
  if (rgba.length % 4 !== 0) {
    throw new Error(`RGBA buffer length must be divisible by 4; received ${rgba.length}.`);
  }

  const alpha = new Uint8Array(rgba.length / 4);
  for (let index = 0; index < alpha.length; index += 1) {
    alpha[index] = rgba[index * 4 + channelOffset];
  }
  return alpha;
}

export function extractSpriteRects(
  alpha: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  options: SpriteExtractionOptions,
): SpriteRect[] {
  if (alpha.length !== width * height) {
    throw new Error(`Alpha buffer length mismatch: expected ${width * height}, received ${alpha.length}.`);
  }
  if (width <= 0 || height <= 0 || options.maxSprites <= 0) return [];

  const visited = new Uint8Array(alpha.length);
  const queue = new Int32Array(alpha.length);
  const components: ComponentBounds[] = [];

  for (let start = 0; start < alpha.length; start += 1) {
    if (visited[start] || alpha[start] <= options.alphaThreshold) continue;

    // Iterative 4-connected flood fill avoids overflowing the call stack on full atlases.
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    while (head < tail) {
      const pixelIndex = queue[head++];
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      area += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      if (x > 0) enqueue(pixelIndex - 1);
      if (x + 1 < width) enqueue(pixelIndex + 1);
      if (y > 0) enqueue(pixelIndex - width);
      if (y + 1 < height) enqueue(pixelIndex + width);
    }

    if (area >= options.minAreaPixels) {
      const padding = Math.max(0, options.paddingPixels);
      const left = Math.max(0, minX - padding);
      const top = Math.max(0, minY - padding);
      const right = Math.min(width - 1, maxX + padding);
      const bottom = Math.min(height - 1, maxY + padding);
      components.push({
        x: left,
        y: top,
        width: right - left + 1,
        height: bottom - top + 1,
        area,
      });
    }

    function enqueue(index: number): void {
      if (!visited[index] && alpha[index] > options.alphaThreshold) {
        visited[index] = 1;
        queue[tail++] = index;
      }
    }
  }

  components.sort((left, right) => right.area - left.area || left.y - right.y || left.x - right.x);
  return components.slice(0, options.maxSprites).map(({ x, y, width: boxWidth, height: boxHeight }) => ({
    x,
    y,
    width: boxWidth,
    height: boxHeight,
  }));
}
