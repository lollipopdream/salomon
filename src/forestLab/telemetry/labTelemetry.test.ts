import { describe, expect, it } from 'vitest';

import {
  buildCandidateTelemetry,
  collectFrameIntervals,
  computeIntervalStats,
} from './labTelemetry';

describe('lab telemetry', () => {
  it('uses the specified even median and nearest-rank p95 for 300 intervals', () => {
    const intervals = Array.from({ length: 300 }, (_, index) => 300 - index);
    expect(computeIntervalStats(intervals)).toEqual({
      medianMs: (150 + 151) / 2,
      p95Ms: 285,
      count: 300,
    });
  });

  it('discards all 30 warmup intervals before collecting samples', async () => {
    let clock = 0;
    let requested = 0;
    const intervals = await collectFrameIntervals({
      requestFrame(callback) {
        requested += 1;
        clock += requested <= 30 ? 1000 + requested : requested - 30;
        callback(clock);
        return requested;
      },
      now: () => clock,
      warmupFrames: 30,
      sampleFrames: 5,
    });
    expect(intervals).toEqual([1, 2, 3, 4, 5]);
    expect(requested).toBe(35);
  });

  it('estimates one 64-byte matrix per detail instance', () => {
    const result = buildCandidateTelemetry({
      counters: { drawCalls: 4, triangles: 12, geometries: 3, textures: 2 },
      shellVertexCount: 9,
      shellTriangleCount: 8,
      detailCount: 37,
      buildMs: 2,
      assetMs: 5,
      intervals: [15, 17],
    });
    expect(result.estimatedInstanceBytes).toBe(37 * 64);
    expect(result.instanceCount).toBe(0);
    expect(result.clusterCount).toBe(0);
    expect(result.memberCount).toBe(0);
  });

  it('adds cluster instance bytes on top of detail bytes and reports cluster fields', () => {
    const result = buildCandidateTelemetry({
      counters: { drawCalls: 4, triangles: 12, geometries: 3, textures: 2 },
      shellVertexCount: 9,
      shellTriangleCount: 8,
      detailCount: 37,
      buildMs: 2,
      assetMs: 5,
      intervals: [15, 17],
      instanceCount: 200,
      clusterCount: 10,
      memberCount: 195,
    });
    expect(result.estimatedInstanceBytes).toBe((37 + 200) * 64);
    expect(result.instanceCount).toBe(200);
    expect(result.clusterCount).toBe(10);
    expect(result.memberCount).toBe(195);
  });
});
