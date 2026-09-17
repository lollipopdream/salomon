import { DEFAULT_COVERAGE_FILL_CONFIG, type CoverageFillConfig } from './coverageFill';
import { DEFAULT_MACRO_SHADE_CONFIG, type MacroShadeConfig } from './macroShade';

export interface R10LabConfig {
  macroShade: MacroShadeConfig;
  coverageFill: CoverageFillConfig;
}

const DEFAULT_R10_CONFIG: R10LabConfig = {
  macroShade: DEFAULT_MACRO_SHADE_CONFIG,
  coverageFill: DEFAULT_COVERAGE_FILL_CONFIG,
};

/**
 * URL パラメータ名 -> MacroShadeConfig の数値フィールド名。
 * `r10light` は enabled の on/off 専用なのでここには含めない。
 */
const NUMERIC_PARAM_KEYS: ReadonlyArray<
  readonly [param: string, field: keyof MacroShadeConfig]
> = [
  ['r10la', 'ambient'],
  ['r10ld', 'direct'],
  ['r10lv', 'valleyWeight'],
  ['r10ln', 'normalStepMeters'],
  ['r10lr', 'valleyRadiusMeters'],
  ['r10lh', 'reliefScaleMeters'],
  ['r10lg', 'gain'],
  ['r10lmin', 'shadeMin'],
  ['r10lmax', 'shadeMax'],
];

/**
 * URL パラメータ名 -> CoverageFillConfig の数値フィールド名。
 * `r10cov` は enabled の on/off 専用なのでここには含めない。
 */
const COVERAGE_NUMERIC_PARAM_KEYS: ReadonlyArray<
  readonly [param: string, field: keyof CoverageFillConfig]
> = [
  ['r10cr', 'gapRadiusMeters'],
  ['r10cc', 'gapCoverageMax'],
  ['r10cs', 'occupancyCellMeters'],
];

function parseNumberParam(
  params: URLSearchParams,
  key: string,
  fallback: number,
): number {
  const raw = params.get(key);
  if (raw === null) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new RangeError(`Forest Lab R10: invalid numeric value for "${key}": ${raw}`);
  }
  return value;
}

/**
 * URL クエリから R10 candidate 設定を作る純粋関数。
 *
 * - `r10light` が未指定なら macroShade.enabled は false(=完全に既定動作)。
 * - `r10light=v1` で有効化する。
 * - `r10cov` が未指定なら coverageFill.enabled は false(=完全に既定動作。
 *   placement は 1 命令も変わらない)。
 * - `r10cov=v1` で gap-targeted な coverage fill を有効化する。
 * - 数値上書きパラメータは `r10light` / `r10cov` の有無に関わらず解釈され、
 *   不正な数値は黙って無視せず throw する。
 */
export function parseR10Config(params: URLSearchParams): R10LabConfig {
  const base = DEFAULT_MACRO_SHADE_CONFIG;
  const enabled = params.get('r10light') === 'v1';

  const macroShade: MacroShadeConfig = { ...base, enabled };
  for (const [param, field] of NUMERIC_PARAM_KEYS) {
    (macroShade[field] as number) = parseNumberParam(params, param, base[field] as number);
  }

  const coverageBase = DEFAULT_COVERAGE_FILL_CONFIG;
  const coverageEnabled = params.get('r10cov') === 'v1';

  const coverageFill: CoverageFillConfig = { ...coverageBase, enabled: coverageEnabled };
  for (const [param, field] of COVERAGE_NUMERIC_PARAM_KEYS) {
    (coverageFill[field] as number) =
      parseNumberParam(params, param, coverageBase[field] as number);
  }

  return { macroShade, coverageFill };
}

let currentR10Config: R10LabConfig = DEFAULT_R10_CONFIG;

export function setR10Config(config: R10LabConfig): void {
  currentR10Config = config;
}

export function getR10Config(): R10LabConfig {
  return currentR10Config;
}
