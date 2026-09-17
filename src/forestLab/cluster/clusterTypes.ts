export const CANDIDATE_IDS = [0, 1, 2, 3, 4, 5] as const;
export const MAIN_COMPARISON_CANDIDATE_IDS = [0, 4, 5] as const;
export const LEGACY_CANDIDATE_IDS = [1, 2, 3] as const;
export const CANDIDATE_NAMES = {
  0: 'CONTROL',
  1: 'SHELL_BASE',
  2: 'SHELL_CROWN_FIELD',
  3: 'HYBRID',
  4: 'CLUSTER_ONLY',
  5: 'HIERARCHICAL_FOREST',
} as const;

export const MEMBER_KIND_GROVE = 0 as const;
export const MEMBER_KIND_TREE = 1 as const;

export function isClusterCandidate(id: number): boolean {
  return id === 4 || id === 5;
}

export function usesFarCanopyLayer(id: number): boolean {
  return id === 5;
}

export interface ClusterPlacementStats {
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
  meanSquareFootprintWidth: number;
  meanFootprintWidth: number;
  meanColorLuminanceMultiplier: number;
}

type LegacyClusterPlacementStats = Omit<
  ClusterPlacementStats,
  'meanSquareFootprintWidth' | 'meanFootprintWidth'
>;

export interface ClusterPlacementResult {
  clusterCount: number;
  memberCount: number;
  clusterX: Float32Array;
  clusterY: Float32Array;
  clusterZ: Float32Array;
  clusterRadiusA: Float32Array;
  clusterRadiusB: Float32Array;
  clusterRotation: Float32Array;
  clusterFamily: Uint8Array;
  clusterMemberStart: Uint32Array;
  memberX: Float32Array;
  memberY: Float32Array;
  memberZ: Float32Array;
  memberScale: Float32Array;
  memberMirrored: Uint8Array;
  memberKind: Uint8Array;
  memberCellSlot: Uint16Array;
  memberCluster: Uint32Array;
  memberFamily: Uint8Array;
  memberColorR: Float32Array;
  memberColorG: Float32Array;
  memberColorB: Float32Array;
  stats: ClusterPlacementStats | LegacyClusterPlacementStats;
}
