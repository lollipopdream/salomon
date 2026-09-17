/**
 * Normal-field row orientation contract:
 *
 * terrainUv.ts maps grid rows with `v = 1 - row / (rows - 1)` to match aerial
 * textures loaded with TextureLoader's default `flipY = true`. DataTexture,
 * however, defaults to `flipY = false`, so data row 0 is sampled at v=0. That
 * v coordinate belongs to grid row `rows - 1` (the southern edge). Encoding in
 * `bottom-up` order is therefore required to align a DataTexture normal map
 * geographically with the aerial texture. Omitting the reversal flips the
 * normal map north-to-south.
 */
import * as THREE from 'three';
import type {
  CanopyDetailNormalConfig,
  TangentNormalField,
  TerrainSurfaceConfig,
  TerrainSurfaceFlags,
} from '../types';

function assertPositiveDimensions(cols: number, rows: number): void {
  if (
    !Number.isInteger(cols) ||
    !Number.isInteger(rows) ||
    cols <= 0 ||
    rows <= 0
  ) {
    throw new RangeError('Normal field dimensions must be positive integers.');
  }
}

function assertValidField(field: TangentNormalField): void {
  assertPositiveDimensions(field.cols, field.rows);
  if (field.values.length !== field.cols * field.rows * 3) {
    throw new RangeError('Normal field values length does not match its dimensions.');
  }
}

function writeNormalized(
  values: Float32Array,
  offset: number,
  x: number,
  y: number,
  z: number,
): void {
  const length = Math.hypot(x, y, z);
  if (length === 0) {
    values[offset] = 0;
    values[offset + 1] = 0;
    values[offset + 2] = 1;
    return;
  }

  values[offset] = x / length;
  values[offset + 1] = y / length;
  values[offset + 2] = z / length;
}

export function resolveNormalFieldTargetSize(
  config: Pick<TerrainSurfaceConfig, 'normalMapResolution' | 'canopy'>,
  flags: Pick<TerrainSurfaceFlags, 'canopyDetailNormal'>,
  canopyResolutionOverride?: number,
): number {
  const canopy: CanopyDetailNormalConfig = config.canopy;
  return flags.canopyDetailNormal
    ? (canopyResolutionOverride ?? canopy.resolution)
    : config.normalMapResolution;
}

export function resampleTangentNormalField(
  field: TangentNormalField,
  cols: number,
  rows: number,
): TangentNormalField {
  assertValidField(field);
  assertPositiveDimensions(cols, rows);

  if (cols === field.cols && rows === field.rows) {
    return { cols, rows, values: new Float32Array(field.values) };
  }

  const values = new Float32Array(cols * rows * 3);
  const sourceColScale = cols === 1 ? 0 : (field.cols - 1) / (cols - 1);
  const sourceRowScale = rows === 1 ? 0 : (field.rows - 1) / (rows - 1);

  for (let row = 0; row < rows; row += 1) {
    const sourceRow = row * sourceRowScale;
    const row0 = Math.floor(sourceRow);
    const row1 = Math.min(row0 + 1, field.rows - 1);
    const rowMix = sourceRow - row0;

    for (let col = 0; col < cols; col += 1) {
      const sourceCol = col * sourceColScale;
      const col0 = Math.floor(sourceCol);
      const col1 = Math.min(col0 + 1, field.cols - 1);
      const colMix = sourceCol - col0;
      const topLeft = (row0 * field.cols + col0) * 3;
      const topRight = (row0 * field.cols + col1) * 3;
      const bottomLeft = (row1 * field.cols + col0) * 3;
      const bottomRight = (row1 * field.cols + col1) * 3;
      const outputOffset = (row * cols + col) * 3;

      const topX = field.values[topLeft] * (1 - colMix) + field.values[topRight] * colMix;
      const topY = field.values[topLeft + 1] * (1 - colMix) + field.values[topRight + 1] * colMix;
      const topZ = field.values[topLeft + 2] * (1 - colMix) + field.values[topRight + 2] * colMix;
      const bottomX = field.values[bottomLeft] * (1 - colMix) + field.values[bottomRight] * colMix;
      const bottomY = field.values[bottomLeft + 1] * (1 - colMix) + field.values[bottomRight + 1] * colMix;
      const bottomZ = field.values[bottomLeft + 2] * (1 - colMix) + field.values[bottomRight + 2] * colMix;

      writeNormalized(
        values,
        outputOffset,
        topX * (1 - rowMix) + bottomX * rowMix,
        topY * (1 - rowMix) + bottomY * rowMix,
        topZ * (1 - rowMix) + bottomZ * rowMix,
      );
    }
  }

  return { cols, rows, values };
}

export function combineTangentNormalFields(
  base: TangentNormalField,
  detail: TangentNormalField,
  weight: number,
): TangentNormalField {
  assertValidField(base);
  assertValidField(detail);
  if (base.cols !== detail.cols || base.rows !== detail.rows) {
    throw new RangeError('Normal field dimensions must match.');
  }

  if (weight === 0) {
    return {
      cols: base.cols,
      rows: base.rows,
      values: new Float32Array(base.values),
    };
  }

  const values = new Float32Array(base.values.length);
  for (let offset = 0; offset < values.length; offset += 3) {
    writeNormalized(
      values,
      offset,
      base.values[offset] + detail.values[offset] * weight,
      base.values[offset + 1] + detail.values[offset + 1] * weight,
      base.values[offset + 2],
    );
  }

  return { cols: base.cols, rows: base.rows, values };
}

export function encodeTangentNormalFieldToRgba(
  field: TangentNormalField,
  options: { rowOrder?: 'top-down' | 'bottom-up' } = {},
): Uint8ClampedArray {
  assertValidField(field);
  const rgba = new Uint8ClampedArray(field.cols * field.rows * 4);
  const rowOrder = options.rowOrder ?? 'top-down';

  for (let dataRow = 0; dataRow < field.rows; dataRow += 1) {
    const fieldRow = rowOrder === 'bottom-up'
      ? field.rows - 1 - dataRow
      : dataRow;

    for (let col = 0; col < field.cols; col += 1) {
      const fieldOffset = (fieldRow * field.cols + col) * 3;
      const dataOffset = (dataRow * field.cols + col) * 4;
      rgba[dataOffset] = Math.round((field.values[fieldOffset] * 0.5 + 0.5) * 255);
      rgba[dataOffset + 1] = Math.round((field.values[fieldOffset + 1] * 0.5 + 0.5) * 255);
      rgba[dataOffset + 2] = Math.round((field.values[fieldOffset + 2] * 0.5 + 0.5) * 255);
      rgba[dataOffset + 3] = 255;
    }
  }

  return rgba;
}

export function createNormalMapDataTexture(
  rgba: Uint8ClampedArray,
  cols: number,
  rows: number,
  maxAnisotropy?: number,
): THREE.DataTexture {
  const texture = new THREE.DataTexture(
    rgba,
    cols,
    rows,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.flipY = false;
  if (maxAnisotropy !== undefined) {
    texture.anisotropy = Math.min(maxAnisotropy, 16);
  }
  texture.needsUpdate = true;
  return texture;
}
