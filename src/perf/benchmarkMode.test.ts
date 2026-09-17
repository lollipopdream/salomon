import { describe, expect, it } from 'vitest';

import { resolveLabelLayerPromotionFlags } from '../scene/labelLayerPromotion';
import { resolveLabelPerfBypassFlags } from '../scene/labelPerfBypass';
import { resolvePerfBypassFlags } from '../scene/perfBypass';

import {
  BENCHMARK_DEFAULT_BUFFER,
  BENCHMARK_DEFAULT_SEGMENT,
  resolveBenchmarkModeFlags,
} from './benchmarkMode';

describe('benchmark mode flags', () => {
  it('is disabled with default dimensions when the query is unspecified', () => {
    expect(resolveBenchmarkModeFlags(new URLSearchParams())).toEqual({
      enabled: false,
      segmentStartMs: BENCHMARK_DEFAULT_SEGMENT.startMs,
      segmentEndMs: BENCHMARK_DEFAULT_SEGMENT.endMs,
      targetBufferWidth: BENCHMARK_DEFAULT_BUFFER.width,
      targetBufferHeight: BENCHMARK_DEFAULT_BUFFER.height,
    });
  });

  it('enables only for an exact benchmark=1 value', () => {
    expect(resolveBenchmarkModeFlags(new URLSearchParams('benchmark=1')).enabled).toBe(true);
    expect(resolveBenchmarkModeFlags(new URLSearchParams('benchmark=0')).enabled).toBe(false);
    expect(resolveBenchmarkModeFlags(new URLSearchParams('benchmark=true')).enabled).toBe(false);
  });

  it('uses the first value for duplicate parameters', () => {
    const enabledFirst = new URLSearchParams(
      'benchmark=1&benchmark=0&benchSegment=100-200&benchSegment=300-400&benchBuffer=800x600&benchBuffer=640x480',
    );
    const disabledFirst = new URLSearchParams('benchmark=0&benchmark=1');

    expect(resolveBenchmarkModeFlags(enabledFirst)).toEqual({
      enabled: true,
      segmentStartMs: 100,
      segmentEndMs: 200,
      targetBufferWidth: 800,
      targetBufferHeight: 600,
    });
    expect(resolveBenchmarkModeFlags(disabledFirst).enabled).toBe(false);
  });

  it.each([
    '22000-16000',
    'same-22000',
    '16000-end',
    '16000',
    '16000-',
    '-1-22000',
    '16000-16000',
    'NaN-22000',
    'Infinity-22000',
  ])('falls back for invalid benchSegment=%s', (benchSegment) => {
    const flags = resolveBenchmarkModeFlags(
      new URLSearchParams({ benchmark: '1', benchSegment }),
    );

    expect([flags.segmentStartMs, flags.segmentEndMs]).toEqual([
      BENCHMARK_DEFAULT_SEGMENT.startMs,
      BENCHMARK_DEFAULT_SEGMENT.endMs,
    ]);
  });

  it.each([
    '0x1080',
    '1920x0',
    '8193x1080',
    '1920x8193',
    '1920.5x1080',
    '1920X1080',
    '1920x',
    'wide',
  ])('falls back for invalid benchBuffer=%s', (benchBuffer) => {
    const flags = resolveBenchmarkModeFlags(
      new URLSearchParams({ benchmark: '1', benchBuffer }),
    );

    expect([flags.targetBufferWidth, flags.targetBufferHeight]).toEqual([
      BENCHMARK_DEFAULT_BUFFER.width,
      BENCHMARK_DEFAULT_BUFFER.height,
    ]);
  });

  it('accepts valid custom segment and buffer values', () => {
    expect(resolveBenchmarkModeFlags(new URLSearchParams(
      'benchmark=1&benchSegment=1250.5-7250.5&benchBuffer=2560x1440',
    ))).toEqual({
      enabled: true,
      segmentStartMs: 1250.5,
      segmentEndMs: 7250.5,
      targetBufferWidth: 2560,
      targetBufferHeight: 1440,
    });
  });
});

describe('benchmark mode は診断系フラグから独立している(回帰防止)', () => {
  // このフェーズの最重要の不変条件。`?perf=1` は labelRenderer 内部の
  // diagnosticsEnabled 経由で updateOcclusion を診断実装へ差し替えてしまうため、
  // `?benchmark=1` がそれを巻き込むと「計測対象そのものが変わる」。
  const benchmarkQuery = new URLSearchParams('?benchmark=1');

  it('?benchmark=1 は perf bypass を有効化しない', () => {
    expect(resolvePerfBypassFlags(benchmarkQuery, true)).toEqual({
      disableAntialias: false,
      terrainMaterialBasic: false,
    });
  });

  it('?benchmark=1 は label perf bypass を有効化しない', () => {
    const flags = resolveLabelPerfBypassFlags(benchmarkQuery, true);
    expect(flags.skipRaycast).toBe(false);
    expect(flags.skipAppearanceWrite).toBe(false);
    expect(flags.skipProjection).toBe(false);
  });

  it('?benchmark=1 は label layer promotion を有効化しない', () => {
    expect(resolveLabelLayerPromotionFlags(benchmarkQuery, true)).toEqual({
      promoteLabelLayers: false,
    });
  });

  it('?benchmark=1 は perf / gpuTimer / labelRaycastVerify のクエリを立てない', () => {
    // sceneSetup はこれらを `queryParams.get(...) === '1'` で直接判定している。
    expect(benchmarkQuery.get('perf')).toBeNull();
    expect(benchmarkQuery.get('gpuTimer')).toBeNull();
    expect(benchmarkQuery.get('labelRaycastVerify')).toBeNull();
    expect(benchmarkQuery.get('labelRaycastFull')).toBeNull();
    expect(benchmarkQuery.get('isolate')).toBeNull();
  });

  it('逆に ?perf=1 だけでは benchmark は有効にならない', () => {
    expect(resolveBenchmarkModeFlags(new URLSearchParams('?perf=1')).enabled).toBe(false);
  });
});
