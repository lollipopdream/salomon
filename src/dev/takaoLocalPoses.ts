import type { Vec3 } from '../types';

/**
 * 高尾山1号路の Takao-local composition preset。
 *
 * route の主軸はほぼ東西で、始点(清滝駅)→終点(高尾山頂)の方位はおよそ 252.7° である。
 * 構図の基本は「主軸に直交する南寄り(azimuth 146〜150°)から見て、route を画面を横切る
 * 線として読ませる」ことで、overview / route-middle / summit がこれにあたる。
 *
 * **T-route-early(azimuth 70°)だけは意図的な例外**で、こちらは主軸に直交せず
 * 主軸に沿って(清滝駅側から山頂方向へ)見る。起点 → 中腹 → 山頂の高低差と順序を
 * 1枚で読ませるためであり、直交構図では出せない奥行きが出る。
 *
 * 俯角はいずれも 12〜18° と浅い。runtime の overview 用カメラ(俯角およそ 48〜51°)は
 * 真上から見下ろす「地図」的な見え方になり、高尾山がどれか特定できなかった。俯角を下げ、
 * lookAt を route 点より 60〜300 m 持ち上げることで、稜線が空を背負う「山」の画になる。
 *
 * ここの数値はすべて実 scene で目視確認しながら決めた実測値である(反復ログ:
 * outputs/matsu-h01-takao-local-still-export/composition-notes.md)。
 */

const DEG_TO_RAD = Math.PI / 180;

export interface TakaoLocalPoseSpec {
  id: string;
  /** target を route 上のどこに置くか。0=清滝駅, 1=高尾山頂 */
  targetFraction: number;
  /** 北=0、東=90、南=180 の時計回り方位。カメラが target から見てどの方角に居るか */
  azimuthDeg: number;
  /** 俯角。0=水平, 90=真上 */
  pitchDeg: number;
  /** target からカメラまでの直線距離 [m] */
  distanceMeters: number;
  fov: number;
  /** target を route 点より上に持ち上げる量 [m]。既定 0 */
  targetLiftMeters?: number;
}

export interface ResolvedTakaoLocalPose {
  position: Vec3;
  target: Vec3;
  fov: number;
}

export const TAKAO_LOCAL_POSES: readonly TakaoLocalPoseSpec[] = [
  // 以下の4値は推測ではなく、実 scene の camera を動かして 1024×576 で目視確認しながら
  // 決めた実測値である(反復ログ:
  // outputs/matsu-h01-takao-local-still-export/composition-notes.md)。
  {
    // 1号路の全長(清滝駅→高尾山頂)が1枚に収まり、かつ高尾山の山体が
    // 最も手前の大きな塊として立つ構図。俯角15°で空が42.3%入る(実測。稜線最上部は上から32.7%)。
    id: 'T-overview',
    targetFraction: 0.57,
    azimuthDeg: 146,
    pitchDeg: 15,
    distanceMeters: 2600,
    fov: 44,
    targetLiftMeters: 300,
  },
  {
    // 清滝駅側から route 主軸に沿って山頂方向(方位およそ243°)を見る。
    // 起点 → 中腹 → 山頂の高低差と順序が1枚で読める。
    id: 'T-route-early',
    targetFraction: 0.08,
    azimuthDeg: 70,
    pitchDeg: 12,
    distanceMeters: 800,
    fov: 45,
    targetLiftMeters: 60,
  },
  {
    // 中腹(浄心門・高尾山駅/霞台の周辺)を route 主軸に直交する南南東から見る。
    // 尾根を横切るトレイルとして route が読める。
    id: 'T-route-middle',
    targetFraction: 0.52,
    azimuthDeg: 150,
    pitchDeg: 18,
    distanceMeters: 900,
    fov: 45,
    targetLiftMeters: 80,
  },
  {
    // 薬王院から山頂への最後の登り。距離を1150mに取っているのは、
    // これより寄せるとDEM(23.3m cell)と航空写真テクスチャの解像度限界で
    // 前景がぼやけるため(近距離を試した結果は composition-notes.md 参照)。
    id: 'T-summit',
    targetFraction: 0.97,
    azimuthDeg: 132,
    pitchDeg: 16,
    distanceMeters: 1150,
    fov: 42,
    targetLiftMeters: 60,
  },
];

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * spec と route 点列から実際のカメラ position / target を計算する。
 * routePoints が空の場合は呼び出し側(resolveTakaoLocalPose)がガードする前提。
 */
export function resolveTakaoLocalPoseSpec(
  spec: TakaoLocalPoseSpec,
  routePoints: readonly Vec3[],
): ResolvedTakaoLocalPose {
  const index = Math.round((routePoints.length - 1) * clamp01(spec.targetFraction));
  const routePoint = routePoints[index];
  const target: Vec3 = {
    x: routePoint.x,
    y: routePoint.y + (spec.targetLiftMeters ?? 0),
    z: routePoint.z,
  };

  const azimuthRad = spec.azimuthDeg * DEG_TO_RAD;
  const pitchRad = spec.pitchDeg * DEG_TO_RAD;
  const d = spec.distanceMeters;

  const offset: Vec3 = {
    x: d * Math.cos(pitchRad) * Math.sin(azimuthRad),
    y: d * Math.sin(pitchRad),
    z: -d * Math.cos(pitchRad) * Math.cos(azimuthRad),
  };

  const position: Vec3 = {
    x: target.x + offset.x,
    y: target.y + offset.y,
    z: target.z + offset.z,
  };

  return { position, target, fov: spec.fov };
}

/** poseId から TAKAO_LOCAL_POSES を探して解決する。未知 id や空の routePoints は undefined。 */
export function resolveTakaoLocalPose(
  poseId: string,
  routePoints: readonly Vec3[],
): ResolvedTakaoLocalPose | undefined {
  if (routePoints.length === 0) {
    return undefined;
  }
  const spec = TAKAO_LOCAL_POSES.find((candidate) => candidate.id === poseId);
  if (!spec) {
    return undefined;
  }
  return resolveTakaoLocalPoseSpec(spec, routePoints);
}
