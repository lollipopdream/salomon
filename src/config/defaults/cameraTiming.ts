import type { CameraTimelineConfig } from '../../types';

export const cameraTimelineDefaults: CameraTimelineConfig = {
  // Working Assumption: high-overviewの各時間は後続タスクのHuman Visual Gateで最終調整する。
  highOverviewHoldMs: 1500,
  descendToOverviewMs: 1200,
  overviewHoldMs: 1200,
  transitionInMs: 1400,
  // MV3-T3: BUG-V3-01の知覚上のジャンプを緩和するため延長。
  transitionToSummitMs: 1500,
  // MV3-T3: summit-holdを独立したカットとして認識できるよう延長。
  summitHoldMs: 1600,
  returnToOverviewMs: 1800,
  // MV3-T3: BUG-V3-02の知覚上のジャンプを緩和するため延長。
  ascendToHighOverviewMs: 900,
  arcLiftMeters: 800,
};
