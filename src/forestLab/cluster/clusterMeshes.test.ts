import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import { forestImpostorV2Defaults } from '../../config/defaults/forestImpostorV2';
import type { ImpostorAssets } from '../../forest/impostorV2/impostorAssets';
import type { GroveTopCapCell } from '../../forest/impostorV2/groveTopCapMeta';
import type { ImpostorCellRef } from '../../forest/impostorV2/types';
import type { ClusterTopCapAssets } from './clusterAssets';
import { createClusterMeshes, TOP_CAP_LOCAL_Y_JITTER_RATIO } from './clusterMeshes';
import {
  MEMBER_KIND_GROVE,
  MEMBER_KIND_TREE,
  type ClusterPlacementResult,
} from './clusterTypes';

function cell(key: string, kind: 'grove' | 'tree', yawDeg: number): ImpostorCellRef {
  return {
    key,
    kind,
    atlas: kind,
    groveConfig: kind === 'grove' ? key : null,
    sourceVariant: kind === 'tree' ? key : null,
    yawDeg,
    uv: { u0: 0, v0: 0, u1: 1, v1: 1 },
    tightWorldWidth: kind === 'grove' ? 2 : 1,
    tightWorldHeight: kind === 'grove' ? 4 : 3,
    groundPivotInTight: { u: 0.5, v: 0 },
    alphaCoverage: 1,
  };
}

const cells = [
  cell('g0', 'grove', 0),
  cell('t0', 'tree', 45),
  cell('g1', 'grove', 90),
  cell('unused', 'tree', 0),
];

function fixture(): { assets: ImpostorAssets; placement: ClusterPlacementResult } {
  const memberCellSlot = Uint16Array.from([1, 0, 2, 1, 0, 2, 1, 0, 2, 1]);
  const memberKind = Uint8Array.from([...memberCellSlot].map((slot) =>
    cells[slot].kind === 'grove' ? MEMBER_KIND_GROVE : MEMBER_KIND_TREE
  ));
  const groveInstanceCount = [...memberKind]
    .filter((kind) => kind === MEMBER_KIND_GROVE).length;
  const treeInstanceCount = memberKind.length - groveInstanceCount;
  const placement: ClusterPlacementResult = {
    clusterCount: 3,
    memberCount: memberCellSlot.length,
    clusterX: Float32Array.from([0, 100, 200]),
    clusterY: Float32Array.from([0, 10, 20]),
    clusterZ: Float32Array.from([0, 50, 100]),
    clusterRadiusA: Float32Array.from([10, 10, 10]),
    clusterRadiusB: Float32Array.from([8, 8, 8]),
    clusterRotation: Float32Array.from([0, 0, 0]),
    clusterFamily: Uint8Array.from([0, 1, 2]),
    clusterMemberStart: Uint32Array.from([0, 3, 6, 10]),
    memberX: Float32Array.from([...memberCellSlot].map((_, index) => index + 1)),
    memberY: Float32Array.from([...memberCellSlot].map((_, index) => index + 11)),
    memberZ: Float32Array.from([...memberCellSlot].map((_, index) => index + 21)),
    memberScale: Float32Array.from([...memberCellSlot].map((_, index) => 1 + index * 0.1)),
    memberMirrored: Uint8Array.from([...memberCellSlot].map((_, index) => index === 1 ? 1 : 0)),
    memberKind,
    memberCellSlot,
    memberCluster: Uint32Array.from([0, 0, 0, 1, 1, 1, 2, 2, 2, 2]),
    memberFamily: Uint8Array.from([0, 0, 0, 1, 1, 1, 2, 2, 2, 2]),
    memberColorR: new Float32Array(memberCellSlot.length).fill(1),
    memberColorG: new Float32Array(memberCellSlot.length).fill(1),
    memberColorB: new Float32Array(memberCellSlot.length).fill(1),
    stats: {
      clusterLatticeCols: 3,
      clusterCandidateCount: 5,
      clusterAcceptedCount: 3,
      memberPlacedCount: memberCellSlot.length,
      memberRejectedByMaskCount: 2,
      memberRejectedByBboxCount: 1,
      groveInstanceCount,
      treeInstanceCount,
      familyClusterCounts: [1, 1, 1],
      meanSquareScale: 2.185,
      meanColorLuminanceMultiplier: 1,
    },
  };
  return {
    assets: {
      meta: {
        schemaVersion: 1,
        pitchDeg: 0,
        atlases: {
          grove: {
            id: 'grove', file: 'grove.png', width: 1, height: 1,
            cellWidth: 1, cellHeight: 1, cols: 1, rows: 1, sha256: 'grove',
          },
          tree: {
            id: 'tree', file: 'tree.png', width: 1, height: 1,
            cellWidth: 1, cellHeight: 1, cols: 1, rows: 1, sha256: 'tree',
          },
        },
        cells,
      },
      cells,
      textures: { grove: new THREE.Texture(), tree: new THREE.Texture() },
      dispose() {},
    },
    placement,
  };
}

function instanceTotal(meshes: readonly THREE.InstancedMesh[]): number {
  return meshes.reduce((sum, mesh) => sum + mesh.count, 0);
}

function topCapFor(assets: ImpostorAssets): ClusterTopCapAssets {
  const mapping = new Map<string, GroveTopCapCell>();
  for (const [cellIndex, side] of assets.cells.entries()) {
    if (side.kind !== 'grove') continue;
    mapping.set(side.key, {
      cellId: `top-${side.key}`,
      matchingSideCellId: side.key,
      matchingSideCellIndex: cellIndex,
      cellIndex,
      row: 0,
      col: cellIndex,
      groveConfig: side.key,
      bakedYaw: side.yawDeg,
      sourceCompositionDigest: 'sha256:test',
      uvRect: { u0: 0, v0: 0, u1: 1, v1: 1 },
      alphaTightBoundsUV: { u0: 0, v0: 0, u1: 1, v1: 1 },
      capHeightWorld: 3,
      tightWorldWidth: 2,
      tightWorldDepth: 2,
      tightWorldBounds: { rightMin: -1, rightMax: 1, depthMin: -1, depthMax: 1 },
    });
  }
  return { mapping, texture: new THREE.Texture() };
}

describe('cluster meshes', () => {
  it('keeps side meshes, matrices, and colors identical when top-cap input is absent', () => {
    const { assets, placement } = fixture();
    placement.memberColorR.fill(0.8);
    placement.memberColorG.fill(0.9);
    const omitted = createClusterMeshes({ assets, placement });
    const explicitUndefined = createClusterMeshes({ assets, placement, topCap: undefined });

    expect(explicitUndefined.meshes).toHaveLength(omitted.meshes.length);
    omitted.meshes.forEach((mesh, index) => {
      const comparison = explicitUndefined.meshes[index];
      expect(Array.from(comparison.instanceMatrix.array)).toEqual(
        Array.from(mesh.instanceMatrix.array),
      );
      expect(Array.from(comparison.instanceColor!.array)).toEqual(
        Array.from(mesh.instanceColor!.array),
      );
    });
    omitted.dispose();
    explicitUndefined.dispose();
  });

  it('builds one initialized mesh for each used cell', () => {
    const { assets, placement } = fixture();
    const result = createClusterMeshes({ assets, placement });
    expect(result.meshes).toHaveLength(3);
    expect(instanceTotal(result.meshes)).toBe(placement.memberCount);
    expect(result.stats).toEqual({
      ...placement.stats,
      atlasCellMeshCount: 3,
      visibleInstanceCount: placement.memberCount,
    });
    for (const mesh of result.meshes) {
      expect(mesh.name.startsWith('forest-lab-cluster-')).toBe(true);
      expect(mesh.frustumCulled).toBe(true);
    }
    result.dispose();
  });

  it('applies all, none, and grove-only visibility', () => {
    const { assets, placement } = fixture();
    const result = createClusterMeshes({ assets, placement });

    expect(result.applyVisibility(Uint8Array.from([0b11, 0b11, 0b11])))
      .toBe(placement.memberCount);
    expect(instanceTotal(result.meshes)).toBe(placement.memberCount);

    expect(result.applyVisibility(Uint8Array.from([0, 0, 0]))).toBe(0);
    expect(instanceTotal(result.meshes)).toBe(0);
    expect(result.meshes.every((mesh) => mesh.visible === false)).toBe(true);

    expect(result.applyVisibility(Uint8Array.from([0b01, 0b01, 0b01])))
      .toBe(placement.stats.groveInstanceCount);
    expect(instanceTotal(result.meshes)).toBe(placement.stats.groveInstanceCount);
    expect(result.stats.visibleInstanceCount).toBe(placement.stats.groveInstanceCount);
    result.dispose();
  });

  it('repeats visibility compaction element-for-element deterministically', () => {
    const { assets, placement } = fixture();
    const result = createClusterMeshes({ assets, placement });
    const visibility = Uint8Array.from([0b01, 0b10, 0b11]);
    result.applyVisibility(visibility);
    const expected = result.meshes.map((mesh) =>
      Array.from(mesh.instanceMatrix.array.slice(0, mesh.count * 16))
    );

    result.applyVisibility(visibility);
    result.meshes.forEach((mesh, meshIndex) => {
      const actual = mesh.instanceMatrix.array.slice(0, mesh.count * 16);
      expect(actual).toHaveLength(expected[meshIndex].length);
      for (let index = 0; index < actual.length; index += 1) {
        expect(actual[index]).toBe(expected[meshIndex][index]);
      }
    });
    result.dispose();
  });

  it('keeps a negative determinant for a mirrored member matrix', () => {
    const { assets, placement } = fixture();
    const result = createClusterMeshes({ assets, placement });
    const mirroredCellMesh = result.meshes.find((mesh) => mesh.name.endsWith('g0'))!;
    const matrix = new THREE.Matrix4();
    mirroredCellMesh.getMatrixAt(0, matrix);
    expect(matrix.determinant()).toBeLessThan(0);
    result.dispose();
  });

  it('adds broadleaf/mixed grove caps at unchanged anchors with positive mirrored width', () => {
    const { assets, placement } = fixture();
    placement.memberMirrored[4] = 1;
    const result = createClusterMeshes({ assets, placement, topCap: topCapFor(assets) });
    const capMeshes = result.meshes.filter((mesh) => mesh.name.includes('-top-cap-'));
    const sideMeshes = result.meshes.filter((mesh) => !mesh.name.includes('-top-cap-'));

    expect(capMeshes).toHaveLength(2);
    expect(instanceTotal(capMeshes)).toBe(4);
    expect(result.stats.atlasCellMeshCount).toBe(5);
    expect(result.stats.visibleInstanceCount).toBe(placement.memberCount + 4);

    const sidePositions = sideMeshes.flatMap((mesh) => {
      const values: number[][] = [];
      const matrix = new THREE.Matrix4();
      for (let inst = 0; inst < mesh.count; inst += 1) {
        mesh.getMatrixAt(inst, matrix);
        values.push([matrix.elements[12], matrix.elements[13], matrix.elements[14]]);
      }
      return values;
    });
    // The cap's HORIZONTAL anchor must be the member's world anchor exactly: X and Z are
    // never touched, so cluster centres, member world positions, density and spacing are
    // provably unchanged. Only Y carries the deterministic local stagger
    // (TOP_CAP_LOCAL_Y_JITTER_RATIO), which is a local representation detail of the cap plane
    // -- the side instances themselves keep their original Y, as asserted elsewhere.
    const matrix = new THREE.Matrix4();
    for (const mesh of capMeshes) {
      for (let inst = 0; inst < mesh.count; inst += 1) {
        mesh.getMatrixAt(inst, matrix);
        const [capX, capY, capZ] = [matrix.elements[12], matrix.elements[13], matrix.elements[14]];
        const anchor = sidePositions.find(([x, , z]) => x === capX && z === capZ);
        expect(anchor).toBeDefined();
        // Y may differ, but only within the documented stagger envelope, and the envelope is
        // derived from the member's own crown height -- never from world placement.
        const scaleY = matrix.elements[5];
        const maxOffset = TOP_CAP_LOCAL_Y_JITTER_RATIO * Math.abs(scaleY);
        expect(Math.abs(capY - anchor![1])).toBeLessThanOrEqual(maxOffset + 1e-6);
      }
    }

    // The stagger must actually do something: if every cap landed on the same Y as its anchor
    // we would be back to the single continuous horizontal sheet this constant exists to break.
    const offsets = capMeshes.flatMap((mesh) => {
      const values: number[] = [];
      const m = new THREE.Matrix4();
      for (let inst = 0; inst < mesh.count; inst += 1) {
        mesh.getMatrixAt(inst, m);
        const anchor = sidePositions.find(([x, , z]) => x === m.elements[12] && z === m.elements[14]);
        values.push(m.elements[13] - anchor![1]);
      }
      return values;
    });
    expect(offsets.some((offset) => Math.abs(offset) > 1e-6)).toBe(true);
    expect(new Set(offsets.map((offset) => offset.toFixed(6))).size).toBeGreaterThan(1);

    const g0Cap = capMeshes.find((mesh) => mesh.name.endsWith('g0'))!;
    let foundMirroredMember = false;
    for (let inst = 0; inst < g0Cap.count; inst += 1) {
      g0Cap.getMatrixAt(inst, matrix);
      if (matrix.elements[12] === placement.memberX[4]) {
        foundMirroredMember = true;
        expect(matrix.elements[0]).toBeGreaterThan(0);
      }
    }
    expect(foundMirroredMember).toBe(true);
    result.dispose();
  });

  it('compacts side and top-cap instances with the same cluster visibility', () => {
    const { assets, placement } = fixture();
    const result = createClusterMeshes({ assets, placement, topCap: topCapFor(assets) });

    expect(result.applyVisibility(Uint8Array.from([0b01, 0, 0b01]))).toBe(6);
    const capMeshes = result.meshes.filter((mesh) => mesh.name.includes('-top-cap-'));
    const sideMeshes = result.meshes.filter((mesh) => !mesh.name.includes('-top-cap-'));
    expect(instanceTotal(capMeshes)).toBe(2);
    expect(instanceTotal(sideMeshes)).toBe(4);
    expect(result.stats.visibleInstanceCount).toBe(6);
    result.dispose();
  });

  it('disposes owned mesh resources once without disposing assets', () => {
    const { assets, placement } = fixture();
    const assetsDispose = vi.spyOn(assets, 'dispose');
    const result = createClusterMeshes({ assets, placement });
    const geometryDisposes = result.meshes.map((mesh) => vi.spyOn(mesh.geometry, 'dispose'));
    const materialDisposes = result.meshes.map((mesh) =>
      vi.spyOn(mesh.material as THREE.Material, 'dispose')
    );

    expect(() => {
      result.dispose();
      result.dispose();
    }).not.toThrow();
    for (const dispose of geometryDisposes) expect(dispose).toHaveBeenCalledOnce();
    for (const dispose of materialDisposes) expect(dispose).toHaveBeenCalledOnce();
    expect(assetsDispose).not.toHaveBeenCalled();
  });

  it('disposes top-cap meshes, geometries, and materials once', () => {
    const { assets, placement } = fixture();
    const result = createClusterMeshes({ assets, placement, topCap: topCapFor(assets) });
    const topMeshes = result.meshes.filter((mesh) => mesh.name.includes('-top-cap-'));
    const meshDisposes = topMeshes.map((mesh) => vi.spyOn(mesh, 'dispose'));
    const geometryDisposes = topMeshes.map((mesh) => vi.spyOn(mesh.geometry, 'dispose'));
    const materialDisposes = topMeshes.map((mesh) =>
      vi.spyOn(mesh.material as THREE.Material, 'dispose')
    );

    result.dispose();
    result.dispose();

    for (const dispose of meshDisposes) expect(dispose).toHaveBeenCalledOnce();
    for (const dispose of geometryDisposes) expect(dispose).toHaveBeenCalledOnce();
    for (const dispose of materialDisposes) expect(dispose).toHaveBeenCalledOnce();
  });

  it('disposes the InstancedMesh (releasing instanceColor GPU resources) when per-instance color is used (I-15)', () => {
    const { assets, placement } = fixture();
    // 全 instance を white 以外にして instanceColor が実際に作られる経路を通す。
    const coloredPlacement: ClusterPlacementResult = {
      ...placement,
      memberColorR: placement.memberColorR.map((_, index) => 0.5 + index * 0.01),
      memberColorG: new Float32Array(placement.memberColorR.length).fill(0.7),
      memberColorB: new Float32Array(placement.memberColorR.length).fill(0.9),
    };
    const result = createClusterMeshes({ assets, placement: coloredPlacement });
    for (const mesh of result.meshes) {
      expect(mesh.instanceColor).not.toBeNull();
    }
    const meshDisposes = result.meshes.map((mesh) => vi.spyOn(mesh, 'dispose'));
    const geometryDisposes = result.meshes.map((mesh) => vi.spyOn(mesh.geometry, 'dispose'));

    result.dispose();

    for (const dispose of meshDisposes) expect(dispose).toHaveBeenCalledOnce();
    for (const dispose of geometryDisposes) expect(dispose).toHaveBeenCalledOnce();
  });

  it('rejects a visibility buffer shorter than the cluster count', () => {
    const { assets, placement } = fixture();
    const result = createClusterMeshes({ assets, placement });
    expect(() => result.applyVisibility(new Uint8Array(placement.clusterCount - 1)))
      .toThrow(RangeError);
    result.dispose();
  });

  it('does not alter production defaults', () => {
    expect(forestImpostorV2Defaults.cellSelection.tree.variants).toHaveLength(3);
  });
});
