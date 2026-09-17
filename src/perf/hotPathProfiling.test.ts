import { describe, expect, it, vi } from 'vitest';

import {
  createHotPathProfiler,
  summarizeMeasuresByBlock,
  type HotPathBlockName,
} from './hotPathProfiling';

const blockNames: HotPathBlockName[] = [
  'route-progress',
  'camera-update',
  'route-line-update',
  'route-head-marker',
  'label-occlusion',
  'spot-arrival',
  'renderer-render',
];

describe('hot path profiling', () => {
  it('summarizes measures by their matching hot-path block', () => {
    const summary = summarizeMeasuresByBlock(
      [
        { name: 'hp:camera-update', duration: 2 },
        { name: 'hp:camera-update', duration: 4 },
        { name: 'hp:renderer-render', duration: 10 },
        { name: 'other-measure', duration: 99 },
      ],
      blockNames,
    );

    expect(summary['camera-update']).toEqual({
      count: 2,
      totalMs: 6,
      avgMs: 3,
      maxMs: 4,
    });
    expect(summary['renderer-render']).toEqual({
      count: 1,
      totalMs: 10,
      avgMs: 10,
      maxMs: 10,
    });
    expect(summary['label-occlusion']).toEqual({
      count: 0,
      totalMs: 0,
      avgMs: 0,
      maxMs: 0,
    });
  });

  it('creates marks and measures, then returns injected measurement summaries', () => {
    const markFn = vi.fn();
    const measureFn = vi.fn();
    const entries = [
      { name: 'hp:camera-update', duration: 2 },
      { name: 'hp:camera-update', duration: 6 },
      { name: 'hp:route-line-update', duration: 5 },
    ];
    const profiler = createHotPathProfiler(markFn, measureFn, () => entries);

    profiler.begin('camera-update');
    profiler.end('camera-update');
    profiler.begin('route-line-update');
    profiler.end('route-line-update');

    expect(markFn.mock.calls).toEqual([
      ['hp:camera-update:start'],
      ['hp:camera-update:end'],
      ['hp:route-line-update:start'],
      ['hp:route-line-update:end'],
    ]);
    expect(measureFn.mock.calls).toEqual([
      ['hp:camera-update', 'hp:camera-update:start', 'hp:camera-update:end'],
      ['hp:route-line-update', 'hp:route-line-update:start', 'hp:route-line-update:end'],
    ]);
    expect(profiler.getSummary()['camera-update']).toEqual({
      count: 2,
      totalMs: 8,
      avgMs: 4,
      maxMs: 6,
    });
    expect(profiler.getSummary()['spot-arrival']).toEqual({
      count: 0,
      totalMs: 0,
      avgMs: 0,
      maxMs: 0,
    });
  });

  it('excludes measurements recorded before reset', () => {
    const entries = [{ name: 'hp:camera-update', duration: 2 }];
    const profiler = createHotPathProfiler(vi.fn(), vi.fn(), () => entries);

    profiler.reset();
    entries.push({ name: 'hp:camera-update', duration: 5 });

    expect(profiler.getSummary()['camera-update']).toEqual({
      count: 1,
      totalMs: 5,
      avgMs: 5,
      maxMs: 5,
    });
  });
});
