import type { CinematicRailConfig } from '../../types';

export const cinematicRailDefaults: CinematicRailConfig = {
  keyPoses: [
    { progress: 0.00, heightMeters: 220, behindMeters: 260, lateralOffsetMeters: 60, headingWindowProgress: 0.01, lookAheadProgress: 0.10, landmarkWeight: 0, targetLiftMeters: 55 },
    { progress: 0.10, heightMeters: 240, behindMeters: 365, lateralOffsetMeters: 65, headingWindowProgress: 0.28, headingReferenceProgress: 0, anchorReferenceProgress: 0.118, lookAheadProgress: 0.10, landmarkWeight: 0, targetLiftMeters: 53 },
    { progress: 0.20, heightMeters: 260, behindMeters: 470, lateralOffsetMeters: 70, headingWindowProgress: 0.28, lookAheadProgress: 0.10, landmarkWeight: 0, targetLiftMeters: 50 },
    { progress: 0.30, heightMeters: 260, behindMeters: 470, lateralOffsetMeters: 78, headingWindowProgress: 0.28, lookAheadProgress: 0.12, landmarkWeight: 0, targetLiftMeters: 58 },
    { progress: 0.45, heightMeters: 260, behindMeters: 470, lateralOffsetMeters: 90, headingWindowProgress: 0.28, lookAheadProgress: 0.15, landmarkWeight: 0, targetLiftMeters: 70 },
    // Advance the position anchors through the hairpin while keeping placement
    // aligned to one broad route trend instead of each switchback's tangent.
    { progress: 0.68, heightMeters: 258, behindMeters: 335, lateralOffsetMeters: 45, headingWindowProgress: 0.30, headingReferenceProgress: 0.57, anchorReferenceProgress: 0.530, lookAheadProgress: 0.10, landmarkWeight: 0, targetLiftMeters: 50 },
    { progress: 0.73, heightMeters: 257, behindMeters: 279, lateralOffsetMeters: 97, headingWindowProgress: 0.30, headingReferenceProgress: 0.57, anchorReferenceProgress: 0.593, lookAheadProgress: 0.09, landmarkWeight: 0, targetLiftMeters: 65 },
    { progress: 0.78, heightMeters: 263, behindMeters: 282, lateralOffsetMeters: 81, headingWindowProgress: 0.30, headingReferenceProgress: 0.57, anchorReferenceProgress: 0.670, lookAheadProgress: 0.08, landmarkPoiId: 'yakuoin', landmarkWeight: 0.6, targetLiftMeters: 85 },
    { progress: 0.83, heightMeters: 217, behindMeters: 294, lateralOffsetMeters: 1, headingWindowProgress: 0.30, headingReferenceProgress: 0.57, anchorReferenceProgress: 0.823, lookAheadProgress: 0.09, landmarkWeight: 0, targetLiftMeters: 65 },
    { progress: 0.88, heightMeters: 226, behindMeters: 172, lateralOffsetMeters: 70, headingWindowProgress: 0.30, headingReferenceProgress: 0.57, anchorReferenceProgress: 0.872, lookAheadProgress: 0.10, landmarkWeight: 0, targetLiftMeters: 50 },
    { progress: 0.97, heightMeters: 225, behindMeters: 240, lateralOffsetMeters: 65, headingWindowProgress: 0.15, lookAheadProgress: 0.08, landmarkPoiId: 'summit', landmarkWeight: 0.5, targetLiftMeters: 60 },
    { progress: 0.985, heightMeters: 222.8, behindMeters: 236.1, lateralOffsetMeters: 57.3, headingWindowProgress: 0.14, lookAheadProgress: 0.07, landmarkWeight: 0, targetLiftMeters: 50 },
    { progress: 1.00, heightMeters: 218.8, behindMeters: 174.2, lateralOffsetMeters: 121.5, headingWindowProgress: 0.12, lookAheadProgress: 0.05, landmarkPoiId: 'summit', landmarkWeight: 0.8, targetLiftMeters: 40 },
  ],
};
