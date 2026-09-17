import {
  evaluateAba,
  evaluateAbaSets,
  evaluateStabilityGate,
  summarizeBenchmarkWindow,
} from './benchmarkProtocol';
import type {
  AbaResult,
  AbaSetResult,
  BenchmarkFrameSample,
  BenchmarkSceneIdentity,
  BenchmarkWindowMetrics,
  StabilityGateResult,
} from './benchmarkProtocol';
import type { BenchmarkModeFlags } from './benchmarkMode';

export interface StableBenchmarkHost {
  /** Current scene identity; called only at a completed or aborted window boundary. */
  getSceneIdentity(): BenchmarkSceneIdentity;
  /** Requests a route-clock seek that the host applies at the next frame boundary. */
  requestRouteClockMs(elapsedMs: number): void;
  /** Environment snapshot containing only scalar, non-secret values. */
  getEnvironment(): Record<string, string | number | boolean | null>;
}

export type StableBenchmarkStatus =
  | 'idle'
  | 'seeking'
  | 'recording'
  | 'done'
  | 'aborted';

export type StableBenchmarkAbortReason =
  | 'PAGE_HIDDEN'
  | 'CAPACITY_EXCEEDED'
  | 'MANUAL_RESET'
  | 'SEEK_TIMEOUT';

export interface StableBenchmarkWindowResult {
  index: number;
  label: string;
  metrics: BenchmarkWindowMetrics;
  identity: BenchmarkSceneIdentity;
  warmupFramesSkipped: number;
  recordedFrames: number;
  aborted: StableBenchmarkAbortReason | null;
}

export interface StableBenchmarkController {
  onFrame(timeMs: number, elapsedMs: number): void;
  start(label: string): void;
  getStatus(): StableBenchmarkStatus;
  getWindows(): StableBenchmarkWindowResult[];
  getLastWindow(): StableBenchmarkWindowResult | null;
  evaluateStability(indices?: readonly number[]): StabilityGateResult;
  evaluateAbaWindows(
    a1Index: number,
    bIndex: number,
    a2Index: number,
  ): AbaResult | null;
  /** window index の集合を A1 / B / A2 arm として A/B/A 判定する。aborted window が 1 つでも含まれていたら null。 */
  evaluateAbaSetWindows(
    a1Indices: readonly number[],
    bIndices: readonly number[],
    a2Indices: readonly number[],
  ): AbaSetResult | null;
  noteDisturbance(reason: StableBenchmarkAbortReason): void;
  resetAll(): void;
  getEnvironment(): Record<string, string | number | boolean | null>;
  getSegment(): { startMs: number; endMs: number };
}

const DEFAULT_CAPACITY = 8192;
const DEFAULT_WARMUP_FRAMES = 2;
const SEEK_TIMEOUT_FRAMES = 600;

function emptyWindowMetrics(): BenchmarkWindowMetrics {
  return {
    frameCount: 0,
    meanMs: 0,
    p50Ms: 0,
    p95Ms: 0,
    p99Ms: 0,
    maxMs: 0,
    elapsedStartMs: 0,
    elapsedEndMs: 0,
    longFrameShare: {
      over33_3: 0,
      over50: 0,
      over66_7: 0,
      over100: 0,
    },
  };
}

export function createStableBenchmark(options: {
  flags: BenchmarkModeFlags;
  host: StableBenchmarkHost;
  capacity?: number;
  warmupFrames?: number;
}): StableBenchmarkController | null {
  if (!options.flags.enabled) {
    return null;
  }

  const capacity = Math.max(1, Math.floor(options.capacity ?? DEFAULT_CAPACITY));
  const warmupFrames = Math.max(
    0,
    Math.floor(options.warmupFrames ?? DEFAULT_WARMUP_FRAMES),
  );
  const dtBuffer = new Float64Array(capacity);
  const elapsedBuffer = new Float64Array(capacity);
  const windows: StableBenchmarkWindowResult[] = [];
  const segmentStartMs = options.flags.segmentStartMs;
  const segmentEndMs = options.flags.segmentEndMs;

  let status: StableBenchmarkStatus = 'idle';
  let activeLabel = '';
  let activeIndex = 0;
  let seekFrames = 0;
  let warmupFramesSkipped = 0;
  let recordedFrames = 0;
  let previousTimeMs = 0;

  const finishWindow = (reason: StableBenchmarkAbortReason | null): void => {
    const samples: BenchmarkFrameSample[] = new Array(recordedFrames);
    for (let index = 0; index < recordedFrames; index += 1) {
      samples[index] = {
        dtMs: dtBuffer[index],
        elapsedMs: elapsedBuffer[index],
      };
    }
    const metrics = summarizeBenchmarkWindow(samples) ?? emptyWindowMetrics();
    const identity = options.host.getSceneIdentity();

    windows.push({
      index: activeIndex,
      label: activeLabel,
      metrics,
      identity,
      warmupFramesSkipped,
      recordedFrames,
      aborted: reason,
    });
    status = reason === null ? 'done' : 'aborted';
  };

  const onFrame = (timeMs: number, elapsedMs: number): void => {
    if (status === 'seeking') {
      seekFrames += 1;
      if (elapsedMs >= segmentStartMs && elapsedMs < segmentEndMs) {
        status = 'recording';
        previousTimeMs = timeMs;
        if (warmupFramesSkipped < warmupFrames) {
          warmupFramesSkipped += 1;
        }
        return;
      }
      if (seekFrames >= SEEK_TIMEOUT_FRAMES) {
        finishWindow('SEEK_TIMEOUT');
      }
      return;
    }

    if (status !== 'recording') {
      return;
    }

    if (elapsedMs > segmentEndMs) {
      finishWindow(null);
      return;
    }

    const dtMs = timeMs - previousTimeMs;
    previousTimeMs = timeMs;
    if (warmupFramesSkipped < warmupFrames) {
      warmupFramesSkipped += 1;
      return;
    }

    if (recordedFrames >= capacity) {
      finishWindow('CAPACITY_EXCEEDED');
      return;
    }

    dtBuffer[recordedFrames] = dtMs;
    elapsedBuffer[recordedFrames] = elapsedMs;
    recordedFrames += 1;
  };

  return {
    onFrame,
    start(label: string): void {
      if (status === 'seeking' || status === 'recording') {
        return;
      }
      activeLabel = label;
      activeIndex = windows.length;
      seekFrames = 0;
      warmupFramesSkipped = 0;
      recordedFrames = 0;
      previousTimeMs = 0;
      options.host.requestRouteClockMs(segmentStartMs);
      status = 'seeking';
    },
    getStatus(): StableBenchmarkStatus {
      return status;
    },
    getWindows(): StableBenchmarkWindowResult[] {
      return windows.slice();
    },
    getLastWindow(): StableBenchmarkWindowResult | null {
      return windows[windows.length - 1] ?? null;
    },
    evaluateStability(indices?: readonly number[]): StabilityGateResult {
      const metrics: BenchmarkWindowMetrics[] = [];
      if (indices === undefined) {
        for (let index = 0; index < windows.length; index += 1) {
          metrics.push(windows[index].metrics);
        }
      } else {
        for (let index = 0; index < indices.length; index += 1) {
          const window = windows[indices[index]];
          if (window !== undefined) {
            metrics.push(window.metrics);
          }
        }
      }
      return evaluateStabilityGate(metrics);
    },
    evaluateAbaWindows(
      a1Index: number,
      bIndex: number,
      a2Index: number,
    ): AbaResult | null {
      const a1 = windows[a1Index];
      const b = windows[bIndex];
      const a2 = windows[a2Index];
      if (
        a1 === undefined
        || b === undefined
        || a2 === undefined
        || a1.aborted !== null
        || b.aborted !== null
        || a2.aborted !== null
      ) {
        return null;
      }

      return evaluateAba({
        a1: a1.metrics,
        b: b.metrics,
        a2: a2.metrics,
        identities: {
          a1: a1.identity,
          b: b.identity,
          a2: a2.identity,
        },
      });
    },
    evaluateAbaSetWindows(
      a1Indices: readonly number[],
      bIndices: readonly number[],
      a2Indices: readonly number[],
    ): AbaSetResult | null {
      const selectWindows = (indices: readonly number[]): StableBenchmarkWindowResult[] | null => {
        const selected: StableBenchmarkWindowResult[] = [];
        for (const index of indices) {
          const window = windows[index];
          if (window === undefined || window.aborted !== null) {
            return null;
          }
          selected.push(window);
        }
        return selected;
      };
      const a1 = selectWindows(a1Indices);
      const b = selectWindows(bIndices);
      const a2 = selectWindows(a2Indices);
      if (a1 === null || b === null || a2 === null) {
        return null;
      }

      return evaluateAbaSets({
        a1: a1.map((window) => window.metrics),
        b: b.map((window) => window.metrics),
        a2: a2.map((window) => window.metrics),
        identities: {
          a1: a1.map((window) => window.identity),
          b: b.map((window) => window.identity),
          a2: a2.map((window) => window.identity),
        },
      });
    },
    noteDisturbance(reason: StableBenchmarkAbortReason): void {
      if (status === 'recording') {
        finishWindow(reason);
      }
    },
    resetAll(): void {
      windows.length = 0;
      status = 'idle';
      activeLabel = '';
      activeIndex = 0;
      seekFrames = 0;
      warmupFramesSkipped = 0;
      recordedFrames = 0;
      previousTimeMs = 0;
    },
    getEnvironment(): Record<string, string | number | boolean | null> {
      return options.host.getEnvironment();
    },
    getSegment(): { startMs: number; endMs: number } {
      return { startMs: segmentStartMs, endMs: segmentEndMs };
    },
  };
}
