import {
  applyDragDelta,
  DEFAULT_MANUAL_ORBIT_OPTIONS,
  orbitPositionFromState,
  orbitStateFromPose,
  type Vec3,
} from '../../interaction/manualOrbit';
import {
  createOrbitInputState,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  type OrbitInputState,
  type PointerOrbitInput,
  type PointerOrbitResult,
} from '../../interaction/pointerOrbit';

export interface LabOrbitPose {
  position: Vec3;
  target: Vec3;
}

export interface LabOrbitController {
  detach(): void;
  reset(): void;
  isApplied(): boolean;
  setEnabled(enabled: boolean): void;
}

export function attachLabOrbit({
  canvas,
  getPose,
  applyPose,
}: {
  canvas: HTMLElement;
  getPose: () => LabOrbitPose;
  applyPose: (pose: LabOrbitPose) => void;
}): LabOrbitController {
  let inputState: OrbitInputState = createOrbitInputState();
  let orbitState = orbitStateFromPose(getPose().position, getPose().target);
  let enabled = true;
  let applied = false;

  const inputOf = (event: PointerEvent): PointerOrbitInput => ({
    pointerId: event.pointerId,
    clientX: event.clientX,
    clientY: event.clientY,
  });

  const handleResult = (event: PointerEvent, result: PointerOrbitResult): void => {
    inputState = result.state;
    if (result.captureRequested && 'setPointerCapture' in canvas) {
      canvas.setPointerCapture(event.pointerId);
    }
    if (result.releaseRequested && 'releasePointerCapture' in canvas) {
      canvas.releasePointerCapture(event.pointerId);
    }
    if (result.delta) {
      orbitState = applyDragDelta(
        orbitState,
        result.delta.dx,
        result.delta.dy,
        DEFAULT_MANUAL_ORBIT_OPTIONS,
      );
      applied = true;
      applyPose({
        position: orbitPositionFromState(orbitState),
        target: { ...orbitState.target },
      });
    }
  };

  const pointerDown = (event: PointerEvent): void => {
    if (!applied) {
      const pose = getPose();
      orbitState = orbitStateFromPose(pose.position, pose.target);
    }
    handleResult(event, onPointerDown(inputState, inputOf(event), enabled));
  };
  const pointerMove = (event: PointerEvent): void => {
    handleResult(event, onPointerMove(inputState, inputOf(event)));
  };
  const pointerUp = (event: PointerEvent): void => {
    handleResult(event, onPointerUp(inputState, inputOf(event)));
  };
  const pointerCancel = (event: PointerEvent): void => {
    handleResult(event, onPointerCancel(inputState, inputOf(event)));
  };

  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerCancel);

  return {
    detach() {
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('pointercancel', pointerCancel);
      inputState = createOrbitInputState();
    },
    reset() {
      const pose = getPose();
      orbitState = orbitStateFromPose(pose.position, pose.target);
      inputState = createOrbitInputState();
      applied = false;
      applyPose({
        position: { ...pose.position },
        target: { ...pose.target },
      });
    },
    isApplied() {
      return applied;
    },
    setEnabled(nextEnabled) {
      enabled = nextEnabled;
      if (!enabled) inputState = createOrbitInputState();
    },
  };
}
