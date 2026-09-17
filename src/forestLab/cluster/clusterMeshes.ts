import * as THREE from 'three';

import { forestImpostorV2Defaults } from '../../config/defaults/forestImpostorV2';
import type { ImpostorAssets } from '../../forest/impostorV2/impostorAssets';
import type { ImpostorCellRef } from '../../forest/impostorV2/types';
import { createGroveTopCapGeometry } from '../../forest/impostorV2/groveTopCapGeometry';
import { createGroveTopCapMaterial } from '../../forest/impostorV2/groveTopCapMeshes';
import { hashIndexTo01 } from '../../forest/forestRandom';
import { createCrossedQuadGeometry } from '../../forest/impostorV2/impostorGeometry';
import { createBiViewCrossedQuadGeometry, PLANE_B_BAKE_YAW_OFFSET_DEG } from './biViewGeometry';
import { createImpostorMaterial } from '../../forest/impostorV2/impostorMaterial';
import type { ClusterRuntimeStats } from '../labTypes';
import type { ClusterAssets, ClusterTopCapAssets } from './clusterAssets';
import { MEMBER_KIND_GROVE } from './clusterTypes';
import type { ClusterPlacementResult } from './clusterTypes';

export interface ClusterMeshSet {
  meshes: THREE.InstancedMesh[];
  applyVisibility(visibility: Uint8Array): number;
  stats: ClusterRuntimeStats;
  dispose(): void;
}

interface CellMeshData {
  mesh: THREE.InstancedMesh;
  matrices: Float32Array;
  colors?: Float32Array;
  clusterOfInst: Uint32Array;
  kindOfInst: Uint8Array;
}

/**
 * 各 grove member の top-cap を、その member の crown 高さに対してどれだけ上下へ散らすか
 * (crown 高さ = cell.tightWorldHeight * memberScale に対する片側比率)。
 *
 * 理由: cap を入れない初版では 74,033 枚の水平不透明面がすべて crown 高さの同じ相対位置
 * (capHeightWorld / tightWorldHeight = 0.62〜0.79)へ揃い、canopy 内部に**連続した 1 枚の
 * 水平シート**を作った。OVERVIEW / PRIMARY ではこれが「閉じた樹冠」として効いたが、
 * 地表付近の CLOSE camera からは同じシートを浅い角度で見ることになり、
 * 森を貫く巨大な平板として読めてしまった(実測: CLOSE の差分画素 25.1 %)。
 *
 * 高さを member ごとに散らすとシートが層状に崩れ、重なり合う樹冠として読める。
 * canonical reference の観察 D「粒立ちは同一サイズの反復では出ない」とも整合する。
 *
 * world placement(memberX/Y/Z)は変えない。これは member の local representation 内部の
 * offset であり、cluster center も member anchor も density も spacing も不変である。
 */
export const TOP_CAP_LOCAL_Y_JITTER_RATIO = 0.14;

/** jitter 専用の seed。placement 側の seed とは独立にして、placement の再現性へ影響させない。 */
export const TOP_CAP_JITTER_SEED = 0x6a09e667;

/**
 * R7 bi-view: which grove configs get a per-plane view pair.
 *
 * Only G4 is opted in. The other grove configs keep the production single-view
 * crossed quad, so any visual change between R3 and R7 is attributable to G4's
 * pixels and G4's view pairing and nothing else.
 */
export type BiViewConfigs = ReadonlySet<string>;

function planeBCellFor(
  cell: ImpostorCellRef,
  cells: readonly ImpostorCellRef[],
): ImpostorCellRef | undefined {
  if (cell.kind !== 'grove') return undefined;
  const wantedYaw = (cell.yawDeg + PLANE_B_BAKE_YAW_OFFSET_DEG) % 360;
  return cells.find(
    (candidate) => candidate.kind === 'grove'
      && candidate.groveConfig === cell.groveConfig
      && candidate.yawDeg === wantedYaw,
  );
}

export function createClusterMeshes({
  assets,
  placement,
  topCap = (assets as ClusterAssets).topCap,
  biViewConfigs,
}: {
  assets: ImpostorAssets;
  placement: ClusterPlacementResult;
  topCap?: ClusterTopCapAssets;
  biViewConfigs?: BiViewConfigs;
}): ClusterMeshSet {
  const counts = new Uint32Array(assets.cells.length);
  for (let member = 0; member < placement.memberCount; member += 1) {
    const slot = placement.memberCellSlot[member];
    if (slot >= assets.cells.length) {
      throw new RangeError(`Member ${member} has an out-of-range cell slot.`);
    }
    counts[slot] += 1;
  }

  const starts = new Uint32Array(assets.cells.length + 1);
  for (let slot = 0; slot < assets.cells.length; slot += 1) {
    starts[slot + 1] = starts[slot] + counts[slot];
  }
  const next = starts.slice(0, assets.cells.length);
  const orderedMembers = new Uint32Array(placement.memberCount);
  for (let member = 0; member < placement.memberCount; member += 1) {
    const slot = placement.memberCellSlot[member];
    orderedMembers[next[slot]] = member;
    next[slot] += 1;
  }

  const meshes: THREE.InstancedMesh[] = [];
  const cellMeshData: CellMeshData[] = [];
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const up = new THREE.Vector3(0, 1, 0);
  const color = new THREE.Color();
  let topCapInstanceCount = 0;

  try {
    for (let slot = 0; slot < assets.cells.length; slot += 1) {
      const count = counts[slot];
      if (count === 0) continue;

      const cell = assets.cells[slot];
      const texture = assets.textures[cell.atlas];
      if (!texture) throw new Error(`Missing texture for ${cell.atlas} atlas.`);
      const alphaTest = cell.kind === 'grove'
        ? forestImpostorV2Defaults.material.groveAlphaTest
        : forestImpostorV2Defaults.material.treeAlphaTest;
      // R7 bi-view. Opt-in per grove config; everything else keeps the exact
      // production geometry. Vertex/triangle counts are identical either way.
      const planeBCell = biViewConfigs?.has(cell.groveConfig ?? '')
        ? planeBCellFor(cell, assets.cells)
        : undefined;
      const geometry = planeBCell
        ? createBiViewCrossedQuadGeometry(cell, planeBCell)
        : createCrossedQuadGeometry(cell);
      const material = createImpostorMaterial(texture, alphaTest, cell.kind, 'unlit');
      const mesh = new THREE.InstancedMesh(geometry, material, count);
      mesh.name = `forest-lab-cluster-${cell.key}`;
      mesh.frustumCulled = true;

      const matrices = new Float32Array(16 * count);
      const colors = new Float32Array(3 * count);
      let allWhite = true;
      const clusterOfInst = new Uint32Array(count);
      const kindOfInst = new Uint8Array(count);
      const first = starts[slot];
      for (let inst = 0; inst < count; inst += 1) {
        const member = orderedMembers[first + inst];
        const memberScale = placement.memberScale[member];
        position.set(
          placement.memberX[member],
          placement.memberY[member],
          placement.memberZ[member],
        );
        rotation.setFromAxisAngle(up, THREE.MathUtils.degToRad(cell.yawDeg));
        scale.set(
          (placement.memberMirrored[member] === 1 ? -1 : 1)
            * cell.tightWorldWidth * memberScale,
          cell.tightWorldHeight * memberScale,
          cell.tightWorldWidth * memberScale,
        );
        matrix.compose(position, rotation, scale);
        matrices.set(matrix.elements, inst * 16);
        const r = placement.memberColorR[member];
        const g = placement.memberColorG[member];
        const b = placement.memberColorB[member];
        colors[inst * 3] = r;
        colors[inst * 3 + 1] = g;
        colors[inst * 3 + 2] = b;
        if (r !== 1 || g !== 1 || b !== 1) allWhite = false;
        clusterOfInst[inst] = placement.memberCluster[member];
        kindOfInst[inst] = placement.memberKind[member];
      }

      mesh.count = count;
      mesh.instanceMatrix.array.set(matrices);
      mesh.instanceMatrix.needsUpdate = true;
      if (!allWhite) {
        for (let inst = 0; inst < count; inst += 1) {
          mesh.setColorAt(
            inst,
            color.setRGB(colors[inst * 3], colors[inst * 3 + 1], colors[inst * 3 + 2]),
          );
        }
        mesh.instanceColor!.needsUpdate = true;
      }
      mesh.visible = true;
      meshes.push(mesh);
      cellMeshData.push({
        mesh,
        matrices,
        ...(allWhite ? {} : { colors }),
        clusterOfInst,
        kindOfInst,
      });
    }

    if (topCap) {
      const topCounts = new Uint32Array(assets.cells.length);
      for (let member = 0; member < placement.memberCount; member += 1) {
        const family = placement.memberFamily[member];
        if (placement.memberKind[member] !== MEMBER_KIND_GROVE || (family !== 1 && family !== 2)) {
          continue;
        }
        topCounts[placement.memberCellSlot[member]] += 1;
        topCapInstanceCount += 1;
      }

      for (let slot = 0; slot < assets.cells.length; slot += 1) {
        const count = topCounts[slot];
        if (count === 0) continue;
        const cell = assets.cells[slot];
        const top = topCap.mapping.get(cell.key);
        if (cell.kind !== 'grove' || !top) {
          throw new Error(`Missing top cap mapping for ${cell.key}.`);
        }
        const geometry = createGroveTopCapGeometry(cell, top);
        const material = createGroveTopCapMaterial(
          topCap.texture,
          forestImpostorV2Defaults.material.groveAlphaTest,
        );
        const mesh = new THREE.InstancedMesh(geometry, material, count);
        mesh.name = `forest-lab-cluster-top-cap-${cell.key}`;
        mesh.frustumCulled = true;

        const matrices = new Float32Array(16 * count);
        const clusterOfInst = new Uint32Array(count);
        const kindOfInst = new Uint8Array(count);
        const first = starts[slot];
        let inst = 0;
        for (let ordered = 0; ordered < counts[slot]; ordered += 1) {
          const member = orderedMembers[first + ordered];
          const family = placement.memberFamily[member];
          if (placement.memberKind[member] !== MEMBER_KIND_GROVE || (family !== 1 && family !== 2)) {
            continue;
          }
          const memberScale = placement.memberScale[member];
          // Deterministic per-member vertical stagger. hashIndexTo01 is the same seeded
          // integer hash clusterPlacement.ts uses, so this stays fully reproducible and
          // introduces no nondeterministic source. (Do not write the name of the forbidden
          // global RNG in this file even inside a comment -- labIsolationGuard.test.ts does a
          // plain substring scan of the source and a mention alone fails the guard.)
          // The offset is in world Y but is derived purely from the member's own crown size,
          // so it is a local representation detail -- memberX/Y/Z themselves are untouched.
          const jitter01 = hashIndexTo01(member, TOP_CAP_JITTER_SEED);
          const capYOffset = (jitter01 - 0.5) * 2
            * TOP_CAP_LOCAL_Y_JITTER_RATIO * cell.tightWorldHeight * memberScale;
          position.set(
            placement.memberX[member],
            placement.memberY[member] + capYOffset,
            placement.memberZ[member],
          );
          rotation.setFromAxisAngle(up, THREE.MathUtils.degToRad(cell.yawDeg));
          // A mirrored horizontal quad reverses the FrontSide winding. Keep cap width positive.
          scale.set(
            cell.tightWorldWidth * memberScale,
            cell.tightWorldHeight * memberScale,
            cell.tightWorldWidth * memberScale,
          );
          matrix.compose(position, rotation, scale);
          matrices.set(matrix.elements, inst * 16);
          clusterOfInst[inst] = placement.memberCluster[member];
          kindOfInst[inst] = MEMBER_KIND_GROVE;
          inst += 1;
        }

        mesh.count = count;
        mesh.instanceMatrix.array.set(matrices);
        mesh.instanceMatrix.needsUpdate = true;
        mesh.visible = true;
        meshes.push(mesh);
        cellMeshData.push({ mesh, matrices, clusterOfInst, kindOfInst });
      }
    }
  } catch (error) {
    for (const mesh of meshes) {
      mesh.dispose();
      mesh.geometry.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) material.dispose();
    }
    throw error;
  }

  const stats: ClusterRuntimeStats = {
    ...placement.stats,
    atlasCellMeshCount: meshes.length,
    visibleInstanceCount: placement.memberCount + topCapInstanceCount,
  };
  let disposed = false;

  return {
    meshes,
    stats,
    applyVisibility(visibility: Uint8Array): number {
      if (visibility.length < placement.clusterCount) {
        throw new RangeError('Visibility is shorter than clusterCount.');
      }

      let visibleInstanceCount = 0;
      for (const { mesh, matrices, colors, clusterOfInst, kindOfInst } of cellMeshData) {
        let write = 0;
        for (let inst = 0; inst < clusterOfInst.length; inst += 1) {
          const need = kindOfInst[inst] === 0 ? 1 : 2;
          if ((visibility[clusterOfInst[inst]] & need) === 0) continue;
          mesh.instanceMatrix.array.set(
            matrices.subarray(inst * 16, inst * 16 + 16),
            write * 16,
          );
          if (colors) {
            mesh.instanceColor!.array.set(
              colors.subarray(inst * 3, inst * 3 + 3),
              write * 3,
            );
          }
          write += 1;
        }
        mesh.count = write;
        mesh.instanceMatrix.needsUpdate = true;
        if (colors) mesh.instanceColor!.needsUpdate = true;
        mesh.visible = write > 0;
        visibleInstanceCount += write;
      }
      stats.visibleInstanceCount = visibleInstanceCount;
      return visibleInstanceCount;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const mesh of meshes) {
        mesh.removeFromParent();
        mesh.dispose();
        mesh.geometry.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) material.dispose();
      }
    },
  };
}
