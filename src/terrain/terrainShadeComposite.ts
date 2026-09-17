import type * as THREE from 'three';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Multiply RGBA image pixels in-place by bilinearly sampled shade factors.
 * Both inputs use row 0 as north, so the factor grid is not flipped.
 */
export function applyShadeFactorsToImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  factors: Float32Array,
  factorCols: number,
  factorRows: number,
): void {
  if (data.length !== width * height * 4) {
    throw new RangeError('Image data length does not match width and height');
  }

  if (factors.length !== factorCols * factorRows) {
    throw new RangeError('Shade factor length does not match factor grid dimensions');
  }

  for (let py = 0; py < height; py += 1) {
    const fy = ((py + 0.5) / height) * factorRows - 0.5;
    const y0 = clamp(Math.floor(fy), 0, factorRows - 1);
    const y1 = clamp(y0 + 1, 0, factorRows - 1);
    const ty = clamp(fy - y0, 0, 1);

    for (let px = 0; px < width; px += 1) {
      const fx = ((px + 0.5) / width) * factorCols - 0.5;
      const x0 = clamp(Math.floor(fx), 0, factorCols - 1);
      const x1 = clamp(x0 + 1, 0, factorCols - 1);
      const tx = clamp(fx - x0, 0, 1);

      const top = factors[y0 * factorCols + x0] * (1 - tx)
        + factors[y0 * factorCols + x1] * tx;
      const bottom = factors[y1 * factorCols + x0] * (1 - tx)
        + factors[y1 * factorCols + x1] * tx;
      const factor = top * (1 - ty) + bottom * ty;
      const offset = (py * width + px) * 4;

      data[offset] = clamp(Math.round(data[offset] * factor), 0, 255);
      data[offset + 1] = clamp(Math.round(data[offset + 1] * factor), 0, 255);
      data[offset + 2] = clamp(Math.round(data[offset + 2] * factor), 0, 255);
      // Alpha (offset + 3) intentionally remains unchanged.
    }
  }
}

/**
 * Bake DEM-derived shade factors into a loaded Three.js texture via Canvas2D.
 */
export function applyDemShadeToTexture(
  texture: THREE.Texture,
  factors: Float32Array,
  factorCols: number,
  factorRows: number,
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
  applyShadeFactorsToImageData(
    imageData.data,
    canvas.width,
    canvas.height,
    factors,
    factorCols,
    factorRows,
  );
  context.putImageData(imageData, 0, 0);

  texture.image = canvas;
  texture.needsUpdate = true;
}
