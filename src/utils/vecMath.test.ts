import { describe, expect, it } from 'vitest';

import {
  addVec3,
  clamp01,
  easeOutQuart,
  lengthVec3,
  lerpVec3,
  normalizeVec3,
  rotateAroundY,
  scaleVec3,
  smootherstep,
  smoothstep,
  subtractVec3,
} from './vecMath';

describe('vecMath', () => {
  it('adds vectors component-wise', () => {
    expect(addVec3({ x: 1, y: -2, z: 3 }, { x: 4, y: 5, z: -6 })).toEqual({
      x: 5,
      y: 3,
      z: -3,
    });
  });

  it('subtracts vectors component-wise', () => {
    expect(
      subtractVec3({ x: 5, y: 3, z: -3 }, { x: 4, y: 5, z: -6 }),
    ).toEqual({ x: 1, y: -2, z: 3 });
  });

  it('scales every vector component', () => {
    expect(scaleVec3({ x: 2, y: -3, z: 4 }, 0.5)).toEqual({
      x: 1,
      y: -1.5,
      z: 2,
    });
  });

  it('interpolates vectors at both endpoints and without clamping', () => {
    const a = { x: 1, y: 2, z: 3 };
    const b = { x: 5, y: 6, z: 7 };

    expect(lerpVec3(a, b, 0)).toEqual(a);
    expect(lerpVec3(a, b, 1)).toEqual(b);
    expect(lerpVec3(a, b, 1.5)).toEqual({ x: 7, y: 8, z: 9 });
  });

  it('computes vector length', () => {
    expect(lengthVec3({ x: 2, y: -3, z: 6 })).toBe(7);
  });

  it('normalizes a non-zero vector', () => {
    const normalized = normalizeVec3({ x: 0, y: 3, z: 4 });

    expect(normalized.x).toBeCloseTo(0);
    expect(normalized.y).toBeCloseTo(0.6);
    expect(normalized.z).toBeCloseTo(0.8);
  });

  it('returns the default fallback for a zero or extremely small vector', () => {
    expect(normalizeVec3({ x: 0, y: 0, z: 0 })).toEqual({
      x: 0,
      y: 0,
      z: 1,
    });
    expect(normalizeVec3({ x: 1e-12, y: 0, z: 0 })).toEqual({
      x: 0,
      y: 0,
      z: 1,
    });
  });

  it('returns an explicit fallback for a zero vector', () => {
    expect(
      normalizeVec3({ x: 0, y: 0, z: 0 }, { x: 1, y: 2, z: 3 }),
    ).toEqual({ x: 1, y: 2, z: 3 });
  });

  it.each([
    [90, { x: 0, y: 4, z: -2 }],
    [180, { x: -2, y: 4, z: 0 }],
    [360, { x: 2, y: 4, z: 0 }],
  ])('rotates a point %s degrees around the Y axis', (degrees, expected) => {
    const rotated = rotateAroundY(
      { x: 2, y: 4, z: 0 },
      { x: 0, y: 0, z: 0 },
      (degrees * Math.PI) / 180,
    );

    expect(rotated.x).toBeCloseTo(expected.x);
    expect(rotated.y).toBeCloseTo(expected.y);
    expect(rotated.z).toBeCloseTo(expected.z);
  });

  it('rotates around a non-origin center', () => {
    const rotated = rotateAroundY(
      { x: 12, y: 7, z: 3 },
      { x: 10, y: 99, z: 3 },
      Math.PI / 2,
    );

    expect(rotated.x).toBeCloseTo(10);
    expect(rotated.z).toBeCloseTo(1);
  });

  it('keeps the point Y coordinate unchanged', () => {
    expect(
      rotateAroundY(
        { x: 12, y: 7, z: 3 },
        { x: 10, y: 99, z: 3 },
        Math.PI / 3,
      ).y,
    ).toBe(7);
  });

  it.each([
    [-1, 0],
    [0, 0],
    [0.25, 0.25],
    [1, 1],
    [2, 1],
  ])('clamps %s to %s', (value, expected) => {
    expect(clamp01(value)).toBe(expected);
  });

  it.each([
    [0, 0],
    [1, 1],
    [0.5, 0.5],
    [-0.5, 0],
    [1.5, 1],
  ])('smoothsteps %s to %s', (value, expected) => {
    expect(smoothstep(value)).toBe(expected);
  });

  it.each([
    [0, 0],
    [1, 1],
    [0.5, 0.5],
  ])('smoothersteps %s to %s', (value, expected) => {
    expect(smootherstep(value)).toBe(expected);
  });

  it('gives smootherstep a steeper S-curve than smoothstep', () => {
    expect(smootherstep(0.25)).toBeLessThan(smoothstep(0.25));
    expect(smootherstep(0.75)).toBeGreaterThan(smoothstep(0.75));
    expect(0.25 - smootherstep(0.25)).toBeGreaterThan(
      0.25 - smoothstep(0.25),
    );
  });

  it.each([
    [0, 0],
    [1, 1],
  ])('easeOutQuart maps %s to %s', (value, expected) => {
    expect(easeOutQuart(value)).toBe(expected);
  });

  it('makes easeOutQuart monotonically increasing', () => {
    const samples = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1].map(easeOutQuart);

    for (let i = 1; i < samples.length; i += 1) {
      expect(samples[i]).toBeGreaterThan(samples[i - 1]);
    }
  });

  it('gives easeOutQuart a decreasing slope near the end', () => {
    const middleDelta = easeOutQuart(0.5) - easeOutQuart(0.49);
    const endDelta = easeOutQuart(1) - easeOutQuart(0.99);

    expect(endDelta).toBeLessThan(middleDelta);
  });
});
