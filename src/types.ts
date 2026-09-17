export interface LatLng {
  lat: number;
  lng: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** 標高グリッド。row-major順、北西端から東・南方向へ格納 */
export interface ElevationGrid {
  cols: number;
  rows: number;
  values: Float32Array; // 標高値(m)。長さ = cols * rows
  cellSizeMeters: number; // 1セルが表す実世界の水平距離(m)
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

/**
 * downsample 前のフル解像度DEM。
 * 現行 z14 3x3 tiles では cols=rows=768、cellSizeMeters は約 7.766。
 * values は row-major、row 0 = 北端、col 0 = 西端(既存 ElevationGrid と同一の並び)。
 */
export interface DemFullResolution {
  cols: number;
  rows: number;
  values: Float32Array; // 長さ cols*rows、標高(m)
  cellSizeMeters: number; // 1 texel が表す実距離(m)
}

/**
 * DEM 読み込み結果。grid は既存 loadDemTiles の戻り値と完全に同一のもの。
 * fullResolution は実DEMタイル読み込みに成功したときのみ存在し、
 * synthetic fallback 時は undefined(呼び出し側は必ず undefined 分岐を持つこと)。
 */
export interface DemLoadResult {
  grid: ElevationGrid;
  fullResolution?: DemFullResolution;
}

/**
 * 接空間(tangent space)法線フィールド。各成分は単位ベクトル (x, y, z):
 *   x = +u 方向成分(terrainUv.ts の u は grid col 増加方向 = world +X)
 *   y = +v 方向成分(terrainUv.ts の v = 1 - row/(rows-1) なので +v = world -Z)
 *   z = 面法線方向成分(world +Y)。常に z > 0。
 * values は長さ cols*rows*3、row-major、row 0 = 北端。
 */
export interface TangentNormalField {
  cols: number;
  rows: number;
  values: Float32Array;
}

/** PoC用仮ルート/将来の公式ルートを型レベルで区別する(Phase1で本格利用) */
export interface RoutePoint {
  lat: number;
  lng: number;
  label?: string;
  poiId?: string; // stable identifier; not used to decide visibility (route fact data)
}

export interface RoutePath {
  points: RoutePoint[];
  isOfficial: false; // PoC v0.1では常にfalse(仮ルート)。公式データ確保時に型を拡張する
  source?: string;
  sourceType?: string;
  retrievedDate?: string;
  license?: string;
  attributionText?: string;
}

/**
 * ルート進行アニメーションの設定値(Phase 2)。
 * 再生時間・待機時間は最終仕様確定ではなくWorking Assumption(8〜15秒程度)であり、
 * 設定値として変更しやすいようAppSettings経由で注入する。
 */
export interface AnimationConfig {
  playDurationMs: number; // 0%→100%までの所要時間(ms)。Working Assumption: 8000〜15000
  holdAtEndMs: number; // 100%到達後、再度0%から開始するまでの待機時間(ms)
}

/**
 * 時間ベースのアニメーション進行状態(Phase 2)。
 * elapsedMsは現在の再生サイクル内の経過時間(ms)であり、
 * 0 <= elapsedMs < cycleDurationMs(config)(= playDurationMs + holdAtEndMs)の範囲に保たれる。
 * フレームレートに依存させず、rAFから得られる実時間の差分(deltaMs)で進行させるための状態。
 */
export interface AnimationState {
  elapsedMs: number;
}

export interface AppSettings {
  resolutionWidth: number; // 1920 (Working Assumption A4)
  resolutionHeight: number; // 1080
  loopDurationSec: number; // 20〜30 (Working Assumption A3。サイネージ全体ループの目安、Phase 2のroute進行時間とは別概念)
  terrainOrigin: LatLng; // 3D空間原点に対応する地理座標(高尾山頂付近を基準点とする)
  elevationScale: number; // 標高(m)→3D空間高さのスケール係数
  metersPerUnit: number; // 水平方向 1m を 3D空間の何単位にするか(通常1.0)
  routeAnimation: AnimationConfig; // Phase 2: ルート進行アニメーションの再生時間・待機時間
  visual: VisualSettings;
  cameraState: CameraStateConfig; // new (Phase 4)
  labels: LabelConfig; // new (Phase 4)
}

export interface RouteHaloLayerConfig {
  widthPx: number;
  opacity: number;
  color: number;
}

export interface RouteVisualConfig {
  baseLayer: { color: number; opacity: number; widthPx: number };
  coreColor: number;
  coreWidthPx: number;
  haloLayers: RouteHaloLayerConfig[];
}

export interface RouteHeadMarkerConfig {
  enabled: boolean;
  radiusMeters: number;
  color: number;
  glowRadiusMeters: number;
  glowOpacity: number;
  directionCue: RouteDirectionCueConfig;
}

export interface RouteDirectionCueConfig {
  dashCount: number;
  spacingMeters: number;
  radiusMeters: number;
  minOpacity: number;
  maxOpacity: number;
  pulsePeriodMs: number;
  phaseStep: number;
}

export interface TerrainEdgeFadeConfig {
  enabled: boolean;
  fadeStartFactor: number; // 0..1。中心からの正規化距離がこの値を超えた頂点からフェード開始
  fadeColor: number; // フェード先の色(background.fogColorと合わせることを推奨)
}

export interface TerrainTextureColorAdjustConfig {
  saturation: number; // 1 = 変更なし。1より大きいほど彩度アップ
  contrast: number; // 1 = 変更なし。0.5を中心にストレッチ
  brightness: number; // 1 = 変更なし(乗算)
}

export type TerrainSurfaceVariantId = 'baseline' | 'c1' | 'c2' | 'c3' | 'c4';

export type CanopySurfaceVariantId = 'off' | 'base' | 'a' | 'b';

export interface CanopySurfaceParameters {
  exposure: number;
  saturation: number;
  shadowLift: number;
  warmth: number;
  shoulder: number;
  detailStrength: number;
  detailScale: number;
  crownSizeMeters: number;
  crownDensity: number;
  gapContrast: number;
  detailFade: number;
  detailNearMeters: number;
  detailFarMeters: number;
  hazeStrength: number;
  hazeNearMeters: number;
  hazeFarMeters: number;
  patchStrength: number;
  patchScaleMeters: number;
  tilePeriodMeters: number;
  tileResolution: number;
  seed: number;
  aerialResolution: number;
  heightScale: number;
  weight: number;
  blurRadiusTexels: number;
}

export interface CanopySurfaceConfig {
  defaultVariant: 'off';
  parameters: CanopySurfaceParameters;
}

/** variant ID から導出される機能フラグ。 */
export interface TerrainSurfaceFlags {
  variantId: TerrainSurfaceVariantId;
  multiScaleHillshade: boolean; // c1, c3, c4
  demNormalMap: boolean; // c2, c3, c4
  canopyDetailNormal: boolean; // c4
}

export interface MultiScaleHillshadeScaleConfig {
  stepPixels: number; // フル解像度DEM上の中央差分ステップ(px、整数 >= 1)
  // 実効基線長 = 2 * stepPixels * cellSizeMeters
  weight: number; // 合成重み(> 0)
}

export interface MultiScaleHillshadeConfig {
  scales: MultiScaleHillshadeScaleConfig[]; // 1 個以上
  slopeExaggeration: number; // 勾配の誇張倍率(> 0、1 = 誇張なし)
  minFactor: number; // 出力係数の下限(> 0、<= 1)
  maxFactor: number; // 出力係数の上限(>= 1、> minFactor)
}

export interface DemNormalMapConfig {
  coarseStepPixels: number; // ハイパスの基準となる粗ステップ(px、整数 >= 1)。
  // 既定 3 = 現行 mesh stride。この波長より長い成分は
  // 既に mesh geometry が持つので normal map から除去する。
  strength: number; // 残差勾配の倍率(>= 0)
}

export interface CanopyDetailNormalConfig {
  resolution: number; // 輝度グリッド一辺(px)。768 / 1536 / 3072 のいずれか
  blurRadiusTexels: number; // ハイパス用 box blur 半径(texel、整数 >= 0。0 = 実質無効)
  heightScale: number; // 高域輝度差を擬似標高(m)へ変換する係数(>= 0)
  weight: number; // DEM法線への加算重み(0..1)
}

export interface TerrainSurfaceConfig {
  defaultVariant: TerrainSurfaceVariantId; // `?terrainSurface=` 未指定時に使う variant
  hillshade: MultiScaleHillshadeConfig;
  demNormal: DemNormalMapConfig;
  canopy: CanopyDetailNormalConfig;
  normalMapResolution: number; // canopy 無効時の normal map 一辺(px、整数 >= 1)。既定 768
  normalScale: number; // MeshStandardMaterial.normalScale に設定する値(>= 0)
}

export interface TerrainMaterialConfig {
  lowElevationColor: number;
  highElevationColor: number;
  roughness: number;
  metalness: number;
  hillshadeMinFactor: number; // 影になった斜面の明るさ倍率(標高色に掛ける係数)。1未満で暗くなる
  hillshadeMaxFactor: number; // 光が当たる斜面の明るさ倍率。1より大きくすることで標高色より明るくブーストできる
  textureUrl?: string; // ローカルにバンドルしたテクスチャの相対パス。未指定時は既存の頂点色表示へフォールバックする
  textureRepeat?: { x: number; y: number }; // テクスチャのX/Y方向タイリング倍率
  edgeFade?: TerrainEdgeFadeConfig; // 未指定時はフェードなし(既存の頂点色表示へフォールバック)。T2でterrain edge fadeを実装する際に既存呼び出し元との互換を保つためoptionalとする
  textureHillshadeMinFactor?: number; // テクスチャ使用時に軽く重ねるhillshadeの下限係数。未指定時は1
  textureHillshadeMaxFactor?: number; // 同、上限係数。未指定時は1
  textureTintStrength?: number; // テクスチャ使用時、標高tintを何%の強さで乗算するか(0..1)。未指定時は挙動変更なし
  textureColorAdjust?: TerrainTextureColorAdjustConfig; // テクスチャ画像自体の彩度/コントラスト/明度調整。未指定時は無調整
}

export interface LightingConfig {
  hemisphereSkyColor: number;
  hemisphereGroundColor: number;
  hemisphereIntensity: number;
  directionalColor: number;
  directionalIntensity: number;
  directionalPosition: Vec3;
}

export interface BackgroundFogConfig {
  gradientTopColor: string; // '#RRGGBB' 形式
  gradientBottomColor: string; // '#RRGGBB' 形式
  fogColor: number;
  fogNearFactor: number;
  fogFarFactor: number;
  gradientMidColor?: string; // '#RRGGBB' 形式。未指定時は既存の2-stopグラデーションのまま
  gradientMidStopPercent?: number; // (0,100)。未指定時は45
  fogMode?: 'linear' | 'exp2'; // 未指定時は既存のlinear(computeFogRange)挙動
  fogDensityFactor?: number; // fogMode: 'exp2' 用。未指定時は1
}

export interface ArrivalCardConfig {
  enabled: boolean;
  position: 'bottom-center';
  bottomMarginPx: number;
  fadeMs: number;
  slideOffsetPx: number;
  backgroundColor: string;
  textColor: string;
  accentColor: number;
}

export interface VisualSettings {
  route: RouteVisualConfig;
  routeHeadMarker: RouteHeadMarkerConfig;
  terrain: TerrainMaterialConfig;
  terrainSurface?: TerrainSurfaceConfig; // 未指定時は本Phaseの全機能が無効 = 既存挙動と完全一致
  lighting: LightingConfig;
  background: BackgroundFogConfig;
  waypoints: WaypointMarkerConfig;
  arrivalCard: ArrivalCardConfig;
  forest?: ForestConfig;
}

export interface WaypointMarkerConfig {
  enabled: boolean;
  style: 'pin-stand' | 'anchor-box'; // ①②系のスタンド型ピン or ③系の白背景ボックス+アンカー
  headRadiusMeters: number;
  standHeightMeters: number;
  color: number;
  glow?: WaypointMarkerGlowConfig;
  beaconRing?: WaypointMarkerBeaconRingConfig;
  emphasizedPoiIds?: readonly string[]; // 強調表示するPOI id。未指定/空配列は強調なし
  emphasis?: WaypointMarkerEmphasisConfig; // 強調時の倍率設定
}

export interface WaypointMarkerEmphasisConfig {
  scaleMultiplier?: number; // 未指定時は1.15
  glowOpacityMultiplier?: number; // 未指定時は1.3
  beaconOpacityMultiplier?: number; // 未指定時は1.2
}

export interface WaypointMarkerGlowConfig {
  enabled: boolean;
  color: number;
  radiusFactor: number; // headRadiusMeters に対する倍率(グロー球半径)
  opacity: number; // AdditiveBlendingの不透明度
}

export interface WaypointMarkerBeaconRingConfig {
  enabled: boolean;
  color: number;
  innerRadiusFactor: number; // headRadiusMeters に対する倍率
  outerRadiusFactor: number;
  opacity: number;
}

export interface LabelPresentationConfig {
  poiId: string; // must exactly match RoutePoint.poiId
  displayText: string; // short text for on-screen display
}

export interface LabelOcclusionConfig {
  epsilonMeters: number;
  throttleFrames: number;
}

export interface LabelDistanceScalingConfig {
  nearDistanceMeters: number; // これ以下はフルスケール
  farDistanceMeters: number; // これ以上はminScale
  minScale: number; // (0,1]
  hideBeyondMeters: number; // これ以上は非表示(farDistanceMetersより大きい値)
}

export interface LabelConfig {
  points: LabelPresentationConfig[];
  heightOffsetMeters: number;
  occlusion: LabelOcclusionConfig;
  distanceScaling: LabelDistanceScalingConfig;
}

export interface CameraTimelineConfig {
  highOverviewHoldMs: number; // high-overviewを静止表示する時間
  descendToOverviewMs: number; // high-overviewから既存overviewへ遷移する時間
  overviewHoldMs: number;
  transitionInMs: number;
  transitionToSummitMs: number;
  summitHoldMs: number;
  returnToOverviewMs: number;
  ascendToHighOverviewMs: number; // 既存overviewへ戻った後、ループ末尾でhigh-overviewへ遷移する時間
  arcLiftMeters: number;
}

export interface RouteFollowConfig {
  behindMeters: number;
  heightMeters: number;
  directionSampleDeltaProgress: number;
  headingSmoothingProgress: number;
  headingLagProgress: number;
  lateralOffsetMeters: number;
  lookAheadProgress: number;
  targetLiftMeters: number;
}

export type RouteFollowSpotEventKind = 'hold' | 'slow-down';

export interface RouteFollowSpotEventConfig {
  poiId: string;
  kind: RouteFollowSpotEventKind;
  decelMs: number;
  midMs: number;
  accelMs: number;
  slowRateFactor?: number;
}

export interface RouteFollowSpotsConfig {
  events: RouteFollowSpotEventConfig[];
}

export interface RouteFollowTimelineSegment {
  kind: 'travel' | 'flat' | 'ease';
  startMs: number;
  endMs: number;
  startProgress: number;
  endProgress: number;
  startRatePerMs: number;
  endRatePerMs: number;
}

export interface CinematicKeyPoseParams {
  progress: number;
  heightMeters: number;
  behindMeters: number;
  lateralOffsetMeters: number;
  headingWindowProgress: number;
  headingReferenceProgress?: number;
  anchorReferenceProgress?: number; // 指定時、position算出のanchor点をkey自身のprogressではなくこの値で計算する(target算出には影響しない)
  lookAheadProgress: number;
  landmarkPoiId?: 'yakuoin' | 'summit';
  landmarkWeight: number;
  targetLiftMeters: number;
}

export interface CinematicRailConfig {
  keyPoses: CinematicKeyPoseParams[];
}

export interface SummitCameraConfig {
  radiusFactor: number;
  heightFactor: number;
}

export interface CameraGuidanceConfig {
  resampleSpacingMeters: number;
  smoothingWindowRadiusMeters: number;
  maxDeviationMeters: number;
}

export interface HighOverviewCameraConfig {
  radiusFactor: number; // 地形対角線長に対する水平距離の倍率。既存overview相当の0.8より大きい値を想定
  heightFactor: number; // 地形対角線長に対する追加高度の倍率。既存overview相当の0.3より大きい値を想定
  orbitDegrees: number; // high-overview保持中に山を周回する角度。0は周回なし(Working Assumption)
  holdDriftStartRadiusFactor?: number; // hold開始時点(t=0)のradiusFactor。未指定時はradiusFactorと同値=ドリフトなし
  holdDriftStartHeightFactor?: number; // hold開始時点(t=0)のheightFactor。未指定時はheightFactorと同値=ドリフトなし
  holdDriftStartAzimuthDegrees?: number; // hold開始時点(t=0)のazimuth度数。未指定時は既存base azimuth(10°)と同値=ドリフトなし
}

export interface OverviewCameraConfig {
  radiusFactor: number; // 地形対角線長に対する水平距離倍率(現状0.8相当)
  heightFactor: number; // 地形対角線長に対する追加高度倍率(現状0.3相当)
  elevationLiftFactor: number; // 最大標高に掛けるリフト係数(現状1.5相当)
}

export interface CameraStateConfig {
  timeline: CameraTimelineConfig;
  follow: RouteFollowConfig;
  routeFollowSpots: RouteFollowSpotsConfig;
  guidance: CameraGuidanceConfig;
  rail: CinematicRailConfig;
  summit: SummitCameraConfig;
  highOverview: HighOverviewCameraConfig;
  overview: OverviewCameraConfig;
}

// ---- 追補10: Forest Representation Technical Spike ----

/** 森林 rendering 方式の A/B variant。'none' は現行(森林なし)と完全に同一。 */
export type ForestVariantId = 'none' | 'instanced' | 'billboard' | 'canopy';

/** variant ID から導出される機能フラグ。 */
export interface ForestFlags {
  variantId: ForestVariantId;
  enabled: boolean;            // 'none' のみ false
  usesInstancedTrees: boolean; // 'instanced'
  usesBillboardCards: boolean; // 'billboard'
  usesCanopyClusters: boolean; // 'canopy'
}

/** 全 variant 共通の placement 設定。variant 間の公平性はこの設定の共有で担保する。 */
export interface ForestPlacementConfig {
  seed: number;                        // 決定論的 placement の唯一の乱数源
  jitterRatio: number;                 // 0..1。セル内のジッタ量(セル辺長比)
  corridorCoreHalfWidthMeters: number; // route からこの距離までは密度 1
  corridorFeatherMeters: number;       // core の外側、密度が 1→0 になる幅
  routeClearanceMeters: number;        // route 中心線からこの距離以内には置かない
  slopeFalloffStartDeg: number;        // この傾斜から密度が落ち始める
  slopeZeroDeg: number;                // この傾斜で密度 0(崖・岩壁)
  distanceFieldCellMeters: number;     // route 距離場のセル寸法
  maxRouteDistanceMeters: number;      // 距離場の打ち切り半径(= core + feather)
}

/** variant 固有の密度と本数上限。三角形予算を揃えるための唯一の調整点。 */
export interface ForestDensityBudget {
  spacingMeters: number;   // 候補グリッドのセル辺長
  maxInstances: number;    // 決定論的間引き後の厳密な上限
}

export interface ForestTreeConfig {          // variant A
  budget: ForestDensityBudget;
  minHeightMeters: number;                    // 16
  maxHeightMeters: number;                    // 26
  crownRadiusRatio: number;                   // 樹高比。0.22 → 3.5〜5.7 m
  crownBaseRatio: number;                     // 樹高比。樹冠下端の高さ 0.30
  crownRadialSegments: number;                // 6
  crownHeightSegments: number;                // 2
  trunkRadiusRatio: number;                   // 0.018
  crownColor: number; trunkColor: number;
  crownBottomShade: number;                   // 0..1。樹冠下端の暗さ(擬似AO)
  colorJitterStrength: number;                // 0..1。instanceColor の振れ幅
}

export interface ForestBillboardConfig {      // variant B
  budget: ForestDensityBudget;
  minHeightMeters: number; maxHeightMeters: number;
  aspectRatio: number;         // カード幅 / 樹高。0.62
  crossQuadCount: number;      // 2(90°交差)
  topCardEnabled: boolean;     // true(俯角対策の水平カード)
  topCardHeightRatio: number;  // 樹高比。0.78 の高さに置く
  topCardSizeRatio: number;    // カード幅比。0.72
  textureSize: number;         // 128(2の冪)
  textureSeed: number;
  alphaTest: number;           // 0.34
  tintColor: number;
  colorJitterStrength: number;
}

export interface ForestCanopyConfig {         // variant C
  budget: ForestDensityBudget;
  minRadiusMeters: number;     // 11
  maxRadiusMeters: number;     // 19
  heightRatio: number;         // 0.62。Y 方向の潰し
  sinkRatio: number;           // 0.34。塊を地表へ埋める深さ(半径比)
  lumpiness: number;           // 0.22。頂点の擬似ノイズ変位(半径比)
  subdivision: number;         // 0 = IcosahedronGeometry detail 0(20三角形)
  color: number;
  bottomShade: number;         // 0..1。塊下面の暗さ(擬似AO)
  colorJitterStrength: number;
}

export interface ForestConfig {
  defaultVariant: ForestVariantId;  // production 既定。必ず 'none'
  placement: ForestPlacementConfig;
  tree: ForestTreeConfig;
  billboard: ForestBillboardConfig;
  canopy: ForestCanopyConfig;
}
