import { hashIndexTo01 } from '../../forest/forestRandom';
import {
  CROWN_RADIUS_MAX_METERS,
  CROWN_RADIUS_MEDIAN_METERS,
  CROWN_RADIUS_MIN_METERS,
  CROWN_RELIEF_AMPLITUDE_METERS,
  MASK_THRESHOLD,
  smoothstep01,
} from '../labConstants';

export interface Crown {
  n: number;
  cx: number;
  cz: number;
  r: number;
  h: number;
}

export interface EnumerateCrownsOptions {
  xMin: number;
  zMin: number;
  latticeCols: number;
  spacing: number;
  seed: number;
  sampleCoverage: (x: number, z: number) => number;
}

export function smax(a: number, b: number, k: number): number {
  const t = Math.min(1, Math.max(0, 0.5 + 0.5 * (a - b) / k));
  return a * t + b * (1 - t) + k * t * (1 - t);
}

export function crownRadiusInvCdf(u: number): number {
  const clamped = Math.min(1, Math.max(0, u));
  if (clamped <= 0.5) {
    return CROWN_RADIUS_MIN_METERS
      + (CROWN_RADIUS_MEDIAN_METERS - CROWN_RADIUS_MIN_METERS) * (clamped / 0.5);
  }
  return CROWN_RADIUS_MEDIAN_METERS
    + (CROWN_RADIUS_MAX_METERS - CROWN_RADIUS_MEDIAN_METERS)
      * ((clamped - 0.5) / 0.5);
}

export function crownProfile(t: number): number {
  if (t >= 1) return 0;
  return 1 - smoothstep01(t);
}

export function enumerateCrowns({
  xMin,
  zMin,
  latticeCols,
  spacing,
  seed,
  sampleCoverage,
}: EnumerateCrownsOptions): Crown[] {
  if (!Number.isInteger(latticeCols) || latticeCols < 0 || !(spacing > 0)) {
    throw new RangeError('Crown lattice dimensions and spacing must be valid.');
  }

  const crowns: Crown[] = [];
  for (let j = 0; j < latticeCols; j += 1) {
    for (let i = 0; i < latticeCols; i += 1) {
      const n = j * latticeCols + i;
      const cx = xMin + (
        i + 0.5 + (hashIndexTo01(3 * n + 0, seed) - 0.5)
      ) * spacing;
      const cz = zMin + (
        j + 0.5 + (hashIndexTo01(3 * n + 1, seed) - 0.5)
      ) * spacing;
      if (sampleCoverage(cx, cz) < MASK_THRESHOLD) continue;

      const r = crownRadiusInvCdf(hashIndexTo01(3 * n + 2, seed));
      crowns.push({
        n,
        cx,
        cz,
        r,
        h: CROWN_RELIEF_AMPLITUDE_METERS * r / CROWN_RADIUS_MEDIAN_METERS,
      });
    }
  }
  return crowns;
}
