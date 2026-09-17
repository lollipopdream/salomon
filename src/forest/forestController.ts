import type * as THREE from 'three';

import type { ForestConfig, ForestFlags, ForestVariantId } from '../types';
import { createBillboardForest } from './billboardForest';
import type { ForestVariantBuild } from './forestBuild';
import { createCanopyClusterForest } from './canopyClusterForest';
import { createInstancedTreeForest } from './instancedTreeForest';
import { createForestPlacement } from './forestPlacement';
import {
  createTerrainHeightSampler,
  type TerrainGridLike,
} from './terrainHeightSampler';

export interface ForestControllerDeps {
  scene: THREE.Scene;
  grid: TerrainGridLike;
  routePointsXZ: readonly { x: number; z: number }[];
  elevationScale: number;
  config: ForestConfig;
  flags: ForestFlags;
  now?: () => number;
}

export interface ForestSummary {
  variantId: ForestVariantId;
  enabled: boolean;
  instanceCount: number;
  trianglesPerInstance: number;
  totalTriangles: number;
  drawCalls: number;
  instanceMatrixBytes: number;
  textureBytes: number;
  buildElapsedMs: number;
  placementElapsedMs: number;
  placement?: {
    candidateCells: number;
    accepted: number;
    kept: number;
    thinned: boolean;
    aabb: { minX: number; minZ: number; maxX: number; maxZ: number };
  };
}

export interface ForestController {
  readonly summary: ForestSummary;
  dispose(): void;
}

const nowByPerformance = (): number => performance.now();

export function createForestController(deps: ForestControllerDeps): ForestController {
  if (!deps.flags.enabled) {
    return {
      summary: {
        variantId: 'none',
        enabled: false,
        instanceCount: 0,
        trianglesPerInstance: 0,
        totalTriangles: 0,
        drawCalls: 0,
        instanceMatrixBytes: 0,
        textureBytes: 0,
        buildElapsedMs: 0,
        placementElapsedMs: 0,
      },
      dispose(): void {},
    };
  }

  const now = deps.now ?? nowByPerformance;
  const sampleHeight = createTerrainHeightSampler(deps.grid, deps.elevationScale);
  const placementStartedAt = now();
  const placement = createForestPlacement({
    routePointsXZ: deps.routePointsXZ,
    sampleHeight,
    config: deps.config.placement,
    budget: selectBudget(deps),
  });
  const placementElapsedMs = now() - placementStartedAt;
  const buildStartedAt = now();
  const build = createVariantBuild(deps, placement, now);
  const buildElapsedMs = now() - buildStartedAt;
  deps.scene.add(build.object3D);

  return {
    summary: {
      ...build.stats,
      enabled: true,
      buildElapsedMs,
      placementElapsedMs,
      placement: {
        candidateCells: placement.stats.candidateCells,
        accepted: placement.stats.accepted,
        kept: placement.stats.kept,
        thinned: placement.stats.thinned,
        aabb: placement.stats.aabb,
      },
    },
    dispose(): void {
      build.dispose();
    },
  };
}

function selectBudget(deps: ForestControllerDeps) {
  if (deps.flags.usesInstancedTrees) return deps.config.tree.budget;
  if (deps.flags.usesBillboardCards) return deps.config.billboard.budget;
  return deps.config.canopy.budget;
}

function createVariantBuild(
  deps: ForestControllerDeps,
  placement: Parameters<typeof createInstancedTreeForest>[0],
  now: () => number,
): ForestVariantBuild {
  if (deps.flags.usesInstancedTrees) {
    return createInstancedTreeForest(placement, deps.config.tree, now);
  }
  if (deps.flags.usesBillboardCards) {
    return createBillboardForest(placement, deps.config.billboard, now);
  }
  return createCanopyClusterForest(placement, deps.config.canopy, now);
}
