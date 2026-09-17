export interface LabelPerfBypassFlags {
  /** Skips only the label-occlusion raycast and preserves cached occlusion. */
  skipRaycast: boolean;
  /** Skips only the DOM writes performed by applyLabelEntryAppearance. */
  skipAppearanceWrite: boolean;
  /** Skips only projection and preserves the previous projected state. */
  skipProjection: boolean;
}

const NO_LABEL_PERF_BYPASS: LabelPerfBypassFlags = {
  skipRaycast: false,
  skipAppearanceWrite: false,
  skipProjection: false,
};

/** Resolves a single development-only label cost-isolation bypass. */
export function resolveLabelPerfBypassFlags(
  query: URLSearchParams,
  isDev: boolean,
): LabelPerfBypassFlags {
  if (!isDev) {
    return { ...NO_LABEL_PERF_BYPASS };
  }

  const bypass = query.get('labelPerfBypass');

  return {
    skipRaycast: bypass === 'no-raycast',
    skipAppearanceWrite: bypass === 'no-appearance-write',
    skipProjection: bypass === 'no-projection',
  };
}
