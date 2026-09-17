// @ts-expect-error This project intentionally has no Node type dependency.
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { ElevationGrid } from '../../types';
import {
  CANONICAL_CELL_SIZE_METERS,
  CANONICAL_COLS,
  CANONICAL_ROWS,
  MASK_EXTENT_METERS,
  MASK_SIZE,
} from '../labConstants';
import type { PatchManifest } from '../labTypes';
import { PATCH_MANIFEST_JSON } from '../scene/labDataSources';
import {
  computeMaskBbox,
  computeUvBbox,
  computeWorldBbox,
  parsePatchManifest,
  patchSpecFromManifest,
  verifyManifestConsistency,
} from './patchManifest';

// @ts-expect-error This project intentionally has no Node type dependency.
const manifestPath = `${process.cwd()}/outputs/matsu-h01-takao-forest-visual-lab-architecture-bakeoff/forest-lab-patch-manifest.json`;
const rawManifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown;

function cloneManifest(manifest: PatchManifest): PatchManifest {
  return JSON.parse(JSON.stringify(manifest)) as PatchManifest;
}

function zeroGrid(bounds: ElevationGrid['bounds']): ElevationGrid {
  return {
    rows: CANONICAL_ROWS,
    cols: CANONICAL_COLS,
    values: new Float32Array(CANONICAL_ROWS * CANONICAL_COLS),
    cellSizeMeters: CANONICAL_CELL_SIZE_METERS,
    bounds,
  };
}

describe('patch manifest', () => {
  it('keeps runtime crown count out of the manifest and mirrors the generated JSON exactly', () => {
    const manifest = parsePatchManifest(rawManifest);
    expect('crownCount' in manifest.derived).toBe(false);
    expect(manifest.derived.crownCountNote.trim().length).toBeGreaterThan(0);
    expect(manifest.derived.detailMaxCount).toBe(358);
    expect(manifest.derived.crownLatticeCols).toBe(322);
    expect(manifest.derived.forestAreaSquareMeters).toBe(4327146.039246672);
    expect(PATCH_MANIFEST_JSON).toEqual(rawManifest);
  });

  it('parses the actual manifest and exposes selected PATCH A', () => {
    const manifest = parsePatchManifest(rawManifest);
    const patch = patchSpecFromManifest(manifest, 'A');
    expect(patch.rowEnd - patch.rowStart).toBe(96);
    expect(patch.colEnd - patch.colStart).toBe(96);
    expect(patch).toEqual({ id: 'A', rowStart: 92, rowEnd: 188, colStart: 36, colEnd: 132 });
    expect(() => patchSpecFromManifest(manifest, 'B')).toThrow(/does not exist/);
  });

  it('rejects missing nested schema keys', () => {
    const broken = JSON.parse(JSON.stringify(rawManifest)) as {
      patches: Array<Record<string, unknown>>;
    };
    delete broken.patches[0].metrics;
    expect(() => parsePatchManifest(broken)).toThrow(/metrics is required/);
  });

  it('recomputes actual UV and mask bboxes from the fixed coordinate conventions', () => {
    const manifest = parsePatchManifest(rawManifest);
    const patch = manifest.patches[0];
    expect(computeUvBbox(patch)).toEqual(patch.uvBbox);
    expect(computeMaskBbox(patch)).toEqual(patch.maskBbox);
    expect(patch.maskBbox).toEqual({
      colStart: Math.floor(patch.worldBbox.xMin / MASK_EXTENT_METERS * MASK_SIZE),
      colEnd: Math.floor(patch.worldBbox.xMax / MASK_EXTENT_METERS * MASK_SIZE),
      rowStart: Math.floor(patch.worldBbox.zMin / MASK_EXTENT_METERS * MASK_SIZE),
      rowEnd: Math.floor(patch.worldBbox.zMax / MASK_EXTENT_METERS * MASK_SIZE),
    });
  });

  it('reports no differences for a self-consistent manifest and identifies corruption', () => {
    const manifest = cloneManifest(parsePatchManifest(rawManifest));
    const grid = zeroGrid(manifest.canonical.bounds);
    for (const patch of manifest.patches) {
      patch.worldBbox = computeWorldBbox(patch, grid);
      patch.uvBbox = computeUvBbox(patch);
      patch.maskBbox = computeMaskBbox(patch);
    }
    expect(verifyManifestConsistency(manifest, grid)).toEqual([]);

    manifest.patches[0].maskBbox.colStart += 1;
    expect(verifyManifestConsistency(manifest, grid)).toContain(
      'patches[0].maskBbox.colStart: expected 144, received 145',
    );
  });
});
