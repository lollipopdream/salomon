import { describe, expect, it } from 'vitest';

import {
  CANONICAL_CELL_SIZE_METERS,
  CANONICAL_COLS,
  CANONICAL_ROWS,
  CANDIDATE_B_BASE_METERS,
  CANOPY_HEIGHT_METERS,
  CAP_HEIGHT_WORLD_BY_CONFIG,
  CAPTURE_HEIGHT,
  CAPTURE_PIXEL_RATIO,
  CAPTURE_WIDTH,
  CROWN_RADIUS_MAX_METERS,
  CROWN_RADIUS_MEDIAN_METERS,
  CROWN_RADIUS_MIN_METERS,
  CROWN_RELIEF_AMPLITUDE_METERS,
  CROWN_SMAX_K_METERS,
  CROWN_SPACING_METERS,
  DETAIL_GROVE_FRACTION,
  DETAIL_SCORE_WEIGHTS,
  DETAIL_SPACING_METERS,
  DETAIL_TOP_DECILE,
  EDGE_TAPER_WIDTH_METERS,
  MASK_EXTENT_METERS,
  MASK_SIZE,
  MASK_THRESHOLD,
  PATCH_SIZE_CELLS,
  OVERVIEW_CAMERA,
  PRIMARY_CAMERA,
  SEED,
  SHELL_CELL_METERS,
  SHELL_SUBDIVISION,
  TELEMETRY_SAMPLE_FRAMES,
  TELEMETRY_WARMUP_FRAMES,
  TERRAIN_UV_EXTENT_METERS,
  TREE_HEIGHT_MEDIAN_METERS,
} from './labConstants';
import * as clusterConstants from './cluster/clusterConstants';
import {
  APPEARANCE_IDS,
  R2_COLOR_ANCHORS,
  R2_MACRO_FIELD_OCTAVES,
} from './appearance/appearanceConstants';
import { PATCH_MANIFEST_JSON } from './scene/labDataSources';
import { buildConfigDump } from './configDump';
import type { ForestLabRuntimeState } from './labTypes';

describe('config dump', () => {
  it('uses null rather than a placeholder zero when no runtime state is available', () => {
    const dump = buildConfigDump(PATCH_MANIFEST_JSON);
    expect(dump.runtime.crownCount).toBeNull();
    expect(dump.runtime.cluster).toBeNull();
    expect(dump.runtime.farCanopy).toBeNull();
    expect(dump.parameterFixLog.appearance.measuredMeanSquareFootprintWidth).toBeNull();
    expect(dump.parameterFixLog.appearance.measuredMeanFootprintWidth).toBeNull();
  });

  it('includes measured footprint-width metrics when cluster runtime state is available', () => {
    const dump = buildConfigDump(PATCH_MANIFEST_JSON, {
      appearance: 'R1',
      crownCount: 0,
      shellVertexCount: 0,
      shellTriangleCount: 0,
      detailCount: 0,
      cluster: {
        clusterLatticeCols: 1,
        clusterCandidateCount: 1,
        clusterAcceptedCount: 1,
        memberPlacedCount: 1,
        memberRejectedByMaskCount: 0,
        memberRejectedByBboxCount: 0,
        groveInstanceCount: 1,
        treeInstanceCount: 0,
        familyClusterCounts: [1, 0, 0],
        meanSquareScale: 1,
        meanSquareFootprintWidth: 144,
        meanFootprintWidth: 12,
        meanColorLuminanceMultiplier: 1,
        atlasCellMeshCount: 1,
        visibleInstanceCount: 1,
      },
    } as unknown as ForestLabRuntimeState);
    expect(dump.parameterFixLog.appearance.measuredMeanSquareFootprintWidth).toBe(144);
    expect(dump.parameterFixLog.appearance.measuredMeanFootprintWidth).toBe(12);
  });

  it('includes actual controller runtime state when supplied', () => {
    const dump = buildConfigDump(PATCH_MANIFEST_JSON, {
      appearance: 'BASELINE',
      crownCount: 1234,
      shellVertexCount: 9409,
      shellTriangleCount: 18432,
      detailCount: 358,
    });
    expect(dump.runtime).toEqual({
      appearance: 'BASELINE',
      crownCount: 1234,
      crownLatticeCols: 322,
      shellVertexCount: 9409,
      shellTriangleCount: 18432,
      detailCount: 358,
      cluster: null,
      farCanopy: null,
    });
  });

  it('includes R3 and reports R2 appearance parameters as active for it', () => {
    const dump = buildConfigDump(PATCH_MANIFEST_JSON, {
      appearance: 'R3',
      crownCount: 0,
      shellVertexCount: 0,
      shellTriangleCount: 0,
      detailCount: 0,
    });
    expect(dump.runtime.appearance).toBe('R3');
    expect(dump.parameterFixLog.appearance.APPEARANCE_IDS).toBe(APPEARANCE_IDS);
    expect(dump.parameterFixLog.appearance.activeMacroFieldOctaves)
      .toBe(R2_MACRO_FIELD_OCTAVES);
    expect(dump.parameterFixLog.appearance.activeColorAnchors).toBe(R2_COLOR_ANCHORS);
  });

  it('includes R4 and reports R2 appearance parameters as active for it', () => {
    const dump = buildConfigDump(PATCH_MANIFEST_JSON, {
      appearance: 'R4',
      crownCount: 0,
      shellVertexCount: 0,
      shellTriangleCount: 0,
      detailCount: 0,
    });
    expect(dump.runtime.appearance).toBe('R4');
    expect(dump.parameterFixLog.appearance.APPEARANCE_IDS).toBe(APPEARANCE_IDS);
    expect(dump.parameterFixLog.appearance.activeMacroFieldOctaves)
      .toBe(R2_MACRO_FIELD_OCTAVES);
    expect(dump.parameterFixLog.appearance.activeColorAnchors).toBe(R2_COLOR_ANCHORS);
  });

  it('includes R6 and reports R2 appearance parameters as active for it', () => {
    const dump = buildConfigDump(PATCH_MANIFEST_JSON, {
      appearance: 'R6',
      crownCount: 0,
      shellVertexCount: 0,
      shellTriangleCount: 0,
      detailCount: 0,
    });
    expect(dump.runtime.appearance).toBe('R6');
    expect(dump.parameterFixLog.appearance.APPEARANCE_IDS).toBe(APPEARANCE_IDS);
    expect(dump.parameterFixLog.appearance.activeMacroFieldOctaves)
      .toBe(R2_MACRO_FIELD_OCTAVES);
    expect(dump.parameterFixLog.appearance.activeColorAnchors).toBe(R2_COLOR_ANCHORS);
  });

  // R6 phase reviewer #1: buildConfigDump も appearanceModel と同じ文字列リテラル連鎖を持ち、
  // R6 の登録漏れで **R6 の dump が R1 のパラメータを active と誤報告**していた。
  // 連鎖を APPEARANCE_IDS 由来の表へ置換したうえで、性質そのものをここで固定する。
  // R1 だけが R2 パラメータを使わない非 BASELINE appearance である。
  it('never reports R1 parameters as active for an appearance that inherits from R2', () => {
    for (const appearance of APPEARANCE_IDS) {
      if (appearance === 'BASELINE' || appearance === 'R1') continue;
      const dump = buildConfigDump(PATCH_MANIFEST_JSON, {
        appearance,
        crownCount: 0,
        shellVertexCount: 0,
        shellTriangleCount: 0,
        detailCount: 0,
      });
      expect(dump.runtime.appearance).toBe(appearance);
      expect(dump.parameterFixLog.appearance.activeMacroFieldOctaves)
        .toBe(R2_MACRO_FIELD_OCTAVES);
      expect(dump.parameterFixLog.appearance.activeColorAnchors).toBe(R2_COLOR_ANCHORS);
    }
  });

  it('includes R5 and reports R2 appearance parameters as active for it', () => {
    const dump = buildConfigDump(PATCH_MANIFEST_JSON, {
      appearance: 'R5',
      crownCount: 0,
      shellVertexCount: 0,
      shellTriangleCount: 0,
      detailCount: 0,
    });
    expect(dump.runtime.appearance).toBe('R5');
    expect(dump.parameterFixLog.appearance.APPEARANCE_IDS).toBe(APPEARANCE_IDS);
    expect(dump.parameterFixLog.appearance.activeMacroFieldOctaves)
      .toBe(R2_MACRO_FIELD_OCTAVES);
    expect(dump.parameterFixLog.appearance.activeColorAnchors).toBe(R2_COLOR_ANCHORS);
    // T3/T4 effective values must be inspectable from the config dump (design report requirement).
    expect(dump.parameterFixLog.appearance.R5_FAR_CANOPY_ANISOTROPY).toBeTypeOf('number');
    expect(dump.parameterFixLog.appearance.R5_FAR_CANOPY_OPACITY_NEAR_METERS).toBeTypeOf('number');
    expect(dump.parameterFixLog.appearance.R5_FAR_CANOPY_OPACITY_FAR_METERS).toBeTypeOf('number');
  });

  it('keeps patchManifest.phase pinned to the original bakeoff value while phase advances', () => {
    const dump = buildConfigDump(PATCH_MANIFEST_JSON);
    expect(dump.phase).toBe('matsu-h01-forest-lab-reference-appearance-convergence-v1');
    expect(dump.patchManifest.phase).toBe('matsu-h01-takao-forest-visual-lab-architecture-bakeoff');
  });

  it('dumps every cluster constant with no gaps', () => {
    const dump = buildConfigDump(PATCH_MANIFEST_JSON);
    expect(new Set(Object.keys(dump.parameterFixLog.cluster)))
      .toEqual(new Set(Object.keys(clusterConstants)));
  });

  it('lists candidates 0 through 5, with 4 and 5 having a shell-free height formula', () => {
    const dump = buildConfigDump(PATCH_MANIFEST_JSON);
    expect(dump.candidates.map((candidate) => candidate.id)).toEqual([0, 1, 2, 3, 4, 5]);
    const candidate4 = dump.candidates.find((candidate) => candidate.id === 4)!;
    const candidate5 = dump.candidates.find((candidate) => candidate.id === 5)!;
    expect(candidate4.shellHeightFormula.startsWith('none')).toBe(true);
    expect(candidate5.shellHeightFormula.startsWith('none')).toBe(true);
  });

  it('contains every fixed numeric parameter with exact values', () => {
    const constants = buildConfigDump(PATCH_MANIFEST_JSON).constants;
    expect(constants.CANONICAL_ROWS).toBe(CANONICAL_ROWS);
    expect(constants.CANONICAL_COLS).toBe(CANONICAL_COLS);
    expect(constants.CANONICAL_CELL_SIZE_METERS).toBe(CANONICAL_CELL_SIZE_METERS);
    expect(constants.TERRAIN_UV_EXTENT_METERS).toBe(TERRAIN_UV_EXTENT_METERS);
    expect(constants.MASK_EXTENT_METERS).toBe(MASK_EXTENT_METERS);
    expect(constants.MASK_SIZE).toBe(MASK_SIZE);
    expect(constants.MASK_THRESHOLD).toBe(MASK_THRESHOLD);
    expect(constants.PATCH_SIZE_CELLS).toBe(PATCH_SIZE_CELLS);
    expect(constants.SHELL_SUBDIVISION).toBe(SHELL_SUBDIVISION);
    expect(constants.SHELL_CELL_METERS).toBe(SHELL_CELL_METERS);
    expect(constants.SEED).toBe(SEED);
    expect(constants.CANOPY_HEIGHT_METERS).toBe(CANOPY_HEIGHT_METERS);
    expect(constants.CAP_HEIGHT_WORLD_BY_CONFIG).toEqual(CAP_HEIGHT_WORLD_BY_CONFIG);
    expect(constants.EDGE_TAPER_WIDTH_METERS).toBe(EDGE_TAPER_WIDTH_METERS);
    expect(constants.CROWN_SPACING_METERS).toBe(CROWN_SPACING_METERS);
    expect(constants.CROWN_RADIUS_MIN_METERS).toBe(CROWN_RADIUS_MIN_METERS);
    expect(constants.CROWN_RADIUS_MEDIAN_METERS).toBe(CROWN_RADIUS_MEDIAN_METERS);
    expect(constants.CROWN_RADIUS_MAX_METERS).toBe(CROWN_RADIUS_MAX_METERS);
    expect(constants.CROWN_RELIEF_AMPLITUDE_METERS).toBe(CROWN_RELIEF_AMPLITUDE_METERS);
    expect(constants.CROWN_SMAX_K_METERS).toBe(CROWN_SMAX_K_METERS);
    expect(constants.CANDIDATE_B_BASE_METERS).toBe(CANDIDATE_B_BASE_METERS);
    expect(constants.TREE_HEIGHT_MEDIAN_METERS).toBe(TREE_HEIGHT_MEDIAN_METERS);
    expect(constants.DETAIL_SPACING_METERS).toBe(DETAIL_SPACING_METERS);
    expect(constants.DETAIL_TOP_DECILE).toBe(DETAIL_TOP_DECILE);
    expect(constants.DETAIL_GROVE_FRACTION).toBe(DETAIL_GROVE_FRACTION);
    expect(constants.DETAIL_SCORE_WEIGHTS).toEqual(DETAIL_SCORE_WEIGHTS);
    expect(constants.CAPTURE_WIDTH).toBe(CAPTURE_WIDTH);
    expect(constants.CAPTURE_HEIGHT).toBe(CAPTURE_HEIGHT);
    expect(constants.CAPTURE_PIXEL_RATIO).toBe(CAPTURE_PIXEL_RATIO);
    expect(constants.TELEMETRY_WARMUP_FRAMES).toBe(TELEMETRY_WARMUP_FRAMES);
    expect(constants.TELEMETRY_SAMPLE_FRAMES).toBe(TELEMETRY_SAMPLE_FRAMES);
    expect(constants.PRIMARY_CAMERA).toEqual(PRIMARY_CAMERA);
    expect(constants.OVERVIEW_CAMERA).toEqual(OVERVIEW_CAMERA);
  });

  it('is JSON-compatible and includes readable candidate and camera records', () => {
    const dump = buildConfigDump(PATCH_MANIFEST_JSON);
    expect(JSON.parse(JSON.stringify(dump))).toEqual(dump);
    expect(dump.candidates.map((candidate) => candidate.name)).toEqual([
      'CONTROL', 'SHELL_BASE', 'SHELL_CROWN_FIELD', 'HYBRID', 'CLUSTER_ONLY', 'HIERARCHICAL_FOREST',
    ]);
    expect(dump.parameterFixLog.candidateC.DETAIL_MAX_COUNT)
      .toBe(PATCH_MANIFEST_JSON.derived.detailMaxCount);
    expect(dump.parameterFixLog.closeCamera).toEqual(PATCH_MANIFEST_JSON.closeCamera);
    expect(dump.parameterFixLog.targetAdjustment)
      .toEqual(PATCH_MANIFEST_JSON.cameraTargetAdjustment);
  });
});
