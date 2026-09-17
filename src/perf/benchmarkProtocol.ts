export interface BenchmarkFrameSample {
  dtMs: number;
  elapsedMs: number;
}

export interface BenchmarkWindowMetrics {
  frameCount: number;
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  elapsedStartMs: number;
  elapsedEndMs: number;
  longFrameShare: {
    over33_3: number;
    over50: number;
    over66_7: number;
    over100: number;
  };
}

export interface BenchmarkSceneIdentity {
  drawCalls: number;
  triangles: number;
  visibleLabels: number;
  drawingBufferWidth: number;
  drawingBufferHeight: number;
  segmentStartMs: number;
  segmentEndMs: number;
}

export interface StabilityThresholds {
  meanSpreadMax: number;
  p50SpreadMax: number;
  over50ShareSpreadMax: number;
  minWindows: number;
}

export const DEFAULT_STABILITY_THRESHOLDS: StabilityThresholds = {
  meanSpreadMax: 0.10,
  p50SpreadMax: 0.10,
  over50ShareSpreadMax: 0.05,
  minWindows: 3,
};

export type StabilityVerdict = 'STABLE' | 'UNSTABLE' | 'INSUFFICIENT_WINDOWS';

export interface StabilityGateResult {
  verdict: StabilityVerdict;
  windowCount: number;
  /** mean の相対 spread `(max - min) / min`。 */
  meanSpread: number;
  /** p50 の相対 spread `(max - min) / min`。 */
  p50Spread: number;
  /** >50ms share の**絶対**差 `max - min`(percentage point、0..1 スケール)。 */
  over50ShareSpread: number;
  failedChecks: string[];
  thresholds: StabilityThresholds;
}

export interface AbaDriftThresholds {
  meanDriftMax: number;
  p50DriftMax: number;
}

export const DEFAULT_ABA_DRIFT_THRESHOLDS: AbaDriftThresholds = {
  meanDriftMax: 0.15,
  p50DriftMax: 0.15,
};

/**
 * Pooled baseline の noise floor に掛ける MAD の保守的な倍率。
 *
 * 外れ値に頑健にするため full range ではなく MAD を使う。3 倍は保守側に
 * 倒した既定であり、self-test（NO-OP は棄却・known-large は検出）の両方を
 * 満たすことを受け入れ条件としている。
 */
export const NOISE_FLOOR_MAD_MULTIPLIER = 3;

export type AbaVerdict =
  | 'VALID_IMPROVEMENT'
  | 'VALID_REGRESSION'
  | 'NOISE_INCONCLUSIVE'
  | 'INVALID_DRIFT'
  | 'INVALID_SCENE_MISMATCH';

export interface AbaMetricEffect {
  baselineReference: number;
  candidate: number;
  absoluteDelta: number;
  percentDelta: number;
  baselineDrift: number;
  exceedsNoise: boolean;
}

export interface AbaResult {
  verdict: AbaVerdict;
  meanDrift: number;
  p50Drift: number;
  sceneMismatchFields: string[];
  effects: {
    mean: AbaMetricEffect;
    p50: AbaMetricEffect;
    p95: AbaMetricEffect;
    over50Share: AbaMetricEffect;
  };
  failedChecks: string[];
  thresholds: AbaDriftThresholds;
  minEffect: number;
}

export interface AbaSetMetricEffect {
  /** baseline arm (A1 \u222a A2) の全 window の中央値。 */
  baselineReference: number;
  /** candidate arm の全 window の中央値。 */
  candidate: number;
  /** candidate - baselineReference。 */
  absoluteDelta: number;
  /** absoluteDelta / baselineReference。 */
  percentDelta: number;
  /** pooled baseline の中央絶対偏差(単位は metric と同じ)。 */
  baselineMad: number;
  /** `3 * baselineMad / baselineReference` による相対 noise floor。 */
  baselineNoiseFloor: number;
  /** `|percentDelta| > max(baselineNoiseFloor, minEffect)` を満たすか。 */
  exceedsNoise: boolean;
}

export interface AbaSetResult {
  verdict: AbaVerdict;
  a1WindowCount: number;
  bWindowCount: number;
  a2WindowCount: number;
  /** `|median(A1 arm) - median(A2 arm)| / baselineReference`。 */
  meanDrift: number;
  /** p50 についての同じ量。 */
  p50Drift: number;
  sceneMismatchFields: string[];
  effects: {
    mean: AbaSetMetricEffect;
    p50: AbaSetMetricEffect;
    p95: AbaSetMetricEffect;
    over50Share: AbaSetMetricEffect;
  };
  failedChecks: string[];
  thresholds: AbaDriftThresholds;
  minEffect: number;
  minWindowsPerArm: number;
}

export type BenchmarkSessionStatus = 'STABLE_SESSION' | 'INVALID_UNSTABLE';

function computePercentile(sortedAscendingMs: readonly number[], percentile0to1: number): number {
  if (sortedAscendingMs.length === 0) {
    return 0;
  }

  const percentile = Math.min(Math.max(percentile0to1, 0), 1);
  const index = Math.min(
    Math.max(Math.ceil(percentile * sortedAscendingMs.length) - 1, 0),
    sortedAscendingMs.length - 1,
  );
  return sortedAscendingMs[index];
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/** Returns the middle value, or the average of the two middle values, without mutating `values`. */
export function median(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const upperMiddleIndex = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[upperMiddleIndex];
  }
  return (sorted[upperMiddleIndex - 1] + sorted[upperMiddleIndex]) / 2;
}

function computeSpread(values: readonly number[], checkName: string, failedChecks: string[]): number {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum <= 0) {
    failedChecks.push(`${checkName}: invalid minimum`);
    return 0;
  }
  return (maximum - minimum) / minimum;
}

/**
 * Absolute (not relative) spread, in the same unit as the inputs.
 *
 * `longFrameShare.over50` is already a ratio in 0..1, so its readiness criterion
 * is stated in percentage points (`max - min <= 0.05`), never as a relative
 * spread. A relative spread would be both wrong and unusable here: three windows
 * at 0.152 / 0.166 / 0.152 differ by only 1.4 percentage points yet have a 9.4%
 * relative spread, and a perfectly stable session where every window has a share
 * of exactly 0 would divide by zero.
 */
function computeAbsoluteSpread(
  values: readonly number[],
  checkName: string,
  failedChecks: string[],
): number {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) {
    failedChecks.push(`${checkName}: invalid value`);
    return 0;
  }
  return maximum - minimum;
}

export function summarizeBenchmarkWindow(
  samples: readonly BenchmarkFrameSample[],
): BenchmarkWindowMetrics | null {
  const validSamples = samples.filter((sample) => Number.isFinite(sample.dtMs) && sample.dtMs >= 0);
  if (validSamples.length === 0) {
    return null;
  }

  const intervals = validSamples.map((sample) => sample.dtMs);
  const sortedIntervals = [...intervals].sort((a, b) => a - b);
  const frameCount = intervals.length;
  const elapsedValues = validSamples
    .map((sample) => sample.elapsedMs)
    .filter((elapsedMs) => Number.isFinite(elapsedMs));

  return {
    frameCount,
    meanMs: intervals.reduce((total, interval) => total + interval, 0) / frameCount,
    p50Ms: computePercentile(sortedIntervals, 0.5),
    p95Ms: computePercentile(sortedIntervals, 0.95),
    p99Ms: computePercentile(sortedIntervals, 0.99),
    maxMs: sortedIntervals[sortedIntervals.length - 1],
    elapsedStartMs: elapsedValues.length > 0 ? Math.min(...elapsedValues) : 0,
    elapsedEndMs: elapsedValues.length > 0 ? Math.max(...elapsedValues) : 0,
    longFrameShare: {
      over33_3: intervals.filter((interval) => interval > 33.3).length / frameCount,
      over50: intervals.filter((interval) => interval > 50).length / frameCount,
      over66_7: intervals.filter((interval) => interval > 66.7).length / frameCount,
      over100: intervals.filter((interval) => interval > 100).length / frameCount,
    },
  };
}

/**
 * p95 is intentionally not a stability-gate signal: long-tail behavior is itself
 * a measurement target, so making it a gate would reject the behavior under study.
 */
export function evaluateStabilityGate(
  windows: readonly BenchmarkWindowMetrics[],
  thresholds?: Partial<StabilityThresholds>,
): StabilityGateResult {
  const resolvedThresholds = { ...DEFAULT_STABILITY_THRESHOLDS, ...thresholds };
  const failedChecks: string[] = [];
  const meanSpread = computeSpread(windows.map((window) => window.meanMs), 'meanSpread', failedChecks);
  const p50Spread = computeSpread(windows.map((window) => window.p50Ms), 'p50Spread', failedChecks);
  const over50ShareSpread = computeAbsoluteSpread(
    windows.map((window) => window.longFrameShare.over50),
    'over50ShareSpread',
    failedChecks,
  );

  if (windows.length < resolvedThresholds.minWindows) {
    return {
      verdict: 'INSUFFICIENT_WINDOWS',
      windowCount: windows.length,
      meanSpread,
      p50Spread,
      over50ShareSpread,
      failedChecks,
      thresholds: resolvedThresholds,
    };
  }

  if (meanSpread > resolvedThresholds.meanSpreadMax) {
    failedChecks.push('meanSpread');
  }
  if (p50Spread > resolvedThresholds.p50SpreadMax) {
    failedChecks.push('p50Spread');
  }
  if (over50ShareSpread > resolvedThresholds.over50ShareSpreadMax) {
    failedChecks.push('over50ShareSpread');
  }

  return {
    verdict: failedChecks.length === 0 ? 'STABLE' : 'UNSTABLE',
    windowCount: windows.length,
    meanSpread,
    p50Spread,
    over50ShareSpread,
    failedChecks,
    thresholds: resolvedThresholds,
  };
}

function computeMetricEffect(a1: number, candidate: number, a2: number, minEffect: number): AbaMetricEffect {
  const reference = finiteOrZero((finiteOrZero(a1) + finiteOrZero(a2)) / 2);
  const safeCandidate = finiteOrZero(candidate);
  const absoluteDelta = finiteOrZero(safeCandidate - reference);
  if (reference === 0) {
    return {
      baselineReference: reference,
      candidate: safeCandidate,
      absoluteDelta,
      percentDelta: 0,
      baselineDrift: 0,
      exceedsNoise: false,
    };
  }

  const percentDelta = finiteOrZero(absoluteDelta / reference);
  const baselineDrift = finiteOrZero(Math.abs(finiteOrZero(a1) - finiteOrZero(a2)) / reference);
  return {
    baselineReference: reference,
    candidate: safeCandidate,
    absoluteDelta,
    percentDelta,
    baselineDrift,
    exceedsNoise: Math.abs(percentDelta) > baselineDrift && Math.abs(percentDelta) > minEffect,
  };
}

const SCENE_IDENTITY_FIELDS: (keyof BenchmarkSceneIdentity)[] = [
  'drawCalls',
  'triangles',
  'visibleLabels',
  'drawingBufferWidth',
  'drawingBufferHeight',
  'segmentStartMs',
  'segmentEndMs',
];

function computeSetMetricEffect(
  a1Values: readonly number[],
  candidateValues: readonly number[],
  a2Values: readonly number[],
  minEffect: number,
): AbaSetMetricEffect {
  const baselineValues = [...a1Values, ...a2Values].map(finiteOrZero);
  const baselineReference = finiteOrZero(median(baselineValues));
  const candidate = finiteOrZero(median(candidateValues.map(finiteOrZero)));
  const absoluteDelta = finiteOrZero(candidate - baselineReference);
  const baselineMad = finiteOrZero(
    median(baselineValues.map((value) => Math.abs(value - baselineReference))),
  );

  if (baselineReference === 0) {
    return {
      baselineReference,
      candidate,
      absoluteDelta,
      percentDelta: 0,
      baselineMad,
      baselineNoiseFloor: 0,
      exceedsNoise: false,
    };
  }

  const baselineNoiseFloor = finiteOrZero(
    (NOISE_FLOOR_MAD_MULTIPLIER * baselineMad) / baselineReference,
  );
  const percentDelta = finiteOrZero(absoluteDelta / baselineReference);
  return {
    baselineReference,
    candidate,
    absoluteDelta,
    percentDelta,
    baselineMad,
    baselineNoiseFloor,
    exceedsNoise: Math.abs(percentDelta) > Math.max(baselineNoiseFloor, minEffect),
  };
}

function computeSetDrift(
  a1Values: readonly number[],
  a2Values: readonly number[],
  baselineReference: number,
): number {
  if (baselineReference === 0) {
    return 0;
  }
  return finiteOrZero(
    Math.abs(
      finiteOrZero(median(a1Values.map(finiteOrZero)))
      - finiteOrZero(median(a2Values.map(finiteOrZero))),
    ) / baselineReference,
  );
}

function findSetSceneMismatchFields(identities: {
  a1: readonly BenchmarkSceneIdentity[];
  b: readonly BenchmarkSceneIdentity[];
  a2: readonly BenchmarkSceneIdentity[];
}): string[] {
  const allIdentities = [...identities.a1, ...identities.b, ...identities.a2];
  const reference = allIdentities[0];
  if (reference === undefined) {
    return [];
  }
  return SCENE_IDENTITY_FIELDS.filter((field) =>
    allIdentities.some((identity) => identity[field] !== reference[field]),
  );
}

/**
 * Single-window A/B/A evaluation. It cannot separate an effect from between-window
 * variance, so the canonical protocol uses {@link evaluateAbaSets} instead.
 *
 * Verdicts deliberately use only mean effect. p50, p95, and long-frame effects
 * remain reported for diagnosis; p95 is a long-tail measurement target and is too
 * variable to make the primary A/B/A verdict depend on it.
 */
export function evaluateAba(input: {
  a1: BenchmarkWindowMetrics;
  b: BenchmarkWindowMetrics;
  a2: BenchmarkWindowMetrics;
  identities?: { a1: BenchmarkSceneIdentity; b: BenchmarkSceneIdentity; a2: BenchmarkSceneIdentity };
  thresholds?: Partial<AbaDriftThresholds>;
  minEffect?: number;
}): AbaResult {
  const thresholds = { ...DEFAULT_ABA_DRIFT_THRESHOLDS, ...input.thresholds };
  const minEffect = input.minEffect ?? 0.05;
  const effects = {
    mean: computeMetricEffect(input.a1.meanMs, input.b.meanMs, input.a2.meanMs, minEffect),
    p50: computeMetricEffect(input.a1.p50Ms, input.b.p50Ms, input.a2.p50Ms, minEffect),
    p95: computeMetricEffect(input.a1.p95Ms, input.b.p95Ms, input.a2.p95Ms, minEffect),
    over50Share: computeMetricEffect(
      input.a1.longFrameShare.over50,
      input.b.longFrameShare.over50,
      input.a2.longFrameShare.over50,
      minEffect,
    ),
  };
  const identities = input.identities;
  const sceneMismatchFields = identities
    ? SCENE_IDENTITY_FIELDS.filter((field) => {
      return identities.a1[field] !== identities.b[field] || identities.a1[field] !== identities.a2[field];
    })
    : [];
  const failedChecks: string[] = [];
  let verdict: AbaVerdict;

  if (sceneMismatchFields.length > 0) {
    failedChecks.push('sceneMismatch');
    verdict = 'INVALID_SCENE_MISMATCH';
  } else if (effects.mean.baselineDrift > thresholds.meanDriftMax || effects.p50.baselineDrift > thresholds.p50DriftMax) {
    if (effects.mean.baselineDrift > thresholds.meanDriftMax) {
      failedChecks.push('meanDrift');
    }
    if (effects.p50.baselineDrift > thresholds.p50DriftMax) {
      failedChecks.push('p50Drift');
    }
    verdict = 'INVALID_DRIFT';
  } else if (effects.mean.exceedsNoise && effects.mean.percentDelta < 0) {
    verdict = 'VALID_IMPROVEMENT';
  } else if (effects.mean.exceedsNoise && effects.mean.percentDelta > 0) {
    verdict = 'VALID_REGRESSION';
  } else {
    verdict = 'NOISE_INCONCLUSIVE';
  }

  return {
    verdict,
    meanDrift: effects.mean.baselineDrift,
    p50Drift: effects.p50.baselineDrift,
    sceneMismatchFields,
    effects,
    failedChecks,
    thresholds,
    minEffect,
  };
}

/**
 * Multi-window A/B/A evaluation. Each arm is represented by its median; the
 * pooled A1/A2 MAD is the baseline noise floor.
 *
 * A window-count failure uses `INVALID_DRIFT` plus `insufficientWindows` rather
 * than adding a new AbaVerdict member, preserving the existing verdict union.
 */
export function evaluateAbaSets(input: {
  a1: readonly BenchmarkWindowMetrics[];
  b: readonly BenchmarkWindowMetrics[];
  a2: readonly BenchmarkWindowMetrics[];
  identities?: {
    a1: readonly BenchmarkSceneIdentity[];
    b: readonly BenchmarkSceneIdentity[];
    a2: readonly BenchmarkSceneIdentity[];
  };
  thresholds?: Partial<AbaDriftThresholds>;
  minEffect?: number;
  minWindowsPerArm?: number;
}): AbaSetResult {
  const thresholds = { ...DEFAULT_ABA_DRIFT_THRESHOLDS, ...input.thresholds };
  const minEffect = input.minEffect ?? 0.05;
  const minWindowsPerArm = input.minWindowsPerArm ?? 3;
  const effects = {
    mean: computeSetMetricEffect(
      input.a1.map((window) => window.meanMs),
      input.b.map((window) => window.meanMs),
      input.a2.map((window) => window.meanMs),
      minEffect,
    ),
    p50: computeSetMetricEffect(
      input.a1.map((window) => window.p50Ms),
      input.b.map((window) => window.p50Ms),
      input.a2.map((window) => window.p50Ms),
      minEffect,
    ),
    p95: computeSetMetricEffect(
      input.a1.map((window) => window.p95Ms),
      input.b.map((window) => window.p95Ms),
      input.a2.map((window) => window.p95Ms),
      minEffect,
    ),
    over50Share: computeSetMetricEffect(
      input.a1.map((window) => window.longFrameShare.over50),
      input.b.map((window) => window.longFrameShare.over50),
      input.a2.map((window) => window.longFrameShare.over50),
      minEffect,
    ),
  };
  const meanDrift = computeSetDrift(
    input.a1.map((window) => window.meanMs),
    input.a2.map((window) => window.meanMs),
    effects.mean.baselineReference,
  );
  const p50Drift = computeSetDrift(
    input.a1.map((window) => window.p50Ms),
    input.a2.map((window) => window.p50Ms),
    effects.p50.baselineReference,
  );
  const sceneMismatchFields = input.identities
    ? findSetSceneMismatchFields(input.identities)
    : [];
  const failedChecks: string[] = [];
  let verdict: AbaVerdict;

  if (
    input.a1.length < minWindowsPerArm
    || input.b.length < minWindowsPerArm
    || input.a2.length < minWindowsPerArm
  ) {
    failedChecks.push('insufficientWindows');
    verdict = 'INVALID_DRIFT';
  } else if (sceneMismatchFields.length > 0) {
    failedChecks.push('sceneMismatch');
    verdict = 'INVALID_SCENE_MISMATCH';
  } else if (meanDrift > thresholds.meanDriftMax || p50Drift > thresholds.p50DriftMax) {
    if (meanDrift > thresholds.meanDriftMax) {
      failedChecks.push('meanDrift');
    }
    if (p50Drift > thresholds.p50DriftMax) {
      failedChecks.push('p50Drift');
    }
    verdict = 'INVALID_DRIFT';
  } else if (effects.mean.exceedsNoise && effects.mean.percentDelta < 0) {
    verdict = 'VALID_IMPROVEMENT';
  } else if (effects.mean.exceedsNoise && effects.mean.percentDelta > 0) {
    verdict = 'VALID_REGRESSION';
  } else {
    verdict = 'NOISE_INCONCLUSIVE';
  }

  return {
    verdict,
    a1WindowCount: input.a1.length,
    bWindowCount: input.b.length,
    a2WindowCount: input.a2.length,
    meanDrift,
    p50Drift,
    sceneMismatchFields,
    effects,
    failedChecks,
    thresholds,
    minEffect,
    minWindowsPerArm,
  };
}

export function classifyBenchmarkSession(
  readinessSets: readonly StabilityGateResult[],
  maxReadinessSets = 2,
): { status: BenchmarkSessionStatus; acceptedSetIndex: number | null; attemptedSets: number } {
  const attemptedSets = Math.min(readinessSets.length, Math.max(0, Math.floor(maxReadinessSets)));
  const acceptedSetIndex = readinessSets.slice(0, attemptedSets).findIndex((set) => set.verdict === 'STABLE');
  if (acceptedSetIndex !== -1) {
    return { status: 'STABLE_SESSION', acceptedSetIndex, attemptedSets };
  }
  return { status: 'INVALID_UNSTABLE', acceptedSetIndex: null, attemptedSets };
}
