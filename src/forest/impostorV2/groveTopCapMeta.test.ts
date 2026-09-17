// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { createGroveTopCapMapping, parseGroveTopCapMeta } from './groveTopCapMeta';
import type { ImpostorCellRef } from './types';

// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
const metaPath = `${process.cwd()}/public/data/forest/impostor-v2/grove_top_atlas_meta.json`;
const rawMeta = JSON.parse(readFileSync(metaPath, 'utf8')) as Record<string, unknown>;

function sideCells(): ImpostorCellRef[] {
  const cells: ImpostorCellRef[] = [];
  for (const groveConfig of ['G1', 'G2', 'G3', 'G4', 'G5', 'G6']) {
    for (const yawDeg of [0, 90, 180, 270]) {
      cells.push({
        key: `grove:${groveConfig}:${yawDeg}`,
        kind: 'grove', atlas: 'grove', groveConfig, sourceVariant: null, yawDeg,
        uv: { u0: 0, v0: 0, u1: 1, v1: 1 },
        tightWorldWidth: 20, tightWorldHeight: 15,
        groundPivotInTight: { u: 0.5, v: 0 }, alphaCoverage: 0.5,
      });
    }
  }
  return cells;
}

function cloneRaw(): Record<string, any> {
  return JSON.parse(JSON.stringify(rawMeta)) as Record<string, any>;
}

describe('grove top cap metadata', () => {
  it('parses the baked 24-cell metadata and validates explicit 24/24 side mapping', () => {
    const meta = parseGroveTopCapMeta(rawMeta);
    expect(meta).not.toBeNull();
    expect(meta!.cells).toHaveLength(24);
    expect(meta!.atlas).toMatchObject({ width: 3072, height: 2048, cellWidth: 512,
      cellHeight: 512, cols: 6, rows: 4 });
    const mapping = createGroveTopCapMapping(meta!, sideCells());
    expect(mapping).not.toBeNull();
    expect(mapping!.size).toBe(24);
    for (const side of sideCells()) {
      const top = mapping!.get(side.key);
      expect(top?.groveConfig).toBe(side.groveConfig);
      expect(top?.bakedYaw).toBe(side.yawDeg);
      expect(top?.matchingSideCellId).toBe(`${side.groveConfig}_yaw${side.yawDeg}`);
    }
  });

  it.each([
    ['schema', (raw: Record<string, any>) => { raw.schema_version = 2; }],
    ['kind', (raw: Record<string, any>) => { raw.kind = 'other'; }],
    ['incomplete', (raw: Record<string, any>) => { raw.incomplete = true; }],
    ['exit', (raw: Record<string, any>) => { raw.exit_code = 1; }],
    ['atlas', (raw: Record<string, any>) => { raw.atlas.width = 1024; }],
    ['cell count', (raw: Record<string, any>) => { raw.cells.pop(); }],
    ['duplicate index', (raw: Record<string, any>) => { raw.cells[1].cellIndex = 0; }],
    ['uv', (raw: Record<string, any>) => { raw.cells[0].uvRect.u1 = 2; }],
    ['tight uv', (raw: Record<string, any>) => { raw.cells[0].alphaTightBoundsUV.v1 = 0; }],
    ['finite height', (raw: Record<string, any>) => { raw.cells[0].capHeightWorld = 'nan'; }],
    ['side identity', (raw: Record<string, any>) => { raw.cells[0].matchingSideCellId = 'G2_yaw0'; }],
    ['digest agreement', (raw: Record<string, any>) => { raw.cells[6].sourceCompositionDigest = 'sha256:other'; }],
  ])('returns null without throwing for invalid %s', (_label, mutate) => {
    const raw = cloneRaw();
    mutate(raw);
    expect(() => parseGroveTopCapMeta(raw)).not.toThrow();
    expect(parseGroveTopCapMeta(raw)).toBeNull();
  });

  it('rejects a mapping with a missing top cell instead of relying on array indices', () => {
    const meta = parseGroveTopCapMeta(rawMeta)!;
    const missing = { ...meta, cells: meta.cells.slice(1) };
    expect(createGroveTopCapMapping(missing, sideCells())).toBeNull();
  });

  it('maps a reordered side selection by config and yaw identity', () => {
    const meta = parseGroveTopCapMeta(rawMeta)!;
    const selected = [sideCells()[17], sideCells()[0], sideCells()[9]];
    const mapping = createGroveTopCapMapping(meta, selected)!;
    expect([...mapping.keys()]).toEqual(selected.map((cell) => cell.key));
    expect([...mapping.values()].map((cell) => cell.matchingSideCellIndex)).toEqual([10, 0, 8]);
  });
});
