import { describe, expect, it } from 'vitest';

import type { BenchmarkModeFlags } from './benchmarkMode';
import type { BenchmarkSceneIdentity } from './benchmarkProtocol';
import {
  createStableBenchmark,
  type StableBenchmarkHost,
} from './stableBenchmark';

const enabledFlags: BenchmarkModeFlags = {
  enabled: true,
  segmentStartMs: 100,
  segmentEndMs: 200,
  targetBufferWidth: 1920,
  targetBufferHeight: 1080,
};

function makeIdentity(): BenchmarkSceneIdentity {
  return {
    drawCalls: 10,
    triangles: 100,
    visibleLabels: 4,
    drawingBufferWidth: 1920,
    drawingBufferHeight: 1080,
    segmentStartMs: 100,
    segmentEndMs: 200,
  };
}

function makeHost(identity: BenchmarkSceneIdentity = makeIdentity()): {
  host: StableBenchmarkHost;
  seeks: number[];
  identityCalls: { count: number };
} {
  const seeks: number[] = [];
  const identityCalls = { count: 0 };
  return {
    seeks,
    identityCalls,
    host: {
      getSceneIdentity: () => {
        identityCalls.count += 1;
        return { ...identity };
      },
      requestRouteClockMs: (elapsedMs) => {
        seeks.push(elapsedMs);
      },
      getEnvironment: () => ({ buildMode: 'test' }),
    },
  };
}

function recordWindow(
  controller: NonNullable<ReturnType<typeof createStableBenchmark>>,
  label: string,
  timeOffset = 0,
): void {
  controller.start(label);
  controller.onFrame(timeOffset, 100);
  controller.onFrame(timeOffset + 10, 110);
  controller.onFrame(timeOffset + 20, 120);
  controller.onFrame(timeOffset + 30, 130);
  controller.onFrame(timeOffset + 40, 201);
}

describe('stable benchmark controller', () => {
  it('returns null when benchmark mode is disabled', () => {
    const { host } = makeHost();

    expect(createStableBenchmark({
      flags: { ...enabledFlags, enabled: false },
      host,
    })).toBeNull();
  });

  it('requests the segment start exactly once on start', () => {
    const fake = makeHost();
    const controller = createStableBenchmark({ flags: enabledFlags, host: fake.host })!;

    controller.start('A1');
    controller.start('ignored');

    expect(fake.seeks).toEqual([100]);
    expect(controller.getStatus()).toBe('seeking');
  });

  it('does not record frames outside the segment', () => {
    const fake = makeHost();
    const controller = createStableBenchmark({
      flags: enabledFlags,
      host: fake.host,
      warmupFrames: 0,
    })!;

    controller.start('A1');
    controller.onFrame(0, 50);
    controller.onFrame(10, 99);

    expect(controller.getStatus()).toBe('seeking');
    expect(controller.getWindows()).toEqual([]);
  });

  it('skips the default two warmup frames', () => {
    const fake = makeHost();
    const controller = createStableBenchmark({ flags: enabledFlags, host: fake.host })!;

    recordWindow(controller, 'A1');

    expect(controller.getLastWindow()).toMatchObject({
      warmupFramesSkipped: 2,
      recordedFrames: 2,
      metrics: { frameCount: 2, elapsedStartMs: 120, elapsedEndMs: 130 },
    });
  });

  it('finishes after elapsed exceeds the segment end with the expected frame count', () => {
    const fake = makeHost();
    const controller = createStableBenchmark({ flags: enabledFlags, host: fake.host })!;

    recordWindow(controller, 'A1');

    expect(controller.getStatus()).toBe('done');
    expect(controller.getLastWindow()?.metrics.frameCount).toBe(2);
  });

  it('captures scene identity exactly once when a window completes', () => {
    const fake = makeHost();
    const controller = createStableBenchmark({ flags: enabledFlags, host: fake.host })!;

    recordWindow(controller, 'A1');
    controller.onFrame(50, 210);

    expect(fake.identityCalls.count).toBe(1);
  });

  it('retains a page-hidden abort that occurs while recording', () => {
    const fake = makeHost();
    const controller = createStableBenchmark({ flags: enabledFlags, host: fake.host })!;

    controller.start('A1');
    controller.onFrame(0, 100);
    controller.noteDisturbance('PAGE_HIDDEN');

    expect(controller.getStatus()).toBe('aborted');
    expect(controller.getWindows()).toHaveLength(1);
    expect(controller.getLastWindow()).toMatchObject({
      label: 'A1',
      aborted: 'PAGE_HIDDEN',
      metrics: { frameCount: 0 },
    });
  });

  it('aborts when the preallocated frame capacity would be exceeded', () => {
    const fake = makeHost();
    const controller = createStableBenchmark({
      flags: enabledFlags,
      host: fake.host,
      capacity: 1,
      warmupFrames: 0,
    })!;

    controller.start('A1');
    controller.onFrame(0, 100);
    controller.onFrame(10, 110);
    controller.onFrame(20, 120);

    expect(controller.getStatus()).toBe('aborted');
    expect(controller.getLastWindow()).toMatchObject({
      recordedFrames: 1,
      aborted: 'CAPACITY_EXCEEDED',
    });
  });

  it('evaluates stability across three collected windows', () => {
    const fake = makeHost();
    const controller = createStableBenchmark({ flags: enabledFlags, host: fake.host })!;

    recordWindow(controller, 'A1', 0);
    recordWindow(controller, 'A2', 1000);
    recordWindow(controller, 'A3', 2000);

    expect(controller.getWindows().map((window) => window.label)).toEqual(['A1', 'A2', 'A3']);
    expect(controller.evaluateStability().windowCount).toBe(3);
  });

  it('returns null for A/B/A evaluation when a selected window was aborted', () => {
    const fake = makeHost();
    const controller = createStableBenchmark({ flags: enabledFlags, host: fake.host })!;

    recordWindow(controller, 'A1');
    controller.start('B');
    controller.onFrame(1000, 100);
    controller.noteDisturbance('PAGE_HIDDEN');
    recordWindow(controller, 'A2', 2000);

    expect(controller.evaluateAbaWindows(0, 1, 2)).toBeNull();
  });

  it('returns null for multi-window A/B/A evaluation when a selected window was aborted', () => {
    const fake = makeHost();
    const controller = createStableBenchmark({ flags: enabledFlags, host: fake.host })!;

    recordWindow(controller, 'A1');
    controller.start('B');
    controller.onFrame(1000, 100);
    controller.noteDisturbance('PAGE_HIDDEN');
    recordWindow(controller, 'A2', 2000);

    expect(controller.evaluateAbaSetWindows([0], [1], [2])).toBeNull();
  });

  it('returns null for multi-window A/B/A evaluation with a missing index', () => {
    const fake = makeHost();
    const controller = createStableBenchmark({ flags: enabledFlags, host: fake.host })!;

    recordWindow(controller, 'A1');

    expect(controller.evaluateAbaSetWindows([0], [1], [0])).toBeNull();
  });

  it('returns a counted multi-window A/B/A result for valid selected windows', () => {
    const fake = makeHost();
    const controller = createStableBenchmark({ flags: enabledFlags, host: fake.host })!;
    for (let index = 0; index < 9; index += 1) {
      recordWindow(controller, `window-${index}`, index * 1000);
    }

    const result = controller.evaluateAbaSetWindows([0, 1, 2], [3, 4, 5], [6, 7, 8]);

    expect(result).not.toBeNull();
    expect(result).toMatchObject({ a1WindowCount: 3, bWindowCount: 3, a2WindowCount: 3 });
  });

  it('replays a segment with matching elapsed bounds and scene identity', () => {
    const identity = makeIdentity();
    const fake = makeHost(identity);
    const controller = createStableBenchmark({ flags: enabledFlags, host: fake.host })!;

    recordWindow(controller, 'A1');
    recordWindow(controller, 'A2', 1000);

    const [first, second] = controller.getWindows();
    expect(first.metrics.elapsedStartMs).toBe(second.metrics.elapsedStartMs);
    expect(first.metrics.elapsedEndMs).toBe(second.metrics.elapsedEndMs);
    expect(first.identity).toEqual(second.identity);
    expect(fake.seeks).toEqual([100, 100]);
  });

  it('clears collected windows and returns to idle on resetAll', () => {
    const fake = makeHost();
    const controller = createStableBenchmark({ flags: enabledFlags, host: fake.host })!;

    recordWindow(controller, 'A1');
    controller.resetAll();

    expect(controller.getWindows()).toEqual([]);
    expect(controller.getStatus()).toBe('idle');
    expect(controller.getLastWindow()).toBeNull();
  });

  it('aborts a seek that misses the segment for 600 frames', () => {
    const fake = makeHost();
    const controller = createStableBenchmark({ flags: enabledFlags, host: fake.host })!;

    controller.start('A1');
    for (let frame = 0; frame < 600; frame += 1) {
      controller.onFrame(frame, 50);
    }

    expect(controller.getStatus()).toBe('aborted');
    expect(controller.getLastWindow()?.aborted).toBe('SEEK_TIMEOUT');
  });
});
