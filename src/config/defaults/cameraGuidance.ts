import type { CameraGuidanceConfig } from '../../types';

export const cameraGuidanceDefaults: CameraGuidanceConfig = {
  resampleSpacingMeters: 12,
  smoothingWindowRadiusMeters: 60,
  maxDeviationMeters: 45,
};
