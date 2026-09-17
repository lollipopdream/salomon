/** mulberry32。同一 seed から必ず同一列を返す。 */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    let value = (state += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** index と seed から [0,1) を返す純関数(順序非依存の間引き用)。 */
export function hashIndexTo01(index: number, seed: number): number {
  let value = (index >>> 0) ^ Math.imul(seed >>> 0, 0x9e3779b1);
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);

  return ((value ^ (value >>> 15)) >>> 0) / 4294967296;
}
