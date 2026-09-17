import { describe, expect, it } from 'vitest';

import { createGpuFrameTimer } from './gpuFrameTimer';

type FakeQuery = {
  id: number;
  available: boolean;
  result: number;
};

class FakeGl {
  readonly QUERY_RESULT_AVAILABLE = 0x8867;
  readonly QUERY_RESULT = 0x8866;
  readonly extension = {
    TIME_ELAPSED_EXT: 0x88bf,
    GPU_DISJOINT_EXT: 0x8fbb,
  };
  readonly queries: FakeQuery[] = [];
  readonly deleted: FakeQuery[] = [];
  disjoint = false;
  extensionAvailable = true;
  activeQuery: FakeQuery | undefined;

  getExtension(name: string): typeof this.extension | null {
    return name === 'EXT_disjoint_timer_query_webgl2' && this.extensionAvailable
      ? this.extension
      : null;
  }

  createQuery(): FakeQuery {
    const query = {
      id: this.queries.length,
      available: false,
      result: 0,
    };
    this.queries.push(query);
    return query;
  }

  beginQuery(target: number, query: FakeQuery): void {
    expect(target).toBe(this.extension.TIME_ELAPSED_EXT);
    if (this.activeQuery !== undefined) {
      throw new Error('A query is already active');
    }
    this.activeQuery = query;
  }

  endQuery(target: number): void {
    expect(target).toBe(this.extension.TIME_ELAPSED_EXT);
    if (this.activeQuery === undefined) {
      throw new Error('No query is active');
    }
    this.activeQuery = undefined;
  }

  getParameter(parameter: number): boolean {
    expect(parameter).toBe(this.extension.GPU_DISJOINT_EXT);
    return this.disjoint;
  }

  getQueryParameter(query: FakeQuery, parameter: number): boolean | number {
    if (parameter === this.QUERY_RESULT_AVAILABLE) {
      return query.available;
    }
    if (parameter === this.QUERY_RESULT) {
      if (!query.available) {
        throw new Error('Synchronous result read attempted');
      }
      return query.result;
    }
    throw new Error(`Unexpected query parameter: ${parameter}`);
  }

  deleteQuery(query: FakeQuery): void {
    this.deleted.push(query);
  }
}

function createTimer(
  gl: FakeGl,
  options?: { poolSize?: number; maxSamples?: number },
) {
  return createGpuFrameTimer(
    gl as unknown as WebGL2RenderingContext,
    options,
  );
}

describe('createGpuFrameTimer', () => {
  it('is a safe no-op when the extension is unavailable', () => {
    const gl = new FakeGl();
    gl.extensionAvailable = false;
    const timer = createTimer(gl);

    expect(timer.available).toBe(false);
    expect(timer.begin(1)).toBe(false);
    expect(() => timer.end()).not.toThrow();
    expect(() => timer.poll()).not.toThrow();
    expect(timer.snapshot()).toEqual({
      available: false,
      samples: [],
      discardedDisjoint: 0,
      skippedNoQuery: 0,
      issued: 0,
      resolved: 0,
    });
  });

  it('does not read a result until a later poll reports it available', () => {
    const gl = new FakeGl();
    const timer = createTimer(gl, { poolSize: 1 });

    expect(timer.begin(12)).toBe(true);
    timer.end();
    timer.poll();

    expect(timer.snapshot().samples).toEqual([]);
    expect(timer.snapshot().resolved).toBe(0);
  });

  it('records frame index and converts nanoseconds to milliseconds', () => {
    const gl = new FakeGl();
    const timer = createTimer(gl, { poolSize: 1 });

    timer.begin(42);
    timer.end();
    gl.queries[0].result = 12_345_678;
    gl.queries[0].available = true;
    timer.poll();

    expect(timer.snapshot().samples).toEqual([
      { frameIndex: 42, gpuMs: 12.345678 },
    ]);
    expect(timer.snapshot()).toMatchObject({ issued: 1, resolved: 1 });
  });

  it('discards every unresolved query when the GPU is disjoint', () => {
    const gl = new FakeGl();
    const timer = createTimer(gl, { poolSize: 2 });

    timer.begin(1);
    timer.end();
    timer.begin(2);
    timer.end();
    gl.disjoint = true;
    timer.poll();

    expect(timer.snapshot()).toMatchObject({
      samples: [],
      discardedDisjoint: 2,
      issued: 2,
      resolved: 0,
    });
  });

  it('skips measurement without throwing when the query pool is exhausted', () => {
    const gl = new FakeGl();
    const timer = createTimer(gl, { poolSize: 1 });

    timer.begin(1);
    timer.end();

    let began = true;
    expect(() => {
      began = timer.begin(2);
    }).not.toThrow();
    expect(began).toBe(false);
    expect(timer.snapshot().skippedNoQuery).toBe(1);
  });

  it('drops the oldest sample when the sample ring reaches capacity', () => {
    const gl = new FakeGl();
    const timer = createTimer(gl, { poolSize: 1, maxSamples: 2 });

    for (const frameIndex of [10, 11, 12]) {
      expect(timer.begin(frameIndex)).toBe(true);
      timer.end();
      gl.queries[0].result = frameIndex * 1_000_000;
      gl.queries[0].available = true;
      timer.poll();
      gl.queries[0].available = false;
    }

    expect(timer.snapshot().samples).toEqual([
      { frameIndex: 11, gpuMs: 11 },
      { frameIndex: 12, gpuMs: 12 },
    ]);
  });

  it('rejects new measurements after disposal', () => {
    const gl = new FakeGl();
    const timer = createTimer(gl, { poolSize: 2 });

    timer.dispose();

    expect(timer.begin(1)).toBe(false);
    expect(() => timer.end()).not.toThrow();
    expect(() => timer.poll()).not.toThrow();
    expect(gl.deleted).toHaveLength(2);
  });
});
