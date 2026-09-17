import { describe, expect, it, vi } from 'vitest';

import {
  applyDragDelta,
  DEFAULT_MANUAL_ORBIT_OPTIONS,
  orbitPositionFromState,
  orbitStateFromPose,
} from '../../interaction/manualOrbit';
import { attachLabOrbit, type LabOrbitPose } from './labOrbit';

class FakeCanvas extends EventTarget {
  setPointerCapture = vi.fn();
  releasePointerCapture = vi.fn();
}

function pointerEvent(type: string, pointerId: number, clientX: number, clientY: number): Event {
  const event = new Event(type);
  Object.assign(event, { pointerId, clientX, clientY });
  return event;
}

describe('lab orbit', () => {
  it('matches the production pure-function drag sequence and resets exactly', () => {
    const preset: LabOrbitPose = {
      position: { x: 12, y: 8, z: 20 },
      target: { x: 2, y: 3, z: 4 },
    };
    const canvas = new FakeCanvas();
    let applied: LabOrbitPose | undefined;
    const orbit = attachLabOrbit({
      canvas: canvas as unknown as HTMLElement,
      getPose: () => preset,
      applyPose: (pose) => { applied = pose; },
    });
    canvas.dispatchEvent(pointerEvent('pointerdown', 7, 10, 20));
    canvas.dispatchEvent(pointerEvent('pointermove', 7, 24, 15));

    const expectedState = applyDragDelta(
      orbitStateFromPose(preset.position, preset.target),
      14,
      -5,
      DEFAULT_MANUAL_ORBIT_OPTIONS,
    );
    expect(applied).toEqual({
      position: orbitPositionFromState(expectedState),
      target: expectedState.target,
    });
    expect(orbit.isApplied()).toBe(true);

    orbit.reset();
    expect(applied).toEqual(preset);
    expect(orbit.isApplied()).toBe(false);
    orbit.detach();
  });
});
