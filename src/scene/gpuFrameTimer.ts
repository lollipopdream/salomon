export interface GpuFrameSample {
  frameIndex: number;
  gpuMs: number;
}

export interface GpuFrameTimerSnapshot {
  available: boolean;
  samples: GpuFrameSample[];
  discardedDisjoint: number;
  skippedNoQuery: number;
  issued: number;
  resolved: number;
}

export interface GpuFrameTimer {
  readonly available: boolean;
  begin(frameIndex: number): boolean;
  end(): void;
  poll(): void;
  snapshot(): GpuFrameTimerSnapshot;
  dispose(): void;
}

type TimerQueryExtension = {
  readonly TIME_ELAPSED_EXT: number;
  readonly GPU_DISJOINT_EXT: number;
};

/** A fixed-size ring with no WebGL dependency. */
export class FixedRingBuffer<T> {
  private readonly entries: T[] = [];
  private start = 0;

  constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError('Ring buffer capacity must be a positive integer');
    }
  }

  push(value: T): void {
    if (this.entries.length < this.capacity) {
      this.entries.push(value);
      return;
    }

    this.entries[this.start] = value;
    this.start = (this.start + 1) % this.capacity;
  }

  toArray(): T[] {
    if (this.entries.length < this.capacity || this.start === 0) {
      return this.entries.slice();
    }
    return [
      ...this.entries.slice(this.start),
      ...this.entries.slice(0, this.start),
    ];
  }

  clear(): void {
    this.entries.length = 0;
    this.start = 0;
  }
}

/** A bounded, reusable object pool with no WebGL dependency. */
class ObjectPool<T> {
  private readonly available: T[];

  constructor(entries: T[]) {
    this.available = entries;
  }

  take(): T | undefined {
    return this.available.pop();
  }

  release(entry: T): void {
    this.available.push(entry);
  }

  drain(): T[] {
    return this.available.splice(0);
  }
}

type PendingQuery = {
  query: WebGLQuery;
  frameIndex: number;
};

const DEFAULT_POOL_SIZE = 8;
const DEFAULT_MAX_SAMPLES = 4000;
const NANOSECONDS_PER_MILLISECOND = 1_000_000;

function positiveIntegerOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function createNoopGpuFrameTimer(): GpuFrameTimer {
  return {
    available: false,
    begin: () => false,
    end: () => undefined,
    poll: () => undefined,
    snapshot: () => ({
      available: false,
      samples: [],
      discardedDisjoint: 0,
      skippedNoQuery: 0,
      issued: 0,
      resolved: 0,
    }),
    dispose: () => undefined,
  };
}

export function createGpuFrameTimer(
  gl: WebGL2RenderingContext | null,
  options: { poolSize?: number; maxSamples?: number } = {},
): GpuFrameTimer {
  if (gl === null) {
    return createNoopGpuFrameTimer();
  }

  const extension = gl.getExtension(
    'EXT_disjoint_timer_query_webgl2',
  ) as TimerQueryExtension | null;
  if (extension === null) {
    return createNoopGpuFrameTimer();
  }

  const queries: WebGLQuery[] = [];
  const poolSize = positiveIntegerOr(options.poolSize, DEFAULT_POOL_SIZE);
  for (let index = 0; index < poolSize; index += 1) {
    const query = gl.createQuery();
    if (query !== null) {
      queries.push(query);
    }
  }
  if (queries.length === 0) {
    return createNoopGpuFrameTimer();
  }

  const queryPool = new ObjectPool(queries);
  const samples = new FixedRingBuffer<GpuFrameSample>(
    positiveIntegerOr(options.maxSamples, DEFAULT_MAX_SAMPLES),
  );
  let active: PendingQuery | undefined;
  let pending: PendingQuery[] = [];
  let disposed = false;
  let discardedDisjoint = 0;
  let skippedNoQuery = 0;
  let issued = 0;
  let resolved = 0;

  return {
    available: true,
    begin(frameIndex: number): boolean {
      if (disposed || active !== undefined) {
        return false;
      }

      const query = queryPool.take();
      if (query === undefined) {
        skippedNoQuery += 1;
        return false;
      }

      try {
        gl.beginQuery(extension.TIME_ELAPSED_EXT, query);
      } catch {
        queryPool.release(query);
        return false;
      }
      active = { query, frameIndex };
      issued += 1;
      return true;
    },

    end(): void {
      if (disposed || active === undefined) {
        return;
      }

      const completed = active;
      active = undefined;
      try {
        gl.endQuery(extension.TIME_ELAPSED_EXT);
        pending.push(completed);
      } catch {
        gl.deleteQuery(completed.query);
      }
    },

    poll(): void {
      if (disposed || pending.length === 0) {
        return;
      }

      let disjoint: boolean;
      try {
        disjoint = Boolean(gl.getParameter(extension.GPU_DISJOINT_EXT));
      } catch {
        return;
      }
      if (disjoint) {
        discardedDisjoint += pending.length;
        for (const entry of pending) {
          queryPool.release(entry.query);
        }
        pending = [];
        return;
      }

      const unresolved: PendingQuery[] = [];
      for (const entry of pending) {
        let resultAvailable = false;
        try {
          resultAvailable = Boolean(
            gl.getQueryParameter(entry.query, gl.QUERY_RESULT_AVAILABLE),
          );
        } catch {
          unresolved.push(entry);
          continue;
        }

        if (!resultAvailable) {
          unresolved.push(entry);
          continue;
        }

        try {
          const elapsedNanoseconds = Number(
            gl.getQueryParameter(entry.query, gl.QUERY_RESULT),
          );
          samples.push({
            frameIndex: entry.frameIndex,
            gpuMs: elapsedNanoseconds / NANOSECONDS_PER_MILLISECOND,
          });
          resolved += 1;
          queryPool.release(entry.query);
        } catch {
          unresolved.push(entry);
        }
      }
      pending = unresolved;
    },

    snapshot(): GpuFrameTimerSnapshot {
      return {
        available: true,
        samples: samples.toArray().map((sample) => ({ ...sample })),
        discardedDisjoint,
        skippedNoQuery,
        issued,
        resolved,
      };
    },

    dispose(): void {
      if (disposed) {
        return;
      }
      disposed = true;

      if (active !== undefined) {
        try {
          gl.endQuery(extension.TIME_ELAPSED_EXT);
        } catch {
          // Disposal must remain best-effort and must not affect scene teardown.
        }
        gl.deleteQuery(active.query);
        active = undefined;
      }
      for (const entry of pending) {
        gl.deleteQuery(entry.query);
      }
      pending = [];
      for (const query of queryPool.drain()) {
        gl.deleteQuery(query);
      }
      samples.clear();
    },
  };
}
