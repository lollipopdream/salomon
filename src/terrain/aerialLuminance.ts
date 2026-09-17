import type * as THREE from 'three';

/**
 * Convert sRGB RGBA byte values to Rec.709 luminance in the 0..1 range.
 *
 * The sRGB values are intentionally not linearized: this luminance is used to
 * extract image high-frequency detail, not as an absolute physical quantity.
 */
export function computeLuminanceFromRgba(
  data: Uint8ClampedArray,
  pixelCount: number,
): Float32Array {
  if (data.length !== pixelCount * 4) {
    throw new RangeError('RGBA data length must equal pixelCount * 4.');
  }

  const luminance = new Float32Array(pixelCount);
  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const offset = pixelIndex * 4;
    luminance[pixelIndex] = (
      0.2126 * data[offset]
      + 0.7152 * data[offset + 1]
      + 0.0722 * data[offset + 2]
    ) / 255;
  }

  return luminance;
}

/**
 * Downsample a loaded texture through Canvas2D and extract its luminance.
 * Returns undefined when the DOM or a usable texture image/context is absent.
 */
export function extractTextureLuminance(
  texture: THREE.Texture,
  targetCols: number,
  targetRows: number,
): Float32Array | undefined {
  const image = texture.image as
    | { width?: number; height?: number }
    | null
    | undefined;

  if (
    image == null
    || typeof image.width !== 'number'
    || typeof image.height !== 'number'
    || image.width <= 0
    || image.height <= 0
    || typeof document === 'undefined'
  ) {
    return undefined;
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetCols;
  canvas.height = targetRows;
  const context = canvas.getContext('2d');

  if (context === null) {
    return undefined;
  }

  context.drawImage(
    image as CanvasImageSource,
    0,
    0,
    targetCols,
    targetRows,
  );
  const imageData = context.getImageData(0, 0, targetCols, targetRows);
  return computeLuminanceFromRgba(imageData.data, targetCols * targetRows);
}
