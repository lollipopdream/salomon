import type { RouteFollowConfig } from '../../types';

export const routeFollowDefaults: RouteFollowConfig = {
  behindMeters: 300,
  heightMeters: 180,
  directionSampleDeltaProgress: 0.03,
  // The guidance geometry already applies a 60 m distance-window smoothing,
  // so the camera can use a narrower trend window without lagging the route.
  headingSmoothingProgress: 0.08,
  headingLagProgress: 0.06,
  lateralOffsetMeters: 70,
  lookAheadProgress: 0.06,
  targetLiftMeters: 50,
};
