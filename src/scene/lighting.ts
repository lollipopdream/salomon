// Three.js integration function excluded from unit testing.
import * as THREE from 'three';
import type { LightingConfig } from '../types';

export function createSceneLights(config: LightingConfig): {
  hemisphere: THREE.HemisphereLight;
  directional: THREE.DirectionalLight;
} {
  const hemisphere = new THREE.HemisphereLight(
    config.hemisphereSkyColor,
    config.hemisphereGroundColor,
    config.hemisphereIntensity,
  );
  const directional = new THREE.DirectionalLight(
    config.directionalColor,
    config.directionalIntensity,
  );
  directional.position.set(
    config.directionalPosition.x,
    config.directionalPosition.y,
    config.directionalPosition.z,
  );

  return { hemisphere, directional };
}
