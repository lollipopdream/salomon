import { describe, expect, it } from 'vitest';

import {
  SPOT_ARRIVAL_TIER_BY_POI_ID,
  SPOT_ARRIVAL_TIMING_MS,
} from '../config/defaults/spotArrival';
import { ROUTE_FOLLOW_BASE_TRAVEL_MS } from '../config/defaults/cameraSpotHold';
import {
  computeAllSpotArrivalStates,
  computeSpotArrivalState,
  computeSummitArrivalState,
  createIdleSpotArrivalStates,
  resolveSpotArrivalSpecs,
  type SpotArrivalSpec,
  type SpotArrivalTierTimingMs,
} from './spotArrival';
import { takaoTrail1Route } from './takaoTrail1Route';

const BASE_TRAVEL_MS = 10_000;
const TIMING: SpotArrivalTierTimingMs = {
  approachMs: 1_000,
  dwellMs: 2_000,
  departMs: 1_000,
};
const SPOT: SpotArrivalSpec = {
  poiId: 'test-spot',
  progressAt: 0.5,
  tier: 'primary',
};

const SUMMIT_INPUT = {
  transitionToSummitMs: 1_500,
  summitHoldMs: 1_600,
} as const;

describe('computeSpotArrivalState', () => {
  it('is idle with zero intensity sufficiently far from the spot', () => {
    expect(computeSpotArrivalState(0.1, SPOT, TIMING, BASE_TRAVEL_MS)).toEqual({
      poiId: SPOT.poiId,
      tier: SPOT.tier,
      phase: 'idle',
      intensity: 0,
      isActive: false,
    });
  });

  it('increases monotonically during approach and decreases during depart', () => {
    const approachIntensities = [0.305, 0.33, 0.37, 0.395].map(
      (progress) => computeSpotArrivalState(
        progress,
        SPOT,
        TIMING,
        BASE_TRAVEL_MS,
      ).intensity,
    );
    const departIntensities = [0.605, 0.63, 0.67, 0.695].map(
      (progress) => computeSpotArrivalState(
        progress,
        SPOT,
        TIMING,
        BASE_TRAVEL_MS,
      ).intensity,
    );

    for (let index = 1; index < approachIntensities.length; index += 1) {
      expect(approachIntensities[index]).toBeGreaterThan(
        approachIntensities[index - 1],
      );
    }
    for (let index = 1; index < departIntensities.length; index += 1) {
      expect(departIntensities[index]).toBeLessThan(
        departIntensities[index - 1],
      );
    }
  });

  it('uses arrive at the center and dwell throughout the wider center window', () => {
    const center = computeSpotArrivalState(0.5, SPOT, TIMING, BASE_TRAVEL_MS);
    const dwellBefore = computeSpotArrivalState(
      0.45,
      SPOT,
      TIMING,
      BASE_TRAVEL_MS,
    );
    const dwellAfter = computeSpotArrivalState(
      0.55,
      SPOT,
      TIMING,
      BASE_TRAVEL_MS,
    );

    expect(center).toMatchObject({ phase: 'arrive', intensity: 1 });
    expect(dwellBefore).toMatchObject({ phase: 'dwell', intensity: 1 });
    expect(dwellAfter).toMatchObject({ phase: 'dwell', intensity: 1 });
  });

  it.each([1e-3, 1e-5, 1e-7])(
    'keeps intensity continuous across every window boundary at epsilon %s',
    (epsilon) => {
      const boundaries = [0.3, 0.4, 0.6, 0.7];

      for (const boundary of boundaries) {
        const before = computeSpotArrivalState(
          boundary - epsilon,
          SPOT,
          TIMING,
          BASE_TRAVEL_MS,
        ).intensity;
        const after = computeSpotArrivalState(
          boundary + epsilon,
          SPOT,
          TIMING,
          BASE_TRAVEL_MS,
        ).intensity;

        expect(Math.abs(after - before)).toBeLessThanOrEqual(
          (2 * epsilon) / 0.1 + Number.EPSILON * 4,
        );
      }
    },
  );
});

describe('computeSummitArrivalState', () => {
  it('is idle before approach begins during transition-to-summit', () => {
    expect(computeSummitArrivalState({
      ...SUMMIT_INPUT,
      phaseKind: 'transition-to-summit',
      phaseElapsedMs: 500,
    }, TIMING)).toEqual({
      poiId: 'summit',
      tier: 'primary',
      phase: 'idle',
      intensity: 0,
      isActive: false,
    });
  });

  it('increases intensity monotonically during the late transition approach', () => {
    const states = [600, 900, 1_200, 1_499].map((phaseElapsedMs) => (
      computeSummitArrivalState({
        ...SUMMIT_INPUT,
        phaseKind: 'transition-to-summit',
        phaseElapsedMs,
      }, TIMING)
    ));
    const intensities = states.map((state) => state.intensity);

    expect(states.every((state) => state.phase === 'approach')).toBe(true);

    for (let index = 1; index < intensities.length; index += 1) {
      expect(intensities[index]).toBeGreaterThan(intensities[index - 1]);
    }
  });

  it('enters arrive at the start of summit-hold, then dwell', () => {
    expect(computeSummitArrivalState({
      ...SUMMIT_INPUT,
      phaseKind: 'summit-hold',
      phaseElapsedMs: 0,
    }, TIMING)).toMatchObject({ phase: 'arrive', intensity: 1, isActive: true });
    expect(computeSummitArrivalState({
      ...SUMMIT_INPUT,
      phaseKind: 'summit-hold',
      phaseElapsedMs: 200,
    }, TIMING)).toMatchObject({ phase: 'dwell', intensity: 1, isActive: true });
  });

  it('departs toward zero immediately before summit-hold ends', () => {
    const state = computeSummitArrivalState({
      ...SUMMIT_INPUT,
      phaseKind: 'summit-hold',
      phaseElapsedMs: SUMMIT_INPUT.summitHoldMs - 1,
    }, TIMING);

    expect(state.phase).toBe('depart');
    expect(state.intensity).toBeGreaterThan(0);
    expect(state.intensity).toBeLessThan(0.01);
  });

  it('clamps dwell into a short hold and always returns bounded intensity', () => {
    const shortHoldInput = {
      transitionToSummitMs: 1_500,
      summitHoldMs: 500,
    } as const;

    for (
      let phaseElapsedMs = 0;
      phaseElapsedMs <= shortHoldInput.summitHoldMs;
      phaseElapsedMs += 10
    ) {
      const state = computeSummitArrivalState({
        ...shortHoldInput,
        phaseKind: 'summit-hold',
        phaseElapsedMs,
      }, TIMING);

      expect(Number.isFinite(state.intensity)).toBe(true);
      expect(state.intensity).toBeGreaterThanOrEqual(0);
      expect(state.intensity).toBeLessThanOrEqual(1);
    }

    expect(computeSummitArrivalState({
      ...shortHoldInput,
      phaseKind: 'summit-hold',
      phaseElapsedMs: shortHoldInput.summitHoldMs,
    }, TIMING)).toMatchObject({ phase: 'idle', intensity: 0, isActive: false });
  });

  it('is idle in unrelated phases', () => {
    expect(computeSummitArrivalState({
      ...SUMMIT_INPUT,
      phaseKind: 'other',
      phaseElapsedMs: 0,
    }, TIMING)).toMatchObject({ phase: 'idle', intensity: 0, isActive: false });
  });
});

describe('computeAllSpotArrivalStates', () => {
  it('activates at most one spot when windows do not overlap', () => {
    const spots: SpotArrivalSpec[] = [
      { poiId: 'first', progressAt: 0.2, tier: 'secondary' },
      { poiId: 'second', progressAt: 0.8, tier: 'primary' },
    ];

    for (const progress of [0, 0.2, 0.5, 0.8, 1]) {
      const states = computeAllSpotArrivalStates(
        progress,
        spots,
        SPOT_ARRIVAL_TIMING_MS,
        BASE_TRAVEL_MS,
      );
      expect(states.filter((state) => state.isActive).length).toBeLessThanOrEqual(1);
    }
  });

  it('selects maximum intensity and breaks equal-intensity ties toward primary', () => {
    const unequalStates = computeAllSpotArrivalStates(
      0.5,
      [
        { poiId: 'weaker-primary', progressAt: 0.65, tier: 'primary' },
        { poiId: 'stronger-secondary', progressAt: 0.5, tier: 'secondary' },
      ],
      {
        primary: TIMING,
        secondary: TIMING,
      },
      BASE_TRAVEL_MS,
    );
    const tiedStates = computeAllSpotArrivalStates(
      0.5,
      [
        { poiId: 'secondary', progressAt: 0.5, tier: 'secondary' },
        { poiId: 'primary', progressAt: 0.5, tier: 'primary' },
      ],
      {
        primary: TIMING,
        secondary: TIMING,
      },
      BASE_TRAVEL_MS,
    );

    expect(
      unequalStates.find((state) => state.isPrimaryActive)?.poiId,
    ).toBe('stronger-secondary');
    expect(tiedStates.filter((state) => state.isPrimaryActive)).toHaveLength(1);
    expect(tiedStates.find((state) => state.isPrimaryActive)?.poiId).toBe('primary');
  });
});

describe('createIdleSpotArrivalStates', () => {
  it('returns an explicitly idle state for every spot', () => {
    const spots: SpotArrivalSpec[] = [
      { poiId: 'first', progressAt: 0.2, tier: 'secondary' },
      { poiId: 'second', progressAt: 0.8, tier: 'primary' },
    ];

    expect(createIdleSpotArrivalStates(spots)).toEqual([
      {
        poiId: 'first',
        tier: 'secondary',
        phase: 'idle',
        intensity: 0,
        isActive: false,
        isPrimaryActive: false,
      },
      {
        poiId: 'second',
        tier: 'primary',
        phase: 'idle',
        intensity: 0,
        isActive: false,
        isPrimaryActive: false,
      },
    ]);
  });
});

describe('resolveSpotArrivalSpecs', () => {
  it('resolves all six real route spots to finite progress values in range', () => {
    const specs = resolveSpotArrivalSpecs(
      takaoTrail1Route,
      SPOT_ARRIVAL_TIER_BY_POI_ID,
    );

    expect(specs).toHaveLength(6);
    expect(specs.map((spec) => spec.poiId)).toEqual(
      Object.keys(SPOT_ARRIVAL_TIER_BY_POI_ID),
    );
    for (const spec of specs) {
      expect(Number.isFinite(spec.progressAt)).toBe(true);
      expect(spec.progressAt).toBeGreaterThanOrEqual(0);
      expect(spec.progressAt).toBeLessThanOrEqual(1);
    }
  });

  it('uses the production base duration without importing it in the engine', () => {
    const summit = resolveSpotArrivalSpecs(
      takaoTrail1Route,
      SPOT_ARRIVAL_TIER_BY_POI_ID,
    ).find((spec) => spec.poiId === 'summit');

    expect(summit).toBeDefined();
    expect(
      computeSpotArrivalState(
        summit!.progressAt,
        summit!,
        SPOT_ARRIVAL_TIMING_MS.primary,
        ROUTE_FOLLOW_BASE_TRAVEL_MS,
      ).phase,
    ).toBe('arrive');
  });
});
