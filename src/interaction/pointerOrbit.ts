export interface PointerOrbitInput {
  pointerId: number;
  clientX: number;
  clientY: number;
}

interface PointerPosition {
  clientX: number;
  clientY: number;
}

export interface OrbitInputState {
  activePointerId: number | undefined;
  trackedPointers: ReadonlyMap<number, PointerPosition>;
}

export interface PointerOrbitResult {
  state: OrbitInputState;
  delta?: { dx: number; dy: number };
  captureRequested?: boolean;
  releaseRequested?: boolean;
}

export function createOrbitInputState(): OrbitInputState {
  return {
    activePointerId: undefined,
    trackedPointers: new Map(),
  };
}

export function onPointerDown(
  state: OrbitInputState,
  input: PointerOrbitInput,
  enabled: boolean,
): PointerOrbitResult {
  if (!enabled || state.activePointerId !== undefined) {
    return { state };
  }

  return {
    state: {
      activePointerId: input.pointerId,
      trackedPointers: new Map([
        [input.pointerId, { clientX: input.clientX, clientY: input.clientY }],
      ]),
    },
    captureRequested: true,
  };
}

export function onPointerMove(
  state: OrbitInputState,
  input: PointerOrbitInput,
): PointerOrbitResult {
  if (state.activePointerId !== input.pointerId) {
    return { state };
  }

  const previous = state.trackedPointers.get(input.pointerId);
  if (previous === undefined) {
    return { state };
  }

  const trackedPointers = new Map(state.trackedPointers);
  trackedPointers.set(input.pointerId, {
    clientX: input.clientX,
    clientY: input.clientY,
  });

  return {
    state: {
      activePointerId: state.activePointerId,
      trackedPointers,
    },
    delta: {
      dx: input.clientX - previous.clientX,
      dy: input.clientY - previous.clientY,
    },
  };
}

function endPointer(
  state: OrbitInputState,
  input: PointerOrbitInput,
): PointerOrbitResult {
  if (state.activePointerId !== input.pointerId) {
    return { state };
  }

  const trackedPointers = new Map(state.trackedPointers);
  trackedPointers.delete(input.pointerId);

  return {
    state: {
      activePointerId: undefined,
      trackedPointers,
    },
    releaseRequested: true,
  };
}

export function onPointerUp(
  state: OrbitInputState,
  input: PointerOrbitInput,
): PointerOrbitResult {
  return endPointer(state, input);
}

export function onPointerCancel(
  state: OrbitInputState,
  input: PointerOrbitInput,
): PointerOrbitResult {
  return endPointer(state, input);
}
