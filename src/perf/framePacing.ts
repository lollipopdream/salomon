const MAX_SAMPLES = 1800;

export interface FramePacingSummary {
  frameCount: number;
  totalElapsedMs: number;
  averageFps: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  longFrameCounts: {
    over33_3ms: number;
    over50ms: number;
    over66_7ms: number;
    over100ms: number;
  };
}

export interface MovementRateSummary {
  sampleCount: number;
  avgPerMs: number;
  maxPerMs: number;
  p95PerMs: number;
}

export interface MovementPacingSummary {
  cameraPositionPerMs: MovementRateSummary;
  cameraTargetPerMs: MovementRateSummary;
  routeProgressPerMs: MovementRateSummary;
}

export interface FramePacingRecorder {
  recordFrame(nowMs: number): void;
  recordMovement(
    deltas: {
      cameraPositionDelta: number;
      cameraTargetDelta: number;
      routeProgressDelta: number;
    },
    deltaMs: number,
  ): void;
  getFrameSummary(): FramePacingSummary | undefined;
  getMovementSummary(): MovementPacingSummary | undefined;
  reset(): void;
}

function pushSample(samples: number[], sample: number): void {
  samples.push(sample);
  if (samples.length > MAX_SAMPLES) {
    samples.shift();
  }
}

export function computePercentile(
  sortedAscendingMs: number[],
  percentile0to1: number,
): number {
  if (sortedAscendingMs.length === 0) {
    return 0;
  }

  const percentile = Math.min(Math.max(percentile0to1, 0), 1);
  const index = Math.min(
    Math.max(Math.ceil(percentile * sortedAscendingMs.length) - 1, 0),
    sortedAscendingMs.length - 1,
  );
  return sortedAscendingMs[index];
}

export function summarizeFrameIntervals(intervalsMs: number[]): FramePacingSummary {
  const frameCount = intervalsMs.length;
  const totalElapsedMs = intervalsMs.reduce((total, interval) => total + interval, 0);
  const sortedIntervals = [...intervalsMs].sort((a, b) => a - b);

  return {
    frameCount,
    totalElapsedMs,
    averageFps: totalElapsedMs > 0 ? (frameCount * 1000) / totalElapsedMs : 0,
    p50Ms: computePercentile(sortedIntervals, 0.5),
    p90Ms: computePercentile(sortedIntervals, 0.9),
    p95Ms: computePercentile(sortedIntervals, 0.95),
    p99Ms: computePercentile(sortedIntervals, 0.99),
    maxMs: sortedIntervals[sortedIntervals.length - 1] ?? 0,
    longFrameCounts: {
      over33_3ms: intervalsMs.filter((interval) => interval > 33.3).length,
      over50ms: intervalsMs.filter((interval) => interval > 50).length,
      over66_7ms: intervalsMs.filter((interval) => interval > 66.7).length,
      over100ms: intervalsMs.filter((interval) => interval > 100).length,
    },
  };
}

export function summarizeMovementRates(ratesPerMs: number[]): MovementRateSummary {
  const sampleCount = ratesPerMs.length;
  const sortedRates = [...ratesPerMs].sort((a, b) => a - b);
  const total = ratesPerMs.reduce((sum, rate) => sum + rate, 0);

  return {
    sampleCount,
    avgPerMs: sampleCount > 0 ? total / sampleCount : 0,
    maxPerMs: sortedRates[sortedRates.length - 1] ?? 0,
    p95PerMs: computePercentile(sortedRates, 0.95),
  };
}

export function createFramePacingRecorder(): FramePacingRecorder {
  const frameIntervalsMs: number[] = [];
  const cameraPositionRatesPerMs: number[] = [];
  const cameraTargetRatesPerMs: number[] = [];
  const routeProgressRatesPerMs: number[] = [];
  let previousFrameMs: number | undefined;

  return {
    recordFrame(nowMs) {
      if (previousFrameMs !== undefined) {
        pushSample(frameIntervalsMs, nowMs - previousFrameMs);
      }
      previousFrameMs = nowMs;
    },

    recordMovement(deltas, deltaMs) {
      if (deltaMs <= 0) {
        return;
      }

      pushSample(cameraPositionRatesPerMs, deltas.cameraPositionDelta / deltaMs);
      pushSample(cameraTargetRatesPerMs, deltas.cameraTargetDelta / deltaMs);
      pushSample(routeProgressRatesPerMs, deltas.routeProgressDelta / deltaMs);
    },

    getFrameSummary() {
      return frameIntervalsMs.length > 0
        ? summarizeFrameIntervals(frameIntervalsMs)
        : undefined;
    },

    getMovementSummary() {
      if (cameraPositionRatesPerMs.length === 0) {
        return undefined;
      }

      return {
        cameraPositionPerMs: summarizeMovementRates(cameraPositionRatesPerMs),
        cameraTargetPerMs: summarizeMovementRates(cameraTargetRatesPerMs),
        routeProgressPerMs: summarizeMovementRates(routeProgressRatesPerMs),
      };
    },

    reset() {
      frameIntervalsMs.length = 0;
      cameraPositionRatesPerMs.length = 0;
      cameraTargetRatesPerMs.length = 0;
      routeProgressRatesPerMs.length = 0;
      previousFrameMs = undefined;
    },
  };
}

function computeMedian(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sortedValues = [...values].sort((a, b) => a - b);
  const middleIndex = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2 === 0
    ? (sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2
    : sortedValues[middleIndex];
}

export function summarizeAcrossFrameSummaries(
  summaries: FramePacingSummary[],
): FramePacingSummary {
  return {
    frameCount: computeMedian(summaries.map((summary) => summary.frameCount)),
    totalElapsedMs: computeMedian(summaries.map((summary) => summary.totalElapsedMs)),
    averageFps: computeMedian(summaries.map((summary) => summary.averageFps)),
    p50Ms: computeMedian(summaries.map((summary) => summary.p50Ms)),
    p90Ms: computeMedian(summaries.map((summary) => summary.p90Ms)),
    p95Ms: computeMedian(summaries.map((summary) => summary.p95Ms)),
    p99Ms: computeMedian(summaries.map((summary) => summary.p99Ms)),
    maxMs: computeMedian(summaries.map((summary) => summary.maxMs)),
    longFrameCounts: {
      over33_3ms: computeMedian(summaries.map((summary) => summary.longFrameCounts.over33_3ms)),
      over50ms: computeMedian(summaries.map((summary) => summary.longFrameCounts.over50ms)),
      over66_7ms: computeMedian(summaries.map((summary) => summary.longFrameCounts.over66_7ms)),
      over100ms: computeMedian(summaries.map((summary) => summary.longFrameCounts.over100ms)),
    },
  };
}
