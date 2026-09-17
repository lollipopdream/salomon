const MAX_SAMPLES = 1800;

type Vector3 = { x: number; y: number; z: number };
type Quaternion = Vector3 & { w: number };

export interface CameraMotionSample {
  timestampMs: number;
  position: Vector3;
  quaternion: Quaternion;
}

export interface RateStat {
  avg: number;
  max: number;
  p95: number;
}

export interface CameraMotionSummary {
  sampleCount: number;
  linear: {
    displacementPerFrame: RateStat;
    velocityPerMs: RateStat;
    accelerationPerMs2: RateStat;
    jerkPerMs3: RateStat;
  };
  angular: {
    displacementRadPerFrame: RateStat;
    velocityRadPerMs: RateStat;
    accelerationRadPerMs2: RateStat;
    jerkRadPerMs3: RateStat;
  };
  directionReversalCount: {
    linearAxisReversals: number;
    angularReversals: number;
  };
  longFrameJumpCorrelation: {
    sampleCount: number;
    pearsonRLinear: number;
    pearsonRAngular: number;
  };
}

export function computeAngularDistanceRad(a: Quaternion, b: Quaternion): number {
  const dot = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
  if (!Number.isFinite(dot)) {
    return 0;
  }

  const clampedDot = Math.min(Math.max(Math.abs(dot), 0), 1);
  return Math.max(0, 2 * Math.acos(clampedDot));
}

export function detectSignReversals(values: number[]): number {
  let reversals = 0;
  let previousSign = 0;

  for (const value of values) {
    if (!Number.isFinite(value) || value === 0) {
      continue;
    }

    const sign = Math.sign(value);
    if (previousSign !== 0 && sign !== previousSign) {
      reversals += 1;
    }
    previousSign = sign;
  }

  return reversals;
}

export function computePearsonCorrelation(xs: number[], ys: number[]): number {
  const pairedValues: Array<[number, number]> = [];
  const pairCount = Math.min(xs.length, ys.length);

  for (let index = 0; index < pairCount; index += 1) {
    const x = xs[index];
    const y = ys[index];
    if (Number.isFinite(x) && Number.isFinite(y)) {
      pairedValues.push([x, y]);
    }
  }

  if (pairedValues.length < 2) {
    return 0;
  }

  const meanX = pairedValues.reduce((sum, [x]) => sum + x, 0) / pairedValues.length;
  const meanY = pairedValues.reduce((sum, [, y]) => sum + y, 0) / pairedValues.length;
  let covariance = 0;
  let xVariance = 0;
  let yVariance = 0;

  for (const [x, y] of pairedValues) {
    const centeredX = x - meanX;
    const centeredY = y - meanY;
    covariance += centeredX * centeredY;
    xVariance += centeredX * centeredX;
    yVariance += centeredY * centeredY;
  }

  if (xVariance === 0 || yVariance === 0) {
    return 0;
  }

  const correlation = covariance / Math.sqrt(xVariance * yVariance);
  return Number.isFinite(correlation) ? Math.min(Math.max(correlation, -1), 1) : 0;
}

export interface CameraMotionRecorder {
  recordSample(sample: CameraMotionSample, frameGapMs: number): void;
  getSummary(): CameraMotionSummary | undefined;
  reset(): void;
}

type TimedCameraMotionSample = CameraMotionSample & { frameGapMs: number };

function createRateStat(values: number[]): RateStat {
  const finiteValues = values.filter(Number.isFinite);
  if (finiteValues.length === 0) {
    return { avg: 0, max: 0, p95: 0 };
  }

  const sortedValues = [...finiteValues].sort((a, b) => a - b);
  const p95Index = Math.min(Math.ceil(sortedValues.length * 0.95) - 1, sortedValues.length - 1);

  return {
    avg: finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length,
    max: sortedValues[sortedValues.length - 1],
    p95: sortedValues[p95Index],
  };
}

function vectorDistance(a: Vector3, b: Vector3): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

function signedAngularMotion(a: Quaternion, b: Quaternion): number {
  // q(b) * conjugate(q(a)); its vector part encodes the rotation axis and direction.
  const relative = {
    x: b.w * -a.x + b.x * a.w + b.y * -a.z - b.z * -a.y,
    y: b.w * -a.y - b.x * -a.z + b.y * a.w + b.z * -a.x,
    z: b.w * -a.z + b.x * -a.y - b.y * -a.x + b.z * a.w,
    w: b.w * a.w - b.x * -a.x - b.y * -a.y - b.z * -a.z,
  };
  const orientationSign = relative.w < 0 ? -1 : 1;
  const components = [relative.x * orientationSign, relative.y * orientationSign, relative.z * orientationSign];
  const dominantComponent = components.reduce((dominant, component) =>
    Math.abs(component) > Math.abs(dominant) ? component : dominant,
  0);

  return Math.sign(dominantComponent) * computeAngularDistanceRad(a, b);
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function summarizeCameraMotion(samples: TimedCameraMotionSample[]): CameraMotionSummary {
  const linearDisplacements: number[] = [];
  const angularDisplacements: number[] = [];
  const linearVelocities: number[] = [];
  const angularVelocities: number[] = [];
  const linearAccelerations: number[] = [];
  const angularAccelerations: number[] = [];
  const linearJerks: number[] = [];
  const angularJerks: number[] = [];
  const linearXChanges: number[] = [];
  const linearYChanges: number[] = [];
  const linearZChanges: number[] = [];
  const signedAngularChanges: number[] = [];
  const frameGaps: number[] = [];
  const correlationLinearDisplacements: number[] = [];
  const correlationAngularDisplacements: number[] = [];
  let previousLinearVelocity: number | undefined;
  let previousAngularVelocity: number | undefined;
  let previousLinearAcceleration: number | undefined;
  let previousAngularAcceleration: number | undefined;

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    const linearDisplacement = vectorDistance(previous.position, current.position);
    const angularDisplacement = computeAngularDistanceRad(previous.quaternion, current.quaternion);

    linearDisplacements.push(linearDisplacement);
    angularDisplacements.push(angularDisplacement);
    linearXChanges.push(current.position.x - previous.position.x);
    linearYChanges.push(current.position.y - previous.position.y);
    linearZChanges.push(current.position.z - previous.position.z);
    signedAngularChanges.push(signedAngularMotion(previous.quaternion, current.quaternion));

    if (!isPositiveFinite(current.frameGapMs)) {
      continue;
    }

    const deltaMs = current.frameGapMs;
    const linearVelocity = linearDisplacement / deltaMs;
    const angularVelocity = angularDisplacement / deltaMs;
    linearVelocities.push(linearVelocity);
    angularVelocities.push(angularVelocity);
    frameGaps.push(deltaMs);
    correlationLinearDisplacements.push(linearDisplacement);
    correlationAngularDisplacements.push(angularDisplacement);

    if (previousLinearVelocity !== undefined) {
      const linearAcceleration = (linearVelocity - previousLinearVelocity) / deltaMs;
      linearAccelerations.push(linearAcceleration);
      if (previousLinearAcceleration !== undefined) {
        linearJerks.push((linearAcceleration - previousLinearAcceleration) / deltaMs);
      }
      previousLinearAcceleration = linearAcceleration;
    }

    if (previousAngularVelocity !== undefined) {
      const angularAcceleration = (angularVelocity - previousAngularVelocity) / deltaMs;
      angularAccelerations.push(angularAcceleration);
      if (previousAngularAcceleration !== undefined) {
        angularJerks.push((angularAcceleration - previousAngularAcceleration) / deltaMs);
      }
      previousAngularAcceleration = angularAcceleration;
    }

    previousLinearVelocity = linearVelocity;
    previousAngularVelocity = angularVelocity;
  }

  return {
    sampleCount: samples.length,
    linear: {
      displacementPerFrame: createRateStat(linearDisplacements),
      velocityPerMs: createRateStat(linearVelocities),
      accelerationPerMs2: createRateStat(linearAccelerations),
      jerkPerMs3: createRateStat(linearJerks),
    },
    angular: {
      displacementRadPerFrame: createRateStat(angularDisplacements),
      velocityRadPerMs: createRateStat(angularVelocities),
      accelerationRadPerMs2: createRateStat(angularAccelerations),
      jerkRadPerMs3: createRateStat(angularJerks),
    },
    directionReversalCount: {
      linearAxisReversals:
        detectSignReversals(linearXChanges) +
        detectSignReversals(linearYChanges) +
        detectSignReversals(linearZChanges),
      angularReversals: detectSignReversals(signedAngularChanges),
    },
    longFrameJumpCorrelation: {
      sampleCount: frameGaps.length,
      pearsonRLinear: computePearsonCorrelation(frameGaps, correlationLinearDisplacements),
      pearsonRAngular: computePearsonCorrelation(frameGaps, correlationAngularDisplacements),
    },
  };
}

export function createCameraMotionRecorder(): CameraMotionRecorder {
  const samples: TimedCameraMotionSample[] = [];

  return {
    recordSample(sample, frameGapMs) {
      samples.push({
        timestampMs: sample.timestampMs,
        position: { ...sample.position },
        quaternion: { ...sample.quaternion },
        frameGapMs,
      });
      if (samples.length > MAX_SAMPLES) {
        samples.shift();
      }
    },

    getSummary() {
      return samples.length > 0 ? summarizeCameraMotion(samples) : undefined;
    },

    reset() {
      samples.length = 0;
    },
  };
}
