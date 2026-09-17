import { elevationToWorldHeight } from '../geo/elevation';
import type { ElevationGrid, RoutePath, Vec3 } from '../types';

/**
 * 緯度経度をgrid.bounds基準の分数インデックス(col, row)へ投影する。
 * 戻り値は0..cols-1 / 0..rows-1の範囲外になる場合がある。
 */
export function projectLatLngToGridIndex(
  point: { lat: number; lng: number },
  grid: Pick<ElevationGrid, 'bounds' | 'cols' | 'rows'>,
): { col: number; row: number } {
  const { north, south, east, west } = grid.bounds;
  const col = ((point.lng - west) / (east - west)) * (grid.cols - 1);
  const row = ((north - point.lat) / (north - south)) * (grid.rows - 1);

  return { col, row };
}

/** グリッド標高値を(col, row)の小数位置で双線形補間する。範囲外は端へクランプする。 */
export function sampleElevationBilinear(
  grid: Pick<ElevationGrid, 'values' | 'cols' | 'rows'>,
  col: number,
  row: number,
): number {
  const clampedCol = Math.min(Math.max(col, 0), grid.cols - 1);
  const clampedRow = Math.min(Math.max(row, 0), grid.rows - 1);
  const col0 = Math.floor(clampedCol);
  const row0 = Math.floor(clampedRow);
  const col1 = Math.min(col0 + 1, grid.cols - 1);
  const row1 = Math.min(row0 + 1, grid.rows - 1);
  const colFraction = clampedCol - col0;
  const rowFraction = clampedRow - row0;

  const v00 = grid.values[row0 * grid.cols + col0];
  const v10 = grid.values[row0 * grid.cols + col1];
  const v01 = grid.values[row1 * grid.cols + col0];
  const v11 = grid.values[row1 * grid.cols + col1];

  const top = v00 * (1 - colFraction) + v10 * colFraction;
  const bottom = v01 * (1 - colFraction) + v11 * colFraction;

  return top * (1 - rowFraction) + bottom * rowFraction;
}

/**
 * 現在のRoutePathは非公式のPoC用仮ルートとして扱う。
 * 緯度経度の各点をterrainMesh.tsと同じグリッドインデックス空間へ変換し、
 * z-fighting回避のため地形表面からheightOffsetMetersだけ浮かせる。
 *
 * 注: 疎な点を直線結合するとPhase 1修正ラウンドで確認された「地形貫通」問題が起きるため、
 * 本番のシーン描画(sceneSetup.ts)では代わりに resampleRouteToWorldPoints を使用している。
 * この関数はテスト・比較用に残しており、区間の中間点で地形標高をサンプリングしない点に注意。
 */
export function routePathToWorldPoints(
  route: RoutePath,
  grid: ElevationGrid,
  settings: { elevationScale: number },
  heightOffsetMeters: number,
): Vec3[] {
  return route.points.map((point) => {
    const { col, row } = projectLatLngToGridIndex(point, grid);
    const elevation = sampleElevationBilinear(grid, col, row);

    return {
      x: col * grid.cellSizeMeters,
      y: elevationToWorldHeight(elevation, settings.elevationScale)
        + heightOffsetMeters,
      z: row * grid.cellSizeMeters,
    };
  });
}

/**
 * routeの各区間(連続する2点間)を、線分の投影距離がおおよそ
 * maxSampleSpacingMeters以下になるよう細かく再分割する。
 * 各サンプル点で地形標高を双線形補間して取得することで、地形の起伏に沿った
 * 連続的なワールド座標列を返し、疎な区間の途中でルート線が地形に埋もれる問題を解消する。
 */
export function resampleRouteToWorldPoints(
  route: RoutePath,
  grid: ElevationGrid,
  settings: { elevationScale: number },
  heightOffsetMeters: number,
  maxSampleSpacingMeters: number,
): Vec3[] {
  const worldPoints: Vec3[] = [];

  for (let i = 0; i < route.points.length - 1; i += 1) {
    const a = route.points[i];
    const b = route.points[i + 1];
    const { col: colA, row: rowA } = projectLatLngToGridIndex(a, grid);
    const { col: colB, row: rowB } = projectLatLngToGridIndex(b, grid);
    const segmentDistanceMeters = Math.hypot(
      (colB - colA) * grid.cellSizeMeters,
      (rowB - rowA) * grid.cellSizeMeters,
    );
    const steps = Math.max(
      1,
      Math.ceil(segmentDistanceMeters / maxSampleSpacingMeters),
    );

    // 区間同士の接続点を重複させないため、開始点は最初の区間でのみ追加する。
    for (let j = i === 0 ? 0 : 1; j <= steps; j += 1) {
      const t = j / steps;
      const lat = a.lat + (b.lat - a.lat) * t;
      const lng = a.lng + (b.lng - a.lng) * t;
      const { col, row } = projectLatLngToGridIndex({ lat, lng }, grid);
      const elevation = sampleElevationBilinear(grid, col, row);

      worldPoints.push({
        x: col * grid.cellSizeMeters,
        y: elevationToWorldHeight(elevation, settings.elevationScale)
          + heightOffsetMeters,
        z: row * grid.cellSizeMeters,
      });
    }
  }

  return worldPoints;
}
