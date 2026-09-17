import { describe, expect, it } from 'vitest';

import { defaultSettings, validateSettings } from '../settings';
import { cameraTimelineDefaults } from './cameraTiming';

// pre-v3 baseline (BUG-V3-01/02, outputs/visual_bug_analysis_v3.md)
const PRE_V3_BASELINE_MS = {
  transitionToSummitMs: 300,
  summitHoldMs: 300,
  ascendToHighOverviewMs: 200,
} as const;

describe('cameraTimelineDefaults', () => {
  it('extends transitionToSummitMs beyond the pre-v3 baseline (BUG-V3-01)', () => {
    expect(cameraTimelineDefaults.transitionToSummitMs).toBeGreaterThan(
      PRE_V3_BASELINE_MS.transitionToSummitMs,
    );
  });

  it('extends summitHoldMs beyond the pre-v3 baseline (P6 recognizability)', () => {
    expect(cameraTimelineDefaults.summitHoldMs).toBeGreaterThan(
      PRE_V3_BASELINE_MS.summitHoldMs,
    );
  });

  it('extends ascendToHighOverviewMs beyond the pre-v3 baseline (BUG-V3-02 primary suspect)', () => {
    expect(cameraTimelineDefaults.ascendToHighOverviewMs).toBeGreaterThan(
      PRE_V3_BASELINE_MS.ascendToHighOverviewMs,
    );
  });

  it('satisfies the validateSettings hold-window constraint with the updated holdAtEndMs', () => {
    expect(validateSettings(defaultSettings)).toBe(true);
  });
});
