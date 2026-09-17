// @ts-expect-error This project intentionally has no Node type dependency.
import { createHash } from 'node:crypto';
// @ts-expect-error This project intentionally has no Node type dependency.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const FAR_CANOPY_URL = new URL('./far-canopy-2048.png', import.meta.url);
const META_URL = new URL('./far-canopy-meta.json', import.meta.url);
const MASK_URL = new URL('../../../public/data/forest/takao-forest-mask.png', import.meta.url);
const VERIFICATION_URL = new URL(
  '../../../outputs/matsu-h01-forest-lab-reference-locked-cluster-hlod-prototype/far-canopy-verification.json',
  import.meta.url,
);

function sha256(url: URL): string {
  return createHash('sha256').update(readFileSync(url)).digest('hex');
}

describe('independent FAR canopy mask alignment verification', () => {
  const verification = JSON.parse(readFileSync(VERIFICATION_URL, 'utf8'));
  const meta = JSON.parse(readFileSync(META_URL, 'utf8'));

  it('checks every texel and covers both forest classifications', () => {
    expect(verification.checkedTexelCount).toBe(2048 * 2048);
    expect(verification.nonForestAlphaMax).toBe(0);
    expect(verification.nonForestTexelCount).toBeGreaterThan(0);
    expect(verification.forestTexelCount).toBeGreaterThan(0);
    expect(verification.nonForestTexelCount + verification.forestTexelCount).toBe(2048 * 2048);
  });

  it('binds the verification to the exact generated and source PNGs', () => {
    expect(verification.farCanopySha256).toBe(sha256(FAR_CANOPY_URL));
    expect(verification.maskSha256).toBe(sha256(MASK_URL));
  });

  it('matches the generated metadata world alignment exactly', () => {
    expect(verification.worldAlignment.xMin).toBe(meta.world.xMin);
    expect(verification.worldAlignment.zMin).toBe(meta.world.zMin);
    expect(verification.worldAlignment.texelMeters).toBe(meta.world.texelMeters);
    expect(verification.worldAlignment.pngRowZeroIsZMin).toBe(meta.world.pngRowZeroIsZMin);
  });

  it('independently reaches the generated metadata forest texel count', () => {
    expect(verification.forestTexelCount).toBe(meta.stats.forestTexelCount);
  });
});
