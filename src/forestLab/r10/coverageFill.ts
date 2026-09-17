/**
 * R10: opt-in な「森林 coverage の穴埋め(gap-targeted fill)」に使う純粋関数群。
 *
 * 背景: Forest Lab candidate 5 の層別 capture 実測で、OVERVIEW カメラの露出
 * (non-forest) 画素の連結成分を見ると、一様な薄さではなく大きな穴が数個
 * 存在することが分かっている。ここでは「まだ被覆されていない領域(gap)」
 * だけを検出するための occupancy raster と、その raster に対する半径サンプ
 * リングを提供する。THREE には一切依存しない(テスト容易性のため)。
 *
 * このモジュールは「どこが穴か」だけを判定する。既存 cluster/member を動か
 * したり、乱数で候補中心を作ったりする責務は持たない(呼び出し側の
 * clusterPlacement.ts が担う)。
 */

export interface CoverageFillConfig {
  enabled: boolean;
  /** 追加候補中心のまわりで occupancy を調べる半径(m)。既定 22m 前後。 */
  gapRadiusMeters: number;
  /**
   * `gapRadiusMeters` 円内の occupancy 被覆率がこの値未満のときだけ
   * 「実際に穴である」と判定する(未満のみ許可)。既定 0.5。
   */
  gapCoverageMax: number;
  /** occupancy raster の 1 セルの一辺(m)。既定 4m 前後。 */
  occupancyCellMeters: number;
}

export const DEFAULT_COVERAGE_FILL_CONFIG: CoverageFillConfig = {
  enabled: false,
  gapRadiusMeters: 22,
  gapCoverageMax: 0.5,
  occupancyCellMeters: 4,
};

export interface WorldBbox {
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
}

export interface OccupancyRaster {
  xMin: number;
  zMin: number;
  cellMeters: number;
  cols: number;
  rows: number;
  /** 1 = 既存 member の実フットプリントで占有されているセル。 */
  occupied: Uint8Array;
}

const MIN_CELL_METERS = 1e-3;

/**
 * 既存 member の実フットプリント(中心 `memberX[i]`,`memberZ[i]` と半径
 * `memberRadiusMeters[i]`)から occupancy raster を作る。セル中心が member の
 * 円内に入っていればそのセルを占有扱いにする。非有限な入力は安全に無視する。
 */
export function buildOccupancyRaster(
  bbox: WorldBbox,
  cellMeters: number,
  memberCount: number,
  memberX: Float32Array,
  memberZ: Float32Array,
  memberRadiusMeters: Float32Array,
): OccupancyRaster {
  const safeCellMeters = Math.max(MIN_CELL_METERS, cellMeters);
  const cols = Math.max(1, Math.ceil((bbox.xMax - bbox.xMin) / safeCellMeters));
  const rows = Math.max(1, Math.ceil((bbox.zMax - bbox.zMin) / safeCellMeters));
  const occupied = new Uint8Array(cols * rows);

  for (let i = 0; i < memberCount; i += 1) {
    const x = memberX[i];
    const z = memberZ[i];
    const r = memberRadiusMeters[i];
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(r) || r <= 0) continue;

    const colMin = Math.max(0, Math.floor((x - r - bbox.xMin) / safeCellMeters));
    const colMax = Math.min(cols - 1, Math.floor((x + r - bbox.xMin) / safeCellMeters));
    const rowMin = Math.max(0, Math.floor((z - r - bbox.zMin) / safeCellMeters));
    const rowMax = Math.min(rows - 1, Math.floor((z + r - bbox.zMin) / safeCellMeters));
    const rSq = r * r;

    for (let row = rowMin; row <= rowMax; row += 1) {
      const cz = bbox.zMin + (row + 0.5) * safeCellMeters;
      const rowOffset = row * cols;
      for (let col = colMin; col <= colMax; col += 1) {
        const cx = bbox.xMin + (col + 0.5) * safeCellMeters;
        const dx = cx - x;
        const dz = cz - z;
        if (dx * dx + dz * dz <= rSq) {
          occupied[rowOffset + col] = 1;
        }
      }
    }
  }

  return { xMin: bbox.xMin, zMin: bbox.zMin, cellMeters: safeCellMeters, cols, rows, occupied };
}

/**
 * `(x, z)` を中心とする半径 `radiusMeters` の円内にある raster セルのうち、
 * 占有セルが占める割合を返す。円内にサンプル可能なセルが 1 つも無い(raster
 * の外)場合は「穴かどうか判定不能」を fail-safe に「穴である(0)」として扱う。
 */
export function sampleGapCoverageRatio(
  raster: OccupancyRaster,
  x: number,
  z: number,
  radiusMeters: number,
): number {
  const { xMin, zMin, cellMeters, cols, rows, occupied } = raster;
  const safeRadius = Math.max(0, radiusMeters);
  const colMin = Math.max(0, Math.floor((x - safeRadius - xMin) / cellMeters));
  const colMax = Math.min(cols - 1, Math.floor((x + safeRadius - xMin) / cellMeters));
  const rowMin = Math.max(0, Math.floor((z - safeRadius - zMin) / cellMeters));
  const rowMax = Math.min(rows - 1, Math.floor((z + safeRadius - zMin) / cellMeters));
  const rSq = safeRadius * safeRadius;

  let total = 0;
  let occupiedCount = 0;
  for (let row = rowMin; row <= rowMax; row += 1) {
    const cz = zMin + (row + 0.5) * cellMeters;
    const rowOffset = row * cols;
    for (let col = colMin; col <= colMax; col += 1) {
      const cx = xMin + (col + 0.5) * cellMeters;
      const dx = cx - x;
      const dz = cz - z;
      if (dx * dx + dz * dz > rSq) continue;
      total += 1;
      if (occupied[rowOffset + col] === 1) occupiedCount += 1;
    }
  }

  if (total === 0) return 0;
  return occupiedCount / total;
}
