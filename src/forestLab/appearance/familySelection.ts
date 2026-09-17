import {
  BROADLEAF_SCALE_RANGE_BY_FAMILY,
  CONIFER_SCALE_RANGE_BY_FAMILY,
  GROVE_WEIGHTS_BY_FAMILY,
  TREE_WEIGHTS_BY_FAMILY,
} from './appearanceConstants';

type FamilyIndex = 0 | 1 | 2;

function familyIndex(family: number): FamilyIndex {
  return family === 0 || family === 2 ? family : 1;
}

export function pickWeighted(weights: readonly number[], u: number): number {
  if (weights.length === 0) throw new RangeError('weights must not be empty.');
  const clamped = Math.min(1 - Number.EPSILON, Math.max(0, u));
  let cumulative = 0;
  for (let index = 0; index < weights.length - 1; index += 1) {
    cumulative += weights[index];
    if (clamped < cumulative) return index;
  }
  return weights.length - 1;
}

export function groveConfigFor(family: number, u: number): number {
  return pickWeighted(GROVE_WEIGHTS_BY_FAMILY[familyIndex(family)], u);
}

export function treeVariantFor(family: number, u: number): number {
  return pickWeighted(TREE_WEIGHTS_BY_FAMILY[familyIndex(family)], u);
}

export function scaleFor(family: number, isBroadleafTree: boolean, u: number): number {
  const index = familyIndex(family);
  const range = isBroadleafTree
    ? BROADLEAF_SCALE_RANGE_BY_FAMILY[index]
    : CONIFER_SCALE_RANGE_BY_FAMILY[index];
  return range[0] + (range[1] - range[0]) * u;
}
