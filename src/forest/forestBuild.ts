import type * as THREE from 'three';

import type { ForestVariantId } from '../types';

export interface ForestBuildStats {
  variantId: ForestVariantId;
  instanceCount: number;
  trianglesPerInstance: number;
  totalTriangles: number;
  drawCalls: number;
  instanceMatrixBytes: number;
  textureBytes: number;
  buildElapsedMs: number;
}

export interface ForestVariantBuild {
  readonly stats: ForestBuildStats;
  readonly object3D: THREE.Object3D;
  dispose(): void;
}

export function createSingleMeshBuild(args: {
  mesh: THREE.InstancedMesh;
  stats: ForestBuildStats;
  textures?: readonly THREE.Texture[];
}): ForestVariantBuild {
  const { mesh, stats, textures = [] } = args;
  let disposed = false;

  return {
    stats,
    object3D: mesh,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      mesh.removeFromParent();
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        for (const material of mesh.material) material.dispose();
      } else {
        mesh.material.dispose();
      }
      for (const texture of textures) texture.dispose();
    },
  };
}
