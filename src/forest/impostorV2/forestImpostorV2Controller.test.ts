// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createForestImpostorV2, type ForestImpostorV2Controller } from './forestImpostorV2Controller';
import type { GroveTopCapAssetsResult } from './groveTopCapAssets';
import type { GroveTopCapCell, GroveTopCapMeta } from './groveTopCapMeta';
import type { ImpostorAssets } from './impostorAssets';
import type {
  ForestImpostorV2Config,
  ForestImpostorV2Flags,
  ForestMaskV2Data,
  ImpostorAtlasMeta,
  ImpostorCellRef,
} from './types';

const controllers: ForestImpostorV2Controller[] = [];

afterEach(() => {
  for (const controller of controllers.splice(0)) controller.dispose();
  vi.restoreAllMocks();
});

function makeConfig(): ForestImpostorV2Config {
  return {
    assets: { metaUrl: '/meta.json', treeAtlasUrl: '/tree.png', groveAtlasUrl: '/grove.png',
      groveTopMetaUrl: '/grove-top.json', groveTopAtlasUrl: '/grove-top.png' },
    mask: { url: '/mask.png', extentMeters: 256, size: 16 },
    cellSelection: {
      grove: { configs: ['G1'], yawDegrees: [0] },
      tree: { variants: ['T1'], yawDegrees: [0] },
    },
    macro: {
      seed: 20260913, cellMeters: 64, reliefRadiusMeters: 64, reliefReferenceMeters: 20,
      minCoverage: 0.35, minCoverageEdge: 0.15, slopeFullDeg: 40, slopeZeroDeg: 60,
      slopeStepMeters: 8, patchNoiseScaleCells: 3,
      patchThreshold: { near: 0, mid: 0, ridge: 0 }, ridgeScoreMin: 0.35,
    },
    corridor: {
      nearMeters: 150, farMeters: 600, ridgeMeters: 1800,
      routeClearanceMeters: 10, clearanceFootprintFactor: 0.6,
      exclusionCellMeters: 8, exclusionMaxMeters: 32,
      corridorCellMeters: 96, corridorMaxMeters: 1920, corridorRouteStride: 4,
    },
    grove: {
      spacingNearMeters: 20, spacingFarMeters: 30, spacingRidgeMeters: 44,
      patchSpacingBoost: 0, minSpacingRatio: 0.62,
      scaleMin: 0.85, scaleMax: 1.25, ridgeScalePenalty: 0.18, slopeScalePenalty: 0.25,
      sinkBaseMeters: 0.5, slopeSinkFactor: 0.55, dartAttemptsPerTarget: 8,
      speciesGroups: { conifer: ['G1'], mixed: ['G1'], broadleaf: ['G1'] },
      speciesGroupSplit: { conifer: 0.45, mixed: 0.8 },
    },
    tree: {
      enabled: true, spacingMeters: 26, minSpacingRatio: 0.62,
      nearRouteMeters: 120, patchEdgeBand: 0.08, ridgeScoreMin: 0.5,
      groveClearanceMeters: 6, variantWeights: { T1: 1 }, nearRouteBroadleafFraction: 0.5,
      scaleMin: 0.8, scaleMax: 1.15, slopeScalePenalty: 0.15,
      sinkBaseMeters: 0.3, slopeSinkFactor: 0.35, dartAttemptsPerTarget: 8,
    },
    material: { groveAlphaTest: 0.45, treeAlphaTest: 0.5, tintJitter: 0 },
    limits: { maxPrimitives: 40000, maxGrovePrimitives: 30000, maxTreePrimitives: 14000 },
  };
}

function makeCell(kind: 'grove' | 'tree'): ImpostorCellRef {
  return {
    key: kind === 'grove' ? 'grove:G1:0' : 'tree:T1:0', kind, atlas: kind,
    groveConfig: kind === 'grove' ? 'G1' : null,
    sourceVariant: kind === 'tree' ? 'T1' : null,
    yawDeg: 0, uv: { u0: 0, v0: 0, u1: 1, v1: 1 },
    tightWorldWidth: kind === 'grove' ? 12 : 3,
    tightWorldHeight: kind === 'grove' ? 12 : 8,
    groundPivotInTight: { u: 0.5, v: 0 }, alphaCoverage: 0.5,
  };
}

function makeTopCell(groveConfig: string, bakedYaw: number, cellIndex: number): GroveTopCapCell {
  return {
    cellId: `GTOP_${groveConfig}_yaw${bakedYaw}`,
    matchingSideCellId: `${groveConfig}_yaw${bakedYaw}`,
    matchingSideCellIndex: cellIndex,
    cellIndex, row: Math.floor(cellIndex / 6), col: cellIndex % 6,
    groveConfig, bakedYaw, sourceCompositionDigest: `sha256:${groveConfig}`,
    uvRect: { u0: 0, v0: 0, u1: 1, v1: 1 },
    alphaTightBoundsUV: { u0: 0, v0: 0, u1: 1, v1: 1 },
    capHeightWorld: 10, tightWorldWidth: 12, tightWorldDepth: 12,
    tightWorldBounds: { rightMin: -6, rightMax: 6, depthMin: -6, depthMax: 6 },
  };
}

function makeTopMeta(): GroveTopCapMeta {
  const cells: GroveTopCapCell[] = [];
  for (const bakedYaw of [0, 90, 180, 270]) {
    for (let configIndex = 0; configIndex < 6; configIndex += 1) {
      const cellIndex = cells.length;
      cells.push(makeTopCell(`G${configIndex + 1}`, bakedYaw, cellIndex));
    }
  }
  return {
    schemaVersion: 1, kind: 'grove_top_cap', capHeightMethod: 'foliage_material_binned_max_mean',
    atlas: { file: 'grove-top.png', width: 3072, height: 2048, cellWidth: 512,
      cellHeight: 512, cols: 6, rows: 4, sha256: 'top' }, cells,
  };
}

function makeTopAssets(): { result: GroveTopCapAssetsResult; texture: THREE.Texture; dispose: ReturnType<typeof vi.fn> } {
  const texture = new THREE.Texture();
  const dispose = vi.fn(() => texture.dispose());
  return { result: { ok: true, meta: makeTopMeta(), texture, dispose }, texture, dispose };
}

function makeMeta(cells: readonly ImpostorCellRef[]): ImpostorAtlasMeta {
  return {
    schemaVersion: 1, pitchDeg: 0, cells,
    atlases: {
      grove: { id: 'grove', file: 'grove.png', width: 64, height: 32,
        cellWidth: 64, cellHeight: 32, cols: 1, rows: 1, sha256: 'g' },
      tree: { id: 'tree', file: 'tree.png', width: 32, height: 16,
        cellWidth: 32, cellHeight: 16, cols: 1, rows: 1, sha256: 't' },
    },
  };
}

function makeMask(value = 255, size = 16): ForestMaskV2Data {
  return { size, extentMeters: 256, coverage: new Uint8Array(size * size).fill(value) };
}

function makeAssets(kinds: ForestImpostorV2Flags['kinds'] = 'both') {
  const cells = kinds === 'grove' ? [makeCell('grove')]
    : kinds === 'tree' ? [makeCell('tree')] : [makeCell('grove'), makeCell('tree')];
  const grove = new THREE.Texture();
  const tree = new THREE.Texture();
  const textures = kinds === 'grove' ? { grove } : kinds === 'tree' ? { tree } : { grove, tree };
  const dispose = vi.fn(() => {
    for (const texture of Object.values(textures)) texture.dispose();
  });
  return { assets: { meta: makeMeta(cells), cells, textures, dispose } satisfies ImpostorAssets, grove, tree, dispose };
}

function makeDeps(options: {
  flags?: Partial<ForestImpostorV2Flags>;
  mask?: ForestMaskV2Data;
  assets?: ReturnType<typeof makeAssets>;
  topAssets?: ReturnType<typeof makeTopAssets>;
  topFailure?: Exclude<GroveTopCapAssetsResult, { ok: true }>;
} = {}) {
  const config = makeConfig();
  const flags: ForestImpostorV2Flags = {
    enabled: true, densityScale: 1, kinds: 'both', materialMode: 'lambert', macroShade: false,
    ...options.flags,
  };
  const assetBundle = options.assets ?? makeAssets(flags.kinds);
  const scene = new THREE.Scene();
  let tick = 0;
  const loadMask = vi.fn(async () => options.mask ?? makeMask());
  const loadAssets = vi.fn(async () => assetBundle.assets);
  const topAssetBundle = options.topAssets ?? makeTopAssets();
  const loadTopCapAssets = vi.fn(async () => options.topFailure ?? topAssetBundle.result);
  return {
    scene, config, flags, assetBundle,
    loadMask,
    loadAssets, loadTopCapAssets, topAssetBundle,
    deps: {
      scene,
      grid: { values: new Float32Array(25), cols: 5, rows: 5, cellSizeMeters: 64 },
      elevationScale: 1,
      routePointsXZ: [{ x: 0, z: 0 }, { x: 128, z: 0 }, { x: 256, z: 0 }],
      config, flags,
      loadMask,
      loadAssets,
      loadTopCapAssets,
      now: () => ++tick,
    },
  };
}

function getMeshes(controller: ForestImpostorV2Controller): THREE.InstancedMesh[] {
  const meshes: THREE.InstancedMesh[] = [];
  controller.object3D.traverse((object) => {
    if (object instanceof THREE.InstancedMesh) meshes.push(object);
  });
  return meshes;
}

async function create(options: Parameters<typeof makeDeps>[0] = {}) {
  const fixture = makeDeps(options);
  const controller = await createForestImpostorV2(fixture.deps);
  if (controller) controllers.push(controller);
  return { ...fixture, controller };
}

describe('forest impostor v2 controller', () => {
  it('returns before loaders or scene changes when disabled', async () => {
    const fixture = makeDeps({ flags: { enabled: false } });
    expect(await createForestImpostorV2(fixture.deps)).toBeUndefined();
    expect(fixture.loadMask).not.toHaveBeenCalled();
    expect(fixture.loadAssets).not.toHaveBeenCalled();
    expect(fixture.scene.children).toHaveLength(0);
  });

  it('creates one static object and a finite complete summary', async () => {
    const { controller, scene } = await create();
    expect(controller).toBeDefined();
    expect(scene.children).toHaveLength(1);
    expect(controller!.summary.primitives.total).toBeGreaterThan(0);
    let meshCount = 0;
    controller!.object3D.traverse((object) => {
      if (object instanceof THREE.InstancedMesh) meshCount += 1;
    });
    expect(controller!.summary.render.drawCalls).toBe(meshCount);
    for (const value of Object.values(controller!.summary.timingsMs)) expect(Number.isFinite(value)).toBe(true);
    expect(controller!.summary.textures).toEqual(expect.arrayContaining([
      expect.objectContaining({ atlas: 'grove', estimatedBytesWithMips: 64 * 32 * 4 * 4 / 3 }),
      expect.objectContaining({ atlas: 'tree', estimatedBytesWithMips: 32 * 16 * 4 * 4 / 3 }),
    ]));
    expect(controller!.summary.maskCoverageMean).toBeGreaterThanOrEqual(0);
    expect(controller!.summary.maskCoverageMean).toBeLessThanOrEqual(1);
  });

  it('prevents a second active instance and permits recreation after dispose', async () => {
    const first = await create();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const second = makeDeps();
    expect(await createForestImpostorV2(second.deps)).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    expect(first.scene.children).toHaveLength(1);
    expect(second.scene.children).toHaveLength(0);
    first.controller!.dispose();
    const third = await createForestImpostorV2(second.deps);
    expect(third).toBeDefined();
    if (third) controllers.push(third);
  });

  it.each([
    ['asset rejection', 'assets'],
    ['mask rejection', 'mask'],
    ['zero placement', 'zero'],
    ['wrong mask size', 'size'],
  ] as const)('fails safely for %s', async (_label, failure) => {
    const fixture = makeDeps({ mask: failure === 'zero' ? makeMask(0) : failure === 'size' ? makeMask(255, 8) : undefined });
    if (failure === 'assets') fixture.loadAssets.mockRejectedValueOnce(new Error('asset failure'));
    if (failure === 'mask') fixture.loadMask.mockRejectedValueOnce(new Error('mask failure'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const groveTexture = vi.spyOn(fixture.assetBundle.grove, 'dispose');
    const treeTexture = vi.spyOn(fixture.assetBundle.tree, 'dispose');
    expect(await createForestImpostorV2(fixture.deps)).toBeUndefined();
    expect(fixture.scene.children).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
    if (failure !== 'assets') {
      expect(fixture.assetBundle.dispose).toHaveBeenCalledTimes(1);
      expect(groveTexture).toHaveBeenCalledTimes(1);
      expect(treeTexture).toHaveBeenCalledTimes(1);
    }
  });

  it('disposes all owned geometry, material, and texture resources idempotently', async () => {
    const fixture = await create();
    const geometrySpies: ReturnType<typeof vi.spyOn>[] = [];
    const materialSpies = new Set<ReturnType<typeof vi.spyOn>>();
    fixture.controller!.object3D.traverse((object) => {
      if (!(object instanceof THREE.InstancedMesh)) return;
      geometrySpies.push(vi.spyOn(object.geometry, 'dispose'));
      materialSpies.add(vi.spyOn(object.material as THREE.Material, 'dispose'));
    });
    const groveTexture = vi.spyOn(fixture.assetBundle.grove, 'dispose');
    const treeTexture = vi.spyOn(fixture.assetBundle.tree, 'dispose');
    fixture.controller!.dispose();
    expect(fixture.scene.children).toHaveLength(0);
    for (const spy of [...geometrySpies, ...materialSpies]) expect(spy).toHaveBeenCalledTimes(1);
    expect(materialSpies.size).toBe(fixture.controller!.summary.render.materials);
    expect(groveTexture).toHaveBeenCalledTimes(1);
    expect(treeTexture).toHaveBeenCalledTimes(1);
    expect(() => fixture.controller!.dispose()).not.toThrow();
    for (const spy of [...geometrySpies, ...materialSpies]) expect(spy).toHaveBeenCalledTimes(1);
  });

  it('uses the alpha override in both summary and actual materials', async () => {
    const { controller } = await create({ flags: { alphaTestOverride: 0.33 } });
    expect(controller!.summary.material).toEqual({ groveAlphaTest: 0.33, treeAlphaTest: 0.33, mode: 'lambert' });
    controller!.object3D.traverse((object) => {
      if (object instanceof THREE.InstancedMesh) {
        expect((object.material as THREE.MeshLambertMaterial).alphaTest).toBe(0.33);
      }
    });
  });

  it('uses Lambert materials for default flags', async () => {
    const { controller } = await create();
    expect(getMeshes(controller!)).not.toHaveLength(0);
    for (const mesh of getMeshes(controller!)) {
      expect(mesh.material).toBeInstanceOf(THREE.MeshLambertMaterial);
    }
  });

  it('uses basic materials and reports unlit mode when opted in', async () => {
    const { controller } = await create({ flags: { materialMode: 'unlit' } });
    expect(controller!.summary.material.mode).toBe('unlit');
    expect(getMeshes(controller!)).not.toHaveLength(0);
    for (const mesh of getMeshes(controller!)) {
      expect(mesh.material).toBeInstanceOf(THREE.MeshBasicMaterial);
    }
  });

  it('keeps instanceColor null when macro shade is off and populates it only when opted in', async () => {
    const baseline = await create({ flags: { macroShade: false } });
    expect(getMeshes(baseline.controller!).every((mesh) => mesh.instanceColor === null)).toBe(true);
    baseline.controller!.dispose();

    const shaded = await create({ flags: { macroShade: true, materialMode: 'unlit', topCap: true } });
    expect(getMeshes(shaded.controller!)).not.toHaveLength(0);
    expect(getMeshes(shaded.controller!).every((mesh) => mesh.instanceColor !== null)).toBe(true);
  });

  it('does not request top assets for V2.1 unlit without the top-cap opt-in', async () => {
    const { controller, loadTopCapAssets } = await create({ flags: { materialMode: 'unlit', topCap: false } });
    expect(loadTopCapAssets).not.toHaveBeenCalled();
    expect(controller!.summary.topCap).toMatchObject({ requested: false, active: false, primitiveCount: 0 });
    expect(controller!.getTopCapVisible()).toBe(false);
    expect(controller!.setTopCapVisible(false)).toBe(false);
  });

  it('activates top cap only for explicit unlit opt-in without changing side summary values', async () => {
    const baseline = await create({ flags: { materialMode: 'unlit' } });
    const sideSummary = baseline.controller!.summary;
    baseline.controller!.dispose();
    const { controller, loadTopCapAssets } = await create({ flags: { materialMode: 'unlit', topCap: true } });
    expect(loadTopCapAssets).toHaveBeenCalledTimes(1);
    expect(controller!.summary.primitives).toEqual(sideSummary.primitives);
    expect(controller!.summary.render).toEqual(sideSummary.render);
    expect(controller!.summary.placement).toEqual(sideSummary.placement);
    expect(controller!.summary.limits).toEqual(sideSummary.limits);
    expect(controller!.summary.topCap).toMatchObject({ requested: true, active: true,
      primitiveCount: controller!.summary.primitives.grove, alphaTest: 0.45, cellCount: 24 });
    const cap = controller!.object3D.getObjectByName('forest-impostor-v2-top-cap');
    expect(cap?.parent).toBe(controller!.object3D);
    expect(controller!.getTopCapVisible()).toBe(true);
    expect(controller!.setTopCapVisible(false)).toBe(true);
    expect(controller!.getTopCapVisible()).toBe(false);
    expect(controller!.setTopCapVisible(true)).toBe(true);
  });

  it('keeps Lambert side material and warns once when top cap is requested with Lambert', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { controller, loadTopCapAssets } = await create({ flags: { materialMode: 'lambert', topCap: true } });
    expect(loadTopCapAssets).not.toHaveBeenCalled();
    expect(controller!.getMaterialMode()).toBe('lambert');
    expect(getMeshes(controller!).every((mesh) => mesh.material instanceof THREE.MeshLambertMaterial)).toBe(true);
    expect(controller!.summary.topCap).toMatchObject({ requested: true, active: false,
      disabledReason: 'material-not-unlit' });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('[forest-impostor-v2] top cap requires forestImpostorV2Material=unlit; top cap disabled');
  });

  it.each([
    ['meta-load-failed', 'meta-load-failed'],
    ['meta-invalid', 'meta-invalid'],
    ['texture-load-failed', 'texture-load-failed'],
  ] as const)('keeps V2.1 active after %s', async (_label, reason) => {
    const { controller } = await create({ flags: { materialMode: 'unlit', topCap: true },
      topFailure: { ok: false, reason } });
    expect(controller).toBeDefined();
    expect(controller!.getMaterialMode()).toBe('unlit');
    expect(controller!.summary.topCap).toMatchObject({ requested: true, active: false, disabledReason: reason });
  });

  it('falls back to V2.1 and releases top texture when mapping is incomplete', async () => {
    const topAssets = makeTopAssets();
    if (!topAssets.result.ok) throw new Error('expected success');
    topAssets.result.meta.cells = topAssets.result.meta.cells.slice(1);
    const { controller } = await create({ flags: { materialMode: 'unlit', topCap: true }, topAssets });
    expect(controller).toBeDefined();
    expect(controller!.summary.topCap?.disabledReason).toBe('mapping-invalid');
    expect(topAssets.dispose).toHaveBeenCalledTimes(1);
  });

  it('disposes cap geometry, material, and texture exactly once', async () => {
    const topAssets = makeTopAssets();
    const { controller } = await create({ flags: { materialMode: 'unlit', topCap: true }, topAssets });
    const cap = controller!.object3D.getObjectByName('forest-impostor-v2-top-cap')!;
    const capMeshes: THREE.InstancedMesh[] = [];
    cap.traverse((object) => { if (object instanceof THREE.InstancedMesh) capMeshes.push(object); });
    const geometrySpies = capMeshes.map((mesh) => vi.spyOn(mesh.geometry, 'dispose'));
    const capMaterial = capMeshes[0].material as THREE.Material;
    const materialDispose = vi.spyOn(capMaterial, 'dispose');
    const textureDispose = vi.spyOn(topAssets.texture, 'dispose');
    controller!.dispose(); controller!.dispose();
    for (const spy of geometrySpies) expect(spy).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(topAssets.dispose).toHaveBeenCalledTimes(1);
    expect(textureDispose).toHaveBeenCalledTimes(1);
  });

  it('changes only the material model between equivalent builds', async () => {
    const first = await create({ flags: { materialMode: 'lambert' } });
    const lambert = first.controller!.summary;
    first.controller!.dispose();
    const second = await create({ flags: { materialMode: 'unlit' } });
    const unlit = second.controller!.summary;
    expect(unlit.primitives).toEqual(lambert.primitives);
    expect(unlit.perCell).toEqual(lambert.perCell);
    expect(unlit.render.drawCalls).toBe(lambert.render.drawCalls);
    expect(unlit.render.triangles).toBe(lambert.render.triangles);
    expect(unlit.render.vertices).toBe(lambert.render.vertices);
    expect(unlit.render.instanceBytes).toBe(lambert.render.instanceBytes);
    expect(unlit.render.geometries).toBe(lambert.render.geometries);
    expect(unlit.render.materials).toBe(lambert.render.materials);
    expect(unlit.placement).toEqual(lambert.placement);
    expect(unlit.macro).toEqual(lambert.macro);
    expect(unlit.limits).toEqual(lambert.limits);
    expect(unlit.material.groveAlphaTest).toBe(lambert.material.groveAlphaTest);
    expect(unlit.material.treeAlphaTest).toBe(lambert.material.treeAlphaTest);
  });

  it('toggles materials without rebuilding mesh state or textures', async () => {
    const { controller } = await create();
    const before = getMeshes(controller!).map((mesh) => ({
      mesh,
      geometry: mesh.geometry,
      instanceMatrix: mesh.instanceMatrix,
      count: mesh.count,
      map: (mesh.material as THREE.MeshLambertMaterial).map,
    }));
    expect(controller!.getMaterialMode()).toBe('lambert');
    expect(controller!.setMaterialMode('unlit')).toBe(true);
    expect(controller!.getMaterialMode()).toBe('unlit');
    for (const state of before) {
      expect(state.mesh.material).toBeInstanceOf(THREE.MeshBasicMaterial);
      expect(state.mesh.geometry).toBe(state.geometry);
      expect(state.mesh.instanceMatrix).toBe(state.instanceMatrix);
      expect(state.mesh.count).toBe(state.count);
      expect((state.mesh.material as THREE.MeshBasicMaterial).map).toBe(state.map);
    }
    expect(controller!.setMaterialMode('unlit')).toBe(true);
    expect(controller!.setMaterialMode('lambert')).toBe(true);
    expect(controller!.getMaterialMode()).toBe('lambert');
    for (const state of before) expect(state.mesh.material).toBeInstanceOf(THREE.MeshLambertMaterial);
    expect(controller!.setMaterialMode('bogus' as any)).toBe(false);
    expect(controller!.getMaterialMode()).toBe('lambert');
    controller!.dispose();
    expect(controller!.setMaterialMode('unlit')).toBe(false);
  });

  it('disposes all four mode-specific materials exactly once', async () => {
    const lambertDispose = vi.spyOn(THREE.MeshLambertMaterial.prototype, 'dispose');
    const basicDispose = vi.spyOn(THREE.MeshBasicMaterial.prototype, 'dispose');
    const { controller } = await create();
    controller!.dispose();
    controller!.dispose();
    expect(lambertDispose).toHaveBeenCalledTimes(2);
    expect(basicDispose).toHaveBeenCalledTimes(2);
  });

  it('loads and reports only one atlas for grove-only mode', async () => {
    const { controller } = await create({ flags: { kinds: 'grove' }, assets: makeAssets('both') });
    expect(controller!.summary.textures).toHaveLength(1);
    expect(controller!.summary.textures[0].atlas).toBe('grove');
    expect(controller!.summary.render.materials).toBe(1);
  });

  it('is deterministic across disposal and recreation', async () => {
    const first = await create();
    const expected = {
      total: first.controller!.summary.primitives.total,
      perCell: first.controller!.summary.perCell,
    };
    first.controller!.dispose();
    const second = await create();
    expect(second.controller!.summary.primitives.total).toBe(expected.total);
    expect(second.controller!.summary.perCell).toEqual(expected.perCell);
  });

  it('contains none of the prohibited source APIs or identifiers', () => {
    // @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
    const root = process.cwd();
    const source = readFileSync(`${root}/src/forest/impostorV2/forestImpostorV2Controller.ts`, 'utf8');
    for (const term of ['set' + 'AnimationLoop', 'request' + 'AnimationFrame', 'on' + 'BeforeCompile',
      'Shader' + 'Material', 'Raw' + 'Shader' + 'Material', 'cast' + 'Shadow', 'receive' + 'Shadow',
      'shadow' + 'Map', 'Math.' + 'random', 'forest' + 'Candidate']) {
      expect(source).not.toContain(term);
    }
  });
});
