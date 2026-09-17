import { describe, expect, it } from 'vitest';

import { extractAlphaChannel, extractSpriteRects } from './foliageSprites';

const options = { alphaThreshold: 40, minAreaPixels: 2, maxSprites: 8, paddingPixels: 0 };

function alphaGrid(width: number, height: number, points: readonly [number, number][]): Uint8Array {
  const alpha = new Uint8Array(width * height);
  for (const [x, y] of points) alpha[y * width + x] = 255;
  return alpha;
}

describe('foliageSprites', () => {
  it('extracts separated blobs in descending component area', () => {
    const alpha = alphaGrid(6, 5, [
      [0, 0], [1, 0],
      [3, 2], [4, 2], [3, 3], [4, 3],
    ]);
    expect(extractSpriteRects(alpha, 6, 5, options)).toEqual([
      { x: 3, y: 2, width: 2, height: 2 },
      { x: 0, y: 0, width: 2, height: 1 },
    ]);
  });

  it('discards blobs below minimum area and truncates to maxSprites', () => {
    const alpha = alphaGrid(7, 3, [
      [0, 0],
      [2, 0], [2, 1],
      [4, 0], [4, 1], [4, 2],
      [6, 0], [6, 1],
    ]);
    expect(extractSpriteRects(alpha, 7, 3, { ...options, maxSprites: 2 })).toEqual([
      { x: 4, y: 0, width: 1, height: 3 },
      { x: 2, y: 0, width: 1, height: 2 },
    ]);
  });

  it('clamps padding at image edges', () => {
    const alpha = alphaGrid(4, 4, [[0, 0], [1, 0]]);
    expect(extractSpriteRects(alpha, 4, 4, { ...options, paddingPixels: 2 })).toEqual([
      { x: 0, y: 0, width: 4, height: 3 },
    ]);
  });

  it('returns no rectangles for a transparent buffer', () => {
    expect(extractSpriteRects(new Uint8Array(16), 4, 4, options)).toEqual([]);
  });

  it('pulls a selected RGBA channel', () => {
    expect([...extractAlphaChannel(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]), 2)])
      .toEqual([3, 7]);
  });
});
