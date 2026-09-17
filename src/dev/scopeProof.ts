import type { ElevationGrid } from '../types';

const METERS_PER_LATITUDE_DEGREE = 111_320;

export interface ScopeProofBounds {
  north: number;
  south: number;
  west: number;
  east: number;
}

export interface ScopeProofCandidate {
  id: string;
  label: string;
  /** null = clip しない(= current / off) */
  bounds: ScopeProofBounds | null;
}

const AUDIT_B_BOUNDS: ScopeProofBounds = {
  north: 35.6450,
  south: 35.6155,
  west: 139.2210,
  east: 139.2745,
};

/**
 * ADJUSTED bounds。AUDIT B の screen hole を地理方向別に実測し、
 * west / south / east は overshoot max(204 / 142 / 242 m)を包含するまで広げ、
 * north のみ overshoot P50(実測 433〜550 m)相当の +557 m に留めたもの。
 * 導出根拠: outputs/matsu-h01-scene-scope-visual-proof/bounds-analysis.md §3。
 */
const ADJUSTED_BOUNDS: ScopeProofBounds = {
  north: 35.6500,
  south: 35.6142,
  west: 139.21875,
  east: 139.2772,
};

/** 'off' と 'current' は現在の scene を一切 clip しない。 */
export const SCOPE_PROOF_CANDIDATES: readonly ScopeProofCandidate[] = [
  { id: 'off', label: 'OFF (production default)', bounds: null },
  { id: 'current', label: 'CURRENT', bounds: null },
  { id: 'audit-b', label: 'AUDIT B', bounds: { ...AUDIT_B_BOUNDS } },
  { id: 'adjusted', label: 'ADJUSTED', bounds: { ...ADJUSTED_BOUNDS } },
];

export interface ScopeProofSelection {
  id: string;
  label: string;
  bounds: ScopeProofBounds | null;
  /** 不正入力を安全側へ倒したときの理由。正常時は null。 */
  fallbackReason: string | null;
}

const copyBounds = (bounds: ScopeProofBounds | null): ScopeProofBounds | null =>
  bounds === null ? null : { ...bounds };

/** "N,S,W,E" 形式(10進度)をパースする。不正なら undefined。 */
export function parseScopeProofBounds(
  raw: string | null | undefined,
): ScopeProofBounds | undefined {
  if (raw === null || raw === undefined) return undefined;

  const parts = raw.split(',').map((part) => part.trim());
  if (parts.length !== 4 || parts.some((part) => part.length === 0)) {
    return undefined;
  }

  const [north, south, west, east] = parts.map(Number);
  if (![north, south, west, east].every(Number.isFinite)) return undefined;
  if (north <= south || east <= west) return undefined;
  if (south < -90 || north > 90 || west < -180 || east > 180) return undefined;

  return { north, south, west, east };
}

/** クエリ値から選択を決める。production では常に完全な OFF。 */
export function resolveScopeProofSelection(
  params: { scopeProof: string | null; scopeProofBounds: string | null },
  isDev: boolean,
): ScopeProofSelection {
  const off = SCOPE_PROOF_CANDIDATES[0];
  if (!isDev) {
    return {
      id: off.id,
      label: off.label,
      bounds: null,
      fallbackReason: 'not-dev',
    };
  }

  const requestedId = params.scopeProof ?? '';
  const candidate = requestedId === ''
    ? off
    : SCOPE_PROOF_CANDIDATES.find(({ id }) => id === requestedId);
  let selection: ScopeProofSelection;
  if (candidate === undefined) {
    selection = {
      id: off.id,
      label: off.label,
      bounds: null,
      fallbackReason: `unknown-candidate:${requestedId}`,
    };
  } else {
    selection = {
      id: candidate.id,
      label: candidate.label,
      bounds: copyBounds(candidate.bounds),
      fallbackReason: null,
    };
  }

  if (params.scopeProofBounds !== null) {
    const parsedBounds = parseScopeProofBounds(params.scopeProofBounds);
    if (parsedBounds === undefined) {
      selection.fallbackReason = `invalid-bounds:${params.scopeProofBounds}`;
    } else if (selection.id !== 'off') {
      selection.bounds = parsedBounds;
    }
  }

  return selection;
}

export interface ScopeProofWorldXZ {
  x: number;
  z: number;
}

/** lat/lng を terrain の identity-transform world 座標(m)へ写す。 */
export function latLngToWorldXZ(
  lat: number,
  lng: number,
  grid: ElevationGrid,
): ScopeProofWorldXZ {
  const col = (lng - grid.bounds.west)
    / (grid.bounds.east - grid.bounds.west)
    * (grid.cols - 1);
  const row = (grid.bounds.north - lat)
    / (grid.bounds.north - grid.bounds.south)
    * (grid.rows - 1);
  return {
    x: col * grid.cellSizeMeters,
    z: row * grid.cellSizeMeters,
  };
}

/** terrain world 座標(m)を lat/lng へ戻す。 */
export function worldXZToLatLng(
  x: number,
  z: number,
  grid: ElevationGrid,
): { lat: number; lng: number } {
  const col = x / grid.cellSizeMeters;
  const row = z / grid.cellSizeMeters;
  return {
    lat: grid.bounds.north
      - row / (grid.rows - 1) * (grid.bounds.north - grid.bounds.south),
    lng: grid.bounds.west
      + col / (grid.cols - 1) * (grid.bounds.east - grid.bounds.west),
  };
}

export interface ScopeProofClipPlane {
  normal: { x: number; y: number; z: number };
  constant: number;
  /** どの辺を表す plane か */
  edge: 'north' | 'south' | 'west' | 'east';
}

/** bounds 内側(normal・p + constant >= 0)だけを残す4平面。 */
export function computeScopeProofClipPlanes(
  bounds: ScopeProofBounds,
  grid: ElevationGrid,
): readonly ScopeProofClipPlane[] {
  const xW = latLngToWorldXZ(bounds.north, bounds.west, grid).x;
  const xE = latLngToWorldXZ(bounds.north, bounds.east, grid).x;
  const zN = latLngToWorldXZ(bounds.north, bounds.west, grid).z;
  const zS = latLngToWorldXZ(bounds.south, bounds.west, grid).z;

  return [
    { edge: 'north', normal: { x: 0, y: 0, z: 1 }, constant: -zN },
    { edge: 'south', normal: { x: 0, y: 0, z: -1 }, constant: zS },
    { edge: 'west', normal: { x: 1, y: 0, z: 0 }, constant: -xW },
    { edge: 'east', normal: { x: -1, y: 0, z: 0 }, constant: xE },
  ];
}

export interface ScopeProofMetrics {
  widthMeters: number;
  heightMeters: number;
  areaKm2: number;
  /** 現 terrain mesh の実効 span に対する面積比。 */
  ratioOfCurrent: number;
}

const longitudeMetersPerDegree = (grid: ElevationGrid): number => {
  const centerLatitude = (grid.bounds.north + grid.bounds.south) / 2;
  return METERS_PER_LATITUDE_DEGREE * Math.cos(centerLatitude * Math.PI / 180);
};

/** demLoader と同じ等距円筒近似による bounds の物理指標。 */
export function computeScopeProofMetrics(
  bounds: ScopeProofBounds,
  grid: ElevationGrid,
): ScopeProofMetrics {
  const widthMeters = (bounds.east - bounds.west) * longitudeMetersPerDegree(grid);
  const heightMeters = (bounds.north - bounds.south) * METERS_PER_LATITUDE_DEGREE;
  const areaKm2 = widthMeters * heightMeters / 1_000_000;
  const currentAreaMeters2 = (grid.cols - 1) * grid.cellSizeMeters
    * (grid.rows - 1) * grid.cellSizeMeters;
  return {
    widthMeters,
    heightMeters,
    areaKm2,
    ratioOfCurrent: currentAreaMeters2 === 0
      ? 0
      : widthMeters * heightMeters / currentAreaMeters2,
  };
}

export interface ScopeProofEdgeAttribution {
  pixels: number;
  pixelShare: number;
  terrainShare: number;
  overshootMetersP50: number;
  overshootMetersP90: number;
  overshootMetersP99: number;
  overshootMetersMax: number;
  /** この辺の違反画素のうち最も遠い点。 */
  farthestLatLng: { lat: number; lng: number } | null;
}

export interface ScopeProofAttribution {
  width: number;
  height: number;
  totalPixels: number;
  terrainPixels: number;
  skyPixels: number;
  insidePixels: number;
  outsidePixels: number;
  holeShareOfScreen: number;
  holeShareOfTerrain: number;
  byEdge: {
    north: ScopeProofEdgeAttribution;
    south: ScopeProofEdgeAttribution;
    west: ScopeProofEdgeAttribution;
    east: ScopeProofEdgeAttribution;
  };
  outsideExtent: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  } | null;
  quantizationMeters: number;
  notes: string[];
}

type Edge = keyof ScopeProofAttribution['byEdge'];

interface MutableEdgeAttribution {
  overshoots: number[];
  farthestDistance: number;
  farthestLatLng: { lat: number; lng: number } | null;
}

const percentileFromSorted = (sorted: readonly number[], fraction: number): number => {
  if (sorted.length === 0) return 0;
  const position = (sorted.length - 1) * fraction;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const blend = position - lowerIndex;
  return sorted[lowerIndex] * (1 - blend) + sorted[upperIndex] * blend;
};

const safeShare = (numerator: number, denominator: number): number =>
  denominator === 0 ? 0 : numerator / denominator;

/**
 * Cell-ID render の RGBA8 buffer を地理的な hole attribution へ変換する。
 * B < 128 は sky、R/G はそれぞれ col/row の8-bit量子値として扱う。
 */
export function classifyScopeProofPixels(
  pixels: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  grid: ElevationGrid,
  bounds: ScopeProofBounds,
): ScopeProofAttribution {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new RangeError('Scope proof dimensions must be positive integers.');
  }
  const totalPixels = width * height;
  if (pixels.length !== totalPixels * 4) {
    throw new RangeError('Scope proof RGBA buffer length does not match dimensions.');
  }

  const edges: Record<Edge, MutableEdgeAttribution> = {
    north: { overshoots: [], farthestDistance: -Infinity, farthestLatLng: null },
    south: { overshoots: [], farthestDistance: -Infinity, farthestLatLng: null },
    west: { overshoots: [], farthestDistance: -Infinity, farthestLatLng: null },
    east: { overshoots: [], farthestDistance: -Infinity, farthestLatLng: null },
  };
  const longitudeScale = longitudeMetersPerDegree(grid);
  let terrainPixels = 0;
  let insidePixels = 0;
  let outsidePixels = 0;
  let outsideExtent: ScopeProofAttribution['outsideExtent'] = null;

  const recordViolation = (
    edge: Edge,
    distanceMeters: number,
    lat: number,
    lng: number,
  ): void => {
    const accumulator = edges[edge];
    accumulator.overshoots.push(distanceMeters);
    if (distanceMeters > accumulator.farthestDistance) {
      accumulator.farthestDistance = distanceMeters;
      accumulator.farthestLatLng = { lat, lng };
    }
  };

  for (let pixelIndex = 0; pixelIndex < totalPixels; pixelIndex += 1) {
    const offset = pixelIndex * 4;
    if (pixels[offset + 2] < 128) continue;

    terrainPixels += 1;
    const col = pixels[offset] / 255 * (grid.cols - 1);
    const row = pixels[offset + 1] / 255 * (grid.rows - 1);
    const { lat, lng } = worldXZToLatLng(
      col * grid.cellSizeMeters,
      row * grid.cellSizeMeters,
      grid,
    );
    const violatesNorth = lat > bounds.north;
    const violatesSouth = lat < bounds.south;
    const violatesWest = lng < bounds.west;
    const violatesEast = lng > bounds.east;
    const isOutside = violatesNorth || violatesSouth || violatesWest || violatesEast;

    if (!isOutside) {
      insidePixels += 1;
      continue;
    }

    outsidePixels += 1;
    if (outsideExtent === null) {
      outsideExtent = { minLat: lat, maxLat: lat, minLng: lng, maxLng: lng };
    } else {
      outsideExtent.minLat = Math.min(outsideExtent.minLat, lat);
      outsideExtent.maxLat = Math.max(outsideExtent.maxLat, lat);
      outsideExtent.minLng = Math.min(outsideExtent.minLng, lng);
      outsideExtent.maxLng = Math.max(outsideExtent.maxLng, lng);
    }

    if (violatesNorth) {
      recordViolation('north', (lat - bounds.north) * METERS_PER_LATITUDE_DEGREE, lat, lng);
    }
    if (violatesSouth) {
      recordViolation('south', (bounds.south - lat) * METERS_PER_LATITUDE_DEGREE, lat, lng);
    }
    if (violatesWest) {
      recordViolation('west', (bounds.west - lng) * longitudeScale, lat, lng);
    }
    if (violatesEast) {
      recordViolation('east', (lng - bounds.east) * longitudeScale, lat, lng);
    }
  }

  const finishEdge = (edge: Edge): ScopeProofEdgeAttribution => {
    const accumulator = edges[edge];
    const count = accumulator.overshoots.length;
    const sortedOvershoots = [...accumulator.overshoots].sort((a, b) => a - b);
    return {
      pixels: count,
      pixelShare: safeShare(count, totalPixels),
      terrainShare: safeShare(count, terrainPixels),
      overshootMetersP50: percentileFromSorted(sortedOvershoots, 0.50),
      overshootMetersP90: percentileFromSorted(sortedOvershoots, 0.90),
      overshootMetersP99: percentileFromSorted(sortedOvershoots, 0.99),
      overshootMetersMax: count === 0 ? 0 : accumulator.farthestDistance,
      farthestLatLng: accumulator.farthestLatLng,
    };
  };

  return {
    width,
    height,
    totalPixels,
    terrainPixels,
    skyPixels: totalPixels - terrainPixels,
    insidePixels,
    outsidePixels,
    holeShareOfScreen: safeShare(outsidePixels, totalPixels),
    holeShareOfTerrain: safeShare(outsidePixels, terrainPixels),
    byEdge: {
      north: finishEdge('north'),
      south: finishEdge('south'),
      west: finishEdge('west'),
      east: finishEdge('east'),
    },
    outsideExtent,
    quantizationMeters: Math.max(
      (grid.cols - 1) / 255,
      (grid.rows - 1) / 255,
    ) * grid.cellSizeMeters,
    notes: [
      'Cell IDs use 8-bit col/row quantization; quantizationMeters reports the larger channel step in world meters.',
      'Edge counts are independent, so a corner pixel may be counted against two edges.',
    ],
  };
}
