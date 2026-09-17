import { computeRouteProgressForPoiId } from '../route/routeProgress';
import type {
  AnimationConfig,
  AnimationState,
  RouteFollowSpotEventConfig,
  RouteFollowTimelineSegment,
  RoutePath,
} from '../types';

const MAX_FRAME_DELTA_MS = 250;
const TIMELINE_TIME_STEPS_PER_MS = 1_048_576;

export type MotionClockStrategy = 'raw' | 'capped' | 'fixed-step';

export interface MotionClockConfig {
  strategy: MotionClockStrategy;
  cappedMaxDeltaMs?: number;
  fixedStepMs?: number;
  fixedStepMaxStepsPerFrame?: number;
}

export const DEFAULT_MOTION_CLOCK_CAPPED_MAX_DELTA_MS = 50;
export const DEFAULT_MOTION_CLOCK_FIXED_STEP_MS = 1000 / 60;
export const DEFAULT_MOTION_CLOCK_FIXED_STEP_MAX_STEPS_PER_FRAME = 3;

/**
 * 指定したmotion clock戦略に従い、今回のフレームで反映するdeltaを返す。
 */
export function computeEffectiveMotionDeltaMs(
  rawDeltaMs: number,
  config: MotionClockConfig,
): number {
  const sanitizedDeltaMs = Number.isFinite(rawDeltaMs) && rawDeltaMs >= 0
    ? rawDeltaMs
    : 0;

  if (config.strategy === 'raw') {
    return sanitizedDeltaMs;
  }

  if (config.strategy === 'capped') {
    return Math.min(
      sanitizedDeltaMs,
      config.cappedMaxDeltaMs ?? DEFAULT_MOTION_CLOCK_CAPPED_MAX_DELTA_MS,
    );
  }

  return Math.min(
    sanitizedDeltaMs,
    (config.fixedStepMs ?? DEFAULT_MOTION_CLOCK_FIXED_STEP_MS)
      * (config.fixedStepMaxStepsPerFrame
        ?? DEFAULT_MOTION_CLOCK_FIXED_STEP_MAX_STEPS_PER_FRAME),
  );
}

function quantizeTimelineMs(value: number): number {
  const quantized = Math.round(value * TIMELINE_TIME_STEPS_PER_MS)
    / TIMELINE_TIME_STEPS_PER_MS;
  const nearestWholeMs = Math.round(quantized);

  return Math.abs(quantized - nearestWholeMs) <= 1 / TIMELINE_TIME_STEPS_PER_MS
    ? nearestWholeMs
    : quantized;
}

/**
 * 1サイクル(再生 + 待機)の合計時間(ms)を返す。
 */
export function cycleDurationMs(config: AnimationConfig): number {
  return config.playDurationMs + config.holdAtEndMs;
}

/**
 * 初期状態(サイクル開始地点)を返す。
 */
export function createInitialAnimationState(): AnimationState {
  return { elapsedMs: 0 };
}

/**
 * 時間経過をアニメーション状態へ反映する(純粋関数、イミュータブル)。
 *
 * - rawDeltaMsが有限な非負数でない場合(NaN/±Infinity/負値)は0として扱う。
 * - 起動時のGPU処理などによる長時間停止を再生時間へ反映しないよう、加算量を
 *   250msにクランプする。通常のフレーム揺らぎや短いGC停止には十分な余裕を
 *   持たせつつ、数秒単位の停止でサイクルが大きく飛ばない上限としている。
 *   タブ復帰時の時間リセットは呼び出し側のvisibilitychangeで個別に扱う。
 * - クランプ後のdeltaをelapsedMsへ加算し、cycleDurationMs(config)で剰余を取る。
 */
export function advanceAnimationState(
  state: AnimationState,
  rawDeltaMs: number,
  config: AnimationConfig,
): AnimationState {
  const sanitizedDeltaMs = Number.isFinite(rawDeltaMs) && rawDeltaMs >= 0 ? rawDeltaMs : 0;
  const cycleMs = cycleDurationMs(config);
  const clampedDeltaMs = Math.min(sanitizedDeltaMs, MAX_FRAME_DELTA_MS);

  const nextElapsedMs = cycleMs > 0 ? (state.elapsedMs + clampedDeltaMs) % cycleMs : 0;

  return { elapsedMs: nextElapsedMs };
}

/**
 * 現在の状態から進捗(0〜1)を算出する。
 * 山頂到達後(elapsedMs >= playDurationMs)は待機区間として progress=1 を維持する。
 */
export function computeProgress(state: AnimationState, config: AnimationConfig): number {
  if (state.elapsedMs >= config.playDurationMs) {
    return 1;
  }

  return state.elapsedMs / config.playDurationMs;
}

export interface ResolvedRouteFollowSpotEvent {
  progressAt: number;
  kind: 'hold' | 'slow-down';
  decelMs: number;
  midMs: number;
  accelMs: number;
  slowRateFactor?: number;
}

/** スポット演出が通常走行に対して追加する正味の所要時間(ms)を返す。 */
export function computeRouteFollowSpotExtraMs(
  events: RouteFollowSpotEventConfig[],
): number {
  return events.reduce((sum, event) => {
    if (event.kind === 'hold') return sum + event.midMs;

    const slowRateFactor = event.slowRateFactor ?? 1;
    return sum + event.midMs * (1 - slowRateFactor);
  }, 0);
}

/** 浮動小数の丸めを補正し、差分が指定時間と厳密に一致する終端を返す。 */
function addExactDurationMs(startMs: number, durationMs: number): number {
  let endMs = startMs + durationMs;

  for (let attempt = 0; attempt < 2 && endMs - startMs !== durationMs; attempt += 1) {
    endMs += durationMs - (endMs - startMs);
  }

  return endMs;
}

/**
 * route-follow中の通常移動とスポット演出を、連続した時系列セグメントへ展開する。
 */
export function buildRouteFollowTimeline(
  events: ResolvedRouteFollowSpotEvent[],
  baseTravelDurationMs: number,
): RouteFollowTimelineSegment[] {
  const travelRate = 1 / baseTravelDurationMs;
  const sortedEvents = [...events].sort((a, b) => a.progressAt - b.progressAt);
  const segments: RouteFollowTimelineSegment[] = [];
  let cursorMs = 0;
  let cursorProgress = 0;

  const pushSegment = (
    segment: RouteFollowTimelineSegment,
  ): void => {
    segments.push(segment);
    cursorMs = segment.endMs;
    cursorProgress = segment.endProgress;
  };

  for (const event of sortedEvents) {
    const naiveDecelStartProgress =
      event.progressAt - travelRate * event.decelMs;
    const decelStartProgress = Math.max(
      cursorProgress,
      naiveDecelStartProgress,
    );
    const availableDecelProgress = event.progressAt - decelStartProgress;
    const effectiveDecelMs = naiveDecelStartProgress >= cursorProgress
      ? event.decelMs
      : Math.max(0, availableDecelProgress / travelRate);
    const decelStartMs = quantizeTimelineMs(
      cursorMs + (decelStartProgress - cursorProgress) / travelRate,
    );

    if (decelStartMs > cursorMs) {
      pushSegment({
        kind: 'travel',
        startMs: cursorMs,
        endMs: decelStartMs,
        startProgress: cursorProgress,
        endProgress: decelStartProgress,
        startRatePerMs: travelRate,
        endRatePerMs: travelRate,
      });
    }

    const midRate = event.kind === 'hold'
      ? 0
      : travelRate * (event.slowRateFactor ?? 1);

    if (effectiveDecelMs > 0) {
      pushSegment({
        kind: 'ease',
        startMs: cursorMs,
        endMs: addExactDurationMs(cursorMs, effectiveDecelMs),
        startProgress: cursorProgress,
        endProgress: event.progressAt,
        startRatePerMs: travelRate,
        endRatePerMs: midRate,
      });
    }

    if (event.midMs > 0) {
      const midEndProgress = cursorProgress + midRate * event.midMs;
      pushSegment({
        kind: event.kind === 'hold' ? 'flat' : 'travel',
        startMs: cursorMs,
        endMs: addExactDurationMs(cursorMs, event.midMs),
        startProgress: cursorProgress,
        endProgress: midEndProgress,
        startRatePerMs: midRate,
        endRatePerMs: midRate,
      });
    }

    if (event.accelMs > 0) {
      pushSegment({
        kind: 'ease',
        startMs: cursorMs,
        endMs: addExactDurationMs(cursorMs, event.accelMs),
        startProgress: cursorProgress,
        endProgress: cursorProgress + travelRate * event.accelMs,
        startRatePerMs: midRate,
        endRatePerMs: travelRate,
      });
    }
  }

  pushSegment({
    kind: 'travel',
    startMs: cursorMs,
    endMs: quantizeTimelineMs(
      cursorMs + (1 - cursorProgress) / travelRate,
    ),
    startProgress: cursorProgress,
    endProgress: 1,
    startRatePerMs: travelRate,
    endRatePerMs: travelRate,
  });

  return segments;
}

function evaluateHermiteSegment(
  segment: RouteFollowTimelineSegment,
  normalizedTime: number,
): number {
  const s2 = normalizedTime * normalizedTime;
  const s3 = s2 * normalizedTime;
  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = s3 - 2 * s2 + normalizedTime;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = s3 - s2;
  const durationMs = segment.endMs - segment.startMs;

  return h00 * segment.startProgress
    + h10 * segment.startRatePerMs * durationMs
    + h01 * segment.endProgress
    + h11 * segment.endRatePerMs * durationMs;
}

/** route-follow開始後の経過時間から、構築済みタイムラインの進捗を評価する。 */
export function evaluateRouteFollowProgress(
  segments: RouteFollowTimelineSegment[],
  elapsedRouteFollowMs: number,
): number {
  if (segments.length === 0) return 0;

  const timelineEndMs = segments[segments.length - 1].endMs;
  const clampedMs = Math.min(Math.max(elapsedRouteFollowMs, 0), timelineEndMs);
  const segment = segments.find((candidate) => clampedMs <= candidate.endMs)
    ?? segments[segments.length - 1];
  const durationMs = segment.endMs - segment.startMs;

  if (durationMs <= 0) return segment.endProgress;

  const normalizedTime = (clampedMs - segment.startMs) / durationMs;
  if (segment.kind === 'ease') {
    return evaluateHermiteSegment(segment, normalizedTime);
  }

  return segment.startProgress
    + (segment.endProgress - segment.startProgress) * normalizedTime;
}

/** route上のPOIを進捗へ解決し、見つかったイベントだけでタイムラインを構築する。 */
export function buildRouteFollowTimelineForRoute(
  route: RoutePath,
  events: RouteFollowSpotEventConfig[],
  baseTravelDurationMs: number,
): RouteFollowTimelineSegment[] {
  const resolvedEvents = events.flatMap((event): ResolvedRouteFollowSpotEvent[] => {
    const progressAt = computeRouteProgressForPoiId(route, event.poiId);
    if (progressAt === undefined) return [];

    const { poiId: _poiId, ...resolvedEvent } = event;
    return [{ ...resolvedEvent, progressAt }];
  });

  return buildRouteFollowTimeline(resolvedEvents, baseTravelDurationMs);
}

/**
 * route-follow開始を0、ルート完了を1として線形にマッピングした
 * カメラのroute-follow専用進捗を返す。
 */
export function computeRouteFollowProgress(
  elapsedMs: number,
  routeFollowStartMs: number,
  playDurationMs: number,
  timeline?: RouteFollowTimelineSegment[],
): number {
  if (elapsedMs <= routeFollowStartMs) return 0;
  if (elapsedMs >= playDurationMs) return 1;
  if (timeline && timeline.length > 0) {
    return evaluateRouteFollowProgress(timeline, elapsedMs - routeFollowStartMs);
  }
  return (elapsedMs - routeFollowStartMs) / (playDurationMs - routeFollowStartMs);
}

/**
 * 明示的な「リスタート」用のエイリアス。中身はcreateInitialAnimationStateと同じ。
 */
export function restartAnimationState(): AnimationState {
  return createInitialAnimationState();
}
