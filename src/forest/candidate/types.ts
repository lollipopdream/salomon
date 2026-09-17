export type ForestCandidateSpeciesId = 'conifer' | 'broadleaf';

export interface ForestCandidateFlags {
  enabled: boolean;
  spacingMetersOverride?: number;
  densityScale: number;
  maxInstancesOverride?: number;
}

export interface ForestMaskData {
  size: number;
  extentMeters: number;
  coverage: Uint8Array;
}

export interface SpriteRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CrownSpritePlacement {
  spriteIndex: number;
  centerX: number;
  centerY: number;
  scale: number;
  rotationRad: number;
  mirrored: boolean;
  brightness: number;
  depth: number;
}

export interface ForestCandidatePlacementResult {
  count: number;
  positions: Float32Array;
  sizes: Float32Array;
  speciesIndices: Uint8Array;
  variantIndices: Uint8Array;
  tintUnits: Float32Array;
  stats: {
    candidateCells: number;
    accepted: number;
    kept: number;
    thinned: boolean;
    coniferCount: number;
    broadleafCount: number;
    elapsedMs: number;
  };
}

export interface ForestCandidateFoliageSourceConfig {
  diffUrl: string;
  alphaUrl: string;
}

export interface ForestCandidateCrownSpeciesConfig {
  spriteCount: number;
  baseScale: number;
  scaleJitter: number;
  envelopeExponent: number;
  bottomFraction: number;
  topFraction: number;
  radiusRatio: number;
  rotationJitterRad: number;
  bottomBrightness: number;
  topBrightness: number;
}

export interface ForestCandidateSizeSpeciesConfig {
  minHeightMeters: number;
  maxHeightMeters: number;
  widthRatio: number;
}

export interface ForestCandidateConfig {
  mask: {
    url: string;
    extentMeters: number;
    size: number;
  };
  foliage: Record<ForestCandidateSpeciesId, ForestCandidateFoliageSourceConfig>;
  atlas: {
    cellSize: number;
    columns: number;
    variantsPerSpecies: number;
  };
  sprites: {
    alphaThreshold: number;
    minAreaPixels: number;
    maxSprites: number;
    paddingPixels: number;
  };
  crown: Record<ForestCandidateSpeciesId, ForestCandidateCrownSpeciesConfig>;
  placement: {
    seed: number;
    spacingMeters: number;
    jitterRatio: number;
    maxInstances: number;
    minCoverage: number;
    slopeFullDeg: number;
    slopeZeroDeg: number;
    routeClearanceMeters: number;
    routeDistanceCellMeters: number;
    coniferFraction: number;
    sinkMeters: number;
  };
  size: Record<ForestCandidateSpeciesId, ForestCandidateSizeSpeciesConfig>;
  material: {
    alphaTest: number;
    tintJitter: number;
    coniferTint: number;
    broadleafTint: number;
  };
}

export interface ForestCandidateSummary {
  enabled: boolean;
  instanceCount: number;
  coniferCount: number;
  broadleafCount: number;
  drawCalls: number;
  triangles: number;
  spacingMeters: number;
  densityScale: number;
  maxInstances: number;
  atlas: {
    cellSize: number;
    columns: number;
    rows: number;
    spriteCounts: Record<ForestCandidateSpeciesId, number>;
  };
  maskCoverageMean: number;
  timingsMs: {
    maskLoadMs: number;
    foliageLoadMs: number;
    atlasBakeMs: number;
    placementMs: number;
    meshBuildMs: number;
    totalMs: number;
  };
}
