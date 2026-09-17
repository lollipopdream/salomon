import type { ForestMaskV2Data } from './types';

export function decodeForestMaskV2FromRgba(
  rgba: Uint8ClampedArray | Uint8Array,
  size: number,
  extentMeters: number,
): ForestMaskV2Data {
  const expectedLength = size * size * 4;
  if (!Number.isInteger(size) || size <= 0 || rgba.length !== expectedLength) {
    throw new Error(
      `Forest mask RGBA length mismatch: expected ${expectedLength}, received ${rgba.length}.`,
    );
  }

  const coverage = new Uint8Array(size * size);
  for (let index = 0; index < coverage.length; index += 1) {
    coverage[index] = rgba[index * 4];
  }
  return { size, extentMeters, coverage };
}

export function sampleMaskCoverageV2(mask: ForestMaskV2Data, x: number, z: number): number {
  if (x < 0 || z < 0 || x >= mask.extentMeters || z >= mask.extentMeters) return 0;

  const col = Math.floor(x / mask.extentMeters * mask.size);
  const row = Math.floor(z / mask.extentMeters * mask.size);
  return mask.coverage[row * mask.size + col] / 255;
}

export function isFootprintInsideMask(
  mask: ForestMaskV2Data,
  x: number,
  z: number,
  radiusMeters: number,
  minCoverage: number,
  minCoverageEdge: number,
): boolean {
  if (sampleMaskCoverageV2(mask, x, z) < minCoverage) return false;
  if (radiusMeters <= 0) return true;

  return sampleMaskCoverageV2(mask, x - radiusMeters, z) >= minCoverageEdge
    && sampleMaskCoverageV2(mask, x + radiusMeters, z) >= minCoverageEdge
    && sampleMaskCoverageV2(mask, x, z - radiusMeters) >= minCoverageEdge
    && sampleMaskCoverageV2(mask, x, z + radiusMeters) >= minCoverageEdge;
}

export type ForestMaskV2CanvasFactory = (
  width: number,
  height: number,
) => HTMLCanvasElement;

export async function loadForestMaskV2(
  url: string,
  size: number,
  extentMeters: number,
  loadImage: (url: string) => Promise<HTMLImageElement> = loadBrowserImage,
  createCanvas: ForestMaskV2CanvasFactory = createBrowserCanvas,
): Promise<ForestMaskV2Data> {
  const image = await loadImage(url);
  if (image.width !== size || image.height !== size) {
    throw new Error(
      `Forest mask image size mismatch: expected ${size}x${size}, `
      + `received ${image.width}x${image.height}.`,
    );
  }

  const canvas = createCanvas(size, size);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Forest mask canvas 2D context is unavailable.');
  context.drawImage(image, 0, 0, size, size);
  return decodeForestMaskV2FromRgba(context.getImageData(0, 0, size, size).data, size, extentMeters);
}

function loadBrowserImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load forest image: ${url}`));
    image.src = url;
  });
}

function createBrowserCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}
