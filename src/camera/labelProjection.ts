export function computeLabelProjectionVisibility(
  clipSpace: { x: number; y: number; z: number; w: number },
): { visible: boolean; ndcX: number; ndcY: number } {
  if (clipSpace.w <= 0) {
    return { visible: false, ndcX: 0, ndcY: 0 };
  }

  const ndcX = clipSpace.x / clipSpace.w;
  const ndcY = clipSpace.y / clipSpace.w;
  const visible = ndcX >= -1 && ndcX <= 1 && ndcY >= -1 && ndcY <= 1;

  return { visible, ndcX, ndcY };
}
