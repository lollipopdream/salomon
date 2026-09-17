import type { ForestCandidateFlags } from './types';

export function resolveForestCandidateFlags(query: URLSearchParams): ForestCandidateFlags {
  return {
    enabled: query.get('forestCandidate') === '1',
    spacingMetersOverride: parseFiniteRange(query.get('forestCandidateSpacing'), 4, 80),
    densityScale: parseFiniteRange(query.get('forestCandidateDensity'), 0, 4) ?? 1,
    maxInstancesOverride: parseIntegerRange(query.get('forestCandidateMax'), 1, 2_000_000),
  };
}

function parseFiniteRange(value: string | null, min: number, max: number): number | undefined {
  if (value === null || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
}

function parseIntegerRange(value: string | null, min: number, max: number): number | undefined {
  const parsed = parseFiniteRange(value, min, max);
  return parsed !== undefined && Number.isInteger(parsed) ? parsed : undefined;
}
