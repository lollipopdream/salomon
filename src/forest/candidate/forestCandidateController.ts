import * as THREE from 'three';

import { bakeCanopyCardAtlas, type CanopyCardAtlasResult } from './canopyCardAtlas';
import { createCanopyCardMeshes, type CanopyCardMeshBuild } from './canopyCardMesh';
import { createForestCandidatePlacement } from './forestCandidatePlacement';
import { decodeForestMaskFromRgba } from './forestMask';
import { extractAlphaChannel, extractSpriteRects } from './foliageSprites';
import {
  createTerrainHeightSampler,
  type TerrainGridLike,
} from '../terrainHeightSampler';
import type {
  ForestCandidateConfig,
  ForestCandidateFlags,
  ForestCandidateSpeciesId,
  ForestCandidateSummary,
} from './types';

export type ForestCandidateImage = CanvasImageSource & { width: number; height: number };

export interface ForestCandidateController {
  readonly summary: ForestCandidateSummary;
  readonly object3D: THREE.Object3D;
  dispose(): void;
}

export async function createForestCandidate(deps: {
  scene: THREE.Scene;
  grid: TerrainGridLike;
  elevationScale: number;
  routePointsXZ: readonly { x: number; z: number }[];
  config: ForestCandidateConfig;
  flags: ForestCandidateFlags;
  loadImage?: (url: string) => Promise<ForestCandidateImage>;
  readPixels?: (
    image: ForestCandidateImage,
    width: number,
    height: number,
  ) => Uint8ClampedArray;
  bakeAtlas?: typeof bakeCanopyCardAtlas;
  now?: () => number;
}): Promise<ForestCandidateController | undefined> {
  if (!deps.flags.enabled) return undefined;

  const now = deps.now ?? (() => performance.now());
  const loadImage = deps.loadImage ?? loadBrowserImage;
  const readPixels = deps.readPixels ?? readBrowserPixels;
  const bakeAtlas = deps.bakeAtlas ?? bakeCanopyCardAtlas;
  const totalStartedAt = now();
  let atlas: CanopyCardAtlasResult | undefined;
  let meshBuild: CanopyCardMeshBuild | undefined;

  try {
    const maskStartedAt = now();
    const maskImage = await loadImage(deps.config.mask.url);
    if (maskImage.width !== deps.config.mask.size || maskImage.height !== deps.config.mask.size) {
      throw new Error(
        `Mask size mismatch: expected ${deps.config.mask.size}x${deps.config.mask.size}, `
        + `received ${maskImage.width}x${maskImage.height}.`,
      );
    }
    const mask = decodeForestMaskFromRgba(
      readPixels(maskImage, maskImage.width, maskImage.height),
      deps.config.mask.size,
      deps.config.mask.extentMeters,
    );
    const maskLoadMs = now() - maskStartedAt;

    const foliageStartedAt = now();
    const speciesOrder: readonly ForestCandidateSpeciesId[] = ['conifer', 'broadleaf'];
    const loadedSources = await Promise.all(speciesOrder.map(async (species) => {
      const sourceConfig = deps.config.foliage[species];
      const [diff, alpha] = await Promise.all([
        loadImage(sourceConfig.diffUrl),
        loadImage(sourceConfig.alphaUrl),
      ]);
      if (diff.width !== alpha.width || diff.height !== alpha.height) {
        throw new Error(
          `${species} diffuse/alpha size mismatch: `
          + `${diff.width}x${diff.height} versus ${alpha.width}x${alpha.height}.`,
        );
      }
      const alphaChannel = extractAlphaChannel(
        readPixels(alpha, alpha.width, alpha.height),
      );
      const spriteRects = extractSpriteRects(
        alphaChannel,
        alpha.width,
        alpha.height,
        deps.config.sprites,
      );
      if (spriteRects.length === 0) {
        throw new Error(`No ${species} foliage sprites passed extraction thresholds.`);
      }
      return { species, diff, alpha, spriteRects };
    }));
    const foliageLoadMs = now() - foliageStartedAt;

    const atlasStartedAt = now();
    atlas = bakeAtlas({
      sources: loadedSources,
      config: deps.config,
      seed: deps.config.placement.seed,
    });
    const atlasBakeMs = now() - atlasStartedAt;

    const placementStartedAt = now();
    const placement = createForestCandidatePlacement({
      mask,
      sampleHeight: createTerrainHeightSampler(deps.grid, deps.elevationScale),
      routePointsXZ: deps.routePointsXZ,
      config: deps.config,
      flags: deps.flags,
      now,
    });
    const placementMs = now() - placementStartedAt;
    if (placement.count === 0) throw new Error('Forest mask and placement rules produced zero instances.');

    const meshStartedAt = now();
    meshBuild = createCanopyCardMeshes({
      placement,
      atlas,
      config: deps.config,
    });
    const meshBuildMs = now() - meshStartedAt;
    const spacingMeters = deps.flags.spacingMetersOverride ?? deps.config.placement.spacingMeters;
    const maxInstances = deps.flags.maxInstancesOverride ?? deps.config.placement.maxInstances;
    const summary: ForestCandidateSummary = {
      enabled: true,
      instanceCount: placement.count,
      coniferCount: placement.stats.coniferCount,
      broadleafCount: placement.stats.broadleafCount,
      drawCalls: meshBuild.stats.drawCalls,
      triangles: meshBuild.stats.triangles,
      spacingMeters,
      densityScale: deps.flags.densityScale,
      maxInstances,
      atlas: {
        cellSize: atlas.cellSize,
        columns: atlas.columns,
        rows: atlas.rows,
        spriteCounts: {
          conifer: loadedSources[0].spriteRects.length,
          broadleaf: loadedSources[1].spriteRects.length,
        },
      },
      maskCoverageMean: meanCoverage(mask.coverage),
      timingsMs: {
        maskLoadMs,
        foliageLoadMs,
        atlasBakeMs,
        placementMs,
        meshBuildMs,
        totalMs: now() - totalStartedAt,
      },
    };
    deps.scene.add(meshBuild.object3D);
    let disposed = false;

    return {
      summary,
      object3D: meshBuild.object3D,
      dispose(): void {
        if (disposed) return;
        disposed = true;
        meshBuild?.dispose();
        atlas?.dispose();
      },
    };
  } catch (error) {
    meshBuild?.dispose();
    atlas?.dispose();
    console.warn('[forest-candidate] Failed to create candidate:', error);
    return undefined;
  }
}

function meanCoverage(coverage: Uint8Array): number {
  if (coverage.length === 0) return 0;
  let total = 0;
  for (const value of coverage) total += value;
  return total / coverage.length / 255;
}

function loadBrowserImage(url: string): Promise<ForestCandidateImage> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load forest candidate image: ${url}`));
    image.src = url;
  });
}

function readBrowserPixels(
  image: ForestCandidateImage,
  width: number,
  height: number,
): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Forest candidate pixel canvas 2D context is unavailable.');
  context.drawImage(image, 0, 0, width, height);
  return context.getImageData(0, 0, width, height).data;
}
