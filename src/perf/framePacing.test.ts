import { describe, expect, it, vi } from 'vitest';

import {
  computePercentile,
  createFramePacingRecorder,
  summarizeAcrossFrameSummaries,
  summarizeFrameIntervals,
  summarizeMovementRates,
} from './framePacing';

describe('frame pacing recorder', () => {
  it('summarizes a constant 16.7ms frame sequence at about 60fps', () => {
    const recorder = createFramePacingRecorder();
    [0, 16.7, 33.4, 50.1, 66.8].forEach((time) => recorder.recordFrame(time));

    expect(recorder.getFrameSummary()).toMatchObject({
      frameCount: 4,
      totalElapsedMs: 66.8,
      longFrameCounts: {
        over33_3ms: 0,
        over50ms: 0,
        over66_7ms: 0,
        over100ms: 0,
      },
    });
    expect(recorder.getFrameSummary()?.averageFps).toBeCloseTo(1000 / 16.7, 8);
  });

  it('uses strict long-frame thresholds, including each boundary value', () => {
    const summary = summarizeFrameIntervals([
      33.3, 33.3001, 50, 50.0001, 66.7, 66.7001, 100, 100.0001,
    ]);

    expect(summary.longFrameCounts).toEqual({
      over33_3ms: 7,
      over50ms: 5,
      over66_7ms: 3,
      over100ms: 1,
    });
  });

  it('calculates the specified nearest-rank percentiles', () => {
    const summary = summarizeFrameIntervals([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);

    expect(summary).toMatchObject({
      p50Ms: 50,
      p90Ms: 90,
      p95Ms: 100,
      p99Ms: 100,
    });
    expect(computePercentile([10, 20, 30], -1)).toBe(10);
    expect(computePercentile([10, 20, 30], 2)).toBe(30);
  });

  it('returns undefined while no complete frame or movement sample has been recorded', () => {
    const recorder = createFramePacingRecorder();

    expect(recorder.getFrameSummary()).toBeUndefined();
    expect(recorder.getMovementSummary()).toBeUndefined();

    recorder.recordFrame(100);
    expect(recorder.getFrameSummary()).toBeUndefined();
  });

  it('normalizes movement rates and ignores non-positive frame durations', () => {
    const recorder = createFramePacingRecorder();
    recorder.recordMovement(
      { cameraPositionDelta: 0, cameraTargetDelta: 10, routeProgressDelta: 0.5 },
      10,
    );
    recorder.recordMovement(
      { cameraPositionDelta: 999, cameraTargetDelta: 999, routeProgressDelta: 999 },
      0,
    );
    recorder.recordMovement(
      { cameraPositionDelta: 999, cameraTargetDelta: 999, routeProgressDelta: 999 },
      -1,
    );

    expect(recorder.getMovementSummary()).toEqual({
      cameraPositionPerMs: { sampleCount: 1, avgPerMs: 0, maxPerMs: 0, p95PerMs: 0 },
      cameraTargetPerMs: { sampleCount: 1, avgPerMs: 1, maxPerMs: 1, p95PerMs: 1 },
      routeProgressPerMs: { sampleCount: 1, avgPerMs: 0.05, maxPerMs: 0.05, p95PerMs: 0.05 },
    });
    expect(summarizeMovementRates([])).toEqual({
      sampleCount: 0,
      avgPerMs: 0,
      maxPerMs: 0,
      p95PerMs: 0,
    });
  });

  it('does not log while recording frames', () => {
    const consoleLog = vi.spyOn(console, 'log');
    const recorder = createFramePacingRecorder();

    recorder.recordFrame(0);
    recorder.recordFrame(16.7);

    expect(consoleLog).not.toHaveBeenCalled();
    consoleLog.mockRestore();
  });

  it('takes field-wise medians across odd and even frame-summary runs', () => {
    const summaries = [10, 20, 30].map((interval) => summarizeFrameIntervals([interval]));

    expect(summarizeAcrossFrameSummaries(summaries)).toEqual({
      frameCount: 1,
      totalElapsedMs: 20,
      averageFps: 50,
      p50Ms: 20,
      p90Ms: 20,
      p95Ms: 20,
      p99Ms: 20,
      maxMs: 20,
      longFrameCounts: {
        over33_3ms: 0,
        over50ms: 0,
        over66_7ms: 0,
        over100ms: 0,
      },
    });

    expect(summarizeAcrossFrameSummaries(summaries.slice(0, 2))).toMatchObject({
      totalElapsedMs: 15,
      averageFps: 75,
      p95Ms: 15,
    });
  });
});
