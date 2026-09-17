// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
import { readFileSync, readdirSync } from 'node:fs';
// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
import { join } from 'node:path';
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveForestCandidateFlags } from '../candidate/forestCandidateFlags';
import {
  createForestImpostorV2,
  type ForestImpostorV2Controller,
} from './forestImpostorV2Controller';
import { resolveForestImpostorV2Flags } from './forestImpostorV2Flags';
import type { ImpostorAssets } from './impostorAssets';
import type {
  ForestImpostorV2Config,
  ForestImpostorV2Flags,
  ImpostorAtlasMeta,
  ImpostorCellRef,
} from './types';

// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
const projectRoot = process.cwd();
const controllers: ForestImpostorV2Controller[] = [];

afterEach(() => {
  for (const controller of controllers.splice(0)) controller.dispose();
  vi.restoreAllMocks();
});

function makeConfig(): ForestImpostorV2Config {
  return {
    assets: { metaUrl: '/meta.json', treeAtlasUrl: '/tree.png', groveAtlasUrl: '/grove.png' },
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
    key: `${kind}:one:0`, kind, atlas: kind,
    groveConfig: kind === 'grove' ? 'G1' : null,
    sourceVariant: kind === 'tree' ? 'T1' : null,
    yawDeg: 0, uv: { u0: 0, v0: 0, u1: 1, v1: 1 },
    tightWorldWidth: kind === 'grove' ? 12 : 3,
    tightWorldHeight: kind === 'grove' ? 12 : 8,
    groundPivotInTight: { u: 0.5, v: 0 }, alphaCoverage: 0.5,
  };
}

function makeAssets(): ImpostorAssets {
  const cells = [makeCell('grove'), makeCell('tree')];
  const meta: ImpostorAtlasMeta = {
    schemaVersion: 1,
    pitchDeg: 0,
    cells,
    atlases: {
      grove: {
        id: 'grove', file: 'grove.png', width: 64, height: 32,
        cellWidth: 64, cellHeight: 32, cols: 1, rows: 1, sha256: 'g',
      },
      tree: {
        id: 'tree', file: 'tree.png', width: 32, height: 16,
        cellWidth: 32, cellHeight: 16, cols: 1, rows: 1, sha256: 't',
      },
    },
  };
  const textures = { grove: new THREE.Texture(), tree: new THREE.Texture() };
  let disposed = false;
  return {
    meta,
    cells,
    textures,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      textures.grove.dispose();
      textures.tree.dispose();
    },
  };
}

function makeDeps(flags: ForestImpostorV2Flags) {
  const scene = new THREE.Scene();
  const loadMask = vi.fn(async () => ({
    size: 16,
    extentMeters: 256,
    coverage: new Uint8Array(16 * 16).fill(255),
  }));
  const loadAssets = vi.fn(async () => makeAssets());
  let tick = 0;
  return {
    scene,
    loadMask,
    loadAssets,
    deps: {
      scene,
      grid: { values: new Float32Array(25), cols: 5, rows: 5, cellSizeMeters: 64 },
      elevationScale: 1,
      routePointsXZ: [{ x: 0, z: 0 }, { x: 128, z: 0 }, { x: 256, z: 0 }],
      config: makeConfig(),
      flags,
      loadMask,
      loadAssets,
      now: () => ++tick,
    },
  };
}

async function createTracked(flags: ForestImpostorV2Flags) {
  const fixture = makeDeps(flags);
  const controller = await createForestImpostorV2(fixture.deps);
  if (controller) controllers.push(controller);
  return { ...fixture, controller };
}

function extractGuardedBlock(source: string): string {
  const guard = 'if (forestImpostorV2Flags.enabled) {';
  const start = source.indexOf(guard);
  if (start === -1) throw new Error(`guard not found: ${guard}`);
  let depth = 0;
  for (let index = start + guard.length - 1; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error('unbalanced forest impostor v2 guard');
}

function countOutsideGuard(source: string, guardedBlock: string, identifier: string): number {
  const outside = source.split(guardedBlock).join('\n');
  const withoutImports = outside
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('import ')
      && !line.trimStart().startsWith('type ')
      && !line.includes("from '../forest/impostorV2/"))
    .join('\n');
  return withoutImports.split(identifier).length - 1;
}

function findTypeScriptFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...findTypeScriptFiles(path));
    else if (entry.isFile() && path.endsWith('.ts')) files.push(path);
  }
  return files;
}

describe('forest impostor v2 回帰', () => {
  it('query 無しでは loader と scene に副作用がない', async () => {
    const flags = resolveForestImpostorV2Flags(new URLSearchParams(''));
    const fixture = makeDeps(flags);
    expect(flags.enabled).toBe(false);
    expect(await createForestImpostorV2(fixture.deps)).toBeUndefined();
    expect(fixture.loadMask).not.toHaveBeenCalled();
    expect(fixture.loadAssets).not.toHaveBeenCalled();
    expect(fixture.scene.children).toHaveLength(0);
  });

  it('明示 flag ON で controller を 1 つ scene に生成する', async () => {
    const flags = resolveForestImpostorV2Flags(new URLSearchParams('forestImpostorV2=1'));
    const fixture = await createTracked(flags);
    expect(flags.enabled).toBe(true);
    expect(fixture.controller).toBeDefined();
    expect(fixture.scene.children).toHaveLength(1);
  });

  it('v1 と v2 の query flag は独立している', () => {
    const v1Only = new URLSearchParams('forestCandidate=1');
    expect(resolveForestCandidateFlags(v1Only).enabled).toBe(true);
    expect(resolveForestImpostorV2Flags(v1Only).enabled).toBe(false);

    const v2Only = new URLSearchParams('forestImpostorV2=1');
    expect(resolveForestCandidateFlags(v2Only).enabled).toBe(false);
    expect(resolveForestImpostorV2Flags(v2Only).enabled).toBe(true);

    const both = new URLSearchParams('forestCandidate=1&forestImpostorV2=1');
    expect(resolveForestCandidateFlags(both).enabled).toBe(true);
    expect(resolveForestImpostorV2Flags(both).enabled).toBe(true);
  });

  it('Lite と main に forest import を追加していない', () => {
    const paths = [
      ...findTypeScriptFiles(join(projectRoot, 'src/presentation/lite2d')),
      join(projectRoot, 'src/main.ts'),
    ];
    const forestImports = paths.flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      const imports = source.match(/^\s*import[\s\S]*?;\s*$/gm) ?? [];
      return imports.filter((statement: string) => /forest/i.test(statement));
    });
    expect(forestImports).toEqual([]);
  });

  it('query 無しの既定経路へ v2 の副作用が漏れていない', () => {
    const source = readFileSync(join(projectRoot, 'src/scene/sceneSetup.ts'), 'utf8');
    const guardedBlock = extractGuardedBlock(source);
    for (const identifier of [
      'forestImpostorV2Defaults',
      '__forestImpostorV2Summary',
      'createForestImpostorV2(',
    ]) {
      expect(countOutsideGuard(source, guardedBlock, identifier)).toBe(0);
    }
  });

  it('controller 経由の placement は再生成しても deterministic である', async () => {
    const flags = resolveForestImpostorV2Flags(new URLSearchParams('forestImpostorV2=1'));
    const first = await createTracked(flags);
    expect(first.controller).toBeDefined();
    const expectedTotal = first.controller!.summary.primitives.total;
    const expectedPerCell = first.controller!.summary.perCell;
    first.controller!.dispose();

    const second = await createTracked(flags);
    expect(second.controller).toBeDefined();
    expect(second.controller!.summary.primitives.total).toBe(expectedTotal);
    expect(second.controller!.summary.perCell).toEqual(expectedPerCell);
  });

  it('二重生成を防ぎ、dispose 後は再生成できる', async () => {
    const flags = resolveForestImpostorV2Flags(new URLSearchParams('forestImpostorV2=1'));
    const first = await createTracked(flags);
    expect(first.controller).toBeDefined();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const second = makeDeps(flags);
    expect(await createForestImpostorV2(second.deps)).toBeUndefined();
    expect(second.scene.children).toHaveLength(0);

    first.controller!.dispose();
    const recreated = await createForestImpostorV2(second.deps);
    expect(recreated).toBeDefined();
    if (recreated) controllers.push(recreated);
    expect(second.scene.children).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
