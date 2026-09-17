import { afterEach, describe, expect, it, vi } from 'vitest';

import { assetUrl } from './assetBase';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('assetUrl', () => {
  it('returns root-absolute paths unchanged when the base is root', () => {
    vi.stubEnv('BASE_URL', '/');

    expect(assetUrl('/data/forest/impostor-v2/tree_atlas_2048.png'))
      .toBe('/data/forest/impostor-v2/tree_atlas_2048.png');
    expect(assetUrl('/data/dem/14/14528/6453.png')).toBe('/data/dem/14/14528/6453.png');
    expect(assetUrl('/data/lite-background/takao-lite-bg-daylight.png'))
      .toBe('/data/lite-background/takao-lite-bg-daylight.png');
  });

  it('prefixes paths with a sub-directory base without a double slash', () => {
    vi.stubEnv('BASE_URL', '/r10-preview/');

    expect(assetUrl('/data/forest/impostor-v2/tree_atlas_2048.png'))
      .toBe('/r10-preview/data/forest/impostor-v2/tree_atlas_2048.png');
  });

  it('joins a base without a trailing slash using one slash', () => {
    vi.stubEnv('BASE_URL', '/r10-preview');

    expect(assetUrl('/data/dem/14/14528/6453.png'))
      .toBe('/r10-preview/data/dem/14/14528/6453.png');
  });

  it('uses the root base when BASE_URL is missing', () => {
    vi.stubEnv('BASE_URL', undefined);

    expect(assetUrl('/data/terrain-texture/takao-aerial.webp'))
      .toBe('/data/terrain-texture/takao-aerial.webp');
  });
});
