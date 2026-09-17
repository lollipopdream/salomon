import type { ForestImpostorV2Flags, ImpostorKindsFlag, ImpostorMaterialMode } from './types';

// matsu-h01-r10-actual-app-vps-preview-deploy (density parity, preview-only):
// `?r10dense=1` のときだけ適用される R10 final 相当の density parity preset。
// これらの定数は production default(`src/config/defaults/forestImpostorV2.ts`)を
// 一切変更せず、flag 経由の override としてのみ効く。導出根拠は
// outputs/matsu-h01-r10-actual-app-vps-preview-deploy/evidence/r10-density-parity.md を参照。
//
// densityScale: grove/tree の spacing 式(macroForestField.ts の spacingMeters と
// impostorPlacement.ts の treeSpacing() はいずれも `/ Math.sqrt(densityScale)` で
// densityScale に反比例するため、accepted 数の目標値(target = cellMeters^2 / spacingMeters^2)は
// densityScale にほぼ線形比例する。実測 baseline 11,811 primitives(densityScale=1)から
// R10 相当密度に必要な instances 約214,795(=33,920/km² × 6.331km²)への倍率は
// 214,795 / 11,811 ≈ 18.19 であり、これは既に確認済みの密度比「約18.2倍」と一致する。
//
// 実測較正(実機 `npm run dev` + `window.__forestImpostorV2Summary()`、headless Chrome):
// densityScale=18.2 では実測 total 158,006(density ≈24,957/km²、目標の約73.6%)にとどまった。
// grove は理論線形値(≈134,407)にほぼ一致(実測131,635、97.9%)する一方、
// tree は grove が密になるほど `tree.groveClearanceMeters`(6m)で棄却される候補が増えるため
// 理論線形値(≈80,553)から大きく下振れ(実測26,371、32.7%)した。
// この非線形性を補正するため、実測フィードバックから densityScale を
// 18.2 × (214,795 / 158,006) ≈ 25 へ引き上げる(単純な 1 刻みの sweep ではなく、
// 実測密度と目標密度の比から 1 回だけ再較正した値)。
const R10_DENSE_DENSITY_SCALE = 25;
// preview-only cap。densityScale=25 の ridge は 2,758 cells × target 約79 ≈ 218,000 grove、
// これに near/mid の現行約160,000 grove を足すと約378,000 grove と見積もられるため、
// 520,000 まで余裕を持たせる。tree は現行実測100,000を維持する。production default
// (maxGrovePrimitives: 30000 / maxTreePrimitives: 14000)は変更しない。
const R10_DENSE_MAX_GROVE_PRIMITIVES = 520_000;
const R10_DENSE_MAX_TREE_PRIMITIVES = 100_000;
// 合計 cap は grove cap 520,000 と tree cap 100,000 に余裕を加えた preview-only 値。
// production default(maxPrimitives: 40000)は変更しない。
const R10_DENSE_MAX_TOTAL_PRIMITIVES = 660_000;

export function resolveForestImpostorV2Flags(query: URLSearchParams): ForestImpostorV2Flags {
  const kinds = query.get('forestImpostorV2Kinds');
  const materialMode = query.get('forestImpostorV2Material');
  const r10Dense = query.get('r10dense') === '1';
  const r10Wide = query.get('r10wide') === '1';
  const r10Atlas = query.get('r10atlas') === '1';
  return {
    enabled: query.get('forestImpostorV2') === '1',
    macroShade: query.get('r10light') === 'v1',
    // 既存の `forestImpostorV2Density` が明示されていればそちらを優先する
    // (r10dense はあくまで既定値のプリセットであり、既存 query の意味を上書きしない)。
    densityScale: parseFiniteRange(query.get('forestImpostorV2Density'), 0.1, 4)
      ?? (r10Dense ? R10_DENSE_DENSITY_SCALE : 1),
    maxPrimitivesOverride: parseIntegerRange(query.get('forestImpostorV2Max'), 1, 200_000)
      ?? (r10Dense ? R10_DENSE_MAX_TOTAL_PRIMITIVES : undefined),
    kinds: isKindsFlag(kinds) ? kinds : 'both',
    materialMode: isMaterialMode(materialMode) ? materialMode : 'lambert',
    topCap: query.get('forestImpostorV2TopCap') === '1',
    alphaTestOverride: parseFiniteRange(query.get('forestImpostorV2AlphaTest'), 0.05, 0.95),
    r10Wide,
    r10Atlas,
    r10Broad: query.get('r10broad') === '1' ? true : undefined,
    r10Tone: query.get('r10tone') === '1',
    r10Air: query.get('r10air') === '1' ? true : undefined,
    r10Dense: r10Dense ? true : undefined,
    maxGrovePrimitivesOverride: r10Dense ? R10_DENSE_MAX_GROVE_PRIMITIVES : undefined,
    maxTreePrimitivesOverride: r10Dense ? R10_DENSE_MAX_TREE_PRIMITIVES : undefined,
  };
}

function isKindsFlag(value: string | null): value is ImpostorKindsFlag {
  return value === 'both' || value === 'grove' || value === 'tree';
}

function isMaterialMode(value: string | null): value is ImpostorMaterialMode {
  return value === 'lambert' || value === 'unlit';
}

function parseFiniteRange(value: string | null, min: number, max: number): number | undefined {
  if (value === null || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
}

function parseIntegerRange(value: string | null, min: number, max: number): number | undefined {
  const parsed = parseFiniteRange(value, min, max);
  return parsed !== undefined && Number.isInteger(parsed) ? parsed : undefined;
}
