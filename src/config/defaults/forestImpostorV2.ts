import type { ForestImpostorV2Config } from '../../forest/impostorV2/types';

import { assetUrl } from '../assetBase';

export const forestImpostorV2Defaults: ForestImpostorV2Config = {
  assets: {
    metaUrl: assetUrl('/data/forest/impostor-v2/impostor-atlas-meta.json'),
    treeAtlasUrl: assetUrl('/data/forest/impostor-v2/tree_atlas_2048.png'),
    groveAtlasUrl: assetUrl('/data/forest/impostor-v2/grove_atlas_3072x2048.png'),
    groveTopAtlasUrl: assetUrl('/data/forest/impostor-v2/grove_top_atlas_3072x2048.png'),
    groveTopMetaUrl: assetUrl('/data/forest/impostor-v2/grove_top_atlas_meta.json'),
  },
  mask: { url: assetUrl('/data/forest/takao-forest-mask.png'), extentMeters: 5940.950684, size: 1024 },
  cellSelection: {
    grove: { configs: ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'], yawDegrees: [0, 90, 180, 270] },
    tree: { variants: ['FIR_A', 'FIR_C', 'BL'], yawDegrees: [0, 90, 180, 270] },
  },
  macro: {
    seed: 20260913,
    cellMeters: 96,
    reliefRadiusMeters: 120,
    reliefReferenceMeters: 25,
    minCoverage: 0.35,
    minCoverageEdge: 0.15,
    slopeFullDeg: 40,
    slopeZeroDeg: 60,
    slopeStepMeters: 16,
    patchNoiseScaleCells: 3,
    patchThreshold: { near: 0.05, mid: 0.28, ridge: 0.45 },
    ridgeScoreMin: 0.35,
  },
  corridor: {
    nearMeters: 150, farMeters: 600, ridgeMeters: 1800,
    routeClearanceMeters: 10,
    clearanceFootprintFactor: 0.6,
    exclusionCellMeters: 8, exclusionMaxMeters: 32,
    corridorCellMeters: 96, corridorMaxMeters: 1920, corridorRouteStride: 4,
  },
  grove: {
    spacingNearMeters: 16, spacingFarMeters: 30, spacingRidgeMeters: 44,
    patchSpacingBoost: 0.35, minSpacingRatio: 0.62,
    scaleMin: 0.85, scaleMax: 1.25,
    ridgeScalePenalty: 0.18, slopeScalePenalty: 0.25,
    sinkBaseMeters: 0.5, slopeSinkFactor: 0.55,
    dartAttemptsPerTarget: 8,
    speciesGroups: {
      conifer: ['G1', 'G3'], mixed: ['G2', 'G4', 'G6'], broadleaf: ['G5', 'G6'],
    },
    speciesGroupSplit: { conifer: 0.45, mixed: 0.80 },
  },
  tree: {
    enabled: true,
    spacingMeters: 26, minSpacingRatio: 0.62,
    nearRouteMeters: 120, patchEdgeBand: 0.08, ridgeScoreMin: 0.5,
    groveClearanceMeters: 6,
    variantWeights: { FIR_A: 0.40, FIR_C: 0.35, BL: 0.25 },
    nearRouteBroadleafFraction: 0.5,
    scaleMin: 0.80, scaleMax: 1.15,
    slopeScalePenalty: 0.15,
    sinkBaseMeters: 0.3, slopeSinkFactor: 0.35,
    dartAttemptsPerTarget: 8,
  },
  material: { groveAlphaTest: 0.45, treeAlphaTest: 0.50, tintJitter: 0 },
  limits: { maxPrimitives: 40000, maxGrovePrimitives: 30000, maxTreePrimitives: 14000 },
};
