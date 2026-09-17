import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { farCanopyDefaults } from '../../config/defaults/farCanopy';
import { defaultSettings } from '../../config/settings';
import { createFarCanopyOverlay } from '../farCanopyOverlay';
import { createGroveTopCapMaterial } from './groveTopCapMeshes';
import { applyR10TonePreset, R10_TONE_PRESET } from './r10TonePreset';

describe('R10 forest-only tone preset', () => {
  it('uses the measured per-channel linear targets', () => {
    expect(R10_TONE_PRESET.linearGain).toEqual({ r: 1.234, g: 1.271, b: 1.388 });
  });

  it('is deterministic, finite, and does not mutate its input', () => {
    const input = Object.freeze({ r: 0.25, g: 0.5, b: 0.75 });
    const before = { ...input };
    const first = applyR10TonePreset(input, true);
    const second = applyR10TonePreset(input, true);
    expect(input).toEqual(before);
    expect(first).not.toBe(input);
    expect(second).toEqual(first);
    expect(Object.values(first).every(Number.isFinite)).toBe(true);
  });

  it('fails finite for non-finite channel inputs without mutating them', () => {
    const input = { r: Number.NaN, g: Number.POSITIVE_INFINITY, b: Number.NEGATIVE_INFINITY };
    const output = applyR10TonePreset(input, true);
    expect(Number.isNaN(input.r)).toBe(true);
    expect(input.g).toBe(Number.POSITIVE_INFINITY);
    expect(input.b).toBe(Number.NEGATIVE_INFINITY);
    expect(Object.values(output).every(Number.isFinite)).toBe(true);
  });

  it('preserves macro-shade ordering and contrast ratio under the uniform layer lift', () => {
    const dark = applyR10TonePreset({ r: 0.35, g: 0.35, b: 0.35 }, true);
    const bright = applyR10TonePreset({ r: 1.4, g: 1.4, b: 1.4 }, true);
    for (const channel of ['r', 'g', 'b'] as const) {
      expect(bright[channel]).toBeGreaterThan(dark[channel]);
      expect(bright[channel] / dark[channel]).toBeCloseTo(4, 12);
    }
  });

  it('applies the same expected gains to top-cap and FAR materials', () => {
    const topCap = createGroveTopCapMaterial(new THREE.Texture(), 0.45, true);
    const far = createFarCanopyOverlay({
      grid: { values: new Float32Array(4), cols: 2, rows: 2, cellSizeMeters: 1,
        bounds: { north: 1, south: 0, east: 1, west: 0 } },
      settings: defaultSettings,
      config: { ...farCanopyDefaults, extentMeters: 1 },
      texture: new THREE.Texture(),
      tone: true,
    });
    for (const material of [topCap, far.material]) {
      expect(material.color.r).toBeCloseTo(R10_TONE_PRESET.linearGain.r, 12);
      expect(material.color.g).toBeCloseTo(R10_TONE_PRESET.linearGain.g, 12);
      expect(material.color.b).toBeCloseTo(R10_TONE_PRESET.linearGain.b, 12);
    }
    far.geometry.dispose();
    far.material.dispose();
    topCap.dispose();
  });

  it('keeps top-cap and FAR material colors at exact white when tone is off', () => {
    const topCap = createGroveTopCapMaterial(new THREE.Texture(), 0.45);
    const far = createFarCanopyOverlay({
      grid: { values: new Float32Array(4), cols: 2, rows: 2, cellSizeMeters: 1,
        bounds: { north: 1, south: 0, east: 1, west: 0 } },
      settings: defaultSettings,
      config: { ...farCanopyDefaults, extentMeters: 1 },
      texture: new THREE.Texture(),
    });
    for (const material of [topCap, far.material]) {
      expect(material.color.r).toBe(1);
      expect(material.color.g).toBe(1);
      expect(material.color.b).toBe(1);
    }
    far.geometry.dispose();
    far.material.dispose();
    topCap.dispose();
  });
});
