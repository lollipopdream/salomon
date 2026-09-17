// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseImpostorAtlasMeta, selectImpostorCells } from './impostorAtlasMeta';

// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
const metaPath = `${process.cwd()}/outputs/matsu-h01-realtime-forest-whole-tree-impostor-v2/bake/impostor-atlas-meta.json`;
const rawMeta = JSON.parse(readFileSync(metaPath, 'utf8')) as Record<string, unknown>;

const defaultSelection = {
  grove: { configs: ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'], yawDegrees: [0, 90, 180, 270] },
  tree: { variants: ['FIR_A', 'FIR_C', 'BL'], yawDegrees: [0, 90, 180, 270] },
};

function cloneMeta(): Record<string, any> {
  return JSON.parse(JSON.stringify(rawMeta)) as Record<string, any>;
}

describe('impostor atlas metadata', () => {
  it('parses the real metadata and atlas details', () => {
    const meta = parseImpostorAtlasMeta(rawMeta);
    expect(meta.cells).toHaveLength(56);
    expect(meta.cells.filter((cell) => cell.kind === 'tree')).toHaveLength(32);
    expect(meta.cells.filter((cell) => cell.kind === 'grove')).toHaveLength(24);
    expect(meta.pitchDeg).toBe(0);
    expect(meta.schemaVersion).toBe(1);
    expect(meta.atlases.tree).toMatchObject({
      width: 2048, height: 2048, cellWidth: 256, cellHeight: 512, cols: 8, rows: 4,
      sha256: 'ea88e5e015476dc66b28e2a1c9f5513afd1bc57b2e588c68a001a6cb96fa80ec',
    });
    expect(meta.atlases.grove).toMatchObject({
      width: 3072, height: 2048, cellWidth: 512, cellHeight: 512, cols: 6, rows: 4,
      sha256: '709388457f4987ec781fb9971ecc1d7659d11588ab57dbc6d09334c75c5bf2d2',
    });
  });

  it('maps representative tree and grove cells', () => {
    const meta = parseImpostorAtlasMeta(rawMeta);
    const tree = meta.cells.find((cell) => cell.key === 'tree:FIR_A:0');
    expect(tree).toBeDefined();
    expect(tree).toMatchObject({ sourceVariant: 'FIR_A', groveConfig: null, kind: 'tree', yawDeg: 0 });
    expect(tree?.uv.u0).toBeCloseTo(0.02001953125, 10);
    expect(tree?.uv.v0).toBeCloseTo(0.751953125, 10);
    expect(tree?.uv.u1).toBeCloseTo(0.10498046875, 10);
    expect(tree?.uv.v1).toBeCloseTo(0.9970703125, 10);
    expect(tree?.tightWorldWidth).toBeCloseTo(6.571283, 5);
    expect(tree?.tightWorldHeight).toBeCloseTo(18.958529, 5);
    expect(tree?.groundPivotInTight.u).toBe(0.5);
    expect(tree?.groundPivotInTight.v).toBeCloseTo(0.00203043436149202, 8);

    const grove = meta.cells.find((cell) => cell.key === 'grove:G1:0');
    expect(grove).toBeDefined();
    expect(grove).toMatchObject({ groveConfig: 'G1', sourceVariant: null, kind: 'grove' });
    expect(grove?.tightWorldWidth).toBeCloseTo(19.840215, 5);
    expect(grove?.tightWorldHeight).toBeCloseTo(18.968988, 5);
    expect(grove?.groundPivotInTight.v).toBeCloseTo(0.0013575185564714085, 8);
  });

  it('preserves cell invariants', () => {
    const cells = parseImpostorAtlasMeta(rawMeta).cells;
    for (const cell of cells) {
      expect(cell.uv.u0).toBeLessThan(cell.uv.u1);
      expect(cell.uv.v0).toBeLessThan(cell.uv.v1);
      for (const value of [cell.uv.u0, cell.uv.v0, cell.uv.u1, cell.uv.v1]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
      expect(cell.tightWorldWidth).toBeGreaterThan(0);
      expect(cell.tightWorldHeight).toBeGreaterThan(0);
      expect(cell.groundPivotInTight.v).toBeGreaterThanOrEqual(0);
      expect(cell.groundPivotInTight.v).toBeLessThanOrEqual(0.01);
      expect(cell.groundPivotInTight.u).toBeGreaterThanOrEqual(0.44);
      expect(cell.groundPivotInTight.u).toBeLessThanOrEqual(0.56);
      expect(cell.alphaCoverage).toBeGreaterThanOrEqual(0);
      expect(cell.alphaCoverage).toBeLessThanOrEqual(1);
    }
    expect(new Set(cells.map((cell) => cell.key)).size).toBe(56);
  });

  it('fails safely for invalid metadata', () => {
    const invalidCases: readonly [string, (value: Record<string, any>) => void, RegExp][] = [
      ['schema', (value) => { value.schema_version = 2; }, /schema_version/],
      ['incomplete', (value) => { value.incomplete = true; }, /incomplete/],
      ['pitch', (value) => { value.bake.pitch_deg = 15; }, /pitch_deg/],
      ['count', (value) => { value.cells.pop(); }, /cell count/],
      ['uv', (value) => { value.cells[0].alpha_tight_bounds_uv.u0 = value.cells[0].alpha_tight_bounds_uv.u1; }, /uv/],
      ['width', (value) => { value.cells[0].tight_world_width = 0; }, /tight_world_width/],
      ['duplicate', (value) => { value.cells[1].source_variant = value.cells[0].source_variant; value.cells[1].yaw_deg = value.cells[0].yaw_deg; }, /duplicate/],
      ['atlas', (value) => { value.atlases.tree.cols = 7; }, /atlas/],
    ];
    for (const [, mutate, cause] of invalidCases) {
      const value = cloneMeta();
      mutate(value);
      expect(() => parseImpostorAtlasMeta(value)).toThrow(cause);
    }
  });

  it('ignores unknown fields for forward compatibility', () => {
    const value = cloneMeta();
    value.future_field = 1;
    expect(parseImpostorAtlasMeta(value).cells).toHaveLength(56);
  });

  it('selects a deterministic, complete requested cell set', () => {
    const meta = parseImpostorAtlasMeta(rawMeta);
    const selected = selectImpostorCells(meta, defaultSelection, 'both');
    expect(selected).toHaveLength(36);
    expect(selected.slice(0, 24).every((cell) => cell.kind === 'grove')).toBe(true);
    expect(selected.slice(24).every((cell) => cell.kind === 'tree')).toBe(true);
    expect(selected.map((cell) => cell.key)).toEqual([
      ...defaultSelection.grove.configs.flatMap((config) => defaultSelection.grove.yawDegrees.map((yaw) => `grove:${config}:${yaw}`)),
      ...defaultSelection.tree.variants.flatMap((variant) => defaultSelection.tree.yawDegrees.map((yaw) => `tree:${variant}:${yaw}`)),
    ]);
    expect(selectImpostorCells(meta, defaultSelection, 'grove')).toHaveLength(24);
    expect(selectImpostorCells(meta, defaultSelection, 'tree')).toHaveLength(12);
    expect(() => selectImpostorCells(meta, { ...defaultSelection, grove: { ...defaultSelection.grove, configs: ['G9'] } }, 'grove')).toThrow(/grove:G9:0/);
    expect(() => selectImpostorCells(meta, { grove: { configs: [], yawDegrees: [] }, tree: { variants: [], yawDegrees: [] } }, 'both')).toThrow();
  });

  it('has no v1 dependency or nondeterministic random source', () => {
    // @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
    const sourceRoot = process.cwd();
    const sources = [
      readFileSync(`${sourceRoot}/src/forest/impostorV2/impostorAtlasMeta.ts`, 'utf8'),
      readFileSync(`${sourceRoot}/src/forest/impostorV2/types.ts`, 'utf8'),
    ];
    for (const source of sources) {
      expect(source).not.toContain('Math.random');
      expect(source).not.toContain('forest' + 'Candidate');
      expect(source).not.toContain("from '../candidate/");
      expect(source).not.toContain('forest/candidate');
    }
  });
});
