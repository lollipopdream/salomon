import type { TerrainMaterialConfig } from '../../types';

import { assetUrl } from '../assetBase';

export const terrainMaterialDefaults: TerrainMaterialConfig = {
  lowElevationColor: 0x707d68,
  highElevationColor: 0xc9c2ab,
  roughness: 0.85,
  metalness: 0.06,
  hillshadeMinFactor: 0.42,
  hillshadeMaxFactor: 1.5,
  textureUrl: assetUrl('/data/terrain-texture/takao-aerial.webp'),
  textureHillshadeMinFactor: 0.42,
  textureHillshadeMaxFactor: 1.32,
  textureTintStrength: 0.22,
  textureColorAdjust: {
    saturation: 0.88,
    contrast: 1.32,
    brightness: 0.97,
  },
  edgeFade: {
    enabled: true,
    fadeStartFactor: 0.72,
    fadeColor: 0xc3d6e4,
  },
};
