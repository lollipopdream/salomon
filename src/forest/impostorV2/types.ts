export type ImpostorAtlasId = 'tree' | 'grove';
export type ImpostorKind = 'grove' | 'tree';
export type ImpostorKindsFlag = 'both' | 'grove' | 'tree';
export type ImpostorMaterialMode = 'lambert' | 'unlit';
export type ImpostorBand = 'none' | 'near' | 'mid' | 'ridge';

export interface ImpostorUvRect { u0: number; v0: number; u1: number; v1: number }

export interface ImpostorAtlasInfo {
  id: ImpostorAtlasId;
  file: string;
  width: number; height: number;
  cellWidth: number; cellHeight: number;
  cols: number; rows: number;
  sha256: string;
}

export interface ImpostorCellRef {
  key: string;
  kind: ImpostorKind;
  atlas: ImpostorAtlasId;
  groveConfig: string | null;
  sourceVariant: string | null;
  yawDeg: number;
  uv: ImpostorUvRect;
  tightWorldWidth: number;
  tightWorldHeight: number;
  groundPivotInTight: { u: number; v: number };
  alphaCoverage: number;
}

export interface ImpostorAtlasMeta {
  schemaVersion: 1;
  pitchDeg: 0;
  atlases: Record<ImpostorAtlasId, ImpostorAtlasInfo>;
  cells: readonly ImpostorCellRef[];
}

export interface ImpostorCellSelection {
  grove: { configs: readonly string[]; yawDegrees: readonly number[] };
  tree: { variants: readonly string[]; yawDegrees: readonly number[] };
}

export interface ForestMaskV2Data { size: number; extentMeters: number; coverage: Uint8Array }

export interface MacroForestCell {
  cellX: number; cellZ: number; index: number;
  centerX: number; centerZ: number;
  coverage: number;
  slopeRad: number; slopeDensity: number;
  ridgeScore: number;
  routeDistanceMeters: number;
  patch: number;
  band: ImpostorBand;
  spacingMeters: number;
  accepted: boolean;
}

export interface MacroForestField {
  cols: number; rows: number; cellMeters: number; extentMeters: number;
  cells: readonly MacroForestCell[];
  stats: {
    acceptedCells: number; nearCells: number; midCells: number; ridgeCells: number;
    meanSpacingMeters: number;
  };
}

export interface ImpostorPlacementResult {
  count: number;
  positions: Float32Array;
  yawRadians: Float32Array;
  widthMeters: Float32Array;
  heightMeters: Float32Array;
  mirrored: Uint8Array;
  cellSlots: Uint16Array;
  stats: {
    groveCount: number; treeCount: number;
    attempted: number; accepted: number; kept: number; thinned: boolean;
    rejectedByMask: number; rejectedByRoute: number; rejectedBySpacing: number;
    perCellCounts: Readonly<Record<string, number>>;
    elapsedMs: number;
  };
}

export interface ForestImpostorV2Flags {
  enabled: boolean;
  macroShade?: boolean;
  densityScale: number;
  maxPrimitivesOverride?: number;
  kinds: ImpostorKindsFlag;
  materialMode?: ImpostorMaterialMode;
  topCap?: boolean;
  alphaTestOverride?: number;
  /** Preview-only whole-mountain card coverage preset (`?r10wide=1`). */
  r10Wide?: boolean;
  /** Preview-only R10 adopted side-atlas preset (`?r10atlas=1`). */
  r10Atlas?: boolean;
  /** Preview-only broadleaf-dominant composition preset (`?r10broad=1`). */
  r10Broad?: boolean;
  /** Preview-only forest material tone calibration (`?r10tone=1`). */
  r10Tone?: boolean;
  /** Preview-only forest depth haze (`?r10air=1`). */
  r10Air?: boolean;
  // matsu-h01-r10-actual-app-vps-preview-deploy (density parity, preview-only):
  // `r10dense=1` のときだけ設定される。既存の densityScale / maxPrimitivesOverride は
  // production の意味(それぞれの既存 query)を変えず、grove/tree 個別 cap の
  // preview-only 引き上げにはこの 2 つの override を使う。
  r10Dense?: boolean;
  maxGrovePrimitivesOverride?: number;
  maxTreePrimitivesOverride?: number;
}

export interface ForestImpostorV2Config {
  assets: {
    metaUrl: string; treeAtlasUrl: string; groveAtlasUrl: string;
    groveTopAtlasUrl?: string; groveTopMetaUrl?: string;
  };
  mask: { url: string; extentMeters: number; size: number };
  cellSelection: ImpostorCellSelection;
  macro: {
    seed: number; cellMeters: number;
    reliefRadiusMeters: number; reliefReferenceMeters: number;
    minCoverage: number; minCoverageEdge: number;
    slopeFullDeg: number; slopeZeroDeg: number; slopeStepMeters: number;
    patchNoiseScaleCells: number;
    patchThreshold: { near: number; mid: number; ridge: number };
    ridgeScoreMin: number;
  };
  corridor: {
    nearMeters: number; farMeters: number; ridgeMeters: number;
    routeClearanceMeters: number; clearanceFootprintFactor: number;
    exclusionCellMeters: number; exclusionMaxMeters: number;
    corridorCellMeters: number; corridorMaxMeters: number; corridorRouteStride: number;
  };
  grove: {
    spacingNearMeters: number; spacingFarMeters: number; spacingRidgeMeters: number;
    patchSpacingBoost: number; minSpacingRatio: number;
    scaleMin: number; scaleMax: number;
    ridgeScalePenalty: number; slopeScalePenalty: number;
    sinkBaseMeters: number; slopeSinkFactor: number;
    dartAttemptsPerTarget: number;
    speciesGroups: { conifer: readonly string[]; mixed: readonly string[]; broadleaf: readonly string[] };
    speciesGroupSplit: { conifer: number; mixed: number };
  };
  tree: {
    enabled: boolean;
    spacingMeters: number; minSpacingRatio: number;
    nearRouteMeters: number; patchEdgeBand: number; ridgeScoreMin: number;
    groveClearanceMeters: number;
    variantWeights: Readonly<Record<string, number>>;
    nearRouteBroadleafFraction: number;
    scaleMin: number; scaleMax: number;
    slopeScalePenalty: number;
    sinkBaseMeters: number; slopeSinkFactor: number;
    dartAttemptsPerTarget: number;
  };
  material: { groveAlphaTest: number; treeAlphaTest: number; tintJitter: number };
  limits: { maxPrimitives: number; maxGrovePrimitives: number; maxTreePrimitives: number };
}

export interface ForestImpostorV2Summary {
  enabled: true;
  flags: ForestImpostorV2Flags;
  primitives: { total: number; grove: number; tree: number };
  perCell: readonly { key: string; count: number }[];
  render: { drawCalls: number; triangles: number; vertices: number; instanceBytes: number; materials: number; geometries: number };
  textures: readonly { atlas: ImpostorAtlasId; width: number; height: number; estimatedBytesWithMips: number }[];
  macro: MacroForestField['stats'];
  macroShadeStats?: {
    mean: number; min: number; max: number;
    shadeMinFraction: number; shadeMaxFraction: number;
  };
  placement: ImpostorPlacementResult['stats'];
  limits: { maxPrimitives: number; thinned: boolean };
  material: { groveAlphaTest: number; treeAlphaTest: number; mode: ImpostorMaterialMode };
  maskCoverageMean: number;
  topCap?: {
    requested: boolean;
    active: boolean;
    disabledReason?: 'material-not-unlit' | 'meta-load-failed' | 'meta-invalid'
      | 'mapping-invalid' | 'texture-load-failed' | 'build-failed';
    primitiveCount: number;
    drawCalls: number;
    triangles: number;
    vertices: number;
    cellCount: number;
    alphaTest: number;
    atlas: { file: string; width: number; height: number; estimatedBytesWithMips: number };
    capHeightMethod: string;
    capHeightWorldByConfig: Record<string, number>;
  };
  timingsMs: { metaMs: number; textureMs: number; maskMs: number; routeFieldMs: number; macroFieldMs: number; placementMs: number; meshBuildMs: number; totalMs: number };
}
