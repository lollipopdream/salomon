import type { RoutePath, Vec3 } from '../types';

/**
 * points[0]を起点(距離0)とした、各点までの累積直線距離(3次元ユークリッド距離の合計)を返す。
 * 戻り値の長さは points.length と同じ。
 */
export function computeCumulativeDistances(points: Vec3[]): number[] {
  if (points.length === 0) {
    return [];
  }

  const distances: number[] = [0];

  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const segmentDistance = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    distances.push(distances[i - 1] + segmentDistance);
  }

  return distances;
}

/**
 * route.points の緯度経度を平面プロキシとして累積し、指定点のルート進捗を返す。
 * 高尾山単一山塊の相対的な到達位置には、標高を除外した近似で十分な精度を見込む。
 */
export function computeApproximateRouteProgressForIndex(
  route: RoutePath,
  pointIndex: number,
): number {
  const proxyPoints: Vec3[] = route.points.map((point) => ({
    x: point.lng,
    y: 0,
    z: point.lat,
  }));
  const distances = computeCumulativeDistances(proxyPoints);

  if (distances.length === 0) {
    return 0;
  }

  const total = distances[distances.length - 1];
  if (!Number.isFinite(total) || total <= 0) {
    return 0;
  }

  const clampedIndex = Math.min(Math.max(pointIndex, 0), distances.length - 1);
  return distances[clampedIndex] / total;
}

/** poiIdに対応するルート点の進捗を返す。該当点がなければundefinedを返す。 */
export function computeRouteProgressForPoiId(
  route: RoutePath,
  poiId: string,
): number | undefined {
  const index = route.points.findIndex((point) => point.poiId === poiId);

  if (index === -1) {
    return undefined;
  }

  return computeApproximateRouteProgressForIndex(route, index);
}

/** aからbへ、tの割合(0..1)で線形補間した点を返す。 */
function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

/**
 * progressに対応する単一のワールド座標を返す純粋関数。
 * getPartialRoutePoints(...)の末尾要素と常に同じ値を返すが、
 * 部分配列を構築しない(二分探索+単一オブジェクト生成のみ)。
 * routeVisualのような「部分ルート線そのもの」が必要な描画には
 * 引き続きgetPartialRoutePointsを使うこと。
 */
export function findRoutePointAtProgress(
  points: Vec3[],
  cumulativeDistances: number[],
  progress: number,
): Vec3 {
  const clampedProgress = Math.min(Math.max(progress, 0), 1);

  if (points.length === 0) {
    return { x: 0, y: 0, z: 0 };
  }
  if (points.length === 1) {
    return { ...points[0] };
  }

  const totalDistance = cumulativeDistances[cumulativeDistances.length - 1];
  if (clampedProgress <= 0 || totalDistance <= 0) {
    return { ...points[0] };
  }
  if (clampedProgress >= 1) {
    return { ...points[points.length - 1] };
  }

  const targetDistance = clampedProgress * totalDistance;

  // cumulativeDistancesは単調非減少。targetDistance以上になる最小indexを二分探索する。
  let low = 1;
  let high = cumulativeDistances.length - 1;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (cumulativeDistances[mid] < targetDistance) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  const prevIndex = low - 1;
  const prevDistance = cumulativeDistances[prevIndex];
  const segmentDistance = cumulativeDistances[low] - prevDistance;
  const t = segmentDistance === 0
    ? 0
    : (targetDistance - prevDistance) / segmentDistance;

  return lerpVec3(points[prevIndex], points[low], t);
}

/**
 * progress(0..1)に応じて、麓側(points[0])から現在の進捗位置までの
 * 連続した部分点列を返す純粋関数。
 * progressは0..1の範囲へクランプしてから処理する。
 */
export function getPartialRoutePoints(
  points: Vec3[],
  cumulativeDistances: number[],
  progress: number,
): Vec3[] {
  const clampedProgress = Math.min(Math.max(progress, 0), 1);

  if (points.length === 0) {
    return [];
  }

  if (clampedProgress <= 0) {
    return [points[0]];
  }

  if (clampedProgress >= 1) {
    return [...points];
  }

  const totalDistance = cumulativeDistances[cumulativeDistances.length - 1];
  const targetDistance = clampedProgress * totalDistance;

  const result: Vec3[] = [];

  for (let i = 0; i < points.length; i += 1) {
    if (cumulativeDistances[i] <= targetDistance) {
      result.push(points[i]);
    } else {
      const prevIndex = i - 1;
      // targetDistanceが最初の点(距離0)より前になることは
      // clampedProgress > 0の分岐内では起こらないため、prevIndexは常に有効。
      const prevDistance = cumulativeDistances[prevIndex];
      const segmentDistance = cumulativeDistances[i] - prevDistance;
      const t = segmentDistance === 0
        ? 0
        : (targetDistance - prevDistance) / segmentDistance;

      result.push(lerpVec3(points[prevIndex], points[i], t));
      break;
    }
  }

  return result;
}
