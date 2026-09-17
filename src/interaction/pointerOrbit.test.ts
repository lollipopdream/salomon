import { describe, expect, it } from 'vitest';

import {
  createOrbitInputState,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
} from './pointerOrbit';

describe('pointer orbit input state', () => {
  it('reports incremental deltas for down, move, move, up', () => {
    let state = createOrbitInputState();

    const down = onPointerDown(
      state,
      { pointerId: 7, clientX: 100, clientY: 50 },
      true,
    );
    state = down.state;
    expect(down.captureRequested).toBe(true);

    const firstMove = onPointerMove(
      state,
      { pointerId: 7, clientX: 112, clientY: 46 },
    );
    state = firstMove.state;
    expect(firstMove.delta).toEqual({ dx: 12, dy: -4 });

    const secondMove = onPointerMove(
      state,
      { pointerId: 7, clientX: 109, clientY: 60 },
    );
    state = secondMove.state;
    expect(secondMove.delta).toEqual({ dx: -3, dy: 14 });

    const up = onPointerUp(
      state,
      { pointerId: 7, clientX: 109, clientY: 60 },
    );
    expect(up.releaseRequested).toBe(true);
    expect(up.state.activePointerId).toBeUndefined();
  });

  it('does not report a delta for move without down', () => {
    const result = onPointerMove(
      createOrbitInputState(),
      { pointerId: 1, clientX: 10, clientY: 20 },
    );

    expect(result.delta).toBeUndefined();
  });

  it('ignores down while disabled', () => {
    const state = createOrbitInputState();
    const result = onPointerDown(
      state,
      { pointerId: 1, clientX: 10, clientY: 20 },
      false,
    );

    expect(result.state).toBe(state);
    expect(result.captureRequested).toBeUndefined();
  });

  it('ends dragging on pointer cancel', () => {
    const down = onPointerDown(
      createOrbitInputState(),
      { pointerId: 2, clientX: 5, clientY: 6 },
      true,
    );
    const cancelled = onPointerCancel(
      down.state,
      { pointerId: 2, clientX: 5, clientY: 6 },
    );
    const move = onPointerMove(
      cancelled.state,
      { pointerId: 2, clientX: 8, clientY: 9 },
    );

    expect(cancelled.releaseRequested).toBe(true);
    expect(move.delta).toBeUndefined();
  });

  it('ignores a second pointer without disturbing the first', () => {
    const firstDown = onPointerDown(
      createOrbitInputState(),
      { pointerId: 1, clientX: 10, clientY: 20 },
      true,
    );
    const secondDown = onPointerDown(
      firstDown.state,
      { pointerId: 2, clientX: 50, clientY: 60 },
      true,
    );
    const secondMove = onPointerMove(
      secondDown.state,
      { pointerId: 2, clientX: 70, clientY: 80 },
    );
    const firstMove = onPointerMove(
      secondMove.state,
      { pointerId: 1, clientX: 13, clientY: 25 },
    );

    expect(secondDown.state).toBe(firstDown.state);
    expect(secondMove.delta).toBeUndefined();
    expect(firstMove.delta).toEqual({ dx: 3, dy: 5 });
  });

  it('does not report a delta after pointer up', () => {
    const down = onPointerDown(
      createOrbitInputState(),
      { pointerId: 3, clientX: 1, clientY: 2 },
      true,
    );
    const up = onPointerUp(
      down.state,
      { pointerId: 3, clientX: 1, clientY: 2 },
    );
    const move = onPointerMove(
      up.state,
      { pointerId: 3, clientX: 4, clientY: 6 },
    );

    expect(move.delta).toBeUndefined();
  });
});
