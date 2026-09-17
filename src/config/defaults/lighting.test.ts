import { describe, expect, it } from 'vitest';

import type { LightingConfig, Vec3 } from '../../types';
import { lightingDefaults } from './lighting';

const OLD_LIGHTING = {
  hemisphereSkyColor: 0x16222f,
  hemisphereGroundColor: 0x1a2a20,
  hemisphereIntensity: 0.35,
} as const;

const TERRAIN_SURFACE_COLOR = 0x657454;
const TERRAIN_NORMAL: Vec3 = {
  x: 0.7205766921228921,
  y: 0.5,
  z: 0.48038446141526137,
};

function srgbChannelToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function hexToLinearRgb(color: number): readonly [number, number, number] {
  return [
    srgbChannelToLinear((color >> 16) & 0xff),
    srgbChannelToLinear((color >> 8) & 0xff),
    srgbChannelToLinear(color & 0xff),
  ];
}

function normalize(vector: Vec3): Vec3 {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function computeHemisphereOnlyBrightness(
  lighting: Pick<
    LightingConfig,
    | 'hemisphereSkyColor'
    | 'hemisphereGroundColor'
    | 'hemisphereIntensity'
  >,
): number {
  const surface = hexToLinearRgb(TERRAIN_SURFACE_COLOR);
  const sky = hexToLinearRgb(lighting.hemisphereSkyColor);
  const ground = hexToLinearRgb(lighting.hemisphereGroundColor);
  const skyWeight = TERRAIN_NORMAL.y * 0.5 + 0.5;
  const lit = surface.map((channel, index) => {
    const hemisphereColor =
      ground[index] * (1 - skyWeight) + sky[index] * skyWeight;
    return channel * hemisphereColor * lighting.hemisphereIntensity;
  });

  return lit[0] * 0.2126 + lit[1] * 0.7152 + lit[2] * 0.0722;
}

describe('lightingDefaults', () => {
  it('meaningfully raises the brightness floor when directional NdotL is zero', () => {
    const directionalNdotL = Math.max(
      0,
      dot(TERRAIN_NORMAL, normalize(lightingDefaults.directionalPosition)),
    );
    const oldFloor = computeHemisphereOnlyBrightness(OLD_LIGHTING);
    const newFloor = computeHemisphereOnlyBrightness(lightingDefaults);

    expect(directionalNdotL).toBe(0);
    expect(newFloor).toBeGreaterThan(oldFloor * 10);
  });

  it('retains a meaningfully stronger directional key for terrain relief', () => {
    expect(lightingDefaults.directionalIntensity).toBeGreaterThan(
      lightingDefaults.hemisphereIntensity * 1.5,
    );
  });

  it('guards the daylight palette against warm color regression', () => {
    // 青成分を明示的に守り、太陽光と空の昼光パレットを維持する。
    const directionalRed = (lightingDefaults.directionalColor >> 16) & 0xff;
    const directionalBlue = lightingDefaults.directionalColor & 0xff;
    const skyRed = (lightingDefaults.hemisphereSkyColor >> 16) & 0xff;
    const skyBlue = lightingDefaults.hemisphereSkyColor & 0xff;

    expect(directionalBlue).toBeGreaterThanOrEqual(0.85 * directionalRed);
    expect(skyBlue).toBeGreaterThan(skyRed);
  });
});
