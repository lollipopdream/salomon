import type { AppearanceId } from './appearance/appearanceModel';

export type { AppearanceId } from './appearance/appearanceModel';

export type CandidateId = 0 | 1 | 2 | 3 | 4 | 5;
export type CameraId = 'PRIMARY' | 'OVERVIEW' | 'CLOSE';
export type PatchId = 'A' | 'B';

export interface PatchSpec {
  id: PatchId;
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
}

export interface Vec3Record {
  x: number;
  y: number;
  z: number;
}

export interface PatchManifestPatch extends PatchSpec {
  worldBbox: {
    xMin: number;
    xMax: number;
    zMin: number;
    zMax: number;
    yMin: number;
    yMax: number;
  };
  uvBbox: { u0: number; u1: number; v0: number; v1: number };
  maskBbox: {
    colStart: number;
    colEnd: number;
    rowStart: number;
    rowEnd: number;
  };
  metrics: {
    maskCoverage: number;
    forestFraction: number;
    nonForestFraction: number;
    boundaryDensity: number;
    ridgeFraction: number;
    valleyFraction: number;
    meanSlopeDeg: number;
    reliefRangeMeters: number;
    primaryVisible: number;
    overviewVisible: number;
    routeCoverage: number;
    routePointsInside: number;
  };
  score: number;
  scoreTerms: {
    m1: number;
    m2: number;
    m3: number;
    m4: number;
    m5: number;
    m6: number;
    m7: number;
    m8: number;
  };
  constraintsMet: { H1: boolean; H2: boolean; H3: boolean; H4: boolean; H5: boolean };
  selectionReason: string;
}

export interface PatchManifest {
  schemaVersion: 1;
  phase: 'matsu-h01-takao-forest-visual-lab-architecture-bakeoff';
  canonical: {
    rows: number;
    cols: number;
    cellSizeMeters: number;
    terrainUvExtentMeters: number;
    maskExtentMeters: number;
    maskSize: number;
    maskSha256: string;
    demTiles: string[];
    bounds: { north: number; south: number; west: number; east: number };
  };
  globalStats: {
    Lt: number;
    gRidge: number;
    gValley: number;
    gSlopeDeg: number;
    reliefRangeMedianOfCandidates: number;
  };
  search: { sizeCells: number; stride: number; candidates: number; survivors: number };
  patches: PatchManifestPatch[];
  patchBDecision: {
    required: boolean;
    nonForestFraction: number;
    threshold: number;
    boundaryDensity: number;
    boundaryThreshold: number;
    reason: string;
  };
  closeCamera: {
    anchor: { row: number; col: number; x: number; y: number; z: number };
    position: Vec3Record;
    target: Vec3Record;
    fov: number;
    groundClearanceApplied: boolean;
  };
  cameraTargetAdjustment: {
    PRIMARY: Vec3Record;
    OVERVIEW: Vec3Record;
  };
  derived: {
    forestAreaSquareMeters: number;
    detailMaxCount: number;
    crownLatticeCols: number;
    crownCountNote: string;
  };
}

export interface ForestLabRuntimeState {
  appearance: AppearanceId;
  crownCount: number;
  shellVertexCount: number;
  shellTriangleCount: number;
  detailCount: number;
  cluster?: ClusterRuntimeStats;
  farCanopy?: FarCanopyRuntimeStats;
}

export interface ForestLabRuntimeConfig {
  appearance: AppearanceId;
  crownCount: number | null;
  crownLatticeCols: number;
  shellVertexCount: number | null;
  shellTriangleCount: number | null;
  detailCount: number | null;
  cluster?: ClusterRuntimeStats | null;
  farCanopy?: FarCanopyRuntimeStats | null;
}

export interface CandidateTelemetry {
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  estimatedInstanceBytes: number;
  shellVertexCount: number;
  shellTriangleCount: number;
  buildMs: number;
  assetMs: number;
  medianRafFrameIntervalMs: number;
  p95RafFrameIntervalMs: number;
  instanceCount?: number;
  clusterCount?: number;
  memberCount?: number;
}

export interface ForestLabCandidateConfig {
  schemaVersion: 1;
  phase:
    | 'matsu-h01-takao-forest-visual-lab-architecture-bakeoff'
    | 'matsu-h01-forest-lab-reference-locked-cluster-hlod-prototype'
    | 'matsu-h01-forest-lab-reference-appearance-convergence-v1';
  patchManifest: PatchManifest;
  constants: Readonly<Record<string, unknown>>;
  runtime?: ForestLabRuntimeConfig;
}

export interface ClusterRuntimeStats {
  clusterLatticeCols: number;
  clusterCandidateCount: number;
  clusterAcceptedCount: number;
  memberPlacedCount: number;
  memberRejectedByMaskCount: number;
  memberRejectedByBboxCount: number;
  groveInstanceCount: number;
  treeInstanceCount: number;
  familyClusterCounts: [number, number, number];
  meanSquareScale: number;
  meanColorLuminanceMultiplier: number;
  atlasCellMeshCount: number;
  visibleInstanceCount: number;
}

export interface FarCanopyRuntimeStats {
  textureSha256: string | null;
  textureWidth: number;
  textureHeight: number;
  overlayVertexCount: number;
  overlayTriangleCount: number;
}
