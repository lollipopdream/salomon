import { describe, expect, it } from 'vitest';
import {
  classifyBenchmarkSession,
  evaluateAba,
  evaluateAbaSets,
  evaluateStabilityGate,
  median,
  summarizeBenchmarkWindow,
  type BenchmarkSceneIdentity,
  type BenchmarkWindowMetrics,
} from './benchmarkProtocol';

function windowWith(overrides: Partial<BenchmarkWindowMetrics> = {}): BenchmarkWindowMetrics {
  return {
    frameCount: 10,
    meanMs: 40,
    p50Ms: 40,
    p95Ms: 50,
    p99Ms: 55,
    maxMs: 60,
    elapsedStartMs: 0,
    elapsedEndMs: 400,
    longFrameShare: { over33_3: 0.2, over50: 0.1, over66_7: 0, over100: 0 },
    ...overrides,
  };
}

function identity(overrides: Partial<BenchmarkSceneIdentity> = {}): BenchmarkSceneIdentity {
  return {
    drawCalls: 100,
    triangles: 1000,
    visibleLabels: 5,
    drawingBufferWidth: 1920,
    drawingBufferHeight: 1080,
    segmentStartMs: 1000,
    segmentEndMs: 11000,
    ...overrides,
  };
}

describe('benchmark protocol', () => {
  it('summarizes known frame intervals with frame-pacing percentiles', () => {
    const summary = summarizeBenchmarkWindow([
      { dtMs: 10, elapsedMs: 30 },
      { dtMs: 20, elapsedMs: 10 },
      { dtMs: 30, elapsedMs: 20 },
      { dtMs: 40, elapsedMs: 40 },
    ]);

    expect(summary).toMatchObject({ meanMs: 25, p50Ms: 20, p95Ms: 40, maxMs: 40, elapsedStartMs: 10, elapsedEndMs: 40 });
  });

  it('returns null for empty or entirely invalid frame intervals', () => {
    expect(summarizeBenchmarkWindow([])).toBeNull();
    expect(summarizeBenchmarkWindow([{ dtMs: Number.NaN, elapsedMs: 1 }, { dtMs: Infinity, elapsedMs: 2 }])).toBeNull();
  });

  it('does not mutate the supplied samples when computing percentiles', () => {
    const samples = [{ dtMs: 30, elapsedMs: 30 }, { dtMs: 10, elapsedMs: 10 }, { dtMs: 20, elapsedMs: 20 }];
    summarizeBenchmarkWindow(samples);

    expect(samples.map((sample) => sample.dtMs)).toEqual([30, 10, 20]);
  });

  it('counts long frames using strict greater-than boundaries', () => {
    const summary = summarizeBenchmarkWindow([{ dtMs: 50, elapsedMs: 50 }, { dtMs: 50.1, elapsedMs: 100 }]);

    expect(summary?.longFrameShare.over50).toBe(0.5);
  });

  it('accepts three windows whose spreads are within every threshold', () => {
    const result = evaluateStabilityGate([windowWith(), windowWith({ meanMs: 43, p50Ms: 43 }), windowWith({ meanMs: 42, p50Ms: 42 })]);

    expect(result).toMatchObject({ verdict: 'STABLE', failedChecks: [] });
  });

  it('rejects a mean spread greater than ten percent', () => {
    const result = evaluateStabilityGate([windowWith({ meanMs: 40 }), windowWith({ meanMs: 45 }), windowWith({ meanMs: 40 })]);

    expect(result.verdict).toBe('UNSTABLE');
    expect(result.failedChecks).toContain('meanSpread');
  });

  it('accepts an over-50 share that moves by only 1.4 percentage points even though its relative spread is 9%', () => {
    // Real readiness data measured on 2026-09-12: 0.1525 / 0.1659 / 0.1517.
    // max - min = 1.42pt (pass), while (max - min) / min = 9.4% (would wrongly fail
    // if the criterion were relative). Locks the absolute-difference contract.
    const result = evaluateStabilityGate([
      windowWith({ longFrameShare: { over33_3: 0.4, over50: 0.1525, over66_7: 0, over100: 0 } }),
      windowWith({ longFrameShare: { over33_3: 0.4, over50: 0.1659, over66_7: 0, over100: 0 } }),
      windowWith({ longFrameShare: { over33_3: 0.4, over50: 0.1517, over66_7: 0, over100: 0 } }),
    ]);

    expect(result.over50ShareSpread).toBeCloseTo(0.0142, 4);
    expect(result.failedChecks).not.toContain('over50ShareSpread');
    expect(result.verdict).toBe('STABLE');
  });

  it('accepts three windows that all have a zero over-50 share', () => {
    // A session where no frame exceeds 50ms is maximally stable. A relative
    // spread would divide by zero here and report the session as unstable.
    const zero = { over33_3: 0, over50: 0, over66_7: 0, over100: 0 };
    const result = evaluateStabilityGate([
      windowWith({ longFrameShare: zero }),
      windowWith({ longFrameShare: zero }),
      windowWith({ longFrameShare: zero }),
    ]);

    expect(result.over50ShareSpread).toBe(0);
    expect(result.verdict).toBe('STABLE');
  });

  it('rejects an over-50 share spread greater than five percentage points', () => {
    const result = evaluateStabilityGate([windowWith(), windowWith({ longFrameShare: { over33_3: 0.2, over50: 0.16, over66_7: 0, over100: 0 } }), windowWith()]);

    expect(result.verdict).toBe('UNSTABLE');
  });

  it('requires at least three windows by default', () => {
    const result = evaluateStabilityGate([windowWith(), windowWith()]);

    expect(result.verdict).toBe('INSUFFICIENT_WINDOWS');
  });

  it('does not report a no-op change as a valid improvement', () => {
    const result = evaluateAba({ a1: windowWith({ meanMs: 40 }), b: windowWith({ meanMs: 40.4 }), a2: windowWith({ meanMs: 40.2 }) });

    expect(result.verdict).toBe('NOISE_INCONCLUSIVE');
    expect(result.verdict).not.toBe('VALID_IMPROVEMENT');
  });

  it('reports the known large mean improvement', () => {
    const result = evaluateAba({ a1: windowWith({ meanMs: 85.7 }), b: windowWith({ meanMs: 37.3 }), a2: windowWith({ meanMs: 86.6 }) });

    expect(result.verdict).toBe('VALID_IMPROVEMENT');
  });

  it('invalidates baseline mean drift measured in unstable runs', () => {
    const result = evaluateAba({ a1: windowWith({ meanMs: 30.7 }), b: windowWith({ meanMs: 50 }), a2: windowWith({ meanMs: 122.3 }) });

    expect(result.verdict).toBe('INVALID_DRIFT');
  });

  it('invalidates a scene mismatch and identifies its field', () => {
    const result = evaluateAba({ a1: windowWith(), b: windowWith(), a2: windowWith(), identities: { a1: identity(), b: identity({ drawCalls: 101 }), a2: identity() } });

    expect(result.sceneMismatchFields).toContain('drawCalls');
  });

  it('prioritizes a scene mismatch over drift', () => {
    const result = evaluateAba({ a1: windowWith({ meanMs: 30 }), b: windowWith({ meanMs: 50 }), a2: windowWith({ meanMs: 100 }), identities: { a1: identity(), b: identity({ drawCalls: 101 }), a2: identity() } });

    expect(result.verdict).toBe('INVALID_SCENE_MISMATCH');
  });

  it('treats an effect smaller than baseline drift as inconclusive', () => {
    const result = evaluateAba({ a1: windowWith({ meanMs: 100 }), b: windowWith({ meanMs: 98.7 }), a2: windowWith({ meanMs: 110 }) });

    expect(result.verdict).toBe('NOISE_INCONCLUSIVE');
  });

  it('keeps zero-reference over-50 effects finite', () => {
    const result = evaluateAba({ a1: windowWith({ longFrameShare: { over33_3: 0, over50: 0, over66_7: 0, over100: 0 } }), b: windowWith({ longFrameShare: { over33_3: 0, over50: 0.1, over66_7: 0, over100: 0 } }), a2: windowWith({ longFrameShare: { over33_3: 0, over50: 0, over66_7: 0, over100: 0 } }) });

    expect(Object.values(result.effects.over50Share).every((value) => typeof value === 'boolean' || Number.isFinite(value))).toBe(true);
  });

  it('treats the measured no-op window variation as inconclusive instead of a valid effect', () => {
    // Baseline windows from the 2026-09-12 self-test span 19.93..22.24ms.
    // The candidate average is higher, but stays within that pooled baseline range.
    const result = evaluateAbaSets({
      a1: [21.18, 19.93, 21.55].map((meanMs) => windowWith({ meanMs })),
      b: [24.97, 21.0, 21.3].map((meanMs) => windowWith({ meanMs })),
      a2: [22.24, 21.94, 20.5].map((meanMs) => windowWith({ meanMs })),
    });

    expect(result.effects.mean.percentDelta).toBeLessThan(result.effects.mean.baselineNoiseFloor);
    expect(result.verdict).toBe('NOISE_INCONCLUSIVE');
    expect(result.verdict).not.toBe('VALID_REGRESSION');
    expect(result.verdict).not.toBe('VALID_IMPROVEMENT');
  });

  it('detects the recorded known-large self-test despite one baseline outlier window', () => {
    const result = evaluateAbaSets({
      a1: [22.67, 22.25, 34.44].map((meanMs) => windowWith({ meanMs })),
      b: [20.17, 17.88, 18.42].map((meanMs) => windowWith({ meanMs })),
      a2: [19.28, 22.88, 21.40].map((meanMs) => windowWith({ meanMs })),
    });

    expect(result.verdict).toBe('VALID_IMPROVEMENT');
    expect(result.meanDrift).toBeLessThanOrEqual(0.15);
    expect(result.effects.mean.baselineNoiseFloor).toBeLessThan(0.63);
  });

  it('keeps the recorded NO-OP self-test inconclusive', () => {
    const result = evaluateAbaSets({
      a1: [27.32, 32.15, 26.61].map((meanMs) => windowWith({ meanMs })),
      b: [27.33, 26.70, 32.37].map((meanMs) => windowWith({ meanMs })),
      a2: [27.76, 28.57, 26.14].map((meanMs) => windowWith({ meanMs })),
    });

    expect(result.verdict).toBe('NOISE_INCONCLUSIVE');
    expect(result.verdict).not.toBe('VALID_IMPROVEMENT');
    expect(result.verdict).not.toBe('VALID_REGRESSION');
  });

  it('uses MAD rather than the full baseline range for a single outlier', () => {
    const result = evaluateAbaSets({
      a1: [20, 20, 20].map((meanMs) => windowWith({ meanMs })),
      b: [20, 20, 20].map((meanMs) => windowWith({ meanMs })),
      a2: [20, 20, 60].map((meanMs) => windowWith({ meanMs })),
    });

    expect(result.effects.mean.baselineMad).toBe(0);
    expect(result.effects.mean.baselineNoiseFloor).toBe(0);
    expect(result.effects.mean.baselineNoiseFloor).toBeLessThan(2);
  });

  it('computes an even median without mutating its input array', () => {
    const values = [4, 1, 3, 2];

    expect(median(values)).toBe(2.5);
    expect(values).toEqual([4, 1, 3, 2]);
  });

  it('contrasts the single-window false positive with the canonical multi-window result', () => {
    const singleWindow = evaluateAba({
      a1: windowWith({ meanMs: 22.24 }),
      b: windowWith({ meanMs: 24.97 }),
      a2: windowWith({ meanMs: 21.94 }),
    });
    const multiWindow = evaluateAbaSets({
      a1: [21.18, 19.93, 21.55].map((meanMs) => windowWith({ meanMs })),
      b: [24.97, 21.0, 21.3].map((meanMs) => windowWith({ meanMs })),
      a2: [22.24, 21.94, 20.5].map((meanMs) => windowWith({ meanMs })),
    });

    expect(singleWindow.verdict).toBe('VALID_REGRESSION');
    expect(multiWindow.verdict).toBe('NOISE_INCONCLUSIVE');
  });

  it('detects a known large multi-window mean improvement', () => {
    const result = evaluateAbaSets({
      a1: [85, 86, 84].map((meanMs) => windowWith({ meanMs })),
      b: [37, 38, 36].map((meanMs) => windowWith({ meanMs })),
      a2: [86, 85, 87].map((meanMs) => windowWith({ meanMs })),
    });

    expect(result.verdict).toBe('VALID_IMPROVEMENT');
  });

  it('invalidates multi-window baseline arms with excessive mean drift', () => {
    const result = evaluateAbaSets({
      a1: [30, 30, 30].map((meanMs) => windowWith({ meanMs })),
      b: [50, 50, 50].map((meanMs) => windowWith({ meanMs })),
      a2: [122, 122, 122].map((meanMs) => windowWith({ meanMs })),
    });

    expect(result.verdict).toBe('INVALID_DRIFT');
    expect(result.failedChecks).toContain('meanDrift');
  });

  it('reports insufficient multi-window arms through the compatible invalid-drift verdict', () => {
    const result = evaluateAbaSets({
      a1: [windowWith(), windowWith()],
      b: [windowWith(), windowWith(), windowWith()],
      a2: [windowWith(), windowWith(), windowWith()],
    });

    expect(result.verdict).toBe('INVALID_DRIFT');
    expect(result.failedChecks).toContain('insufficientWindows');
  });

  it('keeps zero multi-window references finite', () => {
    const zeroMean = windowWith({ meanMs: 0, p50Ms: 0, p95Ms: 0, longFrameShare: { over33_3: 0, over50: 0, over66_7: 0, over100: 0 } });
    const result = evaluateAbaSets({
      a1: [zeroMean, zeroMean, zeroMean],
      b: [windowWith({ meanMs: 2 }), windowWith({ meanMs: 2 }), windowWith({ meanMs: 2 })],
      a2: [zeroMean, zeroMean, zeroMean],
    });

    expect(Object.values(result.effects.mean).every((value) => typeof value === 'boolean' || Number.isFinite(value))).toBe(true);
    expect(result.effects.mean.percentDelta).toBe(0);
    expect(result.effects.mean.baselineMad).toBe(0);
    expect(result.effects.mean.baselineNoiseFloor).toBe(0);
  });

  it('prioritizes a multi-window scene mismatch over drift', () => {
    const result = evaluateAbaSets({
      a1: [30, 30, 30].map((meanMs) => windowWith({ meanMs })),
      b: [50, 50, 50].map((meanMs) => windowWith({ meanMs })),
      a2: [100, 100, 100].map((meanMs) => windowWith({ meanMs })),
      identities: {
        a1: [identity(), identity(), identity()],
        b: [identity({ drawCalls: 101 }), identity({ drawCalls: 101 }), identity({ drawCalls: 101 })],
        a2: [identity(), identity(), identity()],
      },
    });

    expect(result.verdict).toBe('INVALID_SCENE_MISMATCH');
    expect(result.sceneMismatchFields).toContain('drawCalls');
  });

  it('accepts the first stable readiness set', () => {
    const stable = evaluateStabilityGate([windowWith(), windowWith(), windowWith()]);

    expect(classifyBenchmarkSession([stable])).toEqual({ status: 'STABLE_SESSION', acceptedSetIndex: 0, attemptedSets: 1 });
  });

  it('invalidates a session after two unstable readiness sets', () => {
    const unstable = evaluateStabilityGate([windowWith({ meanMs: 40 }), windowWith({ meanMs: 50 }), windowWith({ meanMs: 40 })]);

    expect(classifyBenchmarkSession([unstable, unstable])).toEqual({ status: 'INVALID_UNSTABLE', acceptedSetIndex: null, attemptedSets: 2 });
  });
});
