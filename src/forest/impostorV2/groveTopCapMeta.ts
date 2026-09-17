import type { ImpostorCellRef, ImpostorUvRect } from './types';

export interface GroveTopCapAtlasInfo {
  file: string;
  width: 3072;
  height: 2048;
  cellWidth: 512;
  cellHeight: 512;
  cols: 6;
  rows: 4;
  sha256: string;
}

export interface GroveTopCapCell {
  cellId: string;
  matchingSideCellId: string;
  matchingSideCellIndex: number;
  cellIndex: number;
  row: number;
  col: number;
  groveConfig: string;
  bakedYaw: number;
  sourceCompositionDigest: string;
  uvRect: ImpostorUvRect;
  alphaTightBoundsUV: ImpostorUvRect;
  capHeightWorld: number;
  tightWorldWidth: number;
  tightWorldDepth: number;
  tightWorldBounds: {
    rightMin: number; rightMax: number; depthMin: number; depthMax: number;
  };
}

export interface GroveTopCapMeta {
  schemaVersion: 1;
  kind: 'grove_top_cap';
  capHeightMethod: string;
  atlas: GroveTopCapAtlasInfo;
  cells: readonly GroveTopCapCell[];
}

export type GroveTopCapMapping = ReadonlyMap<string, GroveTopCapCell>;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function integer(value: unknown): number | null {
  const parsed = finite(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseUv(value: unknown): ImpostorUvRect | null {
  const raw = record(value);
  if (!raw) return null;
  const u0 = finite(raw.u0); const v0 = finite(raw.v0);
  const u1 = finite(raw.u1); const v1 = finite(raw.v1);
  if (u0 === null || v0 === null || u1 === null || v1 === null) return null;
  if (u0 < 0 || v0 < 0 || u1 > 1 || v1 > 1 || u0 >= u1 || v0 >= v1) return null;
  return { u0, v0, u1, v1 };
}

function parseCell(value: unknown): GroveTopCapCell | null {
  const raw = record(value);
  if (!raw || raw.rendered !== true) return null;
  const cellId = text(raw.cellId);
  const matchingSideCellId = text(raw.matchingSideCellId);
  const matchingSideCellIndex = integer(raw.matchingSideCellIndex);
  const cellIndex = integer(raw.cellIndex);
  const row = integer(raw.row); const col = integer(raw.col);
  const groveConfig = text(raw.groveConfig); const bakedYaw = integer(raw.bakedYaw);
  const sourceCompositionDigest = text(raw.sourceCompositionDigest);
  const uvRect = parseUv(raw.uvRect);
  const alphaTightBoundsUV = parseUv(raw.alphaTightBoundsUV);
  const capHeightWorld = finite(raw.capHeightWorld);
  const tightWorldWidth = finite(raw.tightWorldWidth);
  const tightWorldDepth = finite(raw.tightWorldDepth);
  const bounds = record(raw.tightWorldBounds);
  if (!cellId || !matchingSideCellId || matchingSideCellIndex === null || cellIndex === null
    || row === null || col === null || !groveConfig || bakedYaw === null
    || !sourceCompositionDigest || !uvRect || !alphaTightBoundsUV || capHeightWorld === null
    || tightWorldWidth === null || tightWorldDepth === null || !bounds) return null;

  const rightMin = finite(bounds.rightMin); const rightMax = finite(bounds.rightMax);
  const depthMin = finite(bounds.depthMin); const depthMax = finite(bounds.depthMax);
  if (rightMin === null || rightMax === null || depthMin === null || depthMax === null
    || rightMin >= rightMax || depthMin >= depthMax || tightWorldWidth <= 0 || tightWorldDepth <= 0) return null;
  if (cellIndex < 0 || cellIndex >= 24 || matchingSideCellIndex < 0 || matchingSideCellIndex >= 24
    || row < 0 || row >= 4 || col < 0 || col >= 6 || cellIndex !== row * 6 + col) return null;
  if (!/^G[1-6]$/.test(groveConfig) || col !== Number(groveConfig.slice(1)) - 1) return null;
  const identity = /^([A-Za-z0-9]+)_yaw(-?\d+)$/.exec(matchingSideCellId);
  if (!identity || identity[1] !== groveConfig || Number(identity[2]) !== bakedYaw) return null;
  if (cellId !== `GTOP_${groveConfig}_yaw${bakedYaw}`) return null;
  if (matchingSideCellIndex !== cellIndex) return null;
  if (!sourceCompositionDigest.startsWith('sha256:')) return null;
  if (alphaTightBoundsUV.u0 < uvRect.u0 || alphaTightBoundsUV.v0 < uvRect.v0
    || alphaTightBoundsUV.u1 > uvRect.u1 || alphaTightBoundsUV.v1 > uvRect.v1) return null;

  return { cellId, matchingSideCellId, matchingSideCellIndex, cellIndex, row, col,
    groveConfig, bakedYaw, sourceCompositionDigest, uvRect, alphaTightBoundsUV,
    capHeightWorld, tightWorldWidth, tightWorldDepth,
    tightWorldBounds: { rightMin, rightMax, depthMin, depthMax } };
}

export function parseGroveTopCapMeta(value: unknown): GroveTopCapMeta | null {
  try {
    const raw = record(value);
    if (!raw || raw.schema_version !== 1 || raw.kind !== 'grove_top_cap'
      || raw.incomplete !== false || raw.exit_code !== 0) return null;
    const atlasRaw = record(raw.atlas);
    const capHeight = record(raw.cap_height);
    if (!atlasRaw || !capHeight) return null;
    if (atlasRaw.width !== 3072 || atlasRaw.height !== 2048 || atlasRaw.cell_width !== 512
      || atlasRaw.cell_height !== 512 || atlasRaw.cols !== 6 || atlasRaw.rows !== 4) return null;
    const file = text(atlasRaw.file); const sha256 = text(atlasRaw.sha256);
    const capHeightMethod = text(capHeight.method);
    if (!file || !sha256 || !capHeightMethod || !Array.isArray(raw.cells) || raw.cells.length !== 24) return null;
    const cells = raw.cells.map(parseCell);
    if (cells.some((cell) => cell === null)) return null;
    const validCells = cells as GroveTopCapCell[];
    const indices = new Set(validCells.map((cell) => cell.cellIndex));
    const ids = new Set(validCells.map((cell) => cell.cellId));
    const sideIds = new Set(validCells.map((cell) => cell.matchingSideCellId));
    if (indices.size !== 24 || ids.size !== 24 || sideIds.size !== 24
      || [...indices].some((index) => index < 0 || index > 23)) return null;
    const digestByConfig = new Map<string, string>();
    for (const cell of validCells) {
      const digest = digestByConfig.get(cell.groveConfig);
      if (digest !== undefined && digest !== cell.sourceCompositionDigest) return null;
      digestByConfig.set(cell.groveConfig, cell.sourceCompositionDigest);
    }
    return {
      schemaVersion: 1,
      kind: 'grove_top_cap',
      capHeightMethod,
      atlas: { file, width: 3072, height: 2048, cellWidth: 512, cellHeight: 512,
        cols: 6, rows: 4, sha256 },
      cells: validCells,
    };
  } catch {
    return null;
  }
}

export function createGroveTopCapMapping(
  meta: GroveTopCapMeta,
  sideCells: readonly ImpostorCellRef[],
): GroveTopCapMapping | null {
  if (meta.cells.length !== 24) return null;
  const topByIdentity = new Map<string, GroveTopCapCell>();
  for (const top of meta.cells) {
    const identity = `${top.groveConfig}:${top.bakedYaw}`;
    if (topByIdentity.has(identity)) return null;
    topByIdentity.set(identity, top);
  }
  const mapping = new Map<string, GroveTopCapCell>();
  const usedTopCells = new Set<string>();
  for (const side of sideCells) {
    if (side.kind !== 'grove' || side.groveConfig === null || !Number.isInteger(side.yawDeg)) continue;
    if (side.key !== `grove:${side.groveConfig}:${side.yawDeg}`) return null;
    const top = topByIdentity.get(`${side.groveConfig}:${side.yawDeg}`);
    if (!top || top.matchingSideCellId !== `${side.groveConfig}_yaw${side.yawDeg}`
      || usedTopCells.has(top.cellId)) return null;
    mapping.set(side.key, top);
    usedTopCells.add(top.cellId);
  }
  const groveCount = sideCells.filter((cell) => cell.kind === 'grove').length;
  return mapping.size === groveCount ? mapping : null;
}
