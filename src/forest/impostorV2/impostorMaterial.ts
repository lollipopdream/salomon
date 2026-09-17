import * as THREE from 'three';

import { applyR10DepthHaze } from './r10DepthHaze';
import { applyR10TonePreset } from './r10TonePreset';
import type { ImpostorMaterialMode } from './types';

export function configureImpostorTexture(texture: THREE.Texture): THREE.Texture {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.premultiplyAlpha = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function createImpostorMaterial(
  texture: THREE.Texture,
  alphaTest: number,
  kind: 'grove' | 'tree',
  mode: ImpostorMaterialMode = 'lambert',
  tone = false,
  haze = false,
): THREE.MeshLambertMaterial | THREE.MeshBasicMaterial {
  const parameters: THREE.MeshLambertMaterialParameters & THREE.MeshBasicMaterialParameters = {
    map: texture,
    alphaTest,
    transparent: false,
    depthWrite: true,
    depthTest: true,
    side: THREE.DoubleSide,
    vertexColors: false,
    fog: true,
  };
  const material = mode === 'unlit'
    ? new THREE.MeshBasicMaterial(parameters)
    : new THREE.MeshLambertMaterial(parameters);
  if (tone) {
    const color = applyR10TonePreset({ r: 1, g: 1, b: 1 }, true);
    material.color.setRGB(color.r, color.g, color.b);
  }
  material.premultipliedAlpha = false;
  material.name = mode === 'unlit'
    ? `forest-impostor-v2-${kind}-unlit`
    : `forest-impostor-v2-${kind}`;
  applyR10DepthHaze(material, haze);
  return material;
}
