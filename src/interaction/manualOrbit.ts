export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface OrbitState {
  azimuthRad: number;
  elevationRad: number;
  radius: number;
  target: Vec3;
}

export interface ManualOrbitOptions {
  yawPerPixelRad: number;
  pitchPerPixelRad: number;
  minElevationRad: number;
  maxElevationRad: number;
}

const degreesToRadians = (degrees: number): number => degrees * Math.PI / 180;

// Feasibility-spike defaults only; production tuning is intentionally not fixed here.
export const DEFAULT_MANUAL_ORBIT_OPTIONS: Readonly<ManualOrbitOptions> = {
  yawPerPixelRad: 0.005,
  pitchPerPixelRad: 0.005,
  minElevationRad: degreesToRadians(2),
  maxElevationRad: degreesToRadians(80),
};

export function orbitStateFromPose(position: Vec3, target: Vec3): OrbitState {
  const offsetX = position.x - target.x;
  const offsetY = position.y - target.y;
  const offsetZ = position.z - target.z;
  const horizontalRadius = Math.hypot(offsetX, offsetZ);
  const radius = Math.hypot(horizontalRadius, offsetY);

  return {
    azimuthRad: radius === 0 ? 0 : Math.atan2(offsetX, offsetZ),
    elevationRad: radius === 0 ? 0 : Math.atan2(offsetY, horizontalRadius),
    radius,
    target: { ...target },
  };
}

export function orbitPositionFromState(state: OrbitState): Vec3 {
  const horizontalRadius = state.radius * Math.cos(state.elevationRad);

  return {
    x: state.target.x + horizontalRadius * Math.sin(state.azimuthRad),
    y: state.target.y + state.radius * Math.sin(state.elevationRad),
    z: state.target.z + horizontalRadius * Math.cos(state.azimuthRad),
  };
}

export function applyDragDelta(
  state: OrbitState,
  dxPx: number,
  dyPx: number,
  options: ManualOrbitOptions,
): OrbitState {
  if (dxPx === 0 && dyPx === 0) {
    return state;
  }

  const elevationRad = Math.min(
    options.maxElevationRad,
    Math.max(
      options.minElevationRad,
      state.elevationRad - dyPx * options.pitchPerPixelRad,
    ),
  );

  return {
    azimuthRad: state.azimuthRad + dxPx * options.yawPerPixelRad,
    elevationRad,
    radius: state.radius,
    target: state.target,
  };
}
