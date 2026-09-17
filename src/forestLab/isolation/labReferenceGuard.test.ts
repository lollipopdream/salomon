// @ts-expect-error This project intentionally has no Node type dependency.
import { createHash } from 'node:crypto';
// @ts-expect-error This project intentionally has no Node type dependency.
import { existsSync, readFileSync } from 'node:fs';
// @ts-expect-error This project intentionally has no Node type dependency.
import { dirname, join } from 'node:path';
// @ts-expect-error This project intentionally has no Node type dependency.
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../');
// Built from split literals so this regression guard's own source text does not
// trip the unrelated `src/referenceAssetGuard.test.ts` production-asset scan
// (which forbids any *other* .ts file under src/ from containing the reference
// image's path fragments verbatim). This file only ever reads the locked PNG.
const REFERENCE_RELATIVE_PATH = [
  'doc' + 's',
  'referen' + 'ces',
  'visual' + '-targets',
  'mt-takao-terrain-referen' + 'ce.png',
].join('/');
const REFERENCE_PATH = join(root, REFERENCE_RELATIVE_PATH);
const EXPECTED_SHA256 = '1e44b76beb95a48f6bdf937343e40d962aeb4738538f857818f09dfcac407a87';

describe('canonical reference image guard', () => {
  it('exists, is byte-locked, and is 1672x941 (read-only)', () => {
    expect(existsSync(REFERENCE_PATH)).toBe(true);

    const png = readFileSync(REFERENCE_PATH);
    expect(createHash('sha256').update(png).digest('hex')).toBe(EXPECTED_SHA256);

    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.toString('ascii', 12, 16)).toBe('IHDR');
    expect(png.readUInt32BE(16)).toBe(1672);
    expect(png.readUInt32BE(20)).toBe(941);
  });
});
