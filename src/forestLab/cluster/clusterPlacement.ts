import { forestImpostorV2Defaults } from '../../config/defaults/forestImpostorV2';
import { hashIndexTo01 } from '../../forest/forestRandom';
import { sampleTerrainSlopeRadians } from '../../forest/terrainHeightSampler';
import {
  buildOccupancyRaster,
  sampleGapCoverageRatio,
  type CoverageFillConfig,
} from '../r10/coverageFill';
import {
  computeRawMacroShade,
  normalizeMacroShade,
  type MacroShadeConfig,
} from '../r10/macroShade';
import { getR10Config } from '../r10/r10LabConfig';
import {
  createAppearanceModel,
  type AppearanceModel,
} from '../appearance/appearanceModel';
import {
  CLUSTER_ASPECT_MAX,
  CLUSTER_ASPECT_MIN,
  CLUSTER_FOOTPRINT_MAX_RATIO,
  CLUSTER_FOOTPRINT_MIN_RATIO,
  CLUSTER_FOOTPRINT_W_M,
  CLUSTER_HASH_STRIDE,
  CLUSTER_SPACING_M,
  DOMINANT_FRACTION,
  GROVE_FRACTION,
  MEMBER_COUNT_MAX,
  MEMBER_COUNT_MAX_RATIO,
  MEMBER_COUNT_MIN_RATIO,
  MEMBER_COUNT_NOMINAL,
} from './clusterConstants';
import {
  MEMBER_KIND_GROVE,
  MEMBER_KIND_TREE,
  type ClusterPlacementStats,
  type ClusterPlacementResult,
} from './clusterTypes';

export const BL_TREE_VARIANT_INDEX = 3;

export interface BuildClusterPlacementArgs {
  worldBbox: { xMin: number; xMax: number; zMin: number; zMax: number };
  seed: number;
  maskThreshold: number;
  sampleCoverage: (x: number, z: number) => number;
  terrainYAt: (x: number, z: number) => number;
  cellWidthOf: (cellSlot: number) => number;
  groveCellSlot: (groveIndex: number, yawIndex: number) => number;
  treeCellSlot: (variantIndex: number, yawIndex: number) => number;
  appearance?: AppearanceModel;
  /**
   * R10: opt-in な山体スケールの低周波 macro shading。省略、または
   * `enabled: false` のときは既存コードパスと 1 命令も変わらない結果になる。
   * 有効時は cluster 単位で 1 回だけ raw shade を計算し(member 単位ではない)、
   * 同じ cluster に属する全 member がその係数を共有する。
   */
  macroShade?: MacroShadeConfig;
  /**
   * R10: opt-in な gap-targeted coverage fill。省略時は `getR10Config().coverageFill`
   * (既定 disabled)にフォールバックする。`enabled: false` のときは既存コード
   * パスと 1 命令も変わらない結果になる(add-only。既存 cluster/member の
   * 座標・色・並び順は一切変更しない)。
   */
  coverageFill?: CoverageFillConfig;
}

const INITIAL_CLUSTER_CAPACITY = 32;
const INITIAL_MEMBER_CAPACITY = 1024;

/**
 * gap-fill の二次格子が使うハッシュ入力を、主格子(`h`)の入力範囲と衝突させ
 * ないための seed オフセット(§別のseedストリーム)。任意の素数。
 */
const GAP_SEED_SALT = 104729;

function growFloat32(source: Float32Array, capacity: number): Float32Array {
  const grown = new Float32Array(capacity);
  grown.set(source);
  return grown;
}

function growUint32(source: Uint32Array, capacity: number): Uint32Array {
  const grown = new Uint32Array(capacity);
  grown.set(source);
  return grown;
}

function growUint16(source: Uint16Array, capacity: number): Uint16Array {
  const grown = new Uint16Array(capacity);
  grown.set(source);
  return grown;
}

function growUint8(source: Uint8Array, capacity: number): Uint8Array {
  const grown = new Uint8Array(capacity);
  grown.set(source);
  return grown;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function buildClusterPlacement(
  args: BuildClusterPlacementArgs,
): ClusterPlacementResult & { stats: ClusterPlacementStats } {
  const {
    worldBbox: { xMin, xMax, zMin, zMax },
    seed,
    maskThreshold,
    sampleCoverage,
    terrainYAt,
    cellWidthOf,
    groveCellSlot,
    treeCellSlot,
  } = args;
  const appearance = args.appearance ?? createAppearanceModel('BASELINE', seed);
  const cols = Math.ceil((xMax - xMin) / CLUSTER_SPACING_M);
  const h = (index: number) => hashIndexTo01(index, seed);

  let clusterCapacity = INITIAL_CLUSTER_CAPACITY;
  let clusterX: Float32Array = new Float32Array(clusterCapacity);
  let clusterY: Float32Array = new Float32Array(clusterCapacity);
  let clusterZ: Float32Array = new Float32Array(clusterCapacity);
  let clusterRadiusA: Float32Array = new Float32Array(clusterCapacity);
  let clusterRadiusB: Float32Array = new Float32Array(clusterCapacity);
  let clusterRotation: Float32Array = new Float32Array(clusterCapacity);
  let clusterFamily: Uint8Array = new Uint8Array(clusterCapacity);
  let clusterMemberCount: Uint32Array = new Uint32Array(clusterCapacity);

  let memberCapacity = INITIAL_MEMBER_CAPACITY;
  let memberX: Float32Array = new Float32Array(memberCapacity);
  let memberY: Float32Array = new Float32Array(memberCapacity);
  let memberZ: Float32Array = new Float32Array(memberCapacity);
  let memberScale: Float32Array = new Float32Array(memberCapacity);
  let memberMirrored: Uint8Array = new Uint8Array(memberCapacity);
  let memberKind: Uint8Array = new Uint8Array(memberCapacity);
  let memberCellSlot: Uint16Array = new Uint16Array(memberCapacity);
  let memberCluster: Uint32Array = new Uint32Array(memberCapacity);
  let memberFamily: Uint8Array = new Uint8Array(memberCapacity);
  let memberColorR: Float32Array = new Float32Array(memberCapacity);
  let memberColorG: Float32Array = new Float32Array(memberCapacity);
  let memberColorB: Float32Array = new Float32Array(memberCapacity);

  let clusterCount = 0;
  let memberCount = 0;
  let clusterCandidateCount = 0;
  let clusterAcceptedCount = 0;
  let memberRejectedByMaskCount = 0;
  let memberRejectedByBboxCount = 0;
  let groveInstanceCount = 0;
  let treeInstanceCount = 0;
  const familyClusterCounts: [number, number, number] = [0, 0, 0];
  let squareScaleSum = 0;
  let squareFootprintWidthSum = 0;
  let footprintWidthSum = 0;
  let colorLuminanceSum = 0;

  // 単一 cluster の楕円・family・member 数を確定し、cluster 配列へ 1 件追記
  // する(必要なら growth)。既存の主格子ループと R10 gap-fill の二次格子
  // ループの両方から呼ぶ(§4: member/cluster 生成ロジックをコピペで複製し
  // ない)。呼び出し前後の副作用は clusterCount のインクリメントのみで、
  // 呼び出し順に依存する(= 先に呼ばれた方が小さい index を得る)ため、
  // 主格子ループを完全に終えてから gap-fill ループを呼ぶ限り、既存 cluster
  // の index は一切ずれない。
  function allocateCluster(
    ccx: number,
    ccz: number,
    clusterBase: number,
    hashFn: (index: number) => number,
  ): {
    clusterIndex: number;
    A: number;
    B: number;
    phi: number;
    family: number;
    dominantGrove: number;
    dominantTree: number;
    Mc: number;
  } {
    const Rc = 0.5 * CLUSTER_FOOTPRINT_W_M * lerp(
      CLUSTER_FOOTPRINT_MIN_RATIO,
      CLUSTER_FOOTPRINT_MAX_RATIO,
      hashFn(clusterBase + 2),
    );
    const aspect = lerp(
      CLUSTER_ASPECT_MIN,
      CLUSTER_ASPECT_MAX,
      hashFn(clusterBase + 3),
    );
    const sqrtAspect = Math.sqrt(aspect);
    const A = Rc * sqrtAspect;
    const B = Rc / sqrtAspect;
    const phi = 2 * Math.PI * hashFn(clusterBase + 4);
    const family = appearance.familyAt(ccx, ccz);
    const dominantGrove = appearance.groveVariant(family, hashFn(clusterBase + 5));
    const dominantTree = appearance.treeVariant(family, hashFn(clusterBase + 7));
    let Mc = Math.max(1, Math.round(MEMBER_COUNT_NOMINAL * lerp(
      MEMBER_COUNT_MIN_RATIO,
      MEMBER_COUNT_MAX_RATIO,
      hashFn(clusterBase + 6),
    )));
    Mc = Math.min(Mc, MEMBER_COUNT_MAX);

    if (clusterCount === clusterCapacity) {
      clusterCapacity *= 2;
      clusterX = growFloat32(clusterX, clusterCapacity);
      clusterY = growFloat32(clusterY, clusterCapacity);
      clusterZ = growFloat32(clusterZ, clusterCapacity);
      clusterRadiusA = growFloat32(clusterRadiusA, clusterCapacity);
      clusterRadiusB = growFloat32(clusterRadiusB, clusterCapacity);
      clusterRotation = growFloat32(clusterRotation, clusterCapacity);
      clusterFamily = growUint8(clusterFamily, clusterCapacity);
      clusterMemberCount = growUint32(clusterMemberCount, clusterCapacity);
    }

    const clusterIndex = clusterCount;
    clusterX[clusterIndex] = ccx;
    clusterY[clusterIndex] = terrainYAt(ccx, ccz);
    clusterZ[clusterIndex] = ccz;
    clusterRadiusA[clusterIndex] = A;
    clusterRadiusB[clusterIndex] = B;
    clusterRotation[clusterIndex] = phi;
    clusterFamily[clusterIndex] = family;
    clusterMemberCount[clusterIndex] = 0;
    clusterCount += 1;
    familyClusterCounts[family] += 1;

    return { clusterIndex, A, B, phi, family, dominantGrove, dominantTree, Mc };
  }

  // 1 cluster ぶんの member を生成し、既存の member 配列の末尾へ追記する
  // (add-only)。既存の主格子ループと R10 gap-fill の二次格子ループの両方
  // から呼ぶ(§4: member 生成ロジックをコピペで複製しない)。ロジックは
  // リファクタ前の member ループ本体と 1 命令も変えていない
  // (family 選択・macro field・色・scale・yaw・mirror・沈み込みのすべてが
  // 既存と同じ経路を通る)。
  function placeClusterMembers(
    clusterIndex: number,
    ccx: number,
    ccz: number,
    A: number,
    B: number,
    phi: number,
    family: number,
    dominantGrove: number,
    dominantTree: number,
    Mc: number,
    clusterBase: number,
    hashFn: (index: number) => number,
  ): void {
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);
    for (let m = 0; m < Mc; m += 1) {
      const mb = clusterBase + 8 + m * 8;
      const r = Math.sqrt(hashFn(mb));
      const th = 2 * Math.PI * hashFn(mb + 1);
      const lx = A * r * Math.cos(th);
      const lz = B * r * Math.sin(th);
      const x = ccx + lx * cosPhi - lz * sinPhi;
      const z = ccz + lx * sinPhi + lz * cosPhi;

      if (x < xMin || x > xMax || z < zMin || z > zMax) {
        memberRejectedByBboxCount += 1;
        continue;
      }
      if (sampleCoverage(x, z) < maskThreshold) {
        memberRejectedByMaskCount += 1;
        continue;
      }

      const kind = hashFn(mb + 2) < GROVE_FRACTION
        ? MEMBER_KIND_GROVE
        : MEMBER_KIND_TREE;
      const useDominant = hashFn(mb + 3) < DOMINANT_FRACTION;
      let variantIndex: number;
      let cellSlot: number;
      if (kind === MEMBER_KIND_GROVE) {
        variantIndex = useDominant
          ? dominantGrove
          : appearance.groveVariant(family, hashFn(mb + 4));
        const yawIndex = Math.min(3, Math.floor(hashFn(mb + 5) * 4));
        cellSlot = groveCellSlot(variantIndex, yawIndex);
      } else {
        variantIndex = useDominant
          ? dominantTree
          : appearance.treeVariant(family, hashFn(mb + 4));
        const yawIndex = Math.min(7, Math.floor(hashFn(mb + 5) * 8));
        cellSlot = treeCellSlot(variantIndex, yawIndex);
      }

      const mirrored = hashFn(mb + 6) < 0.5 ? 1 : 0;
      const isBroadleaf = kind === MEMBER_KIND_TREE &&
        variantIndex === BL_TREE_VARIANT_INDEX;
      const scale = appearance.scale(family, isBroadleaf, hashFn(mb + 7));
      const color = appearance.colorAt(x, z);

      const widthMeters = cellWidthOf(cellSlot) * scale;
      const slopeRad = sampleTerrainSlopeRadians(
        terrainYAt,
        x,
        z,
        forestImpostorV2Defaults.macro.slopeStepMeters,
      );
      const sinkConfig = kind === MEMBER_KIND_GROVE
        ? forestImpostorV2Defaults.grove
        : forestImpostorV2Defaults.tree;
      const sink = sinkConfig.sinkBaseMeters +
        (widthMeters * 0.5) * Math.tan(slopeRad) * sinkConfig.slopeSinkFactor;
      const y = terrainYAt(x, z) - sink;

      if (memberCount === memberCapacity) {
        memberCapacity *= 2;
        memberX = growFloat32(memberX, memberCapacity);
        memberY = growFloat32(memberY, memberCapacity);
        memberZ = growFloat32(memberZ, memberCapacity);
        memberScale = growFloat32(memberScale, memberCapacity);
        memberMirrored = growUint8(memberMirrored, memberCapacity);
        memberKind = growUint8(memberKind, memberCapacity);
        memberCellSlot = growUint16(memberCellSlot, memberCapacity);
        memberCluster = growUint32(memberCluster, memberCapacity);
        memberFamily = growUint8(memberFamily, memberCapacity);
        memberColorR = growFloat32(memberColorR, memberCapacity);
        memberColorG = growFloat32(memberColorG, memberCapacity);
        memberColorB = growFloat32(memberColorB, memberCapacity);
      }

      memberX[memberCount] = x;
      memberY[memberCount] = y;
      memberZ[memberCount] = z;
      memberScale[memberCount] = scale;
      memberMirrored[memberCount] = mirrored;
      memberKind[memberCount] = kind;
      memberCellSlot[memberCount] = cellSlot;
      memberCluster[memberCount] = clusterIndex;
      memberFamily[memberCount] = family;
      memberColorR[memberCount] = color[0];
      memberColorG[memberCount] = color[1];
      memberColorB[memberCount] = color[2];
      squareScaleSum += scale * scale;
      squareFootprintWidthSum += widthMeters * widthMeters;
      footprintWidthSum += widthMeters;
      colorLuminanceSum += 0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2];
      memberCount += 1;
      clusterMemberCount[clusterIndex] += 1;
      if (kind === MEMBER_KIND_GROVE) groveInstanceCount += 1;
      else treeInstanceCount += 1;
    }
  }

  for (let j = -1; j <= cols; j += 1) {
    for (let i = -1; i <= cols; i += 1) {
      const n = (j + 1) * (cols + 2) + (i + 1);
      const clusterBase = n * CLUSTER_HASH_STRIDE;

      const ccx = xMin + (
        i + 0.5 + (h(clusterBase) - 0.5)
      ) * CLUSTER_SPACING_M;
      const ccz = zMin + (
        j + 0.5 + (h(clusterBase + 1) - 0.5)
      ) * CLUSTER_SPACING_M;

      clusterCandidateCount += 1;
      if (sampleCoverage(ccx, ccz) < maskThreshold) continue;
      clusterAcceptedCount += 1;

      const { clusterIndex, A, B, phi, family, dominantGrove, dominantTree, Mc } =
        allocateCluster(ccx, ccz, clusterBase, h);

      placeClusterMembers(
        clusterIndex, ccx, ccz, A, B, phi, family, dominantGrove, dominantTree,
        Mc, clusterBase, h,
      );
    }
  }

  // R10 (opt-in): gap-targeted coverage fill。既存の主格子(上のループ)を
  // 完全に終えたあとでのみ実行するため、既存 cluster/member の index は
  // 一切ずれない(add-only)。§1〜§6 の設計方針を参照。
  // args.coverageFill が省略された場合は getR10Config().coverageFill
  // (既定 disabled)にフォールバックする。
  const coverageFill = args.coverageFill ?? getR10Config().coverageFill;
  if (coverageFill.enabled) {
    // 既存(この時点でまだ gap-fill member を含まない)member の実フットプ
    // リット半径(cellWidthOf(cellSlot) * scale の半分)から occupancy
    // raster を作る。raster はこのブロックの間、静的(gap-fill で追加した
    // member では更新しない)。
    const existingMemberCount = memberCount;
    const memberRadiusMeters = new Float32Array(existingMemberCount);
    for (let i = 0; i < existingMemberCount; i += 1) {
      memberRadiusMeters[i] = cellWidthOf(memberCellSlot[i]) * memberScale[i] * 0.5;
    }
    const raster = buildOccupancyRaster(
      { xMin, xMax, zMin, zMax },
      coverageFill.occupancyCellMeters,
      existingMemberCount,
      memberX,
      memberZ,
      memberRadiusMeters,
    );

    // 二次格子: 既存格子を x, z ともに半間隔(CLUSTER_SPACING_M / 2)ずらした
    // もの。jitter は既存と同じ決定論的な方式だが、既存 cluster と衝突しな
    // い別の seed ストリーム(gapSeed)を使う。
    const gapSeed = seed + GAP_SEED_SALT;
    const hGap = (index: number) => hashIndexTo01(index, gapSeed);
    const halfSpacing = CLUSTER_SPACING_M * 0.5;

    for (let j = -1; j <= cols; j += 1) {
      for (let i = -1; i <= cols; i += 1) {
        const n = (j + 1) * (cols + 2) + (i + 1);
        const gapBase = n * CLUSTER_HASH_STRIDE;

        const gcx = xMin + (
          i + 0.5 + (hGap(gapBase) - 0.5)
        ) * CLUSTER_SPACING_M + halfSpacing;
        const gcz = zMin + (
          j + 0.5 + (hGap(gapBase + 1) - 0.5)
        ) * CLUSTER_SPACING_M + halfSpacing;

        clusterCandidateCount += 1;

        // b. patch bbox 内: mask の外側へは絶対に広げない。
        if (gcx < xMin || gcx > xMax || gcz < zMin || gcz > zMax) continue;
        // a. 既存と同じ mask 判定関数・同じ閾値(下げない)。
        if (sampleCoverage(gcx, gcz) < maskThreshold) continue;
        // c. 中心まわり半径 gapRadiusMeters の occupancy 被覆率が
        //    gapCoverageMax 未満のときだけ「実際に穴である」と判定する。
        const coverageRatio = sampleGapCoverageRatio(
          raster,
          gcx,
          gcz,
          coverageFill.gapRadiusMeters,
        );
        if (coverageRatio >= coverageFill.gapCoverageMax) continue;

        clusterAcceptedCount += 1;

        const { clusterIndex, A, B, phi, family, dominantGrove, dominantTree, Mc } =
          allocateCluster(gcx, gcz, gapBase, hGap);

        placeClusterMembers(
          clusterIndex, gcx, gcz, A, B, phi, family, dominantGrove, dominantTree,
          Mc, gapBase, hGap,
        );
      }
    }
  }

  // R10 (opt-in): macro shade は cluster 単位で 1 回だけ計算し、同じ cluster の
  // 全 member がその係数を共有する(§49: 高周波ノイズにしない/ビルド時間対策)。
  // args.macroShade が省略、または enabled:false のときはこのブロックが一切
  // 実行されないため、既存の結果を 1 命令も変えない。
  if (args.macroShade?.enabled) {
    const macroShade = args.macroShade;
    const clusterRawShade = new Float32Array(clusterCount);
    for (let c = 0; c < clusterCount; c += 1) {
      clusterRawShade[c] = computeRawMacroShade(macroShade, terrainYAt, clusterX[c], clusterZ[c]);
    }
    const clusterShadeMultiplier = normalizeMacroShade(clusterRawShade, macroShade);
    colorLuminanceSum = 0;
    for (let i = 0; i < memberCount; i += 1) {
      const multiplier = clusterShadeMultiplier[memberCluster[i]];
      memberColorR[i] *= multiplier;
      memberColorG[i] *= multiplier;
      memberColorB[i] *= multiplier;
      colorLuminanceSum += 0.2126 * memberColorR[i] +
        0.7152 * memberColorG[i] +
        0.0722 * memberColorB[i];
    }
  }

  const clusterMemberStart = new Uint32Array(clusterCount + 1);
  clusterMemberStart[0] = 0;
  for (let c = 0; c < clusterCount; c += 1) {
    clusterMemberStart[c + 1] = clusterMemberStart[c] + clusterMemberCount[c];
  }

  return {
    clusterCount,
    memberCount,
    clusterX: clusterX.slice(0, clusterCount),
    clusterY: clusterY.slice(0, clusterCount),
    clusterZ: clusterZ.slice(0, clusterCount),
    clusterRadiusA: clusterRadiusA.slice(0, clusterCount),
    clusterRadiusB: clusterRadiusB.slice(0, clusterCount),
    clusterRotation: clusterRotation.slice(0, clusterCount),
    clusterFamily: clusterFamily.slice(0, clusterCount),
    clusterMemberStart,
    memberX: memberX.slice(0, memberCount),
    memberY: memberY.slice(0, memberCount),
    memberZ: memberZ.slice(0, memberCount),
    memberScale: memberScale.slice(0, memberCount),
    memberMirrored: memberMirrored.slice(0, memberCount),
    memberKind: memberKind.slice(0, memberCount),
    memberCellSlot: memberCellSlot.slice(0, memberCount),
    memberCluster: memberCluster.slice(0, memberCount),
    memberFamily: memberFamily.slice(0, memberCount),
    memberColorR: memberColorR.slice(0, memberCount),
    memberColorG: memberColorG.slice(0, memberCount),
    memberColorB: memberColorB.slice(0, memberCount),
    stats: {
      clusterLatticeCols: cols,
      clusterCandidateCount,
      clusterAcceptedCount,
      memberPlacedCount: memberCount,
      memberRejectedByMaskCount,
      memberRejectedByBboxCount,
      groveInstanceCount,
      treeInstanceCount,
      familyClusterCounts,
      meanSquareScale: memberCount > 0 ? squareScaleSum / memberCount : 0,
      meanSquareFootprintWidth: memberCount > 0 ? squareFootprintWidthSum / memberCount : 0,
      meanFootprintWidth: memberCount > 0 ? footprintWidthSum / memberCount : 0,
      meanColorLuminanceMultiplier: memberCount > 0 ? colorLuminanceSum / memberCount : 0,
    },
  };
}
