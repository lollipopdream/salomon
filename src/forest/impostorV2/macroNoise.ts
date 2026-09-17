import { hashIndexTo01 } from '../forestRandom';

function latticeUnit(ix: number, iz: number, seed: number): number {
  const mixed = (Math.imul(ix | 0, 73856093) ^ Math.imul(iz | 0, 19349663)) >>> 0;
  return hashIndexTo01(mixed, seed);
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

export function macroValueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smoothstep(x - ix);
  const fz = smoothstep(z - iz);
  const n00 = latticeUnit(ix, iz, seed);
  const n10 = latticeUnit(ix + 1, iz, seed);
  const n01 = latticeUnit(ix, iz + 1, seed);
  const n11 = latticeUnit(ix + 1, iz + 1, seed);
  return (n00 * (1 - fx) + n10 * fx) * (1 - fz) + (n01 * (1 - fx) + n11 * fx) * fz;
}

export function macroPatchField(
  cellX: number,
  cellZ: number,
  seed: number,
  scaleCells: number,
): number {
  const a = macroValueNoise(cellX / scaleCells, cellZ / scaleCells, seed);
  const b = macroValueNoise(
    cellX / (scaleCells * 0.5) + 11.3,
    cellZ / (scaleCells * 0.5) - 7.1,
    (seed ^ 0x68bc21eb) >>> 0,
  );
  return Math.min(1, Math.max(0, 0.65 * a + 0.35 * b));
}
