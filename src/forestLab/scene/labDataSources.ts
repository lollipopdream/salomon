import { forestImpostorV2Defaults } from '../../config/defaults/forestImpostorV2';
import { terrainMaterialDefaults } from '../../config/defaults/terrainVisual';
import type { ForestImpostorV2Config } from '../../forest/impostorV2/types';
import type { PatchManifest } from '../labTypes';

// このオブジェクトは OUT/forest-lab-patch-manifest.json の逐語コピーであり、
// 変更する場合は OUT/tools/selectPatch.mjs を再実行して両方を更新すること。
export const PATCH_MANIFEST_JSON = {
  schemaVersion: 1,
  phase: 'matsu-h01-takao-forest-visual-lab-architecture-bakeoff',
  canonical: {
    rows: 256,
    cols: 256,
    cellSizeMeters: 23.297845093498204,
    terrainUvExtentMeters: 5940.950498842042,
    maskExtentMeters: 5940.950684,
    maskSize: 1024,
    maskSha256: '3163ecefb4266abf2a97d0d01a9ccfacb257ccbe8e34666bf115c6da0d8ecaba',
    demTiles: [
      '/data/dem/14/14528/6453.png',
      '/data/dem/14/14528/6454.png',
      '/data/dem/14/14528/6455.png',
      '/data/dem/14/14529/6453.png',
      '/data/dem/14/14529/6454.png',
      '/data/dem/14/14529/6455.png',
      '/data/dem/14/14530/6453.png',
      '/data/dem/14/14530/6454.png',
      '/data/dem/14/14530/6455.png',
    ],
    bounds: {
      north: 35.65729624809628,
      south: 35.603718740697296,
      west: 139.21875,
      east: 139.28466796875,
    },
  },
  globalStats: {
    Lt: 16.773361206054688,
    gRidge: 0.0693817138671875,
    gValley: 0.0806427001953125,
    gSlopeDeg: 24.896850144519586,
    reliefRangeMedianOfCandidates: 369.87220764160156,
  },
  search: { sizeCells: 96, stride: 4, candidates: 1600, survivors: 61 },
  patches: [{
    id: 'A',
    rowStart: 92,
    rowEnd: 188,
    colStart: 36,
    colEnd: 132,
    worldBbox: {
      xMin: 838.7224233659354,
      xMax: 3075.3155523417627,
      zMin: 2143.4017486018347,
      zMax: 4379.994877577662,
      yMin: 242.4633331298828,
      yMax: 620.2366943359375,
    },
    uvBbox: {
      u0: 0.1411764705882353,
      u1: 0.5176470588235293,
      v0: 0.6392156862745098,
      v1: 0.26274509803921575,
    },
    maskBbox: { colStart: 144, colEnd: 530, rowStart: 369, rowEnd: 754 },
    metrics: {
      maskCoverage: 0.8556871914458217,
      forestFraction: 0.8650228504623233,
      nonForestFraction: 0.1349771495376767,
      boundaryDensity: 0.1755765756190881,
      ridgeFraction: 0.06972048039111489,
      valleyFraction: 0.09969178446168563,
      meanSlopeDeg: 30.106375005480626,
      reliefRangeMeters: 377.7733612060547,
      primaryVisible: 0.8224852071005917,
      overviewVisible: 0.9230769230769231,
      routeCoverage: 0.4,
      routePointsInside: 184,
    },
    score: 0.7235598858009247,
    scoreTerms: {
      m1: 0.8409090909090909,
      m2: 0.882882882882883,
      m3: 0.9352092510259884,
      m4: 0.772613065326633,
      m5: 0.5024413242700798,
      m6: 0.88726130904357,
      m7: 0.458852867830424,
      m8: 0.04915887169539767,
    },
    constraintsMet: { H1: true, H2: true, H3: true, H4: true, H5: true },
    selectionReason: 'H1〜H5を満たし、PRIMARY可視性(m1)とridge/valley(m5)を含む総合スコアがtie-break後に最高となったため選定。',
  }],
  patchBDecision: {
    required: false,
    nonForestFraction: 0.1349771495376767,
    threshold: 0.08910179138183594,
    boundaryDensity: 0.1755765756190881,
    boundaryThreshold: 0.01897573471069336,
    reason: 'PATCH Aの非森林率とboundary densityがともに山全体平均の半分以上で、単独で境界評価が可能なためPATCH Bは不要。',
  },
  closeCamera: {
    anchor: {
      row: 118,
      col: 99,
      x: 2306.486664256322,
      y: 379.3669483985287,
      z: 2749.145721032788,
    },
    position: {
      x: 2338.5549312816993,
      y: 390.64722687518235,
      z: 2729.6495608150394,
    },
    target: {
      x: 2306.486664256322,
      y: 379.3669483985287,
      z: 2749.145721032788,
    },
    fov: 45,
    groundClearanceApplied: false,
  },
  cameraTargetAdjustment: {
    PRIMARY: { x: 0, y: 0, z: 0 },
    OVERVIEW: {
      x: -1434.077669222138,
      y: 48.051563446471846,
      z: 311.127571263969,
    },
  },
  derived: {
    forestAreaSquareMeters: 4327146.039246672,
    detailMaxCount: 358,
    crownLatticeCols: 322,
    crownCountNote: 'crownCount は crown lattice 列挙(src/forestLab/shell/crownField.ts)と mask sampling に依存する runtime 量であり、本 script では算出しない。実値は forest-lab-candidate-config.json の runtime.crownCount を参照。',
  },
} as const satisfies PatchManifest;

export const DEM_TILE_URLS = [14528, 14529, 14530].flatMap((x) =>
  [6453, 6454, 6455].map((y) => `/data/dem/14/${x}/${y}.png`),
);

export const TERRAIN_TEXTURE_URL = terrainMaterialDefaults.textureUrl!;
export const FOREST_MASK_URL = forestImpostorV2Defaults.mask.url;
export const FOREST_MASK_SIZE = forestImpostorV2Defaults.mask.size;
export const FOREST_MASK_EXTENT_METERS = forestImpostorV2Defaults.mask.extentMeters;

const {
  groveTopAtlasUrl: omittedGroveTopAtlasUrl,
  groveTopMetaUrl: omittedGroveTopMetaUrl,
  ...sideAssets
} = forestImpostorV2Defaults.assets;
void omittedGroveTopAtlasUrl;
void omittedGroveTopMetaUrl;

export const IMPOSTOR_V2_SIDE_ASSET_CONFIG: ForestImpostorV2Config = {
  ...forestImpostorV2Defaults,
  assets: sideAssets,
};

/** R6 の grove top-cap 専用。side-only config には混ぜず、従来 appearance の fetch を増やさない。 */
export const IMPOSTOR_V2_GROVE_TOP_ASSET_URLS = {
  groveTopAtlasUrl: forestImpostorV2Defaults.assets.groveTopAtlasUrl!,
  groveTopMetaUrl: forestImpostorV2Defaults.assets.groveTopMetaUrl!,
} as const;
