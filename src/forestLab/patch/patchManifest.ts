import type { ElevationGrid } from '../../types';
import {
  CANONICAL_CELL_SIZE_METERS,
  CANONICAL_COLS,
  CANONICAL_ROWS,
  MASK_EXTENT_METERS,
  MASK_SIZE,
  PATCH_SIZE_CELLS,
  TERRAIN_UV_EXTENT_METERS,
} from '../labConstants';
import type {
  PatchManifest,
  PatchManifestPatch,
  PatchSpec,
} from '../labTypes';
import { canonicalIndexOf } from './patchGrid';

const PHASE = 'matsu-h01-takao-forest-visual-lab-architecture-bakeoff';

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function required(parent: Record<string, unknown>, key: string, path: string): unknown {
  if (!Object.prototype.hasOwnProperty.call(parent, key)) {
    throw new TypeError(`${path}.${key} is required.`);
  }
  return parent[key];
}

function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${path} must be a finite number.`);
  }
  return value;
}

function integer(value: unknown, path: string): number {
  const parsed = finiteNumber(value, path);
  if (!Number.isInteger(parsed)) throw new TypeError(`${path} must be an integer.`);
  return parsed;
}

function stringValue(value: unknown, path: string): string {
  if (typeof value !== 'string') throw new TypeError(`${path} must be a string.`);
  return value;
}

function booleanValue(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new TypeError(`${path} must be a boolean.`);
  return value;
}

function validateNumberRecord(
  value: unknown,
  keys: readonly string[],
  path: string,
): void {
  const parsed = record(value, path);
  for (const key of keys) finiteNumber(required(parsed, key, path), `${path}.${key}`);
}

function validatePatch(value: unknown, path: string): void {
  const patch = record(value, path);
  const id = stringValue(required(patch, 'id', path), `${path}.id`);
  if (id !== 'A' && id !== 'B') throw new TypeError(`${path}.id must be A or B.`);
  for (const key of ['rowStart', 'rowEnd', 'colStart', 'colEnd'] as const) {
    integer(required(patch, key, path), `${path}.${key}`);
  }
  validateNumberRecord(
    required(patch, 'worldBbox', path),
    ['xMin', 'xMax', 'zMin', 'zMax', 'yMin', 'yMax'],
    `${path}.worldBbox`,
  );
  validateNumberRecord(
    required(patch, 'uvBbox', path),
    ['u0', 'u1', 'v0', 'v1'],
    `${path}.uvBbox`,
  );
  const maskBbox = record(required(patch, 'maskBbox', path), `${path}.maskBbox`);
  for (const key of ['colStart', 'colEnd', 'rowStart', 'rowEnd'] as const) {
    integer(required(maskBbox, key, `${path}.maskBbox`), `${path}.maskBbox.${key}`);
  }
  validateNumberRecord(
    required(patch, 'metrics', path),
    [
      'maskCoverage', 'forestFraction', 'nonForestFraction', 'boundaryDensity',
      'ridgeFraction', 'valleyFraction', 'meanSlopeDeg', 'reliefRangeMeters',
      'primaryVisible', 'overviewVisible', 'routeCoverage', 'routePointsInside',
    ],
    `${path}.metrics`,
  );
  finiteNumber(required(patch, 'score', path), `${path}.score`);
  validateNumberRecord(
    required(patch, 'scoreTerms', path),
    ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8'],
    `${path}.scoreTerms`,
  );
  const constraints = record(
    required(patch, 'constraintsMet', path),
    `${path}.constraintsMet`,
  );
  for (const key of ['H1', 'H2', 'H3', 'H4', 'H5'] as const) {
    booleanValue(required(constraints, key, `${path}.constraintsMet`), `${path}.constraintsMet.${key}`);
  }
  stringValue(required(patch, 'selectionReason', path), `${path}.selectionReason`);
}

export function parsePatchManifest(json: unknown): PatchManifest {
  const root = record(json, 'manifest');
  if (integer(required(root, 'schemaVersion', 'manifest'), 'manifest.schemaVersion') !== 1) {
    throw new TypeError('manifest.schemaVersion must be 1.');
  }
  if (stringValue(required(root, 'phase', 'manifest'), 'manifest.phase') !== PHASE) {
    throw new TypeError(`manifest.phase must be ${PHASE}.`);
  }

  const canonical = record(required(root, 'canonical', 'manifest'), 'manifest.canonical');
  for (const key of ['rows', 'cols', 'maskSize'] as const) {
    integer(required(canonical, key, 'manifest.canonical'), `manifest.canonical.${key}`);
  }
  for (const key of ['cellSizeMeters', 'terrainUvExtentMeters', 'maskExtentMeters'] as const) {
    finiteNumber(required(canonical, key, 'manifest.canonical'), `manifest.canonical.${key}`);
  }
  stringValue(required(canonical, 'maskSha256', 'manifest.canonical'), 'manifest.canonical.maskSha256');
  const demTiles = required(canonical, 'demTiles', 'manifest.canonical');
  if (!Array.isArray(demTiles)) throw new TypeError('manifest.canonical.demTiles must be an array.');
  demTiles.forEach((tile, index) => stringValue(tile, `manifest.canonical.demTiles[${index}]`));
  validateNumberRecord(
    required(canonical, 'bounds', 'manifest.canonical'),
    ['north', 'south', 'west', 'east'],
    'manifest.canonical.bounds',
  );

  validateNumberRecord(
    required(root, 'globalStats', 'manifest'),
    ['Lt', 'gRidge', 'gValley', 'gSlopeDeg', 'reliefRangeMedianOfCandidates'],
    'manifest.globalStats',
  );
  const search = record(required(root, 'search', 'manifest'), 'manifest.search');
  for (const key of ['sizeCells', 'stride', 'candidates', 'survivors'] as const) {
    integer(required(search, key, 'manifest.search'), `manifest.search.${key}`);
  }

  const patches = required(root, 'patches', 'manifest');
  if (!Array.isArray(patches)) throw new TypeError('manifest.patches must be an array.');
  patches.forEach((patch, index) => validatePatch(patch, `manifest.patches[${index}]`));

  const decision = record(
    required(root, 'patchBDecision', 'manifest'),
    'manifest.patchBDecision',
  );
  booleanValue(required(decision, 'required', 'manifest.patchBDecision'), 'manifest.patchBDecision.required');
  for (const key of ['nonForestFraction', 'threshold', 'boundaryDensity', 'boundaryThreshold'] as const) {
    finiteNumber(required(decision, key, 'manifest.patchBDecision'), `manifest.patchBDecision.${key}`);
  }
  stringValue(required(decision, 'reason', 'manifest.patchBDecision'), 'manifest.patchBDecision.reason');

  const closeCamera = record(required(root, 'closeCamera', 'manifest'), 'manifest.closeCamera');
  validateNumberRecord(
    required(closeCamera, 'anchor', 'manifest.closeCamera'),
    ['row', 'col', 'x', 'y', 'z'],
    'manifest.closeCamera.anchor',
  );
  validateNumberRecord(
    required(closeCamera, 'position', 'manifest.closeCamera'),
    ['x', 'y', 'z'],
    'manifest.closeCamera.position',
  );
  validateNumberRecord(
    required(closeCamera, 'target', 'manifest.closeCamera'),
    ['x', 'y', 'z'],
    'manifest.closeCamera.target',
  );
  finiteNumber(required(closeCamera, 'fov', 'manifest.closeCamera'), 'manifest.closeCamera.fov');
  booleanValue(
    required(closeCamera, 'groundClearanceApplied', 'manifest.closeCamera'),
    'manifest.closeCamera.groundClearanceApplied',
  );

  const adjustment = record(
    required(root, 'cameraTargetAdjustment', 'manifest'),
    'manifest.cameraTargetAdjustment',
  );
  validateNumberRecord(
    required(adjustment, 'PRIMARY', 'manifest.cameraTargetAdjustment'),
    ['x', 'y', 'z'],
    'manifest.cameraTargetAdjustment.PRIMARY',
  );
  validateNumberRecord(
    required(adjustment, 'OVERVIEW', 'manifest.cameraTargetAdjustment'),
    ['x', 'y', 'z'],
    'manifest.cameraTargetAdjustment.OVERVIEW',
  );

  validateNumberRecord(
    required(root, 'derived', 'manifest'),
    ['forestAreaSquareMeters', 'detailMaxCount', 'crownLatticeCols'],
    'manifest.derived',
  );
  const derived = record(required(root, 'derived', 'manifest'), 'manifest.derived');
  stringValue(required(derived, 'crownCountNote', 'manifest.derived'), 'manifest.derived.crownCountNote');

  return json as PatchManifest;
}

export function patchSpecFromManifest(manifest: PatchManifest, id: PatchSpec['id']): PatchSpec {
  const patch = manifest.patches.find((candidate) => candidate.id === id);
  if (!patch) throw new Error(`Patch ${id} does not exist in the manifest.`);
  return {
    id: patch.id,
    rowStart: patch.rowStart,
    rowEnd: patch.rowEnd,
    colStart: patch.colStart,
    colEnd: patch.colEnd,
  };
}

export function computeWorldBbox(
  patch: PatchSpec,
  grid: ElevationGrid,
): PatchManifestPatch['worldBbox'] {
  let yMin = Number.POSITIVE_INFINITY;
  let yMax = Number.NEGATIVE_INFINITY;
  for (let localRow = 0; localRow <= patch.rowEnd - patch.rowStart; localRow += 1) {
    for (let localCol = 0; localCol <= patch.colEnd - patch.colStart; localCol += 1) {
      const elevation = grid.values[canonicalIndexOf(patch, localRow, localCol)];
      yMin = Math.min(yMin, elevation);
      yMax = Math.max(yMax, elevation);
    }
  }
  return {
    xMin: patch.colStart * CANONICAL_CELL_SIZE_METERS,
    xMax: patch.colEnd * CANONICAL_CELL_SIZE_METERS,
    zMin: patch.rowStart * CANONICAL_CELL_SIZE_METERS,
    zMax: patch.rowEnd * CANONICAL_CELL_SIZE_METERS,
    yMin,
    yMax,
  };
}

export function computeUvBbox(patch: PatchSpec): PatchManifestPatch['uvBbox'] {
  return {
    u0: patch.colStart * CANONICAL_CELL_SIZE_METERS / TERRAIN_UV_EXTENT_METERS,
    u1: patch.colEnd * CANONICAL_CELL_SIZE_METERS / TERRAIN_UV_EXTENT_METERS,
    v0: 1 - patch.rowStart * CANONICAL_CELL_SIZE_METERS / TERRAIN_UV_EXTENT_METERS,
    v1: 1 - patch.rowEnd * CANONICAL_CELL_SIZE_METERS / TERRAIN_UV_EXTENT_METERS,
  };
}

export function computeMaskBbox(patch: PatchSpec): PatchManifestPatch['maskBbox'] {
  return {
    colStart: Math.floor(
      patch.colStart * CANONICAL_CELL_SIZE_METERS / MASK_EXTENT_METERS * MASK_SIZE,
    ),
    colEnd: Math.floor(
      patch.colEnd * CANONICAL_CELL_SIZE_METERS / MASK_EXTENT_METERS * MASK_SIZE,
    ),
    rowStart: Math.floor(
      patch.rowStart * CANONICAL_CELL_SIZE_METERS / MASK_EXTENT_METERS * MASK_SIZE,
    ),
    rowEnd: Math.floor(
      patch.rowEnd * CANONICAL_CELL_SIZE_METERS / MASK_EXTENT_METERS * MASK_SIZE,
    ),
  };
}

function compareRecord(
  errors: string[],
  path: string,
  actual: object,
  expected: Record<string, number>,
): void {
  const actualRecord = actual as Record<string, unknown>;
  for (const key of Object.keys(expected)) {
    if (actualRecord[key] !== expected[key]) {
      errors.push(`${path}.${key}: expected ${expected[key]}, received ${actualRecord[key]}`);
    }
  }
}

export function verifyManifestConsistency(
  manifest: PatchManifest,
  grid: ElevationGrid,
): string[] {
  const errors: string[] = [];
  const expectedCanonical = {
    rows: CANONICAL_ROWS,
    cols: CANONICAL_COLS,
    cellSizeMeters: CANONICAL_CELL_SIZE_METERS,
    terrainUvExtentMeters: TERRAIN_UV_EXTENT_METERS,
    maskExtentMeters: MASK_EXTENT_METERS,
    maskSize: MASK_SIZE,
  };
  compareRecord(errors, 'canonical', manifest.canonical, expectedCanonical);
  if (grid.rows !== CANONICAL_ROWS) errors.push(`grid.rows: expected ${CANONICAL_ROWS}, received ${grid.rows}`);
  if (grid.cols !== CANONICAL_COLS) errors.push(`grid.cols: expected ${CANONICAL_COLS}, received ${grid.cols}`);
  if (grid.cellSizeMeters !== CANONICAL_CELL_SIZE_METERS) {
    errors.push(`grid.cellSizeMeters: expected ${CANONICAL_CELL_SIZE_METERS}, received ${grid.cellSizeMeters}`);
  }
  compareRecord(errors, 'canonical.bounds', manifest.canonical.bounds, grid.bounds);
  if (manifest.search.sizeCells !== PATCH_SIZE_CELLS) {
    errors.push(`search.sizeCells: expected ${PATCH_SIZE_CELLS}, received ${manifest.search.sizeCells}`);
  }

  for (let index = 0; index < manifest.patches.length; index += 1) {
    const patch = manifest.patches[index];
    const path = `patches[${index}]`;
    if (patch.rowEnd - patch.rowStart !== manifest.search.sizeCells) {
      errors.push(`${path}.row span does not match search.sizeCells`);
    }
    if (patch.colEnd - patch.colStart !== manifest.search.sizeCells) {
      errors.push(`${path}.col span does not match search.sizeCells`);
    }
    compareRecord(errors, `${path}.worldBbox`, patch.worldBbox, computeWorldBbox(patch, grid));
    compareRecord(errors, `${path}.uvBbox`, patch.uvBbox, computeUvBbox(patch));
    compareRecord(errors, `${path}.maskBbox`, patch.maskBbox, computeMaskBbox(patch));
  }
  return errors;
}
