export interface BenchmarkModeFlags {
  enabled: boolean;
  segmentStartMs: number;
  segmentEndMs: number;
  targetBufferWidth: number;
  targetBufferHeight: number;
}

export const BENCHMARK_DEFAULT_SEGMENT: {
  startMs: number;
  endMs: number;
} = {
  startMs: 16_000,
  endMs: 22_000,
};

export const BENCHMARK_DEFAULT_BUFFER: {
  width: number;
  height: number;
} = {
  width: 1920,
  height: 1080,
};

const FINITE_NUMBER_PATTERN = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?';
const SEGMENT_PATTERN = new RegExp(
  `^(${FINITE_NUMBER_PATTERN})-(${FINITE_NUMBER_PATTERN})$`,
);
const BUFFER_PATTERN = /^(\d+)x(\d+)$/;

function resolveSegment(value: string | null): { startMs: number; endMs: number } {
  const match = value?.match(SEGMENT_PATTERN);
  if (match === undefined || match === null) {
    return BENCHMARK_DEFAULT_SEGMENT;
  }

  const startMs = Number(match[1]);
  const endMs = Number(match[2]);
  if (
    !Number.isFinite(startMs)
    || !Number.isFinite(endMs)
    || startMs < 0
    || endMs < 0
    || startMs >= endMs
  ) {
    return BENCHMARK_DEFAULT_SEGMENT;
  }

  return { startMs, endMs };
}

function resolveBuffer(value: string | null): { width: number; height: number } {
  const match = value?.match(BUFFER_PATTERN);
  if (match === undefined || match === null) {
    return BENCHMARK_DEFAULT_BUFFER;
  }

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (
    !Number.isInteger(width)
    || !Number.isInteger(height)
    || width < 1
    || height < 1
    || width > 8192
    || height > 8192
  ) {
    return BENCHMARK_DEFAULT_BUFFER;
  }

  return { width, height };
}

export function resolveBenchmarkModeFlags(
  query: URLSearchParams,
): BenchmarkModeFlags {
  const segment = resolveSegment(query.get('benchSegment'));
  const buffer = resolveBuffer(query.get('benchBuffer'));

  return {
    enabled: query.get('benchmark') === '1',
    segmentStartMs: segment.startMs,
    segmentEndMs: segment.endMs,
    targetBufferWidth: buffer.width,
    targetBufferHeight: buffer.height,
  };
}
