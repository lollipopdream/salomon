import { describe, expect, it } from 'vitest';

import { backgroundDefaults } from './background';
import { terrainMaterialDefaults } from './terrainVisual';

describe('terrainMaterialDefaults', () => {
  it('retains the terrain material defaults after lighting is separated', () => {
    expect(terrainMaterialDefaults).toMatchObject({
      lowElevationColor: 0x707d68,
      highElevationColor: 0xc9c2ab,
      roughness: 0.85,
      metalness: 0.06,
      hillshadeMinFactor: 0.42,
      hillshadeMaxFactor: 1.5,
    });
  });

  it('configures a light texture hillshade overlay, tint, and color adjustment', () => {
    expect(terrainMaterialDefaults).toMatchObject({
      textureHillshadeMinFactor: 0.42,
      textureHillshadeMaxFactor: 1.32,
      textureTintStrength: 0.22,
      textureColorAdjust: {
        saturation: 0.88,
        contrast: 1.32,
        brightness: 0.97,
      },
    });
  });

  it('uses the daylight fog color for terrain edge fade', () => {
    expect(terrainMaterialDefaults.edgeFade?.fadeColor).toBe(0xc3d6e4);
  });

  it('keeps terrain edge fade synchronized with the background fog color', () => {
    expect(terrainMaterialDefaults.edgeFade?.fadeColor).toBe(
      backgroundDefaults.fogColor,
    );
  });
});
