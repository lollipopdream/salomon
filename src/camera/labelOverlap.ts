export interface LabelOverlapCandidate {
  poiId: string;
  ndcX: number;
  ndcY: number;
  /** そのPOIが現在arrival choreography上でactiveか。 */
  isActive: boolean;
  /** タイブレーク用の優先度。値が小さいほど優先(常にopacity=1を維持)。 */
  priority: number;
}

export interface LabelOverlapResult {
  poiId: string;
  opacityMultiplier: number;
}

export const DEFAULT_LIGHT_OVERLAP_NDC_DISTANCE = 0.08;
export const DEFAULT_SEVERE_OVERLAP_NDC_DISTANCE = 0.03;
export const DEFAULT_OVERLAP_LIGHT_DIM_OPACITY = 0.6;

export function computeLabelOverlapFade(
  candidates: LabelOverlapCandidate[],
  lightDistance: number = DEFAULT_LIGHT_OVERLAP_NDC_DISTANCE,
  severeDistance: number = DEFAULT_SEVERE_OVERLAP_NDC_DISTANCE,
): LabelOverlapResult[] {
  const opacityMultipliers = candidates.map(() => 1);

  for (let firstIndex = 0; firstIndex < candidates.length; firstIndex += 1) {
    const first = candidates[firstIndex];
    if (first.isActive) {
      continue;
    }

    for (
      let secondIndex = firstIndex + 1;
      secondIndex < candidates.length;
      secondIndex += 1
    ) {
      const second = candidates[secondIndex];
      if (second.isActive) {
        continue;
      }

      const deltaX = first.ndcX - second.ndcX;
      const deltaY = first.ndcY - second.ndcY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      let overlapOpacity: number;
      if (distance < severeDistance) {
        overlapOpacity = 0;
      } else if (distance < lightDistance) {
        overlapOpacity = DEFAULT_OVERLAP_LIGHT_DIM_OPACITY;
      } else {
        continue;
      }

      const lowerPriorityIndex =
        first.priority > second.priority ||
        (first.priority === second.priority && first.poiId > second.poiId)
          ? firstIndex
          : secondIndex;

      opacityMultipliers[lowerPriorityIndex] = Math.min(
        opacityMultipliers[lowerPriorityIndex],
        overlapOpacity,
      );
    }
  }

  return candidates.map((candidate, index) => ({
    poiId: candidate.poiId,
    opacityMultiplier: opacityMultipliers[index],
  }));
}
