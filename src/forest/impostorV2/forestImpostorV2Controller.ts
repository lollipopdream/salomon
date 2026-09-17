import * as THREE from 'three';

import { computePlacementMacroShade, DEFAULT_MACRO_SHADE_CONFIG } from '../macroShade';
import { buildRouteDistanceField, sampleRouteDistance } from '../routeDistanceField';
import { createTerrainHeightSampler, type TerrainGridLike } from '../terrainHeightSampler';
import { loadForestMaskV2 } from './forestMaskV2';
import {
  loadGroveTopCapAssets,
  type GroveTopCapAssets,
} from './groveTopCapAssets';
import { createGroveTopCapMapping } from './groveTopCapMeta';
import {
  createGroveTopCapMaterial,
  createGroveTopCapMeshes,
  type GroveTopCapMeshBuild,
} from './groveTopCapMeshes';
import { loadImpostorAssets, type ImpostorAssets } from './impostorAssets';
import { createImpostorMaterial } from './impostorMaterial';
import { createImpostorMeshes, type ImpostorMeshBuild } from './impostorMeshes';
import { createImpostorPlacement } from './impostorPlacement';
import { buildMacroForestField } from './macroForestField';
import { computePlacementCanopyTints } from './r10CanopyTint';
import type {
  ForestImpostorV2Config,
  ForestImpostorV2Flags,
  ForestImpostorV2Summary,
  ImpostorAtlasId,
  ImpostorMaterialMode,
} from './types';

export interface ForestImpostorV2Controller {
  readonly summary: ForestImpostorV2Summary;
  readonly object3D: THREE.Object3D;
  getMaterialMode(): ImpostorMaterialMode;
  setMaterialMode(mode: ImpostorMaterialMode): boolean;
  setMaterialMode(mode: string): boolean;
  setTopCapVisible(visible: boolean): boolean;
  getTopCapVisible(): boolean;
  dispose(): void;
}

type ImpostorMaterial = THREE.MeshLambertMaterial | THREE.MeshBasicMaterial;
type ImpostorMaterialSet = Partial<Record<ImpostorMaterialMode, ImpostorMaterial>>;

let activeInstance: ForestImpostorV2Controller | undefined;

export async function createForestImpostorV2(deps: {
  scene: THREE.Scene;
  grid: TerrainGridLike;
  elevationScale: number;
  routePointsXZ: readonly { x: number; z: number }[];
  config: ForestImpostorV2Config;
  flags: ForestImpostorV2Flags;
  loadMask?: typeof loadForestMaskV2;
  loadAssets?: typeof loadImpostorAssets;
  loadTopCapAssets?: typeof loadGroveTopCapAssets;
  now?: () => number;
}): Promise<ForestImpostorV2Controller | undefined> {
  const { scene, grid, elevationScale, routePointsXZ, config, flags } = deps;
  if (!flags.enabled) return undefined;

  if (activeInstance) {
    console.warn('[forest-impostor-v2] an active instance already exists');
    return undefined;
  }

  const clock = deps.now ?? Date.now;
  const totalStart = clock();
  let assets: ImpostorAssets | undefined;
  let meshBuild: ImpostorMeshBuild | undefined;
  let topCapAssets: GroveTopCapAssets | undefined;
  let topCapMeshBuild: GroveTopCapMeshBuild | undefined;
  let topCapMaterial: THREE.MeshBasicMaterial | undefined;
  const materials: Partial<Record<ImpostorAtlasId, ImpostorMaterialSet>> = {};
  let addedToScene = false;

  try {
    const assetsStart = clock();
    assets = await (deps.loadAssets ?? loadImpostorAssets)({ config, kinds: flags.kinds });
    const metaMs = clock() - assetsStart;

    // metadata fetch と texture load は loader 内で 1 操作として行われるため、
    // 両者を分離して計測できない。合算値は metaMs が保持する。
    // textureMs は「分離計測できない」ことを 0 で明示する(偽の計測値を出さない)。
    // 内訳が必要になったら loadImpostorAssets 側に計時を返させること。
    const requestedAtlases: readonly ImpostorAtlasId[] = flags.kinds === 'both'
      ? ['grove', 'tree']
      : [flags.kinds];
    const loadedAtlases = requestedAtlases.filter((atlas) => assets!.textures[atlas]);
    const textureMs = 0;

    const maskStart = clock();
    const mask = await (deps.loadMask ?? loadForestMaskV2)(
      config.mask.url,
      config.mask.size,
      config.mask.extentMeters,
    );
    const maskMs = clock() - maskStart;
    if (mask.size !== config.mask.size || mask.coverage.length !== config.mask.size * config.mask.size) {
      throw new Error('[forest-impostor-v2] loaded mask size does not match config');
    }

    const sampleHeight = createTerrainHeightSampler(grid, elevationScale);

    const routeStart = clock();
    const exclusionField = buildRouteDistanceField(
      routePointsXZ,
      config.corridor.exclusionCellMeters,
      config.corridor.exclusionMaxMeters,
      config.corridor.exclusionMaxMeters,
    );
    const stride = Math.max(1, Math.floor(config.corridor.corridorRouteStride));
    const stridedRoute = routePointsXZ.filter((_, index) => index % stride === 0);
    const corridorField = buildRouteDistanceField(
      stridedRoute,
      config.corridor.corridorCellMeters,
      config.corridor.corridorMaxMeters,
      config.corridor.corridorMaxMeters,
    );
    const routeExclusionDistance = (x: number, z: number): number => sampleRouteDistance(exclusionField, x, z);
    const corridorDistance = (x: number, z: number): number => sampleRouteDistance(corridorField, x, z);
    const routeFieldMs = clock() - routeStart;

    const macroStart = clock();
    const field = buildMacroForestField({
      mask,
      sampleHeight,
      corridorDistance,
      config,
      densityScale: flags.densityScale,
    });
    const macroFieldMs = clock() - macroStart;

    const placementStart = clock();
    const placement = createImpostorPlacement({
      field,
      cells: assets.cells,
      mask,
      sampleHeight,
      routeExclusionDistance,
      config,
      flags,
      now: deps.now,
    });
    const placementMs = clock() - placementStart;
    if (placement.count === 0) {
      throw new Error('[forest-impostor-v2] placement produced no instances');
    }
    const shades = flags.macroShade === true
      ? computePlacementMacroShade(
        { ...DEFAULT_MACRO_SHADE_CONFIG, enabled: true },
        sampleHeight,
        placement.positions,
        placement.count,
      )
      : undefined;
    const tints = flags.r10Broad === true && shades !== undefined
      ? computePlacementCanopyTints(
        placement.positions,
        placement.count,
        config.macro.seed,
        undefined,
        shades,
      )
      : undefined;

    const groveAlphaTest = flags.alphaTestOverride ?? config.material.groveAlphaTest;
    const treeAlphaTest = flags.alphaTestOverride ?? config.material.treeAlphaTest;
    const initialMaterialMode: ImpostorMaterialMode = flags.materialMode === 'unlit' ? 'unlit' : 'lambert';
    for (const atlas of loadedAtlases) {
      const texture = assets.textures[atlas]!;
      const materialSet: ImpostorMaterialSet = {};
      materials[atlas] = materialSet;
      materialSet.lambert = createImpostorMaterial(
        texture,
        atlas === 'grove' ? groveAlphaTest : treeAlphaTest,
        atlas,
        'lambert',
        flags.r10Tone === true,
        flags.r10Air === true,
      );
      materialSet.unlit = createImpostorMaterial(
        texture,
        atlas === 'grove' ? groveAlphaTest : treeAlphaTest,
        atlas,
        'unlit',
        flags.r10Tone === true,
        flags.r10Air === true,
      );
    }

    const meshStart = clock();
    meshBuild = createImpostorMeshes({
      placement,
      cells: assets.cells,
      shades,
      tints,
      materialFor: (cell) => {
        const material = materials[cell.kind]?.[initialMaterialMode];
        if (!material) throw new Error(`[forest-impostor-v2] missing material for ${cell.kind}`);
        return material;
      },
    });
    const meshBuildMs = clock() - meshStart;

    const topCapRequested = flags.topCap === true;
    const topAtlasFile = config.assets.groveTopAtlasUrl?.split('/').pop() ?? '';
    const topCapSummary: NonNullable<ForestImpostorV2Summary['topCap']> = {
      requested: topCapRequested,
      active: false,
      primitiveCount: 0,
      drawCalls: 0,
      triangles: 0,
      vertices: 0,
      cellCount: 0,
      alphaTest: config.material.groveAlphaTest,
      atlas: {
        file: topAtlasFile,
        width: 3072,
        height: 2048,
        estimatedBytesWithMips: 3072 * 2048 * 4 * 4 / 3,
      },
      capHeightMethod: '',
      capHeightWorldByConfig: {},
    };

    if (topCapRequested && initialMaterialMode !== 'unlit') {
      topCapSummary.disabledReason = 'material-not-unlit';
      console.warn('[forest-impostor-v2] top cap requires forestImpostorV2Material=unlit; top cap disabled');
    } else if (topCapRequested) {
      try {
        const result = await (deps.loadTopCapAssets ?? loadGroveTopCapAssets)({ config });
        if (!result.ok) {
          topCapSummary.disabledReason = result.reason;
        } else {
          topCapAssets = result;
          const mapping = createGroveTopCapMapping(result.meta, assets.cells);
          if (!mapping) {
            topCapSummary.disabledReason = 'mapping-invalid';
            topCapAssets.dispose();
            topCapAssets = undefined;
          } else {
            try {
              topCapMaterial = createGroveTopCapMaterial(
                result.texture,
                config.material.groveAlphaTest,
                flags.r10Tone === true,
                flags.r10Air === true,
              );
              topCapMeshBuild = createGroveTopCapMeshes({
                placement,
                cells: assets.cells,
                mapping,
                material: topCapMaterial,
                shades,
                tints,
              });
              meshBuild.object3D.add(topCapMeshBuild.object3D);
              const capHeightWorldByConfig: Record<string, number> = {};
              for (const cell of result.meta.cells) {
                if (capHeightWorldByConfig[cell.groveConfig] === undefined) {
                  capHeightWorldByConfig[cell.groveConfig] = cell.capHeightWorld;
                }
              }
              topCapSummary.active = true;
              topCapSummary.primitiveCount = topCapMeshBuild.stats.primitiveCount;
              topCapSummary.drawCalls = topCapMeshBuild.stats.drawCalls;
              topCapSummary.triangles = topCapMeshBuild.stats.triangles;
              topCapSummary.vertices = topCapMeshBuild.stats.vertices;
              topCapSummary.cellCount = result.meta.cells.length;
              topCapSummary.atlas = {
                file: result.meta.atlas.file,
                width: result.meta.atlas.width,
                height: result.meta.atlas.height,
                estimatedBytesWithMips: result.meta.atlas.width * result.meta.atlas.height * 4 * 4 / 3,
              };
              topCapSummary.capHeightMethod = result.meta.capHeightMethod;
              topCapSummary.capHeightWorldByConfig = capHeightWorldByConfig;
            } catch {
              topCapMeshBuild?.dispose();
              topCapMeshBuild = undefined;
              topCapMaterial?.dispose();
              topCapMaterial = undefined;
              topCapAssets.dispose();
              topCapAssets = undefined;
              topCapSummary.disabledReason = 'build-failed';
            }
          }
        }
      } catch {
        topCapMeshBuild?.dispose();
        topCapMeshBuild = undefined;
        topCapMaterial?.dispose();
        topCapMaterial = undefined;
        topCapAssets?.dispose();
        topCapAssets = undefined;
        topCapSummary.disabledReason = 'meta-load-failed';
      }
    }

    scene.add(meshBuild.object3D);
    addedToScene = true;

    let coverageTotal = 0;
    for (const value of mask.coverage) coverageTotal += value;
    const summary: ForestImpostorV2Summary = {
      enabled: true,
      flags,
      primitives: {
        total: placement.count,
        grove: placement.stats.groveCount,
        tree: placement.stats.treeCount,
      },
      perCell: meshBuild.stats.perCell,
      render: {
        drawCalls: meshBuild.stats.drawCalls,
        triangles: meshBuild.stats.triangles,
        vertices: meshBuild.stats.vertices,
        instanceBytes: meshBuild.stats.instanceBytes,
        materials: loadedAtlases.length,
        geometries: meshBuild.meshes.length,
      },
      textures: loadedAtlases.map((atlas) => {
        const info = assets!.meta.atlases[atlas];
        return {
          atlas,
          width: info.width,
          height: info.height,
          estimatedBytesWithMips: info.width * info.height * 4 * 4 / 3,
        };
      }),
      macro: field.stats,
      macroShadeStats: shades ? summarizeMacroShade(shades) : undefined,
      placement: placement.stats,
      limits: {
        maxPrimitives: flags.maxPrimitivesOverride ?? config.limits.maxPrimitives,
        thinned: placement.stats.thinned,
      },
      material: { groveAlphaTest, treeAlphaTest, mode: initialMaterialMode },
      maskCoverageMean: coverageTotal / mask.coverage.length / 255,
      topCap: topCapSummary,
      timingsMs: {
        metaMs,
        textureMs,
        maskMs,
        routeFieldMs,
        macroFieldMs,
        placementMs,
        meshBuildMs,
        totalMs: clock() - totalStart,
      },
    };

    let disposed = false;
    let materialMode = initialMaterialMode;
    const controller: ForestImpostorV2Controller = {
      summary,
      object3D: meshBuild.object3D,
      getMaterialMode(): ImpostorMaterialMode {
        return materialMode;
      },
      setMaterialMode(mode: string): boolean {
        if (disposed) return false;
        if (mode !== 'lambert' && mode !== 'unlit') return false;
        if (mode === materialMode) return true;
        const replacements = meshBuild!.meshes.map((mesh) => {
          for (const materialSet of Object.values(materials)) {
            if (mesh.material === materialSet[materialMode]) return materialSet[mode];
          }
          return undefined;
        });
        if (replacements.some((material) => !material)) return false;
        meshBuild!.meshes.forEach((mesh, index) => {
          mesh.material = replacements[index]!;
        });
        materialMode = mode;
        return true;
      },
      setTopCapVisible(visible: boolean): boolean {
        if (disposed || !topCapMeshBuild || !topCapSummary.active) return false;
        topCapMeshBuild.object3D.visible = visible;
        return true;
      },
      getTopCapVisible(): boolean {
        return !disposed && topCapSummary.active && topCapMeshBuild?.object3D.visible === true;
      },
      dispose(): void {
        if (disposed) return;
        disposed = true;
        topCapMeshBuild?.dispose();
        topCapMaterial?.dispose();
        topCapAssets?.dispose();
        meshBuild!.dispose();
        for (const materialSet of Object.values(materials)) {
          for (const material of Object.values(materialSet)) material.dispose();
        }
        assets!.dispose();
        controller.object3D.removeFromParent();
        if (activeInstance === controller) activeInstance = undefined;
      },
    };
    activeInstance = controller;
    return controller;
  } catch (error) {
    topCapMeshBuild?.dispose();
    topCapMaterial?.dispose();
    topCapAssets?.dispose();
    meshBuild?.dispose();
    for (const materialSet of Object.values(materials)) {
      for (const material of Object.values(materialSet)) material.dispose();
    }
    assets?.dispose();
    if (addedToScene && meshBuild) scene.remove(meshBuild.object3D);
    console.warn('[forest-impostor-v2] creation failed; keeping the existing scene unchanged', error);
    return undefined;
  }
}

function summarizeMacroShade(shades: Float32Array): NonNullable<ForestImpostorV2Summary['macroShadeStats']> {
  let sum = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let shadeMinCount = 0;
  let shadeMaxCount = 0;
  for (const shade of shades) {
    sum += shade;
    min = Math.min(min, shade);
    max = Math.max(max, shade);
    if (Math.abs(shade - DEFAULT_MACRO_SHADE_CONFIG.shadeMin) <= 1e-6) shadeMinCount += 1;
    if (Math.abs(shade - DEFAULT_MACRO_SHADE_CONFIG.shadeMax) <= 1e-6) shadeMaxCount += 1;
  }
  return {
    mean: sum / shades.length,
    min,
    max,
    shadeMinFraction: shadeMinCount / shades.length,
    shadeMaxFraction: shadeMaxCount / shades.length,
  };
}
