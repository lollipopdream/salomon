import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { forestDefaults } from '../config/defaults/forest';
import { createCanopyBlobGeometry } from './canopyBlobGeometry';

function attributeBytes(attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): Uint8Array {
  return new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength);
}

describe('createCanopyBlobGeometry', () => {
  it('uses the requested icosahedron subdivision triangle count', () => {
    expect(createCanopyBlobGeometry(forestDefaults.canopy).getAttribute('position').count / 3).toBe(20);
    expect(createCanopyBlobGeometry({ ...forestDefaults.canopy, subdivision: 1 })
      .getAttribute('position').count / 3).toBe(80);
  });

  it('keeps every pre-flattened radial distance within the configured noisy shell', () => {
    const config = forestDefaults.canopy;
    const position = createCanopyBlobGeometry(config).getAttribute('position');

    for (let index = 0; index < position.count; index += 1) {
      const radius = Math.hypot(
        position.getX(index),
        (position.getY(index) - config.sinkRatio) / config.heightRatio,
        position.getZ(index),
      );
      expect(radius).toBeGreaterThanOrEqual(1 - config.lumpiness - 1e-6);
      expect(radius).toBeLessThanOrEqual(1 + config.lumpiness + 1e-6);
    }
  });

  it('applies the configured vertical flattening and upward ground offset to every vertex', () => {
    const config = { ...forestDefaults.canopy, lumpiness: 0 };
    const geometry = createCanopyBlobGeometry(config);
    const source = new THREE.IcosahedronGeometry(1, config.subdivision);
    geometry.computeBoundingBox();
    source.computeBoundingBox();

    expect(geometry.boundingBox!.min.y).toBeCloseTo(
      source.boundingBox!.min.y * config.heightRatio + config.sinkRatio,
      6,
    );
    expect(geometry.boundingBox!.max.y).toBeCloseTo(
      source.boundingBox!.max.y * config.heightRatio + config.sinkRatio,
      6,
    );
    source.dispose();
  });

  it('keeps the default blob mostly above ground', () => {
    const geometry = createCanopyBlobGeometry(forestDefaults.canopy);
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox!;

    expect(bounds.min.y).toBeCloseTo(-0.283765, 6);
    expect(bounds.max.y).toBeCloseTo(0.979579, 6);
    expect(bounds.max.y).toBeGreaterThan(0);
    expect(bounds.max.y).toBeGreaterThan(Math.abs(bounds.min.y));
  });

  it('keeps the default blob burial fraction within the intended range', () => {
    const geometry = createCanopyBlobGeometry(forestDefaults.canopy);
    geometry.computeBoundingBox();
    const { min, max } = geometry.boundingBox!;
    const buriedFraction = -min.y / (max.y - min.y);

    expect(buriedFraction).toBeGreaterThanOrEqual(0.10);
    expect(buriedFraction).toBeLessThanOrEqual(0.40);
  });

  it('bakes the configured top-to-bottom color gradient', () => {
    const config = forestDefaults.canopy;
    const geometry = createCanopyBlobGeometry(config);
    const position = geometry.getAttribute('position');
    const color = geometry.getAttribute('color');
    const base = new THREE.Color(config.color);
    let minY = Infinity;
    let maxY = -Infinity;

    for (let index = 0; index < position.count; index += 1) {
      minY = Math.min(minY, position.getY(index));
      maxY = Math.max(maxY, position.getY(index));
    }
    for (let index = 0; index < position.count; index += 1) {
      const shade = (position.getY(index) - minY) / (maxY - minY);
      const expected = config.bottomShade + (1 - config.bottomShade) * shade;
      expect(color.getX(index)).toBeCloseTo(base.r * expected, 6);
      expect(color.getY(index)).toBeCloseTo(base.g * expected, 6);
      expect(color.getZ(index)).toBeCloseTo(base.b * expected, 6);
    }
  });

  it('is byte-identical for the same config and includes matching normals', () => {
    const first = createCanopyBlobGeometry(forestDefaults.canopy);
    const second = createCanopyBlobGeometry(forestDefaults.canopy);

    for (const name of ['position', 'normal', 'color'] as const) {
      expect(attributeBytes(first.getAttribute(name))).toEqual(attributeBytes(second.getAttribute(name)));
    }
    expect(first.getAttribute('normal').count).toBe(first.getAttribute('position').count);
  });
});
