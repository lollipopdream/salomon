import { describe, expect, it } from 'vitest';

import { computeLabelProjectionVisibility } from './labelProjection';

describe('computeLabelProjectionVisibility', () => {
  it('shows a point in front of the camera and inside the NDC bounds', () => {
    expect(
      computeLabelProjectionVisibility({ x: 1, y: -0.5, z: 0, w: 2 }),
    ).toEqual({ visible: true, ndcX: 0.5, ndcY: -0.25 });
  });

  it.each([0, -1])('hides a point at or behind the eye plane (w=%s)', (w) => {
    expect(
      computeLabelProjectionVisibility({ x: 0.5, y: 0.25, z: 0, w }),
    ).toMatchObject({ visible: false });
  });

  it.each([
    { x: 1.01, y: 0 },
    { x: 0, y: -1.01 },
  ])('hides a point outside the NDC bounds ($x, $y)', ({ x, y }) => {
    expect(
      computeLabelProjectionVisibility({ x, y, z: 0, w: 1 }),
    ).toEqual({ visible: false, ndcX: x, ndcY: y });
  });

  it.each([
    { x: -1, y: -1 },
    { x: -1, y: 1 },
    { x: 1, y: -1 },
    { x: 1, y: 1 },
  ])('includes the exact NDC boundary ($x, $y)', ({ x, y }) => {
    expect(
      computeLabelProjectionVisibility({ x: x * 2, y: y * 2, z: 0, w: 2 }),
    ).toEqual({ visible: true, ndcX: x, ndcY: y });
  });
});
