import type { RoutePath } from '../types';
import { computeRouteProgressForPoiId } from './routeProgress';

export type SpotArrivalTier = 'primary' | 'secondary';
export type SpotArrivalPhase = 'idle' | 'approach' | 'arrive' | 'dwell' | 'depart';

export interface SpotArrivalTierTimingMs {
  approachMs: number;
  dwellMs: number;
  departMs: number;
}

export interface SummitArrivalPhaseInput {
  phaseKind: 'transition-to-summit' | 'summit-hold' | 'other';
  phaseElapsedMs: number;
  transitionToSummitMs: number;
  summitHoldMs: number;
}

export interface SpotArrivalSpec {
  poiId: string;
  progressAt: number;
  tier: SpotArrivalTier;
}

export interface SpotArrivalState {
  poiId: string;
  tier: SpotArrivalTier;
  phase: SpotArrivalPhase;
  intensity: number;
  isActive: boolean;
  isPrimaryActive: boolean;
}

const ARRIVE_DURATION_MS = 100;
const SUMMIT_ARRIVAL_SPOT: SpotArrivalSpec = {
  poiId: 'summit',
  progressAt: 1,
  tier: 'primary',
};

function createIdleState(
  spot: SpotArrivalSpec,
): Omit<SpotArrivalState, 'isPrimaryActive'> {
  return {
    poiId: spot.poiId,
    tier: spot.tier,
    phase: 'idle',
    intensity: 0,
    isActive: false,
  };
}

export function computeSpotArrivalState(
  progress: number,
  spot: SpotArrivalSpec,
  timing: SpotArrivalTierTimingMs,
  baseTravelDurationMs: number,
): Omit<SpotArrivalState, 'isPrimaryActive'> {
  if (
    !Number.isFinite(progress)
    || !Number.isFinite(spot.progressAt)
    || !Number.isFinite(baseTravelDurationMs)
    || baseTravelDurationMs <= 0
  ) {
    return createIdleState(spot);
  }

  const approachWidth = Math.max(0, timing.approachMs) / baseTravelDurationMs;
  const dwellHalfWidth = Math.max(0, timing.dwellMs) / baseTravelDurationMs / 2;
  const departWidth = Math.max(0, timing.departMs) / baseTravelDurationMs;
  const arriveHalfWidth = Math.min(
    dwellHalfWidth,
    ARRIVE_DURATION_MS / baseTravelDurationMs / 2,
  );
  const delta = progress - spot.progressAt;

  if (Math.abs(delta) <= arriveHalfWidth) {
    return {
      poiId: spot.poiId,
      tier: spot.tier,
      phase: 'arrive',
      intensity: 1,
      isActive: true,
    };
  }

  if (Math.abs(delta) <= dwellHalfWidth) {
    return {
      poiId: spot.poiId,
      tier: spot.tier,
      phase: 'dwell',
      intensity: 1,
      isActive: true,
    };
  }

  if (
    approachWidth > 0
    && delta > -dwellHalfWidth - approachWidth
    && delta < -dwellHalfWidth
  ) {
    return {
      poiId: spot.poiId,
      tier: spot.tier,
      phase: 'approach',
      intensity: (delta + dwellHalfWidth + approachWidth) / approachWidth,
      isActive: true,
    };
  }

  if (
    departWidth > 0
    && delta > dwellHalfWidth
    && delta < dwellHalfWidth + departWidth
  ) {
    return {
      poiId: spot.poiId,
      tier: spot.tier,
      phase: 'depart',
      intensity: 1 - (delta - dwellHalfWidth) / departWidth,
      isActive: true,
    };
  }

  return createIdleState(spot);
}

export function computeSummitArrivalState(
  input: SummitArrivalPhaseInput,
  timing: SpotArrivalTierTimingMs,
): Omit<SpotArrivalState, 'isPrimaryActive'> {
  const idleState = createIdleState(SUMMIT_ARRIVAL_SPOT);
  const elapsedMs = input.phaseElapsedMs;
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return idleState;

  const toDurationMs = (value: number): number => (
    Number.isFinite(value) ? Math.max(0, value) : 0
  );

  if (input.phaseKind === 'transition-to-summit') {
    const transitionMs = toDurationMs(input.transitionToSummitMs);
    const approachMs = Math.min(toDurationMs(timing.approachMs), transitionMs);
    const approachStartMs = transitionMs - approachMs;

    if (
      approachMs <= 0
      || elapsedMs <= approachStartMs
      || elapsedMs > transitionMs
    ) {
      return idleState;
    }

    return {
      poiId: SUMMIT_ARRIVAL_SPOT.poiId,
      tier: SUMMIT_ARRIVAL_SPOT.tier,
      phase: 'approach',
      intensity: Math.min(1, Math.max(0, (
        elapsedMs - approachStartMs
      ) / approachMs)),
      isActive: true,
    };
  }

  if (input.phaseKind !== 'summit-hold') return idleState;

  const summitHoldMs = toDurationMs(input.summitHoldMs);
  if (summitHoldMs <= 0 || elapsedMs >= summitHoldMs) return idleState;

  const arriveMs = Math.min(ARRIVE_DURATION_MS, summitHoldMs);
  const departMs = Math.min(
    toDurationMs(timing.departMs),
    Math.max(0, summitHoldMs - arriveMs),
  );
  const maxDwellMs = Math.max(0, summitHoldMs - departMs);
  const requestedDwellMs = Math.min(toDurationMs(timing.dwellMs), maxDwellMs);
  // Keep depart anchored to the end of the hold. Any time left after the
  // requested (and possibly clamped) dwell extends the full-intensity dwell,
  // rather than creating an idle gap before depart.
  const dwellSlackMs = maxDwellMs - requestedDwellMs;
  const departStartMs = requestedDwellMs + dwellSlackMs;

  if (elapsedMs < Math.min(arriveMs, departStartMs)) {
    return {
      poiId: SUMMIT_ARRIVAL_SPOT.poiId,
      tier: SUMMIT_ARRIVAL_SPOT.tier,
      phase: 'arrive',
      intensity: 1,
      isActive: true,
    };
  }

  if (elapsedMs < departStartMs || departMs <= 0) {
    return {
      poiId: SUMMIT_ARRIVAL_SPOT.poiId,
      tier: SUMMIT_ARRIVAL_SPOT.tier,
      phase: 'dwell',
      intensity: 1,
      isActive: true,
    };
  }

  return {
    poiId: SUMMIT_ARRIVAL_SPOT.poiId,
    tier: SUMMIT_ARRIVAL_SPOT.tier,
    phase: 'depart',
    intensity: Math.min(1, Math.max(0, (
      summitHoldMs - elapsedMs
    ) / departMs)),
    isActive: true,
  };
}

export function computeAllSpotArrivalStates(
  progress: number,
  spots: SpotArrivalSpec[],
  timingByTier: Record<SpotArrivalTier, SpotArrivalTierTimingMs>,
  baseTravelDurationMs: number,
): SpotArrivalState[] {
  const states = spots.map((spot): SpotArrivalState => ({
    ...computeSpotArrivalState(
      progress,
      spot,
      timingByTier[spot.tier],
      baseTravelDurationMs,
    ),
    isPrimaryActive: false,
  }));

  let primaryActiveIndex = -1;
  for (let index = 0; index < states.length; index += 1) {
    const candidate = states[index];
    if (!candidate.isActive) continue;

    const current = states[primaryActiveIndex];
    if (
      primaryActiveIndex === -1
      || candidate.intensity > current.intensity
      || (
        candidate.intensity === current.intensity
        && candidate.tier === 'primary'
        && current.tier !== 'primary'
      )
    ) {
      primaryActiveIndex = index;
    }
  }

  if (primaryActiveIndex !== -1) {
    states[primaryActiveIndex].isPrimaryActive = true;
  }

  return states;
}

export function createIdleSpotArrivalStates(
  spots: SpotArrivalSpec[],
): SpotArrivalState[] {
  return spots.map((spot) => ({
    ...createIdleState(spot),
    isPrimaryActive: false,
  }));
}

export function resolveSpotArrivalSpecs(
  route: RoutePath,
  tierByPoiId: Record<string, SpotArrivalTier>,
): SpotArrivalSpec[] {
  return Object.entries(tierByPoiId).flatMap(([poiId, tier]) => {
    const progressAt = computeRouteProgressForPoiId(route, poiId);
    return progressAt === undefined ? [] : [{ poiId, progressAt, tier }];
  });
}
