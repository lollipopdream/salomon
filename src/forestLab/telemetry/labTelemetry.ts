import type { CandidateTelemetry } from '../labTypes';

export interface IntervalStats {
  medianMs: number;
  p95Ms: number;
  count: number;
}

export function computeIntervalStats(intervals: number[]): IntervalStats {
  if (intervals.length === 0) return { medianMs: 0, p95Ms: 0, count: 0 };
  const sorted = [...intervals].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const medianMs = sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
  return {
    medianMs,
    p95Ms: sorted[Math.ceil(0.95 * sorted.length) - 1],
    count: sorted.length,
  };
}

export function collectFrameIntervals({
  requestFrame,
  now,
  warmupFrames,
  sampleFrames,
}: {
  requestFrame: (callback: FrameRequestCallback) => number;
  now: () => number;
  warmupFrames: number;
  sampleFrames: number;
}): Promise<number[]> {
  if (!Number.isInteger(warmupFrames) || warmupFrames < 0) {
    return Promise.reject(new RangeError('Warmup frame count must be a non-negative integer.'));
  }
  if (!Number.isInteger(sampleFrames) || sampleFrames < 0) {
    return Promise.reject(new RangeError('Sample frame count must be a non-negative integer.'));
  }
  if (sampleFrames === 0) return Promise.resolve([]);
  return new Promise((resolve) => {
    const intervals: number[] = [];
    let frame = 0;
    let previous = now();
    const tick = (): void => {
      const current = now();
      const interval = current - previous;
      previous = current;
      if (frame >= warmupFrames) intervals.push(interval);
      frame += 1;
      if (intervals.length === sampleFrames) resolve(intervals);
      else requestFrame(tick);
    };
    requestFrame(tick);
  });
}

export function collectRendererCounters(renderer: {
  info: {
    render: { calls: number; triangles: number };
    memory: { geometries: number; textures: number };
  };
}): { drawCalls: number; triangles: number; geometries: number; textures: number } {
  return {
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
  };
}

export function buildCandidateTelemetry({
  counters,
  shellVertexCount,
  shellTriangleCount,
  detailCount,
  buildMs,
  assetMs,
  intervals,
  instanceCount,
  clusterCount,
  memberCount,
}: {
  counters: ReturnType<typeof collectRendererCounters>;
  shellVertexCount: number;
  shellTriangleCount: number;
  detailCount: number;
  buildMs: number;
  assetMs: number;
  intervals: number[];
  instanceCount?: number;
  clusterCount?: number;
  memberCount?: number;
}): CandidateTelemetry {
  const stats = computeIntervalStats(intervals);
  return {
    ...counters,
    estimatedInstanceBytes: (detailCount + (instanceCount ?? 0)) * 64,
    shellVertexCount,
    shellTriangleCount,
    buildMs,
    assetMs,
    medianRafFrameIntervalMs: stats.medianMs,
    p95RafFrameIntervalMs: stats.p95Ms,
    instanceCount: instanceCount ?? 0,
    clusterCount: clusterCount ?? 0,
    memberCount: memberCount ?? 0,
  };
}
