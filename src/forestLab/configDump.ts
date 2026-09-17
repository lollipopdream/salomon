import type { AppearanceId } from './appearance/appearanceModel';
import * as labConstants from './labConstants';
import * as clusterConstants from './cluster/clusterConstants';
import * as appearanceConstants from './appearance/appearanceConstants';

/**
 * 数値 appearance パラメータを R2 から引く appearance の集合。
 *
 * ここは以前 `appearance === 'R2' || appearance === 'R3' || ...` という文字列リテラルの
 * 連鎖で、`APPEARANCE_IDS` へ appearance を足しても更新を忘れることができた。
 * 実際 R6 追加時に更新漏れが起き、**R6 の config dump が R1 のパラメータを
 * active として出力していた**(R6 phase の reviewer 指摘 #1 で発覚)。
 * 同じ連鎖は appearanceModel.ts にもあり、そちらは R6 が黙って BASELINE へ落ちる形で現れた。
 *
 * `satisfies` で全 id の登録を型に強制し、登録漏れをコンパイルエラーにする。
 * 連鎖を伸ばす形へ戻さないこと。
 */
const USES_R2_PARAMETERS_BY_ID = {
  BASELINE: false,
  R1: false,
  R2: true,
  R3: true,
  R4: true,
  R5: true,
  R6: true,
  R7: true,
} as const satisfies Record<AppearanceId, boolean>;

const R2_PARAMETER_APPEARANCES: ReadonlySet<AppearanceId> = new Set(
  (Object.keys(USES_R2_PARAMETERS_BY_ID) as AppearanceId[])
    .filter((id) => USES_R2_PARAMETERS_BY_ID[id]),
);

import type {
  ForestLabCandidateConfig,
  ForestLabRuntimeConfig,
  ForestLabRuntimeState,
  PatchManifest,
} from './labTypes';

interface ClusterAppearanceMetrics {
  meanSquareFootprintWidth?: number;
  meanFootprintWidth?: number;
}

interface ReadableCandidateConfig {
  id: 0 | 1 | 2 | 3 | 4 | 5;
  name: string;
  shellHeightFormula: string;
  materialSource: string;
  notes: string[];
}

export type CompleteForestLabCandidateConfig = ForestLabCandidateConfig & {
  runtime: ForestLabRuntimeConfig;
  candidates: ReadableCandidateConfig[];
  cameras: PatchManifest['closeCamera'] & {
    PRIMARY: typeof labConstants.PRIMARY_CAMERA;
    OVERVIEW: typeof labConstants.OVERVIEW_CAMERA;
    targetAdjustment: PatchManifest['cameraTargetAdjustment'];
  };
  parameterFixLog: {
    common: Record<string, unknown>;
    candidateA: Record<string, unknown>;
    candidateB: Record<string, unknown>;
    candidateC: Record<string, unknown>;
    cluster: Record<string, unknown>;
    appearance: Record<string, unknown>;
    closeCamera: PatchManifest['closeCamera'];
    targetAdjustment: PatchManifest['cameraTargetAdjustment'];
  };
};

let activeRuntimeState: ForestLabRuntimeState | undefined;

export function setActiveConfigDumpRuntimeState(runtimeState: ForestLabRuntimeState): void {
  activeRuntimeState = { ...runtimeState };
}

export function buildConfigDump(
  manifest: PatchManifest,
  runtimeState: ForestLabRuntimeState | undefined = activeRuntimeState,
): CompleteForestLabCandidateConfig {
  const usesR2AppearanceParameters = runtimeState?.appearance !== undefined
    && R2_PARAMETER_APPEARANCES.has(runtimeState.appearance);
  const clusterAppearanceMetrics = runtimeState?.cluster as
    | (ClusterAppearanceMetrics & NonNullable<ForestLabRuntimeState['cluster']>)
    | undefined;
  const constants = Object.fromEntries(
    Object.entries(labConstants).filter(([, value]) => typeof value !== 'function'),
  );
  const candidates: ReadableCandidateConfig[] = [
    {
      id: 0,
      name: 'CONTROL',
      shellHeightFormula: 'none',
      materialSource: 'canonical terrain aerial texture and vertex colors',
      notes: ['Terrain patch and route only; no forest-derived render primitive.'],
    },
    {
      id: 1,
      name: 'SHELL_BASE',
      shellHeightFormula: 'terrainY + taper * CANOPY_HEIGHT_METERS',
      materialSource: 'canonical terrain aerial texture and bilinear vertex colors',
      notes: ['Continuous canopy shell; no random crown relief.'],
    },
    {
      id: 2,
      name: 'SHELL_CROWN_FIELD',
      shellHeightFormula: 'terrainY + taper * (CANDIDATE_B_BASE_METERS + crown smooth-max relief)',
      materialSource: 'canonical terrain aerial texture and bilinear vertex colors',
      notes: ['One continuous shell mesh with deterministic actual-dimension crown relief.'],
    },
    {
      id: 3,
      name: 'HYBRID',
      shellHeightFormula: 'identical to SHELL_CROWN_FIELD',
      materialSource: 'canonical aerial shell plus existing V2.1 grove/tree side atlases',
      notes: ['Candidate 2 shell geometry is reused; selected detail sites add silhouettes.'],
    },
    {
      id: 4,
      name: 'CLUSTER_ONLY',
      shellHeightFormula: 'none (terrain is never displaced)',
      materialSource: 'existing V2.1 grove/tree side atlases, unlit MeshBasicMaterial',
      notes: ['Two-level cluster lattice of crossed-quad impostors. No shell mesh.'],
    },
    {
      id: 5,
      name: 'HIERARCHICAL_FOREST',
      shellHeightFormula: 'none (overlay shares terrain vertices exactly)',
      materialSource: 'candidate 4 assets plus generated far-canopy-2048.png from grove top atlas',
      notes: ['Candidate 4 cluster meshes are reused; one FAR canopy overlay mesh is added.'],
    },
  ];
  return {
    schemaVersion: 1,
    phase: 'matsu-h01-forest-lab-reference-appearance-convergence-v1',
    patchManifest: manifest,
    constants,
    runtime: {
      appearance: runtimeState?.appearance ?? 'BASELINE',
      crownCount: runtimeState && runtimeState.crownCount > 0
        ? runtimeState.crownCount
        : null,
      crownLatticeCols: manifest.derived.crownLatticeCols,
      shellVertexCount: runtimeState?.shellVertexCount ?? null,
      shellTriangleCount: runtimeState?.shellTriangleCount ?? null,
      detailCount: runtimeState?.detailCount ?? null,
      cluster: runtimeState?.cluster ?? null,
      farCanopy: runtimeState?.farCanopy ?? null,
    },
    candidates,
    cameras: {
      ...manifest.closeCamera,
      PRIMARY: labConstants.PRIMARY_CAMERA,
      OVERVIEW: labConstants.OVERVIEW_CAMERA,
      targetAdjustment: manifest.cameraTargetAdjustment,
    },
    parameterFixLog: {
      common: {
        CANONICAL_CELL_SIZE_METERS: labConstants.CANONICAL_CELL_SIZE_METERS,
        TERRAIN_UV_EXTENT_METERS: labConstants.TERRAIN_UV_EXTENT_METERS,
        MASK_EXTENT_METERS: labConstants.MASK_EXTENT_METERS,
        MASK_SIZE: labConstants.MASK_SIZE,
        MASK_THRESHOLD: labConstants.MASK_THRESHOLD,
        PATCH_SIZE_CELLS: labConstants.PATCH_SIZE_CELLS,
        SHELL_SUBDIVISION: labConstants.SHELL_SUBDIVISION,
        SHELL_CELL_METERS: labConstants.SHELL_CELL_METERS,
        SEED: labConstants.SEED,
        smoothstepFormula: 't^2 * (3 - 2t), with t clamped to [0, 1]',
      },
      candidateA: {
        CANOPY_HEIGHT_METERS: labConstants.CANOPY_HEIGHT_METERS,
        EDGE_TAPER_WIDTH_METERS: labConstants.EDGE_TAPER_WIDTH_METERS,
        CAP_HEIGHT_WORLD_BY_CONFIG: labConstants.CAP_HEIGHT_WORLD_BY_CONFIG,
        taperFormula: 'smoothstep(distance / EDGE_TAPER_WIDTH_METERS)',
      },
      candidateB: {
        CROWN_SPACING_METERS: labConstants.CROWN_SPACING_METERS,
        CROWN_RADIUS_MIN_METERS: labConstants.CROWN_RADIUS_MIN_METERS,
        CROWN_RADIUS_MEDIAN_METERS: labConstants.CROWN_RADIUS_MEDIAN_METERS,
        CROWN_RADIUS_MAX_METERS: labConstants.CROWN_RADIUS_MAX_METERS,
        CROWN_RELIEF_AMPLITUDE_METERS: labConstants.CROWN_RELIEF_AMPLITUDE_METERS,
        CROWN_SMAX_K_METERS: labConstants.CROWN_SMAX_K_METERS,
        CANDIDATE_B_BASE_METERS: labConstants.CANDIDATE_B_BASE_METERS,
        TREE_HEIGHT_MEDIAN_METERS: labConstants.TREE_HEIGHT_MEDIAN_METERS,
        radiusFormula: 'piecewise linear inverse CDF anchored at min, median, and max',
        aggregationFormula: 'ordered quadratic smooth-max over contributing crowns only',
      },
      candidateC: {
        DETAIL_SPACING_METERS: labConstants.DETAIL_SPACING_METERS,
        DETAIL_TOP_DECILE: labConstants.DETAIL_TOP_DECILE,
        DETAIL_GROVE_FRACTION: labConstants.DETAIL_GROVE_FRACTION,
        DETAIL_SCORE_WEIGHTS: labConstants.DETAIL_SCORE_WEIGHTS,
        DETAIL_MAX_COUNT: manifest.derived.detailMaxCount,
        assetSource: 'V2.1 grove and tree side atlases',
        countFormula: 'round(DETAIL_TOP_DECILE * forestArea / DETAIL_SPACING_METERS^2)',
      },
      cluster: Object.fromEntries(
        Object.entries(clusterConstants).filter(([, value]) => typeof value !== 'function'),
      ),
      appearance: {
        ...appearanceConstants,
        macroFieldFormula: 'weighted 3-octave rotated value noise with smoothstep interpolation. R2 の selection family は低周波 2 octave のみ(fieldLow)、color は 3 octave 全部(fieldFull)。',
        // R1 / R2 それぞれの閾値を明示し、dump された appearance で実際に使われている方を
        // activeFamilyThresholds として出す(reviewer 指摘 #6。汎用キー名での誤読を防ぐ)。
        r1FamilyThresholds: [
          appearanceConstants.DARK_CONIFER_THRESHOLD,
          appearanceConstants.BRIGHT_BROADLEAF_THRESHOLD,
        ],
        r2FamilyThresholds: [
          appearanceConstants.R2_DARK_CONIFER_THRESHOLD,
          appearanceConstants.R2_BRIGHT_BROADLEAF_THRESHOLD,
        ],
        activeFamilyThresholds: usesR2AppearanceParameters
          ? [
            appearanceConstants.R2_DARK_CONIFER_THRESHOLD,
            appearanceConstants.R2_BRIGHT_BROADLEAF_THRESHOLD,
          ]
          : [
            appearanceConstants.DARK_CONIFER_THRESHOLD,
            appearanceConstants.BRIGHT_BROADLEAF_THRESHOLD,
          ],
        activeMacroFieldOctaves: usesR2AppearanceParameters
          ? appearanceConstants.R2_MACRO_FIELD_OCTAVES
          : appearanceConstants.R1_MACRO_FIELD_OCTAVES,
        activeColorAnchors: usesR2AppearanceParameters
          ? appearanceConstants.R2_COLOR_ANCHORS
          : appearanceConstants.COLOR_ANCHORS,
        familyClusterCounts: runtimeState?.cluster?.familyClusterCounts ?? null,
        measuredMeanSquareScale: runtimeState?.cluster?.meanSquareScale ?? null,
        measuredMeanSquareFootprintWidth:
          clusterAppearanceMetrics?.meanSquareFootprintWidth ?? null,
        measuredMeanFootprintWidth: clusterAppearanceMetrics?.meanFootprintWidth ?? null,
        measuredMeanColorLuminanceMultiplier:
          runtimeState?.cluster?.meanColorLuminanceMultiplier ?? null,
      },
      closeCamera: manifest.closeCamera,
      targetAdjustment: manifest.cameraTargetAdjustment,
    },
  };
}
