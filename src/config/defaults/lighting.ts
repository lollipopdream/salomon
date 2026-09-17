import type { LightingConfig } from '../../types';

export const lightingDefaults: LightingConfig = {
  hemisphereSkyColor: 0x9fc4e8,
  hemisphereGroundColor: 0x5a6b4a,
  hemisphereIntensity: 1.05,
  directionalColor: 0xfff4e2,
  directionalIntensity: 2.4,
  directionalPosition: { x: -3600, y: 3200, z: -2400 },
};
