import * as THREE from 'three';

/**
 * Load a terrain color texture from a local asset path such as
 * `/data/terrain-texture/takao.webp`. This function does not contact external
 * servers such as GSI directly at runtime.
 */
export async function loadTerrainTexture(
  url: string,
  maxAnisotropy?: number,
): Promise<THREE.Texture> {
  // This assumes the caller has already confirmed that a textureUrl is configured.
  // Deciding whether to call the loader belongs to future scene-integration work.
  const loader = new THREE.TextureLoader();

  // Intentionally do not catch loading or decoding errors: fallback decisions
  // belong to the caller in a separate future scene-integration task.
  const texture = await loader.loadAsync(url);

  texture.colorSpace = THREE.SRGBColorSpace;

  // Repeat wrapping keeps the texture ready for terrain tiling; the material
  // layer will choose the actual repeat count in future work.
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;

  // Linear magnification avoids blocky texels when the camera is close, while
  // trilinear mipmap filtering reduces shimmer and aliasing at terrain distance.
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;

  if (maxAnisotropy !== undefined) {
    texture.anisotropy = Math.min(maxAnisotropy, 16);
  }

  // Notify Three.js that the post-load color-space and sampler changes must be
  // applied on the next GPU upload.
  texture.needsUpdate = true;

  return texture;
}
