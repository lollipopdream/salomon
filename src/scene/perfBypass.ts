export interface PerfBypassFlags {
  /** `?aa=0` のときだけ true。WebGLRenderer を antialias:false で生成する。 */
  disableAntialias: boolean;
  /** `?terrainMat=basic` のときだけ true。terrain を unlit へ差し替える。 */
  terrainMaterialBasic: boolean;
}

/**
 * Resolves development-only fragment-cost measurement bypasses.
 * Production always receives the unchanged rendering path, regardless of query.
 */
export function resolvePerfBypassFlags(
  query: URLSearchParams,
  isDev: boolean,
): PerfBypassFlags {
  if (!isDev) {
    return {
      disableAntialias: false,
      terrainMaterialBasic: false,
    };
  }

  return {
    disableAntialias: query.get('aa') === '0',
    terrainMaterialBasic: query.get('terrainMat') === 'basic',
  };
}
