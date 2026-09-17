import { describe, expect, it } from 'vitest';

import type { AnimationConfig } from '../types';
import {
  ROUTE_FOLLOW_BASE_TRAVEL_MS,
  routeFollowSpotsDefaults,
} from '../config/defaults/cameraSpotHold';
import { computeRouteProgressForPoiId } from '../route/routeProgress';
import { takaoTrail1Route } from '../route/takaoTrail1Route';
import {
  advanceAnimationState,
  buildRouteFollowTimeline,
  buildRouteFollowTimelineForRoute,
  computeEffectiveMotionDeltaMs,
  computeProgress,
  computeRouteFollowProgress,
  computeRouteFollowSpotExtraMs,
  createInitialAnimationState,
  cycleDurationMs,
  evaluateRouteFollowProgress,
  restartAnimationState,
} from './progress';
import type { ResolvedRouteFollowSpotEvent } from './progress';

const config: AnimationConfig = {
  playDurationMs: 10_000,
  holdAtEndMs: 2_000,
};

describe('cycleDurationMs', () => {
  it('returns the sum of playDurationMs and holdAtEndMs', () => {
    expect(cycleDurationMs(config)).toBe(12_000);
  });
});

describe('createInitialAnimationState', () => {
  it('returns elapsedMs=0', () => {
    expect(createInitialAnimationState()).toEqual({ elapsedMs: 0 });
  });
});

describe('computeProgress', () => {
  it('returns 0 when elapsedMs is 0', () => {
    const state = { elapsedMs: 0 };
    expect(computeProgress(state, config)).toBe(0);
  });

  it('returns ~0.5 when elapsedMs is 50% of playDurationMs', () => {
    const state = { elapsedMs: 5_000 };
    expect(computeProgress(state, config)).toBeCloseTo(0.5);
  });

  it('returns 1 during the hold window (playDurationMs <= elapsedMs < cycleDurationMs)', () => {
    const atPlayEnd = { elapsedMs: 10_000 };
    const midHold = { elapsedMs: 11_000 };
    const justBeforeCycleEnd = { elapsedMs: 11_999 };

    expect(computeProgress(atPlayEnd, config)).toBe(1);
    expect(computeProgress(midHold, config)).toBe(1);
    expect(computeProgress(justBeforeCycleEnd, config)).toBe(1);
  });
});

describe('computeRouteFollowProgress', () => {
  it('maps route-follow from 0 at its start to 1 at play completion', () => {
    const routeFollowStartMs = 4_900;
    const playDurationMs = 11_000;

    expect(
      computeRouteFollowProgress(0, routeFollowStartMs, playDurationMs),
    ).toBe(0);
    expect(
      computeRouteFollowProgress(
        routeFollowStartMs,
        routeFollowStartMs,
        playDurationMs,
      ),
    ).toBe(0);
    expect(
      computeRouteFollowProgress(7_950, routeFollowStartMs, playDurationMs),
    ).toBeCloseTo(0.5);
    expect(
      computeRouteFollowProgress(
        playDurationMs,
        routeFollowStartMs,
        playDurationMs,
      ),
    ).toBe(1);
    expect(
      computeRouteFollowProgress(12_000, routeFollowStartMs, playDurationMs),
    ).toBe(1);
  });

  it('preserves the exact linear result when the optional timeline is omitted or empty', () => {
    const routeFollowStartMs = 4_900;
    const playDurationMs = 11_000;
    const samples = [0, 4_900, 4_901, 7_950, 10_999, 11_000, 12_000];

    for (const elapsedMs of samples) {
      const expected = elapsedMs <= routeFollowStartMs
        ? 0
        : elapsedMs >= playDurationMs
          ? 1
          : (elapsedMs - routeFollowStartMs)
            / (playDurationMs - routeFollowStartMs);

      expect(
        computeRouteFollowProgress(elapsedMs, routeFollowStartMs, playDurationMs),
      ).toBe(expected);
      expect(
        computeRouteFollowProgress(elapsedMs, routeFollowStartMs, playDurationMs, []),
      ).toBe(expected);
    }
  });
});

const representativeEvents: ResolvedRouteFollowSpotEvent[] = [
  {
    progressAt: 0.25,
    kind: 'hold',
    decelMs: 200,
    midMs: 500,
    accelMs: 200,
  },
  {
    progressAt: 0.65,
    kind: 'slow-down',
    decelMs: 250,
    midMs: 500,
    accelMs: 250,
    slowRateFactor: 0.35,
  },
];

function resolveDefaultEvents(): ResolvedRouteFollowSpotEvent[] {
  return routeFollowSpotsDefaults.events.flatMap((event) => {
    const progressAt = computeRouteProgressForPoiId(takaoTrail1Route, event.poiId);
    if (progressAt === undefined) return [];

    const { poiId: _poiId, ...resolvedEvent } = event;
    return [{ ...resolvedEvent, progressAt }];
  });
}

function lastSegment<T>(items: T[]): T | undefined {
  return items[items.length - 1];
}

describe('buildRouteFollowTimeline', () => {
  it('builds progress-monotonic segments from exactly 0 to exactly 1', () => {
    const segments = buildRouteFollowTimeline(
      [...representativeEvents].reverse(),
      16_000,
    );

    expect(segments[0].startProgress).toBe(0);
    expect(lastSegment(segments)?.endProgress).toBe(1);

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      expect(segment.endProgress).toBeGreaterThanOrEqual(segment.startProgress);
      if (index > 0) {
        expect(segment.startProgress).toBe(segments[index - 1].endProgress);
        expect(segment.startMs).toBe(segments[index - 1].endMs);
      }
    }
  });

  it('keeps the declared rate continuous at every segment boundary', () => {
    const segments = buildRouteFollowTimeline(representativeEvents, 16_000);

    for (let index = 1; index < segments.length; index += 1) {
      expect(segments[index].startRatePerMs)
        .toBe(segments[index - 1].endRatePerMs);
    }
  });

  it('uses the configured deceleration, middle, and acceleration durations', () => {
    const segments = buildRouteFollowTimeline(representativeEvents, 16_000);
    const easeDurations = segments
      .filter((segment) => segment.kind === 'ease')
      .map((segment) => segment.endMs - segment.startMs);
    const flatDurations = segments
      .filter((segment) => segment.kind === 'flat')
      .map((segment) => segment.endMs - segment.startMs);
    const slowTravel = segments.find(
      (segment) => segment.kind === 'travel'
        && segment.startRatePerMs === 0.35 / 16_000,
    );

    expect(easeDurations).toEqual([200, 200, 250, 250]);
    expect(flatDurations).toEqual([500]);
    expect((slowTravel?.endMs ?? 0) - (slowTravel?.startMs ?? 0)).toBe(500);
  });

  it('ends at base travel duration plus the net spot-event delay', () => {
    const resolvedEvents = resolveDefaultEvents();
    const travelRate = 1 / ROUTE_FOLLOW_BASE_TRAVEL_MS;
    let cursorProgress = 0;

    for (const event of resolvedEvents) {
      const unclampedDecelStart = event.progressAt - travelRate * event.decelMs;
      if (event.decelMs > 0) {
        if (event.progressAt === 0) {
          expect(unclampedDecelStart).toBeLessThan(cursorProgress);
        } else {
          expect(unclampedDecelStart).toBeGreaterThan(cursorProgress);
        }
      }
      const midRate = event.kind === 'hold'
        ? 0
        : travelRate * (event.slowRateFactor ?? 1);
      cursorProgress = event.progressAt
        + midRate * event.midMs
        + travelRate * event.accelMs;
    }

    const segments = buildRouteFollowTimeline(
      resolvedEvents,
      ROUTE_FOLLOW_BASE_TRAVEL_MS,
    );

    expect(lastSegment(segments)?.endMs).toBe(
      ROUTE_FOLLOW_BASE_TRAVEL_MS
        + computeRouteFollowSpotExtraMs(routeFollowSpotsDefaults.events),
    );
  });

  it('keeps evaluated velocity continuous at every segment boundary', () => {
    const segments = buildRouteFollowTimeline(
      resolveDefaultEvents(),
      ROUTE_FOLLOW_BASE_TRAVEL_MS,
    );
    const sampleDeltaMs = 0.01;
    const travelRate = 1 / ROUTE_FOLLOW_BASE_TRAVEL_MS;
    const nearZeroRate = travelRate * 0.001;

    for (let index = 1; index < segments.length; index += 1) {
      const boundaryMs = segments[index].startMs;
      const atBoundary = evaluateRouteFollowProgress(segments, boundaryMs);
      const leftRate = (
        atBoundary
        - evaluateRouteFollowProgress(segments, boundaryMs - sampleDeltaMs)
      ) / sampleDeltaMs;
      const rightRate = (
        evaluateRouteFollowProgress(segments, boundaryMs + sampleDeltaMs)
        - atBoundary
      ) / sampleDeltaMs;
      const fasterRate = Math.max(leftRate, rightRate);
      const slowerRate = Math.min(leftRate, rightRate);

      expect(leftRate).toBeGreaterThanOrEqual(0);
      expect(rightRate).toBeGreaterThanOrEqual(0);
      if (slowerRate <= nearZeroRate) {
        expect(fasterRate).toBeLessThanOrEqual(nearZeroRate);
      } else {
        expect(fasterRate / slowerRate).toBeLessThan(1.5);
      }
    }
  });

  it('supports an event with no deceleration segment', () => {
    const event: ResolvedRouteFollowSpotEvent = {
      progressAt: 0.1,
      kind: 'hold',
      decelMs: 0,
      midMs: 500,
      accelMs: 300,
    };

    const segments = buildRouteFollowTimeline([event], 1_000);

    expect(segments.some((segment) => segment.kind === 'flat')).toBe(true);
    expect(segments.filter((segment) => segment.kind === 'ease')).toHaveLength(1);
    expect(lastSegment(segments)?.endMs).toBe(1_500);
  });
});

describe('computeRouteFollowSpotExtraMs', () => {
  it('returns the net delay from the real Trail 1 spot-event defaults', () => {
    expect(computeRouteFollowSpotExtraMs(routeFollowSpotsDefaults.events))
      .toBe(4_500);
  });
});

describe('evaluateRouteFollowProgress', () => {
  it('stays non-decreasing when a hold deceleration window is clamped at route start', () => {
    const segments = buildRouteFollowTimeline(
      [{
        progressAt: 0,
        kind: 'hold',
        decelMs: 300,
        midMs: 900,
        accelMs: 300,
      }],
      16_000,
    );
    const endMs = lastSegment(segments)?.endMs ?? 0;
    let previous = evaluateRouteFollowProgress(segments, 0);

    expect(segments[0]).toMatchObject({
      kind: 'flat',
      startMs: 0,
      endMs: 900,
      startProgress: 0,
      endProgress: 0,
    });
    expect(segments.filter((segment) => segment.kind === 'ease')).toHaveLength(1);

    for (let elapsedMs = 1; elapsedMs <= endMs; elapsedMs += 1) {
      const progress = evaluateRouteFollowProgress(segments, elapsedMs);
      expect(progress).toBeGreaterThanOrEqual(previous);
      previous = progress;
    }
  });

  it('stays non-decreasing across the real Trail 1 spot-event timeline', () => {
    const segments = buildRouteFollowTimelineForRoute(
      takaoTrail1Route,
      routeFollowSpotsDefaults.events,
      ROUTE_FOLLOW_BASE_TRAVEL_MS,
    );
    const endMs = lastSegment(segments)?.endMs ?? 0;
    let previous = evaluateRouteFollowProgress(segments, 0);

    for (let elapsedMs = 1; elapsedMs <= endMs; elapsedMs += 1) {
      const progress = evaluateRouteFollowProgress(segments, elapsedMs);
      expect(progress).toBeGreaterThanOrEqual(previous);
      previous = progress;
    }
  });

  it('moves smoothly and monotonically from 0 to 1 across the full timeline', () => {
    const segments = buildRouteFollowTimeline(representativeEvents, 16_000);
    const endMs = lastSegment(segments)?.endMs ?? 0;
    let previous = evaluateRouteFollowProgress(segments, -1);

    expect(previous).toBe(0);
    for (let elapsedMs = 0; elapsedMs <= endMs; elapsedMs += 10) {
      const progress = evaluateRouteFollowProgress(segments, elapsedMs);
      expect(progress).toBeGreaterThanOrEqual(previous - Number.EPSILON);
      previous = progress;
    }
    expect(evaluateRouteFollowProgress(segments, endMs)).toBe(1);
    expect(evaluateRouteFollowProgress(segments, endMs + 1_000)).toBe(1);
  });

  it('is used by computeRouteFollowProgress when a timeline is supplied', () => {
    const segments = buildRouteFollowTimeline(representativeEvents, 16_000);
    const routeFollowStartMs = 4_900;
    const elapsedRouteFollowMs = 4_000;

    expect(
      computeRouteFollowProgress(
        routeFollowStartMs + elapsedRouteFollowMs,
        routeFollowStartMs,
        routeFollowStartMs + (lastSegment(segments)?.endMs ?? 0),
        segments,
      ),
    ).toBe(evaluateRouteFollowProgress(segments, elapsedRouteFollowMs));
  });
});

describe('buildRouteFollowTimelineForRoute', () => {
  it('resolves the real Trail 1 spot events and ignores unknown POI ids', () => {
    const configuredExtraMs = computeRouteFollowSpotExtraMs(
      routeFollowSpotsDefaults.events,
    );
    const segments = buildRouteFollowTimelineForRoute(
      takaoTrail1Route,
      [
        ...routeFollowSpotsDefaults.events,
        {
          poiId: 'missing-poi',
          kind: 'hold',
          decelMs: 100,
          midMs: 100,
          accelMs: 100,
        },
      ],
      ROUTE_FOLLOW_BASE_TRAVEL_MS,
    );

    expect(segments[0].startProgress).toBe(0);
    expect(lastSegment(segments)?.endProgress).toBe(1);
    expect(lastSegment(segments)?.endMs).toBe(
      ROUTE_FOLLOW_BASE_TRAVEL_MS + configuredExtraMs,
    );
  });
});

describe('advanceAnimationState', () => {
  it('wraps around to near 0 when advancing past cycleDurationMs (loop boundary)', () => {
    const state = { elapsedMs: 11_900 };
    const next = advanceAnimationState(state, 150, config);

    // 11_900 + 150 = 12_050 -> 12_050 % 12_000 = 50
    expect(next.elapsedMs).toBeCloseTo(50);
    expect(next.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(next.elapsedMs).toBeLessThan(cycleDurationMs(config));
  });

  it('passes a normal 16ms frame delta through unchanged', () => {
    const state = { elapsedMs: 1_000 };
    const next = advanceAnimationState(state, 16, config);

    expect(next.elapsedMs).toBe(1_016);
  });

  it('clamps a multi-second startup stall to 250ms', () => {
    const state = { elapsedMs: 1_000 };
    const next = advanceAnimationState(state, 5_000, config);

    expect(next.elapsedMs).toBe(1_250);
  });

  it('treats negative delta as 0 without producing NaN', () => {
    const state = { elapsedMs: 1_000 };
    const next = advanceAnimationState(state, -500, config);

    expect(next.elapsedMs).toBe(1_000);
    expect(Number.isNaN(next.elapsedMs)).toBe(false);
  });

  it('treats NaN delta as 0 without producing NaN', () => {
    const state = { elapsedMs: 1_000 };
    const next = advanceAnimationState(state, NaN, config);

    expect(next.elapsedMs).toBe(1_000);
    expect(Number.isNaN(next.elapsedMs)).toBe(false);
  });

  it('treats Infinity delta as 0 without producing NaN or runaway progression', () => {
    const state = { elapsedMs: 1_000 };
    const next = advanceAnimationState(state, Infinity, config);

    expect(next.elapsedMs).toBe(1_000);
    expect(Number.isNaN(next.elapsedMs)).toBe(false);
  });

  it('clamps an extremely large positive delta to the steady-state ceiling', () => {
    const state = { elapsedMs: 0 };
    const tenMinutesMs = 10 * 60 * 1000;
    const next = advanceAnimationState(state, tenMinutesMs, config);

    expect(next.elapsedMs).toBe(250);
    expect(Number.isNaN(next.elapsedMs)).toBe(false);
  });

  it('does not advance more than the steady-state ceiling in a single call', () => {
    const state = { elapsedMs: 0 };
    const tenMinutesMs = 10 * 60 * 1000;
    const next = advanceAnimationState(state, tenMinutesMs, config);

    const totalAdvance =
      (next.elapsedMs - state.elapsedMs + cycleDurationMs(config)) %
      cycleDurationMs(config);
    expect(totalAdvance).toBeLessThanOrEqual(250);
  });
});

describe('restartAnimationState', () => {
  it('returns elapsedMs=0, same as createInitialAnimationState', () => {
    expect(restartAnimationState()).toEqual({ elapsedMs: 0 });
    expect(restartAnimationState()).toEqual(createInitialAnimationState());
  });
});

describe('computeEffectiveMotionDeltaMs', () => {
  it('returns finite non-negative raw deltas unchanged for the raw strategy', () => {
    expect(computeEffectiveMotionDeltaMs(0, { strategy: 'raw' })).toBe(0);
    expect(computeEffectiveMotionDeltaMs(16.67, { strategy: 'raw' })).toBe(16.67);
  });

  it('returns 0 for invalid raw deltas', () => {
    const invalidDeltas = [NaN, -1, Infinity];

    for (const rawDeltaMs of invalidDeltas) {
      expect(computeEffectiveMotionDeltaMs(rawDeltaMs, { strategy: 'raw' })).toBe(0);
    }
  });

  it('caps deltas at the default or configured cap for the capped strategy', () => {
    expect(computeEffectiveMotionDeltaMs(75, { strategy: 'capped' })).toBe(50);
    expect(computeEffectiveMotionDeltaMs(75, {
      strategy: 'capped',
      cappedMaxDeltaMs: 30,
    })).toBe(30);
  });

  it('caps deltas at the default or configured fixed-step frame budget', () => {
    expect(computeEffectiveMotionDeltaMs(75, { strategy: 'fixed-step' }))
      .toBe(1000 / 60 * 3);
    expect(computeEffectiveMotionDeltaMs(75, {
      strategy: 'fixed-step',
      fixedStepMs: 10,
      fixedStepMaxStepsPerFrame: 4,
    })).toBe(40);
  });
});
