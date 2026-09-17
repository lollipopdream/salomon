// @ts-expect-error This project intentionally has no Node type dependency.
import { createHash } from 'node:crypto';
// @ts-expect-error This project intentionally has no Node type dependency.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { R7_FAR_CANOPY_TEXTURE_URL } from '../cluster/farCanopyLayer';

const CANONICAL_URL = new URL('./far-canopy-2048.png', import.meta.url);
const EXPECTED_CANONICAL_SHA = 'a0c9e2c89ed451b7c10ee30694d406459fba5f56ab8b1a136c025f838f3648d0';

/**
 * R9 の far canopy candidate。i1 は gain を実測するための calibration probe、
 * i2 は最初の fit、i3 が最終候補(appearance R7 が実際に使うもの)。
 * すべて canonical far-canopy-2048.png を読み取り専用の入力として、
 * linear light で青チャネルへ加算オフセットを足しただけのものである。
 */
const CANDIDATES = [
  { id: 'r9-i1-skylight-blue', c: 0.018, role: 'calibration-probe' },
  { id: 'r9-i2-farcanopy-fit', c: 0.0218, role: 'fit' },
  { id: 'r9-i3-farcanopy-fit', c: 0.023, role: 'fit' },
] as const;

function sha256(url: URL): string {
  return createHash('sha256').update(readFileSync(url)).digest('hex');
}

function pngUrl(id: string): URL {
  return new URL(`./far-canopy-${id}-2048.png`, import.meta.url);
}

function metaUrl(id: string): URL {
  return new URL(`./far-canopy-${id}-meta.json`, import.meta.url);
}

describe('generated R9 FAR canopy candidates', () => {
  for (const candidate of CANDIDATES) {
    it(`${candidate.id} is a 2048x2048 RGBA8 PNG matching its own digest`, () => {
      const png = pngUrl(candidate.id);
      const meta = metaUrl(candidate.id);
      expect(existsSync(png)).toBe(true);
      expect(existsSync(meta)).toBe(true);

      const bytes = readFileSync(png);
      const record = JSON.parse(readFileSync(meta, 'utf8'));
      expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      expect(bytes.toString('ascii', 12, 16)).toBe('IHDR');
      expect(bytes.readUInt32BE(16)).toBe(2048);
      expect(bytes.readUInt32BE(20)).toBe(2048);
      expect(bytes[24]).toBe(8);
      expect(bytes[25]).toBe(6);

      expect(sha256(png)).toBe(record.output.sha256);
      expect(record.size).toBe(2048);
      // 親は必ず canonical であり、candidate から candidate を作っていないこと。
      expect(record.parent.sha256).toBe(EXPECTED_CANONICAL_SHA);
      // 承認された機構(青のみ・linear light の加算)から外れていないこと。
      expect(record.correction.channel).toBe('blue');
      expect(record.correction.space).toBe('linear-sRGB');
      expect(record.correction.offsetLinearBlue).toBeCloseTo(candidate.c, 6);
    });
  }

  it('appearance R7 selects the final R9 candidate, not the canonical texture', () => {
    expect(R7_FAR_CANOPY_TEXTURE_URL).toContain('far-canopy-r9-i3-farcanopy-fit-2048.png');
    expect(R7_FAR_CANOPY_TEXTURE_URL).not.toContain('far-canopy-2048.png');
  });

  it('leaves the canonical FAR canopy texture unchanged', () => {
    expect(sha256(CANONICAL_URL)).toBe(EXPECTED_CANONICAL_SHA);
  });
});
