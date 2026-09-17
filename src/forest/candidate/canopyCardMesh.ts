import * as THREE from 'three';

import type { ForestCandidateConfig, ForestCandidatePlacementResult } from './types';

export interface CanopyCardMeshBuild {
  object3D: THREE.Object3D;
  meshes: THREE.InstancedMesh[];
  stats: {
    instanceCount: number;
    drawCalls: number;
    triangles: number;
    instanceBytes: number;
  };
  dispose(): void;
}

type MeshConfig = Pick<ForestCandidateConfig, 'material' | 'atlas'>;

const VERTEX_DECLARATIONS = `attribute vec2 aSize;
attribute vec4 aUvRect;
varying vec2 vCardUv;
`;

// `beginnormal_vertex` と `begin_vertex` は同じ main() スコープへ展開されるため、
// 両方で同名変数を宣言すると GLSL の再宣言エラーになる。billboard 基底ベクトルは
// 先に展開される NORMAL_BLOCK 側だけで一度宣言し、POSITION_BLOCK では再利用する
// (Lambert の chunk 順は beginnormal_vertex → begin_vertex で固定)。
const NORMAL_BLOCK = `vec3 fcInstancePosition = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
vec3 fcCamFwd = cameraPosition - fcInstancePosition;
fcCamFwd.y = 0.0;
float fcCamFwdLength = length(fcCamFwd);
fcCamFwd = fcCamFwdLength > 0.00001 ? fcCamFwd / fcCamFwdLength : vec3(0.0, 0.0, 1.0);
vec3 fcRightDir = vec3(fcCamFwd.z, 0.0, -fcCamFwd.x);
vec3 objectNormal = normalize(fcCamFwd * 0.5 + vec3(0.0, 1.0, 0.0) + fcRightDir * position.x * 1.3);`;

const POSITION_BLOCK = `vCardUv = aUvRect.xy + uv * aUvRect.zw;
vec3 transformed = fcRightDir * (position.x * aSize.x) + vec3(0.0, position.y * aSize.y, 0.0);`;

const FRAGMENT_DECLARATIONS = `varying vec2 vCardUv;
`;

const MAP_BLOCK = `vec4 sampledDiffuseColor = texture2D( map, vCardUv );
diffuseColor *= sampledDiffuseColor;`;

export function createCanopyCardMeshes(args: {
  placement: ForestCandidatePlacementResult;
  atlas: { texture: THREE.Texture; uvRects: Float32Array; columns: number };
  config: MeshConfig;
}): CanopyCardMeshBuild {
  const group = new THREE.Group();
  group.name = 'forest-candidate-canopy-cards';
  const meshes: THREE.InstancedMesh[] = [];

  try {
    for (let speciesIndex = 0; speciesIndex < 2; speciesIndex += 1) {
      const sourceIndices: number[] = [];
      for (let index = 0; index < args.placement.count; index += 1) {
        if (args.placement.speciesIndices[index] === speciesIndex) sourceIndices.push(index);
      }

      const geometry = createCardGeometry();
      const sizes = new Float32Array(sourceIndices.length * 2);
      const uvRects = new Float32Array(sourceIndices.length * 4);
      geometry.setAttribute('aSize', new THREE.InstancedBufferAttribute(sizes, 2));
      geometry.setAttribute('aUvRect', new THREE.InstancedBufferAttribute(uvRects, 4));
      const material = createCardMaterial(args.atlas.texture, args.config);
      const mesh = new THREE.InstancedMesh(geometry, material, sourceIndices.length);
      const matrix = new THREE.Matrix4();
      const color = new THREE.Color();

      for (let localIndex = 0; localIndex < sourceIndices.length; localIndex += 1) {
        const sourceIndex = sourceIndices[localIndex];
        sizes[localIndex * 2] = args.placement.sizes[sourceIndex * 2];
        sizes[localIndex * 2 + 1] = args.placement.sizes[sourceIndex * 2 + 1];
        const atlasCell = speciesIndex * args.atlas.columns
          + args.placement.variantIndices[sourceIndex];
        const atlasOffset = atlasCell * 4;
        uvRects.set(args.atlas.uvRects.subarray(atlasOffset, atlasOffset + 4), localIndex * 4);
        matrix.makeTranslation(
          args.placement.positions[sourceIndex * 3],
          args.placement.positions[sourceIndex * 3 + 1],
          args.placement.positions[sourceIndex * 3 + 2],
        );
        mesh.setMatrixAt(localIndex, matrix);
        setTintColor(color, speciesIndex, args.placement.tintUnits[sourceIndex], args.config);
        mesh.setColorAt(localIndex, color);
      }

      geometry.getAttribute('aSize').needsUpdate = true;
      geometry.getAttribute('aUvRect').needsUpdate = true;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.frustumCulled = false;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      mesh.name = speciesIndex === 0 ? 'forest-candidate-conifer' : 'forest-candidate-broadleaf';
      meshes.push(mesh);
      group.add(mesh);
    }
  } catch (error) {
    for (const mesh of meshes) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    throw error;
  }

  let disposed = false;
  return {
    object3D: group,
    meshes,
    stats: {
      instanceCount: args.placement.count,
      drawCalls: meshes.length,
      triangles: args.placement.count * 2,
      instanceBytes: args.placement.count * (64 + 8 + 16 + 12),
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      for (const mesh of meshes) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    },
  };
}

function createCardGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.5, 0, 0,
    0.5, 0, 0,
    0.5, 1, 0,
    -0.5, 1, 0,
  ], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([
    0, 0,
    1, 0,
    1, 1,
    0, 1,
  ], 2));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
  ], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  return geometry;
}

function createCardMaterial(texture: THREE.Texture, config: MeshConfig): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({
    map: texture,
    alphaTest: config.material.alphaTest,
    transparent: false,
    depthWrite: true,
    side: THREE.DoubleSide,
    // `vertexColors: true` は USE_COLOR を立てて `attribute vec3 color` を要求する。
    // この geometry は color attribute を持たないため全インスタンスが黒くなる。
    // per-instance tint は InstancedMesh.setColorAt 由来の USE_INSTANCING_COLOR
    // だけで有効になり、material 側の指定は不要。
    vertexColors: false,
    fog: true,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = VERTEX_DECLARATIONS + shader.vertexShader
      .replace('#include <beginnormal_vertex>', NORMAL_BLOCK)
      .replace('#include <begin_vertex>', POSITION_BLOCK);
    shader.fragmentShader = FRAGMENT_DECLARATIONS + shader.fragmentShader
      .replace('#include <map_fragment>', MAP_BLOCK);
  };
  material.customProgramCacheKey = () => 'forest-candidate-canopy-card-v1';
  return material;
}

function setTintColor(
  target: THREE.Color,
  speciesIndex: number,
  tintUnit: number,
  config: MeshConfig,
): void {
  target.set(speciesIndex === 0 ? config.material.coniferTint : config.material.broadleafTint);
  const hsl = { h: 0, s: 0, l: 0 };
  target.getHSL(hsl);
  const variation = (tintUnit - 0.5) * config.material.tintJitter;
  target.setHSL(
    (hsl.h + variation * 0.04 + 1) % 1,
    THREE.MathUtils.clamp(hsl.s * (1 + variation * 0.2), 0, 1),
    THREE.MathUtils.clamp(hsl.l * (1 + variation), 0, 1),
  );
}
