import {
  EDGE_TAPER_WIDTH_METERS,
  MASK_EXTENT_METERS,
  MASK_SIZE,
  smoothstep01,
} from '../labConstants';

export const MASK_TEXEL_METERS = MASK_EXTENT_METERS / MASK_SIZE;

function distanceTransform1d(source: Float64Array, output: Float64Array): void {
  const length = source.length;
  const sites = new Int32Array(length);
  const boundaries = new Float64Array(length + 1);
  let envelopeSize = 0;

  for (let q = 0; q < length; q += 1) {
    if (!Number.isFinite(source[q])) continue;

    let intersection = Number.NEGATIVE_INFINITY;
    while (envelopeSize > 0) {
      const p = sites[envelopeSize - 1];
      intersection = (
        (source[q] + q * q) - (source[p] + p * p)
      ) / (2 * q - 2 * p);
      if (intersection > boundaries[envelopeSize - 1]) break;
      envelopeSize -= 1;
    }

    if (envelopeSize === 0) {
      sites[0] = q;
      boundaries[0] = Number.NEGATIVE_INFINITY;
      boundaries[1] = Number.POSITIVE_INFINITY;
      envelopeSize = 1;
    } else {
      sites[envelopeSize] = q;
      boundaries[envelopeSize] = intersection;
      boundaries[envelopeSize + 1] = Number.POSITIVE_INFINITY;
      envelopeSize += 1;
    }
  }

  if (envelopeSize === 0) {
    output.fill(Number.POSITIVE_INFINITY);
    return;
  }

  let envelopeIndex = 0;
  for (let q = 0; q < length; q += 1) {
    while (
      envelopeIndex + 1 < envelopeSize
      && boundaries[envelopeIndex + 1] < q
    ) {
      envelopeIndex += 1;
    }
    const p = sites[envelopeIndex];
    const delta = q - p;
    output[q] = delta * delta + source[p];
  }
}

export function buildMaskDistanceFieldTexels(
  coverage: Uint8Array,
  size: number,
  threshold: number,
): Float32Array {
  if (!Number.isInteger(size) || size <= 0 || coverage.length !== size * size) {
    throw new RangeError('Mask dimensions must be a positive square matching coverage length.');
  }
  if (!Number.isFinite(threshold)) {
    throw new RangeError('Mask threshold must be finite.');
  }

  const horizontal = new Float64Array(size * size);
  const source = new Float64Array(size);
  const transformed = new Float64Array(size);

  for (let row = 0; row < size; row += 1) {
    const rowOffset = row * size;
    for (let col = 0; col < size; col += 1) {
      source[col] = coverage[rowOffset + col] / 255 < threshold
        ? 0
        : Number.POSITIVE_INFINITY;
    }
    distanceTransform1d(source, transformed);
    horizontal.set(transformed, rowOffset);
  }

  const result = new Float32Array(size * size);
  for (let col = 0; col < size; col += 1) {
    for (let row = 0; row < size; row += 1) {
      source[row] = horizontal[row * size + col];
    }
    distanceTransform1d(source, transformed);
    for (let row = 0; row < size; row += 1) {
      result[row * size + col] = Math.sqrt(transformed[row]);
    }
  }

  return result;
}

function interpolate(a: number, b: number, t: number): number {
  if (t === 0 || a === b) return a;
  return a + (b - a) * t;
}

export function sampleDistanceMeters(
  field: Float32Array,
  size: number,
  x: number,
  z: number,
): number {
  if (!Number.isInteger(size) || size <= 0 || field.length !== size * size) {
    throw new RangeError('Distance field dimensions must match its square size.');
  }

  const colF = x / MASK_EXTENT_METERS * MASK_SIZE - 0.5;
  const rowF = z / MASK_EXTENT_METERS * MASK_SIZE - 0.5;
  if (colF < 0 || rowF < 0 || colF > size - 1 || rowF > size - 1) return 0;

  const col0 = Math.floor(colF);
  const row0 = Math.floor(rowF);
  const col1 = Math.min(col0 + 1, size - 1);
  const row1 = Math.min(row0 + 1, size - 1);
  const tx = colF - col0;
  const ty = rowF - row0;
  const top = interpolate(field[row0 * size + col0], field[row0 * size + col1], tx);
  const bottom = interpolate(field[row1 * size + col0], field[row1 * size + col1], tx);
  return interpolate(top, bottom, ty) * MASK_TEXEL_METERS;
}

export function taperAt(
  field: Float32Array,
  size: number,
  x: number,
  z: number,
): number {
  return smoothstep01(
    sampleDistanceMeters(field, size, x, z) / EDGE_TAPER_WIDTH_METERS,
  );
}
