import * as THREE from 'three';

import {
  loadImpostorAssets,
  type ImpostorAssets,
} from '../../forest/impostorV2/impostorAssets';
import { createCrossedQuadGeometry } from '../../forest/impostorV2/impostorGeometry';
import { createImpostorMaterial } from '../../forest/impostorV2/impostorMaterial';
import type { ImpostorCellRef } from '../../forest/impostorV2/types';
import { forestImpostorV2Defaults } from '../../config/defaults/forestImpostorV2';
import { IMPOSTOR_V2_SIDE_ASSET_CONFIG } from '../scene/labDataSources';
import type { DetailPlacement } from './detailPlacement';

const GROVE_VARIANTS = forestImpostorV2Defaults.cellSelection.grove.configs;
const TREE_VARIANTS = forestImpostorV2Defaults.cellSelection.tree.variants;
const YAW_DEGREES = forestImpostorV2Defaults.cellSelection.grove.yawDegrees;

export interface LoadDetailAssetsDependencies {
  fetchJson?: (url: string) => Promise<unknown>;
  loadTexture?: (url: string) => Promise<THREE.Texture>;
}

export type DetailMeshPlacement = Pick<
  DetailPlacement,
  'cx' | 'cz' | 'kind' | 'variantIndex' | 'yawIndex'
>;

export function loadDetailAssets(
  dependencies: LoadDetailAssetsDependencies = {},
): Promise<ImpostorAssets> {
  return loadImpostorAssets({
    config: IMPOSTOR_V2_SIDE_ASSET_CONFIG,
    kinds: 'both',
    ...dependencies,
  });
}

function selectedCell(
  cells: readonly ImpostorCellRef[],
  placement: DetailMeshPlacement,
): ImpostorCellRef {
  const identity = placement.kind === 'grove'
    ? GROVE_VARIANTS[placement.variantIndex]
    : TREE_VARIANTS[placement.variantIndex];
  const yaw = YAW_DEGREES[placement.yawIndex];
  const cell = cells.find((candidate) =>
    candidate.kind === placement.kind
    && (placement.kind === 'grove'
      ? candidate.groveConfig === identity
      : candidate.sourceVariant === identity)
    && candidate.yawDeg === yaw
  );
  if (!cell) {
    throw new RangeError(
      `Missing ${placement.kind} atlas cell for variant ${placement.variantIndex}, yaw ${placement.yawIndex}.`,
    );
  }
  return cell;
}

export function createDetailMeshes(args: {
  assets: ImpostorAssets;
  placements: readonly DetailMeshPlacement[];
  terrainYAt: (x: number, z: number) => number;
}): THREE.InstancedMesh[] {
  const grouped = new Map<string, { cell: ImpostorCellRef; placements: DetailMeshPlacement[] }>();
  for (const placement of args.placements) {
    const cell = selectedCell(args.assets.cells, placement);
    const group = grouped.get(cell.key);
    if (group) group.placements.push(placement);
    else grouped.set(cell.key, { cell, placements: [placement] });
  }

  const meshes: THREE.InstancedMesh[] = [];
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const up = new THREE.Vector3(0, 1, 0);
  try {
    for (const { cell, placements } of grouped.values()) {
      const texture = args.assets.textures[cell.atlas];
      if (!texture) throw new Error(`Missing texture for ${cell.atlas} atlas.`);
      const alphaTest = cell.kind === 'grove'
        ? forestImpostorV2Defaults.material.groveAlphaTest
        : forestImpostorV2Defaults.material.treeAlphaTest;
      const geometry = createCrossedQuadGeometry(cell);
      const material = createImpostorMaterial(texture, alphaTest, cell.kind, 'unlit');
      const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
      mesh.name = `forest-lab-detail-${cell.key}`;
      mesh.frustumCulled = true;

      placements.forEach((placement, index) => {
        position.set(
          placement.cx,
          args.terrainYAt(placement.cx, placement.cz),
          placement.cz,
        );
        const yawDegrees = YAW_DEGREES[placement.yawIndex];
        rotation.setFromAxisAngle(up, THREE.MathUtils.degToRad(yawDegrees));
        scale.set(cell.tightWorldWidth, cell.tightWorldHeight, cell.tightWorldWidth);
        matrix.compose(position, rotation, scale);
        mesh.setMatrixAt(index, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      meshes.push(mesh);
    }
  } catch (error) {
    for (const mesh of meshes) {
      mesh.geometry.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) material.dispose();
    }
    throw error;
  }
  return meshes;
}

export function disposeDetailMeshes(
  meshes: readonly THREE.InstancedMesh[],
  assets: ImpostorAssets,
): void {
  for (const mesh of meshes) {
    mesh.removeFromParent();
    mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) material.dispose();
  }
  assets.dispose();
}
