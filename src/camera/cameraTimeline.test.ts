import { describe, expect, it } from 'vitest';

import {
  computeRouteFollowProgress,
  cycleDurationMs,
  evaluateRouteFollowProgress,
} from '../animation/progress';
import { defaultSettings } from '../config/settings';
import type {
  AnimationConfig,
  CameraTimelineConfig,
  RouteFollowTimelineSegment,
} from '../types';
import { smoothstep } from '../utils/vecMath';
import {
  computeCameraPhase,
  computeRouteFollowStartMs,
} from './cameraTimeline';

const animationConfig: AnimationConfig = {
  playDurationMs: 10_000,
  holdAtEndMs: 2_000,
};

const timeline: CameraTimelineConfig = {
  highOverviewHoldMs: 1_500,
  descendToOverviewMs: 1_200,
  overviewHoldMs: 1_200,
  transitionInMs: 1_000,
  transitionToSummitMs: 600,
  summitHoldMs: 800,
  returnToOverviewMs: 600,
  ascendToHighOverviewMs: 200,
  arcLiftMeters: 800,
};

const defaultAnimationConfig = defaultSettings.routeAnimation;
const defaultTimeline = defaultSettings.cameraState.timeline;
const frontPhaseOffsetMs =
  timeline.highOverviewHoldMs + timeline.descendToOverviewMs;
const routeFollowStartMs =
  frontPhaseOffsetMs + timeline.overviewHoldMs + timeline.transitionInMs;

describe('computeRouteFollowStartMs', () => {
  it('returns the sum of all phases before route-follow', () => {
    expect(computeRouteFollowStartMs(timeline)).toBe(4_900);
  });
});

describe('computeCameraPhase', () => {
  it.each([0, 0.1, 0.25, 0.5, 0.75, 0.9])(
    'smoothsteps high-overview-hold progress at normalized elapsed time %s',
    (rawT) => {
      const phase = computeCameraPhase(
        timeline.highOverviewHoldMs * rawT,
        animationConfig,
        timeline,
      );

      expect(phase).toEqual({
        kind: 'high-overview-hold',
        t: smoothstep(rawT),
      });
    },
  );

  it('preserves the high-overview-hold easing endpoints at the descent boundary', () => {
    expect(
      computeCameraPhase(0, animationConfig, timeline),
    ).toEqual({ kind: 'high-overview-hold', t: smoothstep(0) });
    expect(
      smoothstep(timeline.highOverviewHoldMs / timeline.highOverviewHoldMs),
    ).toBe(1);
    expect(
      computeCameraPhase(
        timeline.highOverviewHoldMs,
        animationConfig,
        timeline,
      ),
    ).toEqual({ kind: 'descend-to-overview', t: 0 });
  });

  it('returns overview after descent and until the overview hold boundary', () => {
    expect(
      computeCameraPhase(frontPhaseOffsetMs, animationConfig, timeline),
    ).toEqual({
      kind: 'overview',
    });
    expect(
      computeCameraPhase(
        frontPhaseOffsetMs + timeline.overviewHoldMs - 0.001,
        animationConfig,
        timeline,
      ),
    ).toEqual({ kind: 'overview' });
  });

  it('enters transition-in at the overviewHoldMs boundary', () => {
    expect(
      computeCameraPhase(
        frontPhaseOffsetMs + timeline.overviewHoldMs,
        animationConfig,
        timeline,
      ),
    ).toEqual({ kind: 'transition-in', t: 0 });

    const quarter = computeCameraPhase(
      frontPhaseOffsetMs
        + timeline.overviewHoldMs
        + timeline.transitionInMs * 0.25,
      animationConfig,
      timeline,
    );
    expect(quarter).toEqual({
      kind: 'transition-in',
      t: smoothstep(0.25),
    });
  });

  it('enters route-follow at progress 0 when transition-in ends', () => {
    const elapsedMs =
      frontPhaseOffsetMs
      + timeline.overviewHoldMs
      + timeline.transitionInMs;

    expect(computeCameraPhase(elapsedMs, animationConfig, timeline)).toEqual({
      kind: 'route-follow',
      progress: computeRouteFollowProgress(
        elapsedMs,
        routeFollowStartMs,
        animationConfig.playDurationMs,
      ),
    });
  });

  it('uses the supplied route-follow timeline to calculate route progress', () => {
    const routeFollowTimeline: RouteFollowTimelineSegment[] = [
      {
        kind: 'travel',
        startMs: 0,
        endMs: animationConfig.playDurationMs - routeFollowStartMs,
        startProgress: 0,
        endProgress: 1,
        startRatePerMs: 1 / (animationConfig.playDurationMs - routeFollowStartMs),
        endRatePerMs: 1 / (animationConfig.playDurationMs - routeFollowStartMs),
      },
    ];
    const elapsedMs = routeFollowStartMs + 1_234;
    const phase = computeCameraPhase(
      elapsedMs,
      animationConfig,
      timeline,
      routeFollowTimeline,
    );

    expect(phase.kind).toBe('route-follow');
    expect(phase.kind === 'route-follow' && phase.progress).toBe(
      evaluateRouteFollowProgress(
        routeFollowTimeline,
        elapsedMs - routeFollowStartMs,
      ),
    );
  });

  it('enters transition-to-summit at playDurationMs and summit-hold after the transition', () => {
    const transitionStart = animationConfig.playDurationMs;

    expect(
      computeCameraPhase(transitionStart, animationConfig, timeline),
    ).toEqual({ kind: 'transition-to-summit', t: 0 });

    const quarter = computeCameraPhase(
      transitionStart + timeline.transitionToSummitMs * 0.25,
      animationConfig,
      timeline,
    );
    expect(quarter).toEqual({
      kind: 'transition-to-summit',
      t: smoothstep(0.25),
    });

    expect(
      computeCameraPhase(
        transitionStart + timeline.transitionToSummitMs,
        animationConfig,
        timeline,
      ),
    ).toEqual({ kind: 'summit-hold' });
  });

  it('keeps route-follow until route progress reaches 100%', () => {
    const justBeforePlayEnd = animationConfig.playDurationMs - 0.001;

    expect(
      computeCameraPhase(justBeforePlayEnd, animationConfig, timeline),
    ).toEqual({
      kind: 'route-follow',
      progress: computeRouteFollowProgress(
        justBeforePlayEnd,
        routeFollowStartMs,
        animationConfig.playDurationMs,
      ),
    });
    expect(
      computeCameraPhase(
        animationConfig.playDurationMs,
        animationConfig,
        timeline,
      ).kind,
    ).toBe('transition-to-summit');
  });

  it('enters return-to-overview when summit-hold ends', () => {
    const returnStart =
      animationConfig.playDurationMs
      + timeline.transitionToSummitMs
      + timeline.summitHoldMs;

    expect(
      computeCameraPhase(returnStart, animationConfig, timeline),
    ).toEqual({ kind: 'return-to-overview', t: 0 });
  });

  it.each([
    [
      'transition-in',
      frontPhaseOffsetMs + timeline.overviewHoldMs,
      timeline.transitionInMs,
    ],
    [
      'transition-to-summit',
      animationConfig.playDurationMs,
      timeline.transitionToSummitMs,
    ],
    [
      'return-to-overview',
      animationConfig.playDurationMs
        + timeline.transitionToSummitMs
        + timeline.summitHoldMs,
      timeline.returnToOverviewMs,
    ],
  ] as const)('%s t is smoothstepped and remains within 0..1', (kind, start, duration) => {
    for (const rawT of [0, 0.25, 0.5, 0.75, 1]) {
      const phase = computeCameraPhase(
        start + duration * rawT,
        animationConfig,
        timeline,
      );

      if (rawT < 1) {
        expect(phase.kind).toBe(kind);
        expect('t' in phase && phase.t).toBeCloseTo(smoothstep(rawT));
        expect('t' in phase && phase.t).toBeGreaterThanOrEqual(0);
        expect('t' in phase && phase.t).toBeLessThanOrEqual(1);
      }
    }
  });

  it('returns the expected kind immediately before and at every default phase boundary', () => {
    const descendStartMs = defaultTimeline.highOverviewHoldMs;
    const overviewStartMs =
      descendStartMs + defaultTimeline.descendToOverviewMs;
    const transitionInStartMs =
      overviewStartMs + defaultTimeline.overviewHoldMs;
    const routeFollowStartMs = computeRouteFollowStartMs(defaultTimeline);
    const transitionToSummitStartMs = defaultSettings.routeAnimation.playDurationMs;
    const summitHoldStartMs =
      transitionToSummitStartMs + defaultTimeline.transitionToSummitMs;
    const returnToOverviewStartMs =
      summitHoldStartMs + defaultTimeline.summitHoldMs;
    const ascendStartMs =
      returnToOverviewStartMs + defaultTimeline.returnToOverviewMs;
    const boundaries = [
      [descendStartMs, 'high-overview-hold', 'descend-to-overview'],
      [overviewStartMs, 'descend-to-overview', 'overview'],
      [transitionInStartMs, 'overview', 'transition-in'],
      [routeFollowStartMs, 'transition-in', 'route-follow'],
      [transitionToSummitStartMs, 'route-follow', 'transition-to-summit'],
      [summitHoldStartMs, 'transition-to-summit', 'summit-hold'],
      [returnToOverviewStartMs, 'summit-hold', 'return-to-overview'],
      [ascendStartMs, 'return-to-overview', 'ascend-to-high-overview'],
    ] as const;

    expect(boundaries.map(([boundaryMs]) => boundaryMs)).toEqual([
      1_500,
      2_700,
      3_900,
      5_300,
      25_800,
      27_300,
      28_900,
      30_700,
    ]);

    for (const [boundaryMs, beforeKind, atKind] of boundaries) {
      expect(
        computeCameraPhase(
          boundaryMs - 1,
          defaultAnimationConfig,
          defaultTimeline,
        ).kind,
      ).toBe(beforeKind);
      expect(
        computeCameraPhase(
          boundaryMs,
          defaultAnimationConfig,
          defaultTimeline,
        ).kind,
      ).toBe(atKind);
    }
  });

  it('starts high-overview-hold at t=0 and reaches nearly t=1 before descending at t=0', () => {
    const descendStartMs = defaultTimeline.highOverviewHoldMs;

    expect(
      computeCameraPhase(0, defaultAnimationConfig, defaultTimeline),
    ).toEqual({ kind: 'high-overview-hold', t: 0 });

    const justBeforeDescent = computeCameraPhase(
      descendStartMs - 0.001,
      defaultAnimationConfig,
      defaultTimeline,
    );
    expect(justBeforeDescent.kind).toBe('high-overview-hold');
    expect(
      justBeforeDescent.kind === 'high-overview-hold'
        && justBeforeDescent.t,
    ).toBeCloseTo(1, 5);
    expect(
      computeCameraPhase(
        descendStartMs,
        defaultAnimationConfig,
        defaultTimeline,
      ),
    ).toEqual({ kind: 'descend-to-overview', t: 0 });
  });

  it('preserves the existing phase calculations at offset-relative inputs', () => {
    const transitionInStartMs =
      frontPhaseOffsetMs + timeline.overviewHoldMs;
    const transitionIn = computeCameraPhase(
      transitionInStartMs + timeline.transitionInMs * 0.25,
      animationConfig,
      timeline,
    );
    const routeElapsedMs =
      transitionInStartMs + timeline.transitionInMs + 123;
    const routeFollow = computeCameraPhase(
      routeElapsedMs,
      animationConfig,
      timeline,
    );
    const transitionToSummit = computeCameraPhase(
      animationConfig.playDurationMs
        + timeline.transitionToSummitMs * 0.25,
      animationConfig,
      timeline,
    );
    const returnStartMs =
      animationConfig.playDurationMs
      + timeline.transitionToSummitMs
      + timeline.summitHoldMs;
    const returnToOverview = computeCameraPhase(
      returnStartMs + timeline.returnToOverviewMs * 0.25,
      animationConfig,
      timeline,
    );

    expect(transitionIn).toEqual({
      kind: 'transition-in',
      t: smoothstep(0.25),
    });
    expect(routeFollow).toEqual({
      kind: 'route-follow',
      progress: computeRouteFollowProgress(
        routeElapsedMs,
        routeFollowStartMs,
        animationConfig.playDurationMs,
      ),
    });
    expect(transitionToSummit).toEqual({
      kind: 'transition-to-summit',
      t: smoothstep(0.25),
    });
    expect(returnToOverview).toEqual({
      kind: 'return-to-overview',
      t: smoothstep(0.25),
    });
  });

  it('has monotonically increasing default boundaries with no gap at the cycle end', () => {
    const descendStartMs = defaultTimeline.highOverviewHoldMs;
    const overviewStartMs =
      descendStartMs + defaultTimeline.descendToOverviewMs;
    const transitionInStartMs =
      overviewStartMs + defaultTimeline.overviewHoldMs;
    const routeFollowStartMs =
      transitionInStartMs + defaultTimeline.transitionInMs;
    const transitionToSummitStartMs = defaultAnimationConfig.playDurationMs;
    const summitHoldStartMs =
      transitionToSummitStartMs + defaultTimeline.transitionToSummitMs;
    const returnToOverviewStartMs =
      summitHoldStartMs + defaultTimeline.summitHoldMs;
    const ascendStartMs =
      returnToOverviewStartMs + defaultTimeline.returnToOverviewMs;
    const phaseEndMs =
      ascendStartMs + defaultTimeline.ascendToHighOverviewMs;
    const boundaries = [
      0,
      descendStartMs,
      overviewStartMs,
      transitionInStartMs,
      routeFollowStartMs,
      transitionToSummitStartMs,
      summitHoldStartMs,
      returnToOverviewStartMs,
      ascendStartMs,
      phaseEndMs,
    ];

    expect(boundaries).toEqual([
      0, 1_500, 2_700, 3_900, 5_300, 25_800, 27_300, 28_900, 30_700,
      31_600,
    ]);
    for (let index = 1; index < boundaries.length; index += 1) {
      expect(boundaries[index]).toBeGreaterThan(boundaries[index - 1]);
    }
    expect(phaseEndMs).toBe(cycleDurationMs(defaultAnimationConfig));
  });

  it('is continuous at the loop seam from ascent to high-overview hold', () => {
    const epsilonMs = 0.001;
    const justBeforeLoop = computeCameraPhase(
      cycleDurationMs(defaultAnimationConfig) - epsilonMs,
      defaultAnimationConfig,
      defaultTimeline,
    );

    expect(justBeforeLoop.kind).toBe('ascend-to-high-overview');
    // toBeCloseTo(x, 10) demands ~5e-11 precision, tighter than the floating-point
    // error inherent to smoothstep's cubic near t=1 for this epsilonMs; 8 digits
    // (~5e-9 tolerance) still confirms near-exact continuity without chasing noise.
    expect(
      justBeforeLoop.kind === 'ascend-to-high-overview' && justBeforeLoop.t,
    ).toBeCloseTo(1, 8);
    expect(
      computeCameraPhase(0, defaultAnimationConfig, defaultTimeline),
    ).toEqual({
      kind: 'high-overview-hold',
      t: 0,
    });
  });
});
