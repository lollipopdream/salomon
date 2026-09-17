import { hashIndexTo01 } from '../../forest/forestRandom';
import {
  DETAIL_GROVE_FRACTION,
  DETAIL_SCORE_WEIGHTS,
  DETAIL_SPACING_METERS,
  DETAIL_TOP_DECILE,
  EDGE_TAPER_WIDTH_METERS,
} from '../labConstants';
import type { Crown } from '../shell/crownField';

export interface ScoredDetailSite {
  n: number;
  cx: number;
  cz: number;
  score: number;
  ridgeTerm: number;
  nearTerm: number;
  silhouetteTerm: number;
}

export interface DetailPlacement extends ScoredDetailSite {
  kind: 'grove' | 'tree';
  variantIndex: number;
  yawIndex: number;
}

export interface ScoreDetailSitesOptions {
  laplacianAt: (x: number, z: number) => number;
  Lt: number;
  LmaxPatch: number;
  primaryPosXZ: { x: number; z: number };
  distanceMetersAt: (x: number, z: number) => number;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export function computeDetailMaxCount(forestAreaSquareMeters: number): number {
  return Math.round(
    DETAIL_TOP_DECILE * forestAreaSquareMeters / DETAIL_SPACING_METERS ** 2,
  );
}

export function scoreDetailSites(
  crowns: readonly Pick<Crown, 'n' | 'cx' | 'cz'>[],
  options: ScoreDetailSitesOptions,
): ScoredDetailSite[] {
  const distances = new Float64Array(crowns.length);
  let dMin = Number.POSITIVE_INFINITY;
  let dMax = Number.NEGATIVE_INFINITY;
  crowns.forEach(({ cx, cz }, index) => {
    const distance = Math.hypot(
      cx - options.primaryPosXZ.x,
      cz - options.primaryPosXZ.z,
    );
    distances[index] = distance;
    dMin = Math.min(dMin, distance);
    dMax = Math.max(dMax, distance);
  });

  return crowns.map(({ n, cx, cz }, index) => {
    const laplacian = options.laplacianAt(cx, cz);
    const ridgeTerm = laplacian < options.Lt || options.LmaxPatch === options.Lt
      ? 0
      : clamp01((laplacian - options.Lt) / (options.LmaxPatch - options.Lt));
    const nearTerm = dMax === dMin
      ? 1
      : 1 - clamp01((distances[index] - dMin) / (dMax - dMin));
    const distanceFromEdge = options.distanceMetersAt(cx, cz);
    const silhouetteTerm = distanceFromEdge > EDGE_TAPER_WIDTH_METERS
      ? 0
      : clamp01(
        (EDGE_TAPER_WIDTH_METERS - distanceFromEdge) / EDGE_TAPER_WIDTH_METERS,
      );
    return {
      n,
      cx,
      cz,
      ridgeTerm,
      nearTerm,
      silhouetteTerm,
      score: DETAIL_SCORE_WEIGHTS.ridge * ridgeTerm
        + DETAIL_SCORE_WEIGHTS.near * nearTerm
        + DETAIL_SCORE_WEIGHTS.silhouette * silhouetteTerm,
    };
  });
}

export function selectDetailPlacements(
  scoredSites: readonly ScoredDetailSite[],
  maxCount: number,
): ScoredDetailSite[] {
  if (!Number.isInteger(maxCount) || maxCount < 0) {
    throw new RangeError('Detail maximum count must be a non-negative integer.');
  }
  if (maxCount === 0) return [];
  const ordered = [...scoredSites].sort((a, b) => b.score - a.score || a.n - b.n);
  const selected: ScoredDetailSite[] = [];
  for (const site of ordered) {
    const separated = selected.every((existing) =>
      Math.hypot(site.cx - existing.cx, site.cz - existing.cz) >= DETAIL_SPACING_METERS
    );
    if (!separated) continue;
    selected.push(site);
    if (selected.length === maxCount) break;
  }
  return selected;
}

export function assignDetailAttributes(
  placements: readonly ScoredDetailSite[],
  seed: number,
): DetailPlacement[] {
  return placements.map((placement) => {
    const kind = hashIndexTo01(4 * placement.n, seed) < DETAIL_GROVE_FRACTION
      ? 'grove' as const
      : 'tree' as const;
    const variantCount = kind === 'grove' ? 6 : 3;
    return {
      ...placement,
      kind,
      variantIndex: Math.floor(hashIndexTo01(4 * placement.n + 1, seed) * variantCount),
      yawIndex: Math.floor(hashIndexTo01(4 * placement.n + 2, seed) * 4),
    };
  });
}
