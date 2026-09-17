import type {
  ImpostorAtlasId,
  ImpostorAtlasInfo,
  ImpostorAtlasMeta,
  ImpostorCellRef,
  ImpostorCellSelection,
  ImpostorKindsFlag,
  ImpostorUvRect,
} from './types';

const errorPrefix = '[forest-impostor-v2] ';
const treeVariants = new Set(['FIR_A', 'FIR_B', 'FIR_C', 'BL']);
const groveConfigs = new Set(['G1', 'G2', 'G3', 'G4', 'G5', 'G6']);

function fail(reason: string): never {
  throw new Error(errorPrefix + reason);
}

function asRecord(value: unknown, reason: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(reason);
  }
  return value as Record<string, unknown>;
}

function finite(value: unknown, reason: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(reason);
  }
  return value;
}

function positive(value: unknown, reason: string): number {
  const number = finite(value, reason);
  if (number <= 0) fail(reason);
  return number;
}

function nonEmptyString(value: unknown, reason: string): string {
  if (typeof value !== 'string' || value.length === 0) fail(reason);
  return value;
}

function atlasInfo(id: ImpostorAtlasId, value: unknown): ImpostorAtlasInfo {
  const atlas = asRecord(value, `atlas ${id}`);
  const info: ImpostorAtlasInfo = {
    id,
    file: nonEmptyString(atlas.file, `atlas ${id} file`),
    width: positive(atlas.width, `atlas ${id} width`),
    height: positive(atlas.height, `atlas ${id} height`),
    cellWidth: positive(atlas.cell_width, `atlas ${id} cell_width`),
    cellHeight: positive(atlas.cell_height, `atlas ${id} cell_height`),
    cols: positive(atlas.cols, `atlas ${id} cols`),
    rows: positive(atlas.rows, `atlas ${id} rows`),
    sha256: nonEmptyString(atlas.sha256, `atlas ${id} sha256`),
  };
  if (info.cols * info.cellWidth !== info.width || info.rows * info.cellHeight !== info.height) {
    fail(`atlas ${id} dimensions`);
  }
  return info;
}

function uvRect(value: unknown): ImpostorUvRect {
  const uv = asRecord(value, 'uv');
  const result: ImpostorUvRect = {
    u0: finite(uv.u0, 'uv'),
    v0: finite(uv.v0, 'uv'),
    u1: finite(uv.u1, 'uv'),
    v1: finite(uv.v1, 'uv'),
  };
  if (
    result.u0 < 0 || result.u0 > 1 || result.v0 < 0 || result.v0 > 1 ||
    result.u1 < 0 || result.u1 > 1 || result.v1 < 0 || result.v1 > 1 ||
    result.u0 >= result.u1 || result.v0 >= result.v1
  ) {
    fail('uv');
  }
  return result;
}

function parseCell(value: unknown, atlases: Record<ImpostorAtlasId, ImpostorAtlasInfo>): ImpostorCellRef {
  const cell = asRecord(value, 'cell');
  if (cell.rendered !== true) fail('rendered');
  const atlas = cell.atlas;
  if (atlas !== 'tree' && atlas !== 'grove') fail('atlas');
  const row = finite(cell.row, 'row');
  const col = finite(cell.col, 'col');
  if (!Number.isInteger(row) || row < 0 || row >= atlases[atlas].rows) fail('row');
  if (!Number.isInteger(col) || col < 0 || col >= atlases[atlas].cols) fail('col');
  const yawDeg = finite(cell.yaw_deg, 'yaw_deg');
  const tightWorldWidth = positive(cell.tight_world_width, 'tight_world_width');
  const tightWorldHeight = positive(cell.tight_world_height, 'tight_world_height');
  const pivot = asRecord(cell.ground_pivot_in_tight, 'ground_pivot_in_tight');
  const groundPivotInTight = {
    u: finite(pivot.u, 'ground_pivot_in_tight'),
    v: finite(pivot.v, 'ground_pivot_in_tight'),
  };
  const alphaCoverage = finite(cell.content_alpha_coverage, 'content_alpha_coverage');
  if (alphaCoverage < 0 || alphaCoverage > 1) fail('content_alpha_coverage');

  let sourceVariant: string | null;
  let groveConfig: string | null;
  if (atlas === 'tree') {
    sourceVariant = cell.source_variant === null ? null : nonEmptyString(cell.source_variant, 'source_variant');
    if (sourceVariant === null || !treeVariants.has(sourceVariant) || cell.grove_config !== null) {
      fail('tree source_variant or grove_config');
    }
    groveConfig = null;
  } else {
    groveConfig = cell.grove_config === null ? null : nonEmptyString(cell.grove_config, 'grove_config');
    if (groveConfig === null || !groveConfigs.has(groveConfig) || cell.source_variant !== null) {
      fail('grove grove_config or source_variant');
    }
    sourceVariant = null;
  }

  const identity = atlas === 'tree' ? sourceVariant : groveConfig;
  return {
    key: `${atlas}:${identity}:${String(Math.round(yawDeg))}`,
    kind: atlas,
    atlas,
    groveConfig,
    sourceVariant,
    yawDeg,
    uv: uvRect(cell.alpha_tight_bounds_uv),
    tightWorldWidth,
    tightWorldHeight,
    groundPivotInTight,
    alphaCoverage,
  };
}

export function parseImpostorAtlasMeta(raw: unknown): ImpostorAtlasMeta {
  const root = asRecord(raw, 'metadata object');
  if (root.schema_version !== 1) fail('schema_version');
  if (root.incomplete !== false) fail('incomplete');
  const bake = asRecord(root.bake, 'bake');
  if (bake.pitch_deg !== 0) fail('pitch_deg');
  if (bake.pixel_origin !== 'top-left') fail('pixel_origin');
  nonEmptyString(bake.uv_convention, 'uv_convention');

  const rawAtlases = asRecord(root.atlases, 'atlases');
  const atlases: Record<ImpostorAtlasId, ImpostorAtlasInfo> = {
    tree: atlasInfo('tree', rawAtlases.tree),
    grove: atlasInfo('grove', rawAtlases.grove),
  };
  if (!Array.isArray(root.cells) || root.cells.length !== 56) fail('cell count');
  const cells = root.cells.map((cell) => parseCell(cell, atlases));
  const keys = new Set<string>();
  for (const cell of cells) {
    if (keys.has(cell.key)) fail(`duplicate ${cell.key}`);
    keys.add(cell.key);
  }
  return { schemaVersion: 1, pitchDeg: 0, atlases, cells };
}

function requestedKey(kind: ImpostorAtlasId, identity: string, yaw: number): string {
  return `${kind}:${identity}:${String(Math.round(yaw))}`;
}

export function selectImpostorCells(
  meta: ImpostorAtlasMeta,
  selection: ImpostorCellSelection,
  kinds: ImpostorKindsFlag,
): readonly ImpostorCellRef[] {
  const byKey = new Map(meta.cells.map((cell) => [cell.key, cell]));
  const result: ImpostorCellRef[] = [];
  const addRequested = (kind: ImpostorAtlasId, identity: string, yaw: number): void => {
    const key = requestedKey(kind, identity, yaw);
    const cell = byKey.get(key);
    if (cell === undefined || cell.yawDeg !== yaw) fail(`unknown ${key}`);
    result.push(cell);
  };
  if (kinds === 'both' || kinds === 'grove') {
    for (const config of selection.grove.configs) {
      for (const yaw of selection.grove.yawDegrees) addRequested('grove', config, yaw);
    }
  }
  if (kinds === 'both' || kinds === 'tree') {
    for (const variant of selection.tree.variants) {
      for (const yaw of selection.tree.yawDegrees) addRequested('tree', variant, yaw);
    }
  }
  if (result.length === 0) fail('cell selection is empty');
  return result;
}
