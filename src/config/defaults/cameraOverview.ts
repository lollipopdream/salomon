import type {
  HighOverviewCameraConfig,
  OverviewCameraConfig,
} from '../../types';

// CV2-T1/leader correction: radiusFactor/heightFactor tuned to the boundary
// value that still crops the near+left+right terrain edges (see the
// isNearOrSideEdgeSample perimeter test in cameraController.test.ts) across
// the overview pose and all of its interpolation endpoints
// (descend-to-overview/transition-in/ascend-to-high-overview/
// return-to-overview). Values much below this (e.g. 0.12/0.10, an earlier
// over-correction) skim the terrain canopy at an unusably close distance;
// values above ~0.15/0.115 let a terrain edge back into frame.
export const overviewCameraDefaults: OverviewCameraConfig = {
  radiusFactor: 0.145,
  heightFactor: 0.11,
  elevationLiftFactor: 1.5,
};

export const highOverviewCameraDefaults: HighOverviewCameraConfig = {
  radiusFactor: 0.15,
  heightFactor: 0.13,
  // Working Assumption: 保守的に周回なしで開始し、後続タスクのHuman Visual Gateで調整する。
  orbitDegrees: 0,
  // Working Assumption (MV3-T2 / motion_reimplementation_plan_v3.md P1):
  // easeOutQuartで広め/高めのhold開始位置からbase値へ収束する。
  // CR8: hold開始azimuthから固定base azimuth(10°)へ、radius/heightと同じcurveで収束する。
  holdDriftStartRadiusFactor: 0.15 * 1.08,
  holdDriftStartHeightFactor: 0.13 * 1.08,
  // CR8-PRECHECK: 実routeのendpoint間を結ぶside-on方向から導出し、実DEM tile相当route geometryと既存compositionGrid terrain testsの双方で検証済み。
  holdDriftStartAzimuthDegrees: 72.7000166641626,
};
