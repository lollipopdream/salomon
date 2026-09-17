import {
  BROADLEAF_SCALE_MAX,
  BROADLEAF_SCALE_MIN,
  CONIFER_SCALE_MAX,
  CONIFER_SCALE_MIN,
} from '../cluster/clusterConstants';
import { APPEARANCE_IDS, COLOR_ANCHORS_BY_APPEARANCE } from './appearanceConstants';
import { groveConfigFor, scaleFor, treeVariantFor } from './familySelection';
import { sampleMacroField, selectionFamilyAt } from './macroFamilyField';

export type AppearanceId = typeof APPEARANCE_IDS[number];

export interface AppearanceModel {
  readonly id: AppearanceId;
  groveVariant(family: number, u: number): number;
  treeVariant(family: number, u: number): number;
  scale(family: number, isBroadleafTree: boolean, u: number): number;
  colorAt(x: number, z: number): readonly [number, number, number];
  familyAt(x: number, z: number): number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function interpolateColor(
  field: number,
  appearance: Exclude<AppearanceId, 'BASELINE'>,
): readonly [number, number, number] {
  const anchors = COLOR_ANCHORS_BY_APPEARANCE[appearance];
  const first = anchors[0];
  const last = anchors[anchors.length - 1];
  if (field <= first.field) return [first.r, first.g, first.b];
  if (field >= last.field) return [last.r, last.g, last.b];
  const upperIndex = field < anchors[1].field ? 1 : 2;
  const lower = anchors[upperIndex - 1];
  const upper = anchors[upperIndex];
  const t = (field - lower.field) / (upper.field - lower.field);
  return [
    lerp(lower.r, upper.r, t),
    lerp(lower.g, upper.g, t),
    lerp(lower.b, upper.b, t),
  ];
}

/**
 * 各 appearance が数値パラメータ(macro field / color anchors / family selection)を
 * どの appearance から引くか。R3 以降はいずれも R2 を alias し、差分は bind する asset だけである。
 *
 * `satisfies Record<Exclude<AppearanceId, 'BASELINE'>, ...>` を付けているのは意図的である。
 * この表は以前 `id === 'R1' || id === 'R2' || ...` という文字列リテラルの連鎖だったため、
 * APPEARANCE_IDS へ新しい appearance を足しても連鎖の更新を忘れることができ、
 * その appearance は**エラーにならず黙って BASELINE へ落ちた**(R6 追加時に実際に起きた)。
 * この表なら登録漏れは型エラーになる。連鎖を伸ばす形へ戻さないこと。
 */
const PARAMETER_APPEARANCE_BY_ID = {
  R1: 'R1',
  R2: 'R2',
  R3: 'R2',
  R4: 'R2',
  R5: 'R2',
  R6: 'R2',
  R7: 'R2',
} as const satisfies Record<Exclude<AppearanceId, 'BASELINE'>, 'R1' | 'R2'>;

export function createAppearanceModel(id: AppearanceId, seed: number): AppearanceModel {
  if (id !== 'BASELINE') {
    const parameterAppearance = PARAMETER_APPEARANCE_BY_ID[id];
    return {
      id,
      groveVariant: groveConfigFor,
      treeVariant: treeVariantFor,
      scale: scaleFor,
      colorAt(x, z) {
        return interpolateColor(
          sampleMacroField(x, z, seed, parameterAppearance),
          parameterAppearance,
        );
      },
      familyAt(x, z) {
        return selectionFamilyAt(x, z, seed, parameterAppearance);
      },
    };
  }
  return {
    id: 'BASELINE',
    groveVariant(_family, u) {
      return Math.min(5, Math.floor(u * 6));
    },
    treeVariant(_family, u) {
      return Math.min(3, Math.floor(u * 4));
    },
    scale(_family, isBroadleafTree, u) {
      return isBroadleafTree
        ? lerp(BROADLEAF_SCALE_MIN, BROADLEAF_SCALE_MAX, u)
        : lerp(CONIFER_SCALE_MIN, CONIFER_SCALE_MAX, u);
    },
    colorAt() {
      return [1, 1, 1];
    },
    familyAt() {
      return 1;
    },
  };
}

/** APPEARANCE_IDS から導出する。ここも以前は文字列リテラルの連鎖で、実体と乖離できた。 */
const RESOLVABLE_APPEARANCE_IDS: ReadonlySet<string> = new Set(
  APPEARANCE_IDS.filter((id) => id !== 'BASELINE'),
);

export function resolveAppearanceId(value: unknown): AppearanceId {
  return typeof value === 'string' && RESOLVABLE_APPEARANCE_IDS.has(value)
    ? (value as AppearanceId)
    : 'BASELINE';
}
