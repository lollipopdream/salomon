import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { forestDefaults } from '../config/defaults/forest';
import { createTreeGeometry } from './treeGeometry';

function attributeBytes(attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): Uint8Array {
  return new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength);
}

describe('createTreeGeometry', () => {
  it('creates the fixed 30-triangle normalized tree geometry', () => {
    const geometry = createTreeGeometry(forestDefaults.tree);
    const indexCount = geometry.index?.count ?? 0;

    expect(indexCount).toBe(90);
    expect(geometry.getAttribute('position').count).toBe(34);
  });

  it('fits its normalized crown dimensions and has matching vertex attributes', () => {
    const geometry = createTreeGeometry(forestDefaults.tree);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const position = geometry.getAttribute('position');
    const color = geometry.getAttribute('color');
    const normal = geometry.getAttribute('normal');

    expect(box.min.y).toBeCloseTo(0);
    expect(box.max.y).toBeCloseTo(1);
    expect(box.min.x).toBeGreaterThanOrEqual(-forestDefaults.tree.crownRadiusRatio);
    expect(box.max.x).toBeLessThanOrEqual(forestDefaults.tree.crownRadiusRatio);
    expect(box.min.z).toBeGreaterThanOrEqual(-forestDefaults.tree.crownRadiusRatio);
    expect(box.max.z).toBeLessThanOrEqual(forestDefaults.tree.crownRadiusRatio);
    expect(color.count).toBe(position.count);
    expect(normal.count).toBe(position.count);
  });

  it('bakes the crown top-to-bottom shade into vertex colors', () => {
    const config = forestDefaults.tree;
    const geometry = createTreeGeometry(config);
    const position = geometry.getAttribute('position');
    const color = geometry.getAttribute('color');
    const expectedCrown = new THREE.Color(config.crownColor);
    const topColors: number[][] = [];
    const bottomColors: number[][] = [];

    for (let index = 0; index < position.count; index += 1) {
      const value = [color.getX(index), color.getY(index), color.getZ(index)];
      if (Math.abs(position.getY(index) - 1) < 1e-6) topColors.push(value);
      if (
        Math.abs(position.getY(index) - config.crownBaseRatio) < 1e-6 &&
        Math.abs(position.getX(index)) > config.trunkRadiusRatio
      ) bottomColors.push(value);
    }

    expect(topColors.length).toBeGreaterThan(0);
    expect(bottomColors.length).toBeGreaterThan(0);
    for (const value of topColors) {
      expect(value[0]).toBeCloseTo(expectedCrown.r, 6);
      expect(value[1]).toBeCloseTo(expectedCrown.g, 6);
      expect(value[2]).toBeCloseTo(expectedCrown.b, 6);
    }
    expect(bottomColors[0][0]).toBeCloseTo(expectedCrown.r * config.crownBottomShade, 6);
    expect(bottomColors[0][1]).toBeCloseTo(expectedCrown.g * config.crownBottomShade, 6);
    expect(bottomColors[0][2]).toBeCloseTo(expectedCrown.b * config.crownBottomShade, 6);
  });

  it('is byte-identical for the same config', () => {
    const first = createTreeGeometry(forestDefaults.tree);
    const second = createTreeGeometry(forestDefaults.tree);

    for (const name of ['position', 'normal', 'color'] as const) {
      expect(attributeBytes(first.getAttribute(name))).toEqual(attributeBytes(second.getAttribute(name)));
    }
    expect(attributeBytes(first.index!)).toEqual(attributeBytes(second.index!));
  });
});
