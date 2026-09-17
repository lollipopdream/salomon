/// <reference types="vite/client" />

import {
  Color,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  Plane,
  PerspectiveCamera,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  TextureLoader,
  UnsignedByteType,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import type * as THREE from 'three';

import {
  advanceAnimationState,
  buildRouteFollowTimelineForRoute,
  computeRouteFollowProgress,
  createInitialAnimationState,
} from '../animation/progress';
import {
  computeLookAtTarget,
  computeOverviewCameraPosition,
} from '../camera/cameraController';
import { computeCameraPose } from '../camera/cameraPose';
import { computeRouteFollowAnchor } from '../camera/routeFollowCamera';
import { buildCameraRail } from '../camera/routeFollowRail';
import {
  computeCameraPhase,
  computeRouteFollowStartMs,
} from '../camera/cameraTimeline';
import { ROUTE_FOLLOW_BASE_TRAVEL_MS } from '../config/defaults/cameraSpotHold';
import { assetUrl } from '../config/assetBase';
import { forestDefaults } from '../config/defaults/forest';
import {
  SPOT_ARRIVAL_TIER_BY_POI_ID,
  SPOT_ARRIVAL_TIMING_MS,
} from '../config/defaults/spotArrival';
import {
  FOREST_CAPTURE_ELAPSED_MS,
  resolveCapturePose,
  resolvePopSweepPose,
} from '../dev/forestCapturePoses';
import {
  SCOPE_PROOF_CANDIDATES,
  classifyScopeProofPixels,
  computeScopeProofClipPlanes,
  computeScopeProofMetrics,
  resolveScopeProofSelection,
} from '../dev/scopeProof';
// Matsu H01 Takao Local Still Export: DEV限定`window.__takaoStill`用のposeテーブルと
// bucket/name検証。production buildには影響しない(docs/design.md追補参照)。
import {
  resolveTakaoLocalPose,
  resolveTakaoLocalPoseSpec,
} from '../dev/takaoLocalPoses';
import type { TakaoLocalPoseSpec } from '../dev/takaoLocalPoses';
import type {
  ScopeProofAttribution,
  ScopeProofBounds,
  ScopeProofMetrics,
} from '../dev/scopeProof';
import { createForestController } from '../forest/forestController';
import { resolveForestFlags } from '../forest/forestVariant';
import { forestCandidateDefaults } from '../config/defaults/forestCandidate';
import {
  createForestCandidate,
  type ForestCandidateController,
} from '../forest/candidate/forestCandidateController';
import { resolveForestCandidateFlags } from '../forest/candidate/forestCandidateFlags';
import { forestImpostorV2Defaults } from '../config/defaults/forestImpostorV2';
import {
  createForestImpostorV2,
  type ForestImpostorV2Controller,
} from '../forest/impostorV2/forestImpostorV2Controller';
import { resolveForestImpostorV2Flags } from '../forest/impostorV2/forestImpostorV2Flags';
import { createR10AtlasPreset } from '../forest/impostorV2/r10AtlasPreset';
import { createR10CompositionPreset } from '../forest/impostorV2/r10CompositionPreset';
import { createR10WidePreset } from '../forest/impostorV2/r10WidePreset';
import { configureImpostorTexture } from '../forest/impostorV2/impostorMaterial';
import { farCanopyDefaults } from '../config/defaults/farCanopy';
import { createFarCanopyOverlay, resolveFarCanopyFlags } from '../forest/farCanopyOverlay';
import { DEFAULT_MACRO_SHADE_CONFIG } from '../forest/macroShade';
import { createTerrainHeightSampler } from '../forest/terrainHeightSampler';
import {
  computeAllSpotArrivalStates,
  createIdleSpotArrivalStates,
  resolveSpotArrivalSpecs,
} from '../route/spotArrival';
import { takaoTrail1Route } from '../route/takaoTrail1Route';
import {
  computeRouteDirectionDashTransforms,
  computeRouteHeadMarkerTransform,
  createRouteHeadMarker,
} from '../route/routeHeadMarker';
import { resampleRouteToWorldPoints } from '../route/routePath';
import {
  computeCumulativeDistances,
  getPartialRoutePoints,
} from '../route/routeProgress';
import { computeCameraGuidancePath } from '../route/routeGuidance';
import {
  createWhiteThickRoutePreset,
  resolveRouteStyleFlags,
} from '../route/r11RouteStylePreset';
import { createRouteVisual } from '../route/routeVisual';
import {
  LITE_BACKGROUND_HEIGHT,
  LITE_BACKGROUND_URL,
  LITE_BACKGROUND_WIDTH,
  LITE_ROUTE_LABELS,
  LITE_ROUTE_POINTS,
} from '../presentation/lite2d/liteFixedRoute';
import type { PresentationMode } from '../presentation/lite2d/mode';
import { createLiteRouteOverlay } from '../presentation/lite2d/overlay';
import {
  LITE2D_LOOP_DURATION_MS,
  computeLite2DFrame,
} from '../presentation/lite2d/timeline';
import { loadDemTilesWithFullResolution } from '../terrain/demLoader';
import { generateSyntheticElevationGrid } from '../terrain/syntheticDem';
import { resolveCanopySurfaceFlags } from '../terrain/canopySurfaceVariant';
import type { CanopySurfaceRuntime } from '../terrain/canopySurface';
import { applyTerrainMaterial } from '../terrain/terrainMaterial';
import { buildTerrainGeometry } from '../terrain/terrainMesh';
import { loadTerrainTexture } from '../terrain/terrainTexture';
import { resolvePerfBypassFlags } from './perfBypass';
// Matsu Reference-Driven Terrain (2026-09-10): terrain surface detail の生成。
// すべて初期化時に1回だけ実行し、rAFコールバック内には1行も追加しない
// (per-frame CPU追加ゼロ。docs/design.md追補「Matsu H01 Reference-Driven Terrain」§4参照)。
import { computeDemDetailNormalField } from '../terrain/demNormalMap';
import { computeMultiScaleHillshadeFactors } from '../terrain/multiScaleHillshade';
import { applyDemShadeToTexture } from '../terrain/terrainShadeComposite';
import { extractTextureLuminance } from '../terrain/aerialLuminance';
import { computeCanopyDetailNormalField } from '../terrain/canopyDetailNormal';
import {
  combineTangentNormalFields,
  createNormalMapDataTexture,
  encodeTangentNormalFieldToRgba,
  resampleTangentNormalField,
  resolveNormalFieldTargetSize,
} from '../terrain/normalFieldTexture';
import {
  resolveCanopyResolution,
  resolveTerrainSurfaceFlags,
} from '../terrain/terrainVariant';
import type {
  AppSettings,
  BackgroundFogConfig,
  DemLoadResult,
  ElevationGrid,
  Vec3,
} from '../types';
import { createFramePacingRecorder } from '../perf/framePacing';
import { createCameraMotionRecorder } from '../perf/cameraMotionMetrics';
import { createHotPathProfiler } from '../perf/hotPathProfiling';
import { resolveBenchmarkModeFlags } from '../perf/benchmarkMode';
import { createStableBenchmark } from '../perf/stableBenchmark';
import {
  parseIsolationVariant,
  resolveIsolationFlags,
} from '../perf/binaryIsolation';
import {
  applyCameraDiagVariant,
  createInitialCameraPoseSmoothingState,
} from '../camera/cameraPoseSmoothing';
import type { CameraDiagVariant } from '../camera/cameraPoseSmoothing';
import { computeEffectiveMotionDeltaMs } from '../animation/progress';
import type { MotionClockConfig } from '../animation/progress';
import { computeSummitArrivalState } from '../route/spotArrival';
import type { SpotArrivalState } from '../route/spotArrival';
import {
  DEFAULT_MANUAL_ORBIT_OPTIONS,
  applyDragDelta,
  orbitPositionFromState,
  orbitStateFromPose,
} from '../interaction/manualOrbit';
import type { OrbitState } from '../interaction/manualOrbit';
import {
  createOrbitInputState,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
} from '../interaction/pointerOrbit';
import type { OrbitInputState } from '../interaction/pointerOrbit';
import { applyBackgroundAndFog } from './background';
// Matsu H01 Takao Local Still Export: `window.__takaoStill.setChrome()`が
// attribution overlayを識別するためのhref参照のみ(表示文言・生成ロジックには
// 触れない)。
import { ATTRIBUTION_HREF } from './attribution';
import { createArrivalCard } from './arrivalCard';
import { resolveLabelLayerPromotionFlags } from './labelLayerPromotion';
import { resolveLabelPerfBypassFlags } from './labelPerfBypass';
import { createLabelRenderer } from './labelRenderer';
import { createSceneLights } from './lighting';
import { computeEffectivePixelRatio } from './pixelRatio';
import { createGpuFrameTimer, FixedRingBuffer } from './gpuFrameTimer';

/**
 * Matsu Phase 4 (2026-09-09): summit到着中(transition-to-summit / summit-hold)は
 * spotArrivalSpecs内の`poiId==='summit'`エントリだけを時間ベースのarrival状態へ
 * 差し替える。他スポットはidleのまま(route-follow終了後の一瞬だけ発火していた
 * 既存の欠落を解消する、docs/design.md追補§0-6/§7参照)。
 */
function mergeSummitArrivalStateForPhase(
  baseStates: SpotArrivalState[],
  phaseKind: 'transition-to-summit' | 'summit-hold',
  phaseElapsedMs: number,
  transitionToSummitMs: number,
  summitHoldMs: number,
  timing: { approachMs: number; dwellMs: number; departMs: number },
): SpotArrivalState[] {
  const summitState = computeSummitArrivalState(
    { phaseKind, phaseElapsedMs, transitionToSummitMs, summitHoldMs },
    timing,
  );
  return baseStates.map((state) => (
    state.poiId === 'summit'
      ? { ...summitState, isPrimaryActive: summitState.isActive }
      : state
  ));
}

const DEM_TILE_URLS = [14528, 14529, 14530].flatMap((x) =>
  [6453, 6454, 6455].map((y) => assetUrl(`/data/dem/14/${x}/${y}.png`)),
);

/**
 * Lite presentation: a fixed 2D background photo (never panned/zoomed/
 * transformed) with a cyan SVG route drawn in the image's own fixed pixel
 * space, so the route can never drift from the background on resize. No
 * Three.js/DEM/terrain/camera work happens for this mode at all.
 */
async function setupLiteScene(container: HTMLElement): Promise<void> {
  const loadingIndicator = document.createElement('div');
  loadingIndicator.textContent = 'Loading…';
  loadingIndicator.setAttribute('role', 'status');
  loadingIndicator.style.cssText = [
    'position: fixed',
    'inset: 0',
    'z-index: 1000',
    'display: grid',
    'place-items: center',
    'color: #fff',
    'font: 14px/1.4 sans-serif',
    'pointer-events: none',
  ].join(';');
  container.appendChild(loadingIndicator);

  const stage = document.createElement('div');
  stage.className = 'lite-fixed-background';
  stage.style.position = 'absolute';
  stage.style.inset = '0';
  stage.style.width = '100%';
  stage.style.height = '100%';
  stage.style.overflow = 'hidden';
  stage.style.backgroundImage = `url("${LITE_BACKGROUND_URL}")`;
  stage.style.backgroundSize = 'cover';
  stage.style.backgroundPosition = 'center center';
  stage.style.backgroundRepeat = 'no-repeat';
  container.appendChild(stage);

  const overlay = createLiteRouteOverlay(
    stage,
    LITE_BACKGROUND_WIDTH,
    LITE_BACKGROUND_HEIGHT,
  );
  overlay.setRoutePoints(LITE_ROUTE_POINTS);
  overlay.setLabels(LITE_ROUTE_LABELS);
  loadingIndicator.remove();

  const animationConfig = {
    playDurationMs: LITE2D_LOOP_DURATION_MS,
    holdAtEndMs: 0,
  };
  let animationState = createInitialAnimationState();
  let previousFrameTimeMs: number | undefined;

  const resetFrameTimeOnVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      previousFrameTimeMs = undefined;
    }
  };
  document.addEventListener(
    'visibilitychange',
    resetFrameTimeOnVisibilityChange,
  );

  const animate = (time: number): void => {
    const deltaMs =
      previousFrameTimeMs === undefined ? 0 : time - previousFrameTimeMs;
    previousFrameTimeMs = time;
    animationState = advanceAnimationState(
      animationState,
      deltaMs,
      animationConfig,
    );

    const frame = computeLite2DFrame(animationState.elapsedMs);
    overlay.setProgress(
      frame.routeProgress,
      frame.cut === 'hero' ? 'subtle' : 'active',
    );
    window.requestAnimationFrame(animate);
  };

  window.requestAnimationFrame(animate);
}

export async function setupScene(
  container: HTMLElement,
  settings: AppSettings,
  mode: PresentationMode = 'full',
): Promise<void> {
  if (mode === 'lite') {
    await setupLiteScene(container);
    return;
  }

  // Matsu Phase 3 (2026-09-09) P0-A/P0-C: 実行時クエリパラメータによる計測・A/B切替。
  // いずれも既定値省略時は既存baselineと完全一致する(推測でDPR/terrainを変更しないため、
  // docs/design.md追補§3/§7参照)。
  const queryParams = new URLSearchParams(window.location.search);
  const routeStyleFlags = resolveRouteStyleFlags(queryParams);
  const perfBypass = resolvePerfBypassFlags(queryParams, import.meta.env.DEV);
  const labelLayerPromotionFlags = resolveLabelLayerPromotionFlags(
    queryParams,
    import.meta.env.DEV,
  );
  const labelPerfBypassFlags = resolveLabelPerfBypassFlags(
    queryParams,
    import.meta.env.DEV,
  );
  const labelRaycastFullEnabled = import.meta.env.DEV
    && queryParams.get('labelRaycastFull') === '1';
  const labelRaycastVerifyEnabled = import.meta.env.DEV
    && queryParams.get('labelRaycastVerify') === '1';
  const manualOrbitEnabled =
    import.meta.env.DEV && queryParams.get('manualOrbit') === '1';
  const gpuTimerEnabled =
    import.meta.env.DEV && queryParams.get('gpuTimer') === '1';
  // Stable benchmark (2026-09-12): `?benchmark=1` の明示 opt-in のみ。
  // DEV gate しない(production preview で測る必要があるため)。
  // `?perf=1` とは独立で、labelController は production の updateOcclusionBaseline を通る。
  const benchmarkFlags = resolveBenchmarkModeFlags(queryParams);
  const benchmarkEnabled = benchmarkFlags.enabled;
  // setupScene のクロージャローカルに持つ。module scope に置くと、同一ページで
  // setupScene が二度呼ばれたときに前回の seek 要求が残りうる。
  let benchmarkSeekRequestMs: number | null = null;
  const scopeProofSelection = import.meta.env.DEV
    ? resolveScopeProofSelection({
      scopeProof: queryParams.get('scopeProof'),
      scopeProofBounds: queryParams.get('scopeProofBounds'),
    }, true)
    : undefined;
  const framePacingEnabled = queryParams.get('perf') === '1';
  const terrainGridDimension = Number(queryParams.get('terrainRes')) || 256;
  // Matsu Reference-Driven Terrain (2026-09-10): `?terrainSurface=`で
  // baseline/c1/c2/c3/c4 を実行時切替する(structural A/B用)。既定は
  // terrainSurfaceDefaults.defaultVariant('baseline' の間は既存挙動と完全一致)。
  // `?canopyRes=`は canopy detail normal の解像度(768/1536/3072)。
  const terrainSurfaceConfig = settings.visual.terrainSurface;
  const terrainSurfaceFlags = resolveTerrainSurfaceFlags(
    queryParams.get('terrainSurface'),
    terrainSurfaceConfig?.defaultVariant ?? 'baseline',
  );
  const canopyResolution = resolveCanopyResolution(
    queryParams.get('canopyRes'),
    terrainSurfaceConfig?.canopy.resolution ?? 1536,
  );
  const dprVariantCapParam = queryParams.get('dprCap');
  const dprVariantCap =
    dprVariantCapParam === null ? undefined : Number(dprVariantCapParam);
  const framePacingRecorder = createFramePacingRecorder();
  let previousCameraPositionForPacing: Vector3 | undefined;
  let previousCameraTargetForPacing: Vector3 | undefined;
  let previousRouteFollowProgressForPacing = 0;

  // Matsu Phase 4 (2026-09-09) P0-1〜P0-2: camera motion instrumentation・
  // position/orientation diagnostic variant・motion clock strategy・binary
  // isolationの実行時クエリパラメータ。いずれも既定値省略時は既存baselineと
  // 完全一致する(docs/design.md追補§2/§3/§5/§9参照)。
  const cameraDiagParamRaw = queryParams.get('cameraDiag');
  const cameraDiagVariant: CameraDiagVariant =
    cameraDiagParamRaw === 'stable-orientation'
    || cameraDiagParamRaw === 'stable-position'
    || cameraDiagParamRaw === 'stable-both'
      ? cameraDiagParamRaw
      : 'baseline';
  // Matsu Phase 4 (2026-09-09) [MP4-F5][MP4-F9] CASE E採用: baseline実測で
  // long-frame gapと次frame displacementのPearson相関がlinear=0.437・
  // angular=0.456(中程度)確認された後、`capped`(1フレームあたりmotion
  // delta上限50ms)をA/B実測したところ相関がlinear=0.083・angular=0.077
  // へほぼ消失し、最大線形displacementも456m→155m・最大角displacementも
  // 0.41rad→0.16radへ大幅改善した(outputs/matsu-h01-phase4/README.md参照)。
  // この実測evidenceに基づき既定strategyを'raw'から'capped'へ変更する
  // (spot timing/total loop timingは同じelapsedMsを唯一の時間源として
  // 参照するため、この1箇所の変更だけで自動的に一貫する、docs/design.md
  // 追補§3参照)。`?motionClock=raw`で従来挙動へ明示的に戻せる。
  const motionClockParam = queryParams.get('motionClock');
  const motionClockConfig: MotionClockConfig =
    motionClockParam === 'raw'
      ? { strategy: 'raw' }
      : motionClockParam === 'fixed-step'
        ? { strategy: 'fixed-step' }
        : { strategy: 'capped' };
  const isolationFlags = resolveIsolationFlags(
    parseIsolationVariant(queryParams.get('isolate')),
  );
  // 追補10 [MP-FOREST-F2]: 森林 rendering 方式の DEV 限定 A/B。
  // production build では import.meta.env.DEV が false に畳まれ、
  // `?forestVariant=` を付けても森林を有効化する経路が存在しない。
  const forestVariantRaw = import.meta.env.DEV ? queryParams.get('forestVariant') : null;
  const forestFlags = resolveForestFlags(
    forestVariantRaw,
    settings.visual.forest?.defaultVariant ?? 'none',
  );
  // matsu-h01-realtime-forest-first-visual-candidate (2026-09-12):
  // GSI landcover mask 駆動の canopy card forest を `?forestCandidate=1` の
  // 明示 opt-in でのみ追加する reversible candidate。query が無い既定では
  // 何も load せず何も scene へ足さないため、現行 Full の挙動は不変。
  // DEV gate しない(production preview で 1080p guardrail を測るため)。
  const forestCandidateFlags = resolveForestCandidateFlags(queryParams);
  // matsu-h01-realtime-forest-whole-tree-impostor-v2 (2026-09-12):
  // 実在 Poly Haven tree mesh から Blender Cycles CPU で焼いた
  // whole-tree / whole-grove impostor atlas を使う realtime forest v2。
  // `?forestImpostorV2=1` の明示 opt-in でのみ有効。query が無い既定では
  // asset を 1 つも fetch せず scene へ何も足さないため現行 Full の挙動は不変。
  // v1(`?forestCandidate=1`)とは完全に独立で、同時 ON も可能。
  // per-frame 更新を持たない静的 geometry なので animation loop には一切触らない。
  // DEV gate しない(production preview で 1080p guardrail を測るため)。
  const forestImpostorV2Flags = resolveForestImpostorV2Flags(queryParams);
  // matsu-h01-r10-actual-app-vps-preview-deploy (2026-09-16):
  // R10 final の FAR canopy layer を actual app へ preview-only で載せる opt-in。
  // `?r10far=1` のときだけ有効。query が無い既定では texture を 1 枚も fetch せず
  // scene へ何も足さないため、現行 production の挙動は不変。
  // instance を 1 つも増やさずに森林 mask 領域を覆うのがこの層の役割。
  const farCanopyFlags = resolveFarCanopyFlags(queryParams);
  const cameraPoseSmoothingConfig = { positionTauMs: 120, targetTauMs: 120 };
  let cameraPoseSmoothingState = createInitialCameraPoseSmoothingState();
  const cameraMotionRecorder = framePacingEnabled
    ? createCameraMotionRecorder()
    : undefined;
  const hotPathProfiler = framePacingEnabled
    ? createHotPathProfiler(
      (name) => performance.mark(name),
      (name, startMark, endMark) => performance.measure(name, startMark, endMark),
      () => performance.getEntriesByType('measure'),
    )
    : undefined;

  const scene = new Scene();

  const camera = new PerspectiveCamera(
    45,
    settings.resolutionWidth / settings.resolutionHeight,
    0.1,
    100_000,
  );
  const loadingIndicator = document.createElement('div');
  loadingIndicator.textContent = 'Loading…';
  loadingIndicator.setAttribute('role', 'status');
  loadingIndicator.style.cssText = [
    'position: fixed',
    'inset: 0',
    'z-index: 1000',
    'display: grid',
    'place-items: center',
    'color: #fff',
    'font: 14px/1.4 sans-serif',
    'pointer-events: none',
  ].join(';');
  container.appendChild(loadingIndicator);

  const rendererAntialiasRequested = !perfBypass.disableAntialias;
  const renderer = new WebGLRenderer({
    antialias: !perfBypass.disableAntialias,
    alpha: true,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(
    computeEffectivePixelRatio(window.devicePixelRatio, {
      variantCapRatio: dprVariantCap,
    }),
  );
  container.appendChild(renderer.domElement);

  const rendererContext = gpuTimerEnabled ? renderer.getContext() : null;
  const gpuFrameTimer = createGpuFrameTimer(
    gpuTimerEnabled && renderer.capabilities.isWebGL2
      ? rendererContext as WebGL2RenderingContext
      : null,
  );
  type GpuTimerFrameSample = {
    frameIndex: number;
    dtMs: number;
    callbackMs: number;
  };
  const gpuTimerFrames = new FixedRingBuffer<GpuTimerFrameSample>(4000);
  let gpuTimerPreviousFrameTimeMs: number | undefined;
  let gpuTimerCurrentFrameTimeMs = 0;
  let gpuTimerCurrentFrameIndex = 0;
  let gpuTimerCallbackStartedAt = 0;
  let gpuTimerQueryIssued = false;
  // Select once at setup: the default loop has no per-frame feature branch.
  const gpuTimerInstrumentation = gpuTimerEnabled
    ? {
        beginFrame(time: number, currentFrameIndex: number): void {
          gpuTimerCallbackStartedAt = performance.now();
          gpuTimerCurrentFrameTimeMs = time;
          gpuTimerCurrentFrameIndex = currentFrameIndex;
        },
        beginRender(): void {
          gpuTimerQueryIssued = gpuFrameTimer.begin(
            gpuTimerCurrentFrameIndex,
          );
        },
        endRender(): void {
          if (gpuTimerQueryIssued) {
            gpuFrameTimer.end();
          }
          gpuFrameTimer.poll();
        },
        endFrame(): void {
          const callbackMs = performance.now() - gpuTimerCallbackStartedAt;
          gpuTimerFrames.push({
            frameIndex: gpuTimerCurrentFrameIndex,
            dtMs: gpuTimerPreviousFrameTimeMs === undefined
              ? 0
              : gpuTimerCurrentFrameTimeMs - gpuTimerPreviousFrameTimeMs,
            callbackMs,
          });
          gpuTimerPreviousFrameTimeMs = gpuTimerCurrentFrameTimeMs;
        },
      }
    : {
        beginFrame: (_time: number, _currentFrameIndex: number) => undefined,
        beginRender: () => undefined,
        endRender: () => undefined,
        endFrame: () => undefined,
      };

  const demPromise = (async (): Promise<DemLoadResult> => {
    try {
      // Matsu Phase 1 (2026-09-09) A/B比較用: 第3引数省略時は既存の128×128相当
      // (MAX_GRID_DIMENSION=150のデフォルト)のまま。256を渡すと256×256相当の
      // 高精細candidateになる(docs/spec.md追補3 [MP1-F1] 参照)。
      // Matsu Phase 3 (2026-09-09) P0-C: `?terrainRes=`で実行時上書き可能
      // (既定256は現行baselineと完全一致、docs/design.md追補§3参照)。
      // Matsu Reference-Driven Terrain (2026-09-10): downsample前の768×768 DEMも
      // 併せて受け取る。gridの中身と terrainGridDimension の扱いは従来と完全に同一。
      return await loadDemTilesWithFullResolution(
        DEM_TILE_URLS,
        settings.terrainOrigin,
        terrainGridDimension,
      );
    } catch (error) {
      console.warn(
        'DEM loading failed; using a synthetic Takao terrain fallback.',
        error,
      );
      return { grid: generateSyntheticElevationGrid(50, 50, 599) };
    }
  })();

  const terrainTexturePromise = (async (): Promise<
    THREE.Texture | undefined
  > => {
    if (!settings.visual.terrain.textureUrl) return undefined;

    try {
      // Matsu Phase 1 (2026-09-09) [MP1-F2] 採用: 斜め俯瞰カメラでの航空写真の
      // ぼやけ・引き伸ばし対策として、renderer capability内の安全な上限で
      // anisotropic filteringを適用する(低リスク改善、outputs/matsu-h01-phase1/
      // README.md「Task B」参照)。
      const texture = await loadTerrainTexture(
        settings.visual.terrain.textureUrl,
        renderer.capabilities.getMaxAnisotropy(),
      );
      const repeat = settings.visual.terrain.textureRepeat;
      if (repeat) {
        texture.repeat.set(repeat.x, repeat.y);
      }
      if (import.meta.env.DEV) {
        console.info(
          '[terrain-texture] loaded',
          settings.visual.terrain.textureUrl,
        );
      }
      return texture;
    } catch (error) {
      console.warn(
        'Terrain texture loading failed; falling back to vertex-color terrain.',
        error,
      );
      return undefined;
    }
  })();

  const [demResult, terrainTexture] = await Promise.all([
    demPromise,
    terrainTexturePromise,
  ]);
  const grid = demResult.grid;
  const demFullResolution = demResult.fullResolution;

  // DEV-only surface experiment. Lite returned above; off imports/allocates nothing.
  // b must read the unshaded aerial BEFORE the existing hillshade bake below.
  let canopySurfaceRuntime: CanopySurfaceRuntime | undefined;
  if (import.meta.env.DEV) {
    const selection = resolveCanopySurfaceFlags(queryParams, import.meta.env.DEV);
    if (selection.variant !== 'off') {
      const { prepareCanopySurface } = await import('../terrain/canopySurface');
      canopySurfaceRuntime = prepareCanopySurface(
        selection, terrainTexture, (grid.cols - 1) * grid.cellSizeMeters,
        renderer.capabilities.getMaxAnisotropy(), settings.metersPerUnit,
      );
    }
    (window as any).__canopySurfaceSummary = () => canopySurfaceRuntime?.summary() ?? ({
      variant: 'off', effectiveVariant: 'off', parameters: { ...selection.parameters },
      textures: [], initTimingsMs: { prepareTotal: 0, total: 0 }, estimatedPeakCpuBytes: 0,
      shader: { attempted: false, injected: false, missingMarkers: [] }, fallbackReason: null,
    });
  }

  applyBackgroundAndFog(container, scene, grid, settings.visual.background);

  // ── Matsu Reference-Driven Terrain (2026-09-10) ────────────────────────────
  // 現在捨てているfull-resolution DEM(768×768 / 7.766 m/px)とaerial(1.9416 m/texel)
  // から、5〜93mの波長帯に欠けているshadingを初期化時1回だけ生成する。
  // geometryは1頂点も増やさない(既知地雷: labelRendererのocclusion raycast)。
  //
  // 実行順序は厳守: ①canopy輝度抽出 → ②hillshadeベイク → ③normal map生成。
  // ①を②より先に行わないと、ベイク済み陰影がcanopy輝度へ混入して二重計上になる。
  const terrainSurfaceTimingsMs: Record<string, number> = {};
  let terrainNormalMapTexture: THREE.DataTexture | undefined;

  if (terrainSurfaceConfig !== undefined && demFullResolution !== undefined) {
    // ① canopy輝度(hillshadeベイクより前に取得すること)
    let canopyLuminance: Float32Array | undefined;
    if (terrainSurfaceFlags.canopyDetailNormal && terrainTexture !== undefined) {
      const startedAt = performance.now();
      canopyLuminance = extractTextureLuminance(
        terrainTexture,
        canopyResolution,
        canopyResolution,
      );
      terrainSurfaceTimingsMs.canopyLuminance = performance.now() - startedAt;
    }

    // ② multi-scale hillshadeをaerial textureへベイク
    if (terrainSurfaceFlags.multiScaleHillshade && terrainTexture !== undefined) {
      const startedAt = performance.now();
      const factors = computeMultiScaleHillshadeFactors(
        demFullResolution,
        settings.visual.lighting.directionalPosition,
        terrainSurfaceConfig.hillshade,
      );
      applyDemShadeToTexture(
        terrainTexture,
        factors,
        demFullResolution.cols,
        demFullResolution.rows,
      );
      terrainSurfaceTimingsMs.hillshadeBake = performance.now() - startedAt;
    }

    // ③ normal map(DEMハイパス残差 [+ canopy detail])
    if (terrainSurfaceFlags.demNormalMap) {
      const startedAt = performance.now();
      const targetSize = resolveNormalFieldTargetSize(
        terrainSurfaceConfig,
        terrainSurfaceFlags,
        canopyResolution,
      );
      let normalField = computeDemDetailNormalField(
        demFullResolution,
        terrainSurfaceConfig.demNormal,
      );
      if (normalField.cols !== targetSize || normalField.rows !== targetSize) {
        normalField = resampleTangentNormalField(normalField, targetSize, targetSize);
      }

      if (canopyLuminance !== undefined) {
        // full-res DEMの物理範囲(768 × 7.766 m ≒ 5964.6 m)をcanopy解像度で割る。
        const metersPerTexel =
          (demFullResolution.cols * demFullResolution.cellSizeMeters) / canopyResolution;
        let canopyField = computeCanopyDetailNormalField(
          canopyLuminance,
          canopyResolution,
          canopyResolution,
          metersPerTexel,
          { ...terrainSurfaceConfig.canopy, resolution: canopyResolution },
        );
        if (canopyField.cols !== targetSize || canopyField.rows !== targetSize) {
          canopyField = resampleTangentNormalField(canopyField, targetSize, targetSize);
        }
        normalField = combineTangentNormalFields(
          normalField,
          canopyField,
          terrainSurfaceConfig.canopy.weight,
        );
      }

      // rowOrder 'bottom-up': DataTextureはflipY=false既定なのでdata row 0がv=0(南端)。
      // computeTerrainUVsのv = 1 - row/(rows-1)に揃えるため反転して書き出す。
      terrainNormalMapTexture = createNormalMapDataTexture(
        encodeTangentNormalFieldToRgba(normalField, { rowOrder: 'bottom-up' }),
        normalField.cols,
        normalField.rows,
        renderer.capabilities.getMaxAnisotropy(),
      );
      terrainSurfaceTimingsMs.normalMap = performance.now() - startedAt;
    }
  }

  const terrainGeometry = buildTerrainGeometry(grid, settings);
  let terrainMaterial: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial = applyTerrainMaterial(
    terrainGeometry,
    grid,
    settings,
    settings.visual.terrain,
    settings.visual.lighting.directionalPosition,
    terrainTexture,
  );
  // normal mapは applyTerrainMaterial の「外側」で代入する。
  // これにより src/terrain/terrainMaterial.ts を一切変更せずに済み、
  // 既存の「texture使用時にhillshade係数を差し替える」意図的ロジックへ触れない。
  if (terrainNormalMapTexture !== undefined && terrainSurfaceConfig !== undefined) {
    terrainMaterial.normalMap = terrainNormalMapTexture;
    terrainMaterial.normalScale.set(
      terrainSurfaceConfig.normalScale,
      terrainSurfaceConfig.normalScale,
    );
    terrainMaterial.needsUpdate = true;
  }
  if (canopySurfaceRuntime !== undefined) {
    canopySurfaceRuntime.attach(terrainMaterial);
    console.info('[canopy-surface] CPU initialization (GPU upload/compile excluded)', canopySurfaceRuntime.summary());
  }
  if (perfBypass.terrainMaterialBasic) {
    // DEV-only measurement bypass: isolates terrain PBR fragment cost; never a
    // production visual setting. Keep the same geometry, mesh, and aerial map.
    const { map, side } = terrainMaterial;
    const basicMaterial = new MeshBasicMaterial({ map, side });
    terrainMaterial.dispose();
    terrainMaterial = basicMaterial;
    console.info('[perf-bypass] terrain material replaced with MeshBasicMaterial');
  }
  const terrain = new Mesh(terrainGeometry, terrainMaterial);
  scene.add(terrain);
  const scopeProofRuntime = import.meta.env.DEV && scopeProofSelection !== undefined
    ? (() => {
      let currentId = scopeProofSelection.id;
      let currentLabel = scopeProofSelection.label;
      let currentFallbackReason = scopeProofSelection.fallbackReason;
      let currentBounds: ScopeProofBounds | null = null;

      const applyScopeProofBounds = (bounds: ScopeProofBounds | null): void => {
        currentBounds = bounds === null ? null : { ...bounds };
        if (currentBounds === null) {
          terrainMaterial.clippingPlanes = null;
          renderer.localClippingEnabled = false;
          terrainMaterial.needsUpdate = true;
          return;
        }

        renderer.localClippingEnabled = true;
        terrainMaterial.clippingPlanes = computeScopeProofClipPlanes(currentBounds, grid)
          .map(({ normal, constant }) => new Plane(
            new Vector3(normal.x, normal.y, normal.z),
            constant,
          ));
        terrainMaterial.clipShadows = false;
        terrainMaterial.needsUpdate = true;
      };

      const setCandidate = (id: string): boolean => {
        const candidate = SCOPE_PROOF_CANDIDATES.find((entry) => entry.id === id);
        if (candidate === undefined) return false;
        currentId = candidate.id;
        currentLabel = candidate.label;
        currentFallbackReason = null;
        applyScopeProofBounds(candidate.bounds);
        return true;
      };

      applyScopeProofBounds(scopeProofSelection.bounds);
      return {
        applyScopeProofBounds,
        setCandidate,
        getState: () => ({
          id: currentId,
          label: currentLabel,
          fallbackReason: currentFallbackReason,
          bounds: currentBounds === null ? null : { ...currentBounds },
        }),
      };
    })()
    : undefined;

  const heightOffsetMeters = 5;
  const maxSampleSpacingMeters = grid.cellSizeMeters * 0.5;
  const worldRoutePoints: Vec3[] = resampleRouteToWorldPoints(
    takaoTrail1Route,
    grid,
    settings,
    heightOffsetMeters,
    maxSampleSpacingMeters,
  );
  const routeCumulativeDistances = computeCumulativeDistances(worldRoutePoints);
  const cameraGuidancePath = computeCameraGuidancePath(
    worldRoutePoints,
    routeCumulativeDistances,
    settings.cameraState.guidance,
  );
  const cameraRail = buildCameraRail(
    worldRoutePoints,
    routeCumulativeDistances,
    cameraGuidancePath.points,
    cameraGuidancePath.cumulativeDistances,
    settings.cameraState.rail,
  );
  const routeFollowStartMs = computeRouteFollowStartMs(
    settings.cameraState.timeline,
  );
  // Matsu Phase 4 (2026-09-09): summit到着ビジュアル配線用のフェーズ境界時刻。
  // 既存cameraTimeline.tsの境界計算(routeAnimation.playDurationMs起点)と同じ式
  // (docs/design.md追補§7参照、既存summit演出時間は不変更)。
  const transitionToSummitStartMs = settings.routeAnimation.playDurationMs;
  const summitHoldStartMs =
    transitionToSummitStartMs + settings.cameraState.timeline.transitionToSummitMs;
  const routeFollowTimeline = buildRouteFollowTimelineForRoute(
    takaoTrail1Route,
    settings.cameraState.routeFollowSpots.events,
    ROUTE_FOLLOW_BASE_TRAVEL_MS,
  );
  const routePoints = worldRoutePoints.map(
    (point) => new Vector3(point.x, point.y, point.z),
  );
  const routeVisualConfig = routeStyleFlags.whiteThick
    ? createWhiteThickRoutePreset(settings.visual.route)
    : settings.visual.route;
  const routeVisual = createRouteVisual(routeVisualConfig, worldRoutePoints);
  scene.add(routeVisual.object3D);
  routeVisual.updatePoints(
    getPartialRoutePoints(worldRoutePoints, routeCumulativeDistances, 0),
  );
  const routeHeadMarker = createRouteHeadMarker({
    scene,
    config: settings.visual.routeHeadMarker,
  });

  const forestController = createForestController({
    scene,
    grid,
    routePointsXZ: worldRoutePoints,
    elevationScale: settings.elevationScale,
    config: settings.visual.forest ?? forestDefaults,
    flags: forestFlags,
    now: () => performance.now(),
  });

  let forestCandidateController: ForestCandidateController | undefined;
  if (forestCandidateFlags.enabled) {
    forestCandidateController = await createForestCandidate({
      scene,
      grid,
      elevationScale: settings.elevationScale,
      routePointsXZ: worldRoutePoints,
      config: forestCandidateDefaults,
      flags: forestCandidateFlags,
    });
    // candidate を明示 opt-in したときだけ露出する検証用フック。
    // query 無しの既定経路では window へ何も足さない。
    (window as any).__forestCandidateSummary = () => ({
      flags: forestCandidateFlags,
      build: forestCandidateController?.summary ?? null,
      renderer: {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        programs: renderer.info.programs?.length ?? 0,
      },
    });
    (window as any).__forestCandidateDispose = (): void => {
      forestCandidateController?.dispose();
      forestCandidateController = undefined;
    };
    // stable benchmark を 1 session 内で A1 → B → A2 の bracket として回すための
    // 非破壊 toggle。false のとき Three は candidate group を描画対象から外すので
    // drawCalls / triangles は candidate OFF と一致する。
    // benchmark protocol / harness には一切手を入れていない。
    (window as any).__forestCandidateSetVisible = (visible: boolean): boolean => {
      if (forestCandidateController === undefined) return false;
      forestCandidateController.object3D.visible = visible;
      return true;
    };
  }

  let forestImpostorV2Controller: ForestImpostorV2Controller | undefined;
  if (forestImpostorV2Flags.enabled) {
    const wideConfig = forestImpostorV2Flags.r10Wide
      ? createR10WidePreset(forestImpostorV2Defaults)
      : forestImpostorV2Defaults;
    const compositionConfig = forestImpostorV2Flags.r10Broad === true
      ? createR10CompositionPreset(wideConfig)
      : wideConfig;
    const impostorConfig = forestImpostorV2Flags.r10Atlas
      ? createR10AtlasPreset(compositionConfig)
      : compositionConfig;
    forestImpostorV2Controller = await createForestImpostorV2({
      scene,
      grid,
      elevationScale: settings.elevationScale,
      routePointsXZ: worldRoutePoints,
      // Deterministic composition: coverage -> species composition -> side-atlas URLs.
      config: impostorConfig,
      flags: forestImpostorV2Flags,
      now: () => performance.now(),
    });
    // v2 を明示 opt-in したときだけ露出する検証用フック。
    // query 無しの既定経路では window へ何も足さない。
    (window as any).__forestImpostorV2Summary = () => ({
      flags: forestImpostorV2Flags,
      build: forestImpostorV2Controller?.summary ?? null,
      renderer: {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        programs: renderer.info.programs?.length ?? 0,
      },
    });
    (window as any).__forestImpostorV2Dispose = (): void => {
      forestImpostorV2Controller?.dispose();
      forestImpostorV2Controller = undefined;
    };
    // stable benchmark を 1 session 内で A1 → B → A2 の bracket として回すための
    // 非破壊 toggle。false のとき Three は v2 group を描画対象から外すので
    // drawCalls / triangles は v2 OFF と一致する。
    // benchmark protocol / harness には一切手を入れていない。
    (window as any).__forestImpostorV2SetVisible = (visible: boolean): boolean => {
      if (forestImpostorV2Controller === undefined) return false;
      forestImpostorV2Controller.object3D.visible = visible;
      return true;
    };
    // v2 の runtime lighting 寄与だけを 1 session 内で切り分けるための
    // 非破壊 material toggle。geometry / placement / texture は再生成しない。
    (window as any).__forestImpostorV2SetMaterialMode = (mode: string): boolean => {
      if (forestImpostorV2Controller === undefined) return false;
      return forestImpostorV2Controller.setMaterialMode(mode);
    };
    // stable benchmark を 1 session 内で A1 → B → A2 の bracket として回すための
    // 非破壊 toggle。false のとき Three は top cap group を描画対象から外す。
    // benchmark protocol / harness には一切手を入れていない。
    (window as any).__forestImpostorV2SetTopCapVisible = (visible: boolean): boolean => {
      if (forestImpostorV2Controller === undefined) return false;
      return forestImpostorV2Controller.setTopCapVisible(visible);
    };
  }

  let farCanopyMesh: THREE.Mesh | undefined;
  if (farCanopyFlags.enabled) {
    const farTexture = await new TextureLoader().loadAsync(
      farCanopyDefaults.textureUrl,
    );
    // texture は pngRowZeroIsZMin: true で焼かれているため flipY は false
    // (lab 版 farCanopyLayer.ts と同じ contract)。
    farTexture.flipY = false;
    configureImpostorTexture(farTexture);
    const farBuildStart = performance.now();
    farCanopyMesh = createFarCanopyOverlay({
      grid,
      settings,
      config: farCanopyDefaults,
      texture: farTexture,
      // R10 macro shading は forest card 側と同じ opt-in で FAR にも参加させる。
      macroShade: forestImpostorV2Flags.macroShade
        ? { ...DEFAULT_MACRO_SHADE_CONFIG, enabled: true }
        : undefined,
      terrainYAt: createTerrainHeightSampler(grid, settings.elevationScale),
      tone: forestImpostorV2Flags.r10Tone === true,
      haze: forestImpostorV2Flags.r10Air === true,
    });
    const farBuildMs = performance.now() - farBuildStart;
    scene.add(farCanopyMesh);
    (window as any).__farCanopySummary = () => ({
      flags: farCanopyFlags,
      textureUrl: farCanopyDefaults.textureUrl,
      extentMeters: farCanopyDefaults.extentMeters,
      alphaTest: farCanopyDefaults.alphaTest,
      macroShade: forestImpostorV2Flags.macroShade,
      tone: forestImpostorV2Flags.r10Tone === true,
      toneDiagnostics: farCanopyMesh!.geometry.userData.toneDiagnostics,
      buildMs: farBuildMs,
      vertexCount: farCanopyMesh!.geometry.getAttribute('position').count,
      triangleCount: farCanopyMesh!.geometry.getIndex()!.count / 3,
    });
    // 非破壊 toggle。FAR 層だけの寄与を 1 session 内で切り分けるために使う。
    (window as any).__farCanopySetVisible = (visible: boolean): boolean => {
      if (!farCanopyMesh) return false;
      farCanopyMesh.visible = visible;
      return true;
    };
  }

  const { hemisphere, directional } = createSceneLights(
    settings.visual.lighting,
  );
  scene.add(hemisphere, directional);

  const cameraPosition = computeOverviewCameraPosition(grid, settings);
  const lookAtTarget = computeLookAtTarget(grid, settings);
  camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
  camera.lookAt(lookAtTarget.x, lookAtTarget.y, lookAtTarget.z);

  const labelController = createLabelRenderer({
    container,
    scene,
    camera,
    terrainMesh: terrain,
    route: takaoTrail1Route,
    grid,
    settings,
    labelLayerPromotion: labelLayerPromotionFlags,
    labelPerfBypass: labelPerfBypassFlags,
    labelPerfCountersEnabled: framePacingEnabled,
    labelRaycastFull: labelRaycastFullEnabled,
    labelRaycastVerify: labelRaycastVerifyEnabled,
  });

  // Matsu Final Visual Polish (2026-09-09): Hybrid arrival card。3D座標には
  // 追従しないscreen-fixedのDOM overlay。SpotArrivalState.phase/intensityのみを
  // 読み、薬王院canonical cadence(spotArrival.ts/cameraSpotHold.ts)を変更しない
  // (docs/design.md追補「Matsu Final Visual Polish」§5-6参照)。
  const arrivalCard = createArrivalCard({
    container,
    config: settings.visual.arrivalCard,
    poiDisplayTextById: new Map(
      settings.labels.points.map((point) => [point.poiId, point.displayText]),
    ),
  });

  // Matsu Phase 3 (2026-09-09): スポットarrival choreography(APPROACH→ARRIVE→
  // DWELL→DEPART)用のspec解決。setup時に1回だけ行う(docs/design.md追補§5参照)。
  const spotArrivalSpecs = resolveSpotArrivalSpecs(
    takaoTrail1Route,
    SPOT_ARRIVAL_TIER_BY_POI_ID,
  );

  const resize = (): void => {
    const width = container.clientWidth || settings.resolutionWidth;
    const height = container.clientHeight || settings.resolutionHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    labelController.setSize(width, height);
  };

  resize();
  window.addEventListener('resize', resize);

  if (benchmarkEnabled) {
    const clientWidth = renderer.domElement.clientWidth;
    const clientHeight = renderer.domElement.clientHeight;
    if (clientWidth > 0 && clientHeight > 0) {
      const pixelRatio = Math.min(
        benchmarkFlags.targetBufferWidth / clientWidth,
        benchmarkFlags.targetBufferHeight / clientHeight,
      );
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(clientWidth, clientHeight);
      labelController.setSize(clientWidth, clientHeight);
    }
  }

  const benchmarkController = benchmarkEnabled
    ? createStableBenchmark({
        flags: benchmarkFlags,
        host: {
          getSceneIdentity: () => {
            let visibleLabels = 0;
            for (let index = 0; index < labelController.objects.length; index += 1) {
              const wrapper = labelController.objects[index].element;
              const inner = wrapper.firstElementChild as HTMLElement | null;
              if (wrapper.style.display === 'none' || inner === null) {
                continue;
              }
              const opacityText = inner.style.opacity;
              const opacity = opacityText === '' ? 1 : Number(opacityText);
              if (opacity > 0) {
                visibleLabels += 1;
              }
            }

            return {
              drawCalls: renderer.info.render.calls,
              triangles: renderer.info.render.triangles,
              visibleLabels,
              drawingBufferWidth: renderer.domElement.width,
              drawingBufferHeight: renderer.domElement.height,
              segmentStartMs: benchmarkFlags.segmentStartMs,
              segmentEndMs: benchmarkFlags.segmentEndMs,
            };
          },
          requestRouteClockMs: (elapsedMs) => {
            benchmarkSeekRequestMs = elapsedMs;
          },
          getEnvironment: () => ({
            buildMode: import.meta.env.DEV ? 'dev' : 'production',
            search: window.location.search,
            drawingBufferWidth: renderer.domElement.width,
            drawingBufferHeight: renderer.domElement.height,
            clientWidth: renderer.domElement.clientWidth,
            clientHeight: renderer.domElement.clientHeight,
            pixelRatio: renderer.getPixelRatio(),
            devicePixelRatio: window.devicePixelRatio,
            userAgent: navigator.userAgent,
            visibilityState: document.visibilityState,
            hasFocus: document.hasFocus(),
            hardwareConcurrency: navigator.hardwareConcurrency ?? null,
            isWebGL2: Boolean((
              renderer.capabilities as typeof renderer.capabilities & {
                isWebGL2?: boolean;
              }
            ).isWebGL2),
            rendererAntialiasRequested,
          }),
        },
      })
    : null;

  if (benchmarkController !== null) {
    (window as any).__takaoBenchmark = benchmarkController;
  }

  // Compile shaders and force geometry/texture upload before the animation epoch.
  renderer.compile(scene, camera);
  renderer.render(scene, camera);
  labelController.render();
  loadingIndicator.remove();

  let animationState = createInitialAnimationState();
  let previousFrameTimeMs: number | undefined;
  let previousPhaseKind: string | undefined;
  // Matsu Phase 3: DEVログ用previousPhaseKindとは別に、production buildでも
  // spot arrival choreographyのフェーズ判定(route-follow時のみ有効化)に使う
  // 現在フェーズを保持する(docs/design.md追補§0-10の罠を避けるため必須)。
  let currentPhaseKind: string | undefined;
  let updateOverlayText: ((progress: number) => void) | undefined;
  let isAutoCameraPaused = false;
  let captureFrozenElapsedMs: number | undefined;
  let frameIndex = 0;

  type ManualOrbitSavedPose = {
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
  };
  let manualOrbitInputState: OrbitInputState | undefined;
  let manualOrbitState: OrbitState | undefined;
  let manualOrbitSavedPose: ManualOrbitSavedPose | undefined;
  let manualOrbitSessionActive = false;

  const releaseManualOrbitCapture = (): void => {
    const pointerId = manualOrbitInputState?.activePointerId;
    if (pointerId === undefined) {
      return;
    }
    const canvas = renderer.domElement;
    if (
      typeof canvas.releasePointerCapture === 'function'
      && (
        typeof canvas.hasPointerCapture !== 'function'
        || canvas.hasPointerCapture(pointerId)
      )
    ) {
      canvas.releasePointerCapture(pointerId);
    }
  };

  const clearManualOrbitSession = (): void => {
    if (!manualOrbitEnabled) {
      return;
    }
    releaseManualOrbitCapture();
    manualOrbitInputState = createOrbitInputState();
    manualOrbitState = undefined;
    manualOrbitSavedPose = undefined;
    manualOrbitSessionActive = false;
  };

  const resetManualOrbit = (): void => {
    if (!manualOrbitEnabled) {
      return;
    }
    if (manualOrbitSavedPose !== undefined) {
      const { position, target } = manualOrbitSavedPose;
      camera.position.set(position.x, position.y, position.z);
      camera.lookAt(target.x, target.y, target.z);
    }
    clearManualOrbitSession();
  };

  if (manualOrbitEnabled) {
    const canvas = renderer.domElement;
    manualOrbitInputState = createOrbitInputState();
    canvas.style.touchAction = 'none';

    canvas.addEventListener('pointerdown', (event) => {
      const result = onPointerDown(
        manualOrbitInputState!,
        event,
        manualOrbitEnabled && isAutoCameraPaused,
      );
      manualOrbitInputState = result.state;
      if (!result.captureRequested) {
        return;
      }

      if (!manualOrbitSessionActive) {
        manualOrbitSavedPose = {
          position: {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
          },
          target: {
            x: lookAtTarget.x,
            y: lookAtTarget.y,
            z: lookAtTarget.z,
          },
        };
        manualOrbitState = orbitStateFromPose(
          manualOrbitSavedPose.position,
          manualOrbitSavedPose.target,
        );
        manualOrbitSessionActive = true;
      }

      event.preventDefault();
      if (typeof canvas.setPointerCapture === 'function') {
        canvas.setPointerCapture(event.pointerId);
      }
    });

    canvas.addEventListener('pointermove', (event) => {
      const result = onPointerMove(manualOrbitInputState!, event);
      manualOrbitInputState = result.state;
      if (
        !isAutoCameraPaused
        || result.delta === undefined
        || manualOrbitState === undefined
      ) {
        return;
      }

      manualOrbitState = applyDragDelta(
        manualOrbitState,
        result.delta.dx,
        result.delta.dy,
        DEFAULT_MANUAL_ORBIT_OPTIONS,
      );
      const position = orbitPositionFromState(manualOrbitState);
      camera.position.set(position.x, position.y, position.z);
      camera.lookAt(
        manualOrbitState.target.x,
        manualOrbitState.target.y,
        manualOrbitState.target.z,
      );
    });

    const finishPointer = (
      event: PointerEvent,
      transition: typeof onPointerUp,
    ): void => {
      const result = transition(manualOrbitInputState!, event);
      manualOrbitInputState = result.state;
      if (
        result.releaseRequested
        && typeof canvas.releasePointerCapture === 'function'
        && (
          typeof canvas.hasPointerCapture !== 'function'
          || canvas.hasPointerCapture(event.pointerId)
        )
      ) {
        canvas.releasePointerCapture(event.pointerId);
      }
    };

    canvas.addEventListener('pointerup', (event) => {
      finishPointer(event, onPointerUp);
    });
    canvas.addEventListener('pointercancel', (event) => {
      finishPointer(event, onPointerCancel);
    });
  }

  const resetFrameTimeOnVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      previousFrameTimeMs = undefined;
    }
    if (benchmarkEnabled && document.visibilityState !== 'visible') {
      benchmarkController?.noteDisturbance('PAGE_HIDDEN');
    }
  };
  document.addEventListener(
    'visibilitychange',
    resetFrameTimeOnVisibilityChange,
  );

  renderer.setAnimationLoop((time: number) => {
    gpuTimerInstrumentation.beginFrame(time, frameIndex);

    if (framePacingEnabled) {
      framePacingRecorder.recordFrame(time);
    }

    const deltaMs =
      previousFrameTimeMs === undefined ? 0 : time - previousFrameTimeMs;
    previousFrameTimeMs = time;

    if (!isAutoCameraPaused) {
      // Matsu Phase 4 (2026-09-09) [MP4-F5]: motion clock strategy。
      // `?motionClock=`省略時は'raw'(既存のrawDeltaMsそのまま)であり既存挙動と
      // 完全一致する。適用箇所はここ1箇所のみ(docs/design.md追補§3参照、
      // spot timing/total loop timingも同じelapsedMsを参照するため自動的に一貫する)。
      const effectiveDeltaMs = computeEffectiveMotionDeltaMs(
        deltaMs,
        motionClockConfig,
      );
      animationState = advanceAnimationState(
        animationState,
        effectiveDeltaMs,
        settings.routeAnimation,
      );
    }

    if (benchmarkEnabled) {
      if (benchmarkSeekRequestMs !== null) {
        animationState = { elapsedMs: benchmarkSeekRequestMs };
        benchmarkSeekRequestMs = null;
      }
      benchmarkController?.onFrame(time, animationState.elapsedMs);
    }

    // 追補10 [MP-FOREST-A11]: A/B 撮影で elapsedMs を variant 間へ厳密に揃えるための
    // DEV 限定固定。production build では消える。定常状態では再代入も発生しない。
    if (import.meta.env.DEV && captureFrozenElapsedMs !== undefined) {
      if (animationState.elapsedMs !== captureFrozenElapsedMs) {
        animationState = { elapsedMs: captureFrozenElapsedMs };
      }
      currentPhaseKind = computeCameraPhase(
        animationState.elapsedMs, settings.routeAnimation,
        settings.cameraState.timeline, routeFollowTimeline,
      ).kind;
    }

    hotPathProfiler?.begin('route-progress');
    const routeFollowProgress = computeRouteFollowProgress(
      animationState.elapsedMs,
      routeFollowStartMs,
      settings.routeAnimation.playDurationMs,
      routeFollowTimeline,
    );
    hotPathProfiler?.end('route-progress');

    if (!isAutoCameraPaused) {
      hotPathProfiler?.begin('camera-update');
      const phase = computeCameraPhase(
        animationState.elapsedMs,
        settings.routeAnimation,
        settings.cameraState.timeline,
        routeFollowTimeline,
      );
      currentPhaseKind = phase.kind;
      if (import.meta.env.DEV && phase.kind !== previousPhaseKind) {
        // eslint-disable-next-line no-console
        console.log(
          `[phase] ${phase.kind} at elapsedMs=${animationState.elapsedMs.toFixed(0)}, routeFollowProgress=${routeFollowProgress.toFixed(3)}`,
        );
        previousPhaseKind = phase.kind;
      }
      const rawPose = computeCameraPose({
        phase,
        elapsedMs: animationState.elapsedMs,
        animationConfig: settings.routeAnimation,
        grid,
        settings,
        worldRoutePoints,
        cumulativeDistances: routeCumulativeDistances,
        routeGuidancePoints: cameraGuidancePath.points,
        routeGuidanceCumulativeDistances:
          cameraGuidancePath.cumulativeDistances,
        cameraRail,
        cameraState: settings.cameraState,
      });

      // Matsu Phase 4 (2026-09-09) [MP4-F2]: position/orientation diagnostic
      // variant。`?cameraDiag=`省略時(baseline)はrawPoseをそのまま使い既存
      // baselineと完全一致する(docs/design.md追補§2参照)。
      const { pose, nextState: nextCameraPoseSmoothingState } =
        applyCameraDiagVariant(
          rawPose,
          cameraPoseSmoothingState,
          deltaMs,
          cameraDiagVariant,
          cameraPoseSmoothingConfig,
        );
      cameraPoseSmoothingState = nextCameraPoseSmoothingState;

      camera.position.set(
        pose.position.x,
        pose.position.y,
        pose.position.z,
      );
      camera.lookAt(pose.target.x, pose.target.y, pose.target.z);

      if (framePacingEnabled) {
        const targetVec = new Vector3(
          pose.target.x,
          pose.target.y,
          pose.target.z,
        );
        const positionDelta = previousCameraPositionForPacing
          ? camera.position.distanceTo(previousCameraPositionForPacing)
          : 0;
        const targetDelta = previousCameraTargetForPacing
          ? targetVec.distanceTo(previousCameraTargetForPacing)
          : 0;
        const progressDelta = Math.abs(
          routeFollowProgress - previousRouteFollowProgressForPacing,
        );
        framePacingRecorder.recordMovement(
          {
            cameraPositionDelta: positionDelta,
            cameraTargetDelta: targetDelta,
            routeProgressDelta: progressDelta,
          },
          deltaMs,
        );
        previousCameraPositionForPacing = camera.position.clone();
        previousCameraTargetForPacing = targetVec;
        previousRouteFollowProgressForPacing = routeFollowProgress;

        // Matsu Phase 4 (2026-09-09) [MP4-F1]: camera position/orientation
        // instrumentation(docs/design.md追補§1参照)。毎フレームconsole出力は
        // 行わず、on-demandの`window.__cameraMotionSummary()`のみ公開する。
        cameraMotionRecorder?.recordSample(
          {
            timestampMs: time,
            position: {
              x: camera.position.x,
              y: camera.position.y,
              z: camera.position.z,
            },
            quaternion: {
              x: camera.quaternion.x,
              y: camera.quaternion.y,
              z: camera.quaternion.z,
              w: camera.quaternion.w,
            },
          },
          deltaMs,
        );
      }
      hotPathProfiler?.end('camera-update');
    }

    // Matsu Phase 4 (2026-09-09) [MP4-F7]: binary isolation。`?isolate=`省略時
    // (baseline)は既存挙動と完全一致する(docs/design.md追補§5参照)。
    if (!isolationFlags.skipRouteVisualUpdate) {
      hotPathProfiler?.begin('route-line-update');
      const partialRoutePoints = getPartialRoutePoints(
        worldRoutePoints,
        routeCumulativeDistances,
        routeFollowProgress,
      );
      routeVisual.updatePoints(partialRoutePoints);
      hotPathProfiler?.end('route-line-update');
    }

    hotPathProfiler?.begin('route-head-marker');
    const routeHeadMarkerTransform = computeRouteHeadMarkerTransform(
      routeFollowProgress,
      computeRouteFollowAnchor(
        worldRoutePoints,
        routeCumulativeDistances,
        routeFollowProgress,
      ),
      settings.visual.routeHeadMarker,
    );
    routeHeadMarker.updatePosition(
      routeHeadMarkerTransform.position,
      routeHeadMarkerTransform.visible,
    );
    routeHeadMarker.updateDirectionDashes(
      computeRouteDirectionDashTransforms(
        worldRoutePoints,
        routeCumulativeDistances,
        routeFollowProgress,
        settings.visual.routeHeadMarker,
      ),
      animationState.elapsedMs,
    );
    hotPathProfiler?.end('route-head-marker');

    if (!isolationFlags.skipLabelOcclusion) {
      hotPathProfiler?.begin('label-occlusion');
      labelController.updateOcclusion(frameIndex, deltaMs);
      hotPathProfiler?.end('label-occlusion');
    }
    frameIndex += 1;

    // Matsu Phase 3 (2026-09-09): スポットarrival choreography。
    // route-followフェーズ以外では必ずidle状態を渡す(docs/design.md追補§0-10:
    // routeFollowProgressはフェーズに関わらず1にclampされたまま維持されるため、
    // フェーズガードなしではsummit等が半永久的に「到着中」表示になってしまう)。
    // Matsu Phase 4 (2026-09-09) [MP4-F11]: summit到着中(transition-to-summit /
    // summit-hold)は`poiId==='summit'`だけ時間ベースのarrival状態へ差し替える
    // (docs/design.md追補§0-6/§7参照、既存summit演出のtransition/hold時間は
    // 不変更)。`?isolate=no-spot-animation`時は計算・DOM更新ごとスキップする。
    let spotArrivalStates: SpotArrivalState[];
    if (isolationFlags.skipSpotAnimation) {
      spotArrivalStates = createIdleSpotArrivalStates(spotArrivalSpecs);
    } else {
      hotPathProfiler?.begin('spot-arrival');
      const baseSpotArrivalStates =
        currentPhaseKind === 'route-follow'
          ? computeAllSpotArrivalStates(
              routeFollowProgress,
              spotArrivalSpecs,
              SPOT_ARRIVAL_TIMING_MS,
              ROUTE_FOLLOW_BASE_TRAVEL_MS,
            )
          : createIdleSpotArrivalStates(spotArrivalSpecs);
      spotArrivalStates =
        currentPhaseKind === 'transition-to-summit'
          ? mergeSummitArrivalStateForPhase(
              baseSpotArrivalStates,
              'transition-to-summit',
              animationState.elapsedMs - transitionToSummitStartMs,
              settings.cameraState.timeline.transitionToSummitMs,
              settings.cameraState.timeline.summitHoldMs,
              SPOT_ARRIVAL_TIMING_MS.primary,
            )
          : currentPhaseKind === 'summit-hold'
            ? mergeSummitArrivalStateForPhase(
                baseSpotArrivalStates,
                'summit-hold',
                animationState.elapsedMs - summitHoldStartMs,
                settings.cameraState.timeline.transitionToSummitMs,
                settings.cameraState.timeline.summitHoldMs,
                SPOT_ARRIVAL_TIMING_MS.primary,
              )
            : baseSpotArrivalStates;
      labelController.updateArrivalStates(
        spotArrivalStates,
        animationState.elapsedMs,
      );
      hotPathProfiler?.end('spot-arrival');

      hotPathProfiler?.begin('arrival-card');
      arrivalCard.update(spotArrivalStates);
      hotPathProfiler?.end('arrival-card');
    }

    if (import.meta.env.DEV) {
      (window as any).__animationState = animationState;
      // Matsu Phase 3 visual verification用の一時的なDEVフック(既存
      // __animationState等と同じ運用)。本番挙動には影響しない。
      (window as any).__spotArrivalStates = spotArrivalStates;
      updateOverlayText?.(routeFollowProgress);
    }

    hotPathProfiler?.begin('renderer-render');
    gpuTimerInstrumentation.beginRender();
    renderer.render(scene, camera);
    // labelController uses CSS2DRenderer. Close the GPU query before its DOM work
    // so style/layout time cannot be misclassified as WebGL execution time.
    gpuTimerInstrumentation.endRender();
    labelController.render();
    hotPathProfiler?.end('renderer-render');
    gpuTimerInstrumentation.endFrame();
  });

  if (gpuTimerEnabled) {
    (window as any).__takaoGpuTimer = () => ({
      gpu: gpuFrameTimer.snapshot(),
      frames: gpuTimerFrames.toArray().map((frame) => ({ ...frame })),
      elapsedMs: animationState.elapsedMs,
      canvas: {
        width: renderer.domElement.width,
        height: renderer.domElement.height,
        pixelRatio: renderer.getPixelRatio(),
      },
    });
  }

  const getTakaoLabelPerfSummary = () => ({
    bypass: { ...labelPerfBypassFlags },
    layerPromotion: { ...labelLayerPromotionFlags },
    counters: labelController.getPerfCounters?.() ?? null,
    verify: labelController.getRaycastVerification?.() ?? null,
    throttleFrames: settings.labels.occlusion.throttleFrames,
    entryCount: labelController.objects.length,
  });

  if (framePacingEnabled) {
    // Matsu Phase 3 (2026-09-09) P0-A: `?perf=1`時のみ公開。DEVに限定しないのは、
    // `npm run preview`(本番相当ビルド)でも計測できるようにするため
    // (docs/design.md追補§1参照)。毎フレームのconsole出力は行わず、on-demand。
    (window as any).__framePacingSummary = () => ({
      frame: framePacingRecorder.getFrameSummary(),
      movement: framePacingRecorder.getMovementSummary(),
    });
    // Matsu Phase 4 (2026-09-09) [MP4-F1]/[MP4-F6]: camera motion instrumentation・
    // main-thread hot path profilingのon-demand summary(docs/design.md追補§1/§4参照)。
    (window as any).__cameraMotionSummary = () => cameraMotionRecorder?.getSummary();
    (window as any).__hotPathSummary = () => hotPathProfiler?.getSummary();
    (window as any).__takaoLabelPerf = getTakaoLabelPerfSummary;
    // Matsu Reference-Driven Terrain (2026-09-10): A/B時にvariant・実解像度・
    // 初期化コストをリーダーが実測するためのon-demand summary。per-frameコストなし。
    (window as any).__terrainSurfaceSummary = () => ({
      variant: terrainSurfaceFlags,
      canopyResolution,
      fullResolution: demFullResolution
        ? {
            cols: demFullResolution.cols,
            rows: demFullResolution.rows,
            cellSizeMeters: demFullResolution.cellSizeMeters,
          }
        : null,
      normalMap: terrainNormalMapTexture
        ? {
            width: terrainNormalMapTexture.image.width,
            height: terrainNormalMapTexture.image.height,
          }
        : null,
      initTimingsMs: terrainSurfaceTimingsMs,
    });
    (window as any).__forestSummary = () => ({
      variant: forestFlags,
      build: forestController.summary,
      renderer: {
        render: {
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          points: renderer.info.render.points,
          lines: renderer.info.render.lines,
        },
        memory: {
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
        },
        programs: renderer.info.programs?.length ?? 0,
      },
    });
  }

  // Verification can be requested independently of `?perf=1`; expose only
  // the label summary needed to inspect its comparison counters in that case.
  if (labelRaycastVerifyEnabled && !framePacingEnabled) {
    (window as any).__takaoLabelPerf = getTakaoLabelPerfSummary;
  }

  if (import.meta.env.DEV && mode === 'full') {
    const manualOrbitIsActive = (): boolean =>
      manualOrbitSessionActive && isAutoCameraPaused;

    (window as any).__takaoManualOrbit = {
      enabled: (): boolean => manualOrbitEnabled,
      active: (): boolean => manualOrbitIsActive(),
      state: () => manualOrbitState === undefined
        ? null
        : {
            azimuthRad: manualOrbitState.azimuthRad,
            elevationRad: manualOrbitState.elevationRad,
            radius: manualOrbitState.radius,
            target: { ...manualOrbitState.target },
            savedPose: manualOrbitSavedPose === undefined
              ? null
              : {
                  position: { ...manualOrbitSavedPose.position },
                  target: { ...manualOrbitSavedPose.target },
                },
          },
      reset: (): void => {
        resetManualOrbit();
      },
    };

    const getUnmaskedWebGlInfo = (): {
      unmaskedRenderer: string | null;
      unmaskedVendor: string | null;
    } => {
      try {
        const context = renderer.getContext();
        const debugInfo = context.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo === null) {
          return { unmaskedRenderer: null, unmaskedVendor: null };
        }
        const rendererValue = context.getParameter(
          debugInfo.UNMASKED_RENDERER_WEBGL,
        );
        const vendorValue = context.getParameter(
          debugInfo.UNMASKED_VENDOR_WEBGL,
        );
        return {
          unmaskedRenderer:
            typeof rendererValue === 'string' ? rendererValue : null,
          unmaskedVendor: typeof vendorValue === 'string' ? vendorValue : null,
        };
      } catch {
        return { unmaskedRenderer: null, unmaskedVendor: null };
      }
    };

    (window as any).__takaoPerf = () => {
      const unmasked = getUnmaskedWebGlInfo();
      const capabilities = renderer.capabilities as typeof renderer.capabilities & {
        isWebGL2?: boolean;
      };
      return {
        renderer: {
          // autoReset remains unchanged, so render counters describe the latest frame.
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          points: renderer.info.render.points,
          lines: renderer.info.render.lines,
          frame: renderer.info.render.frame,
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
          autoReset: renderer.info.autoReset,
        },
        canvas: {
          width: renderer.domElement.width,
          height: renderer.domElement.height,
          clientWidth: renderer.domElement.clientWidth,
          clientHeight: renderer.domElement.clientHeight,
          pixelRatio: renderer.getPixelRatio(),
          devicePixelRatio: window.devicePixelRatio,
        },
        context: {
          isWebGL2: capabilities.isWebGL2,
          maxTextureSize: renderer.capabilities.maxTextureSize,
          precision: renderer.capabilities.precision,
          ...unmasked,
        },
        bypass: {
          disableAntialias: perfBypass.disableAntialias,
          terrainMaterialBasic: perfBypass.terrainMaterialBasic,
          rendererAntialiasRequested,
          terrainMaterialType: terrainMaterial.type,
        },
        paused: isAutoCameraPaused,
        manualOrbitActive: manualOrbitIsActive(),
        framePacing: framePacingEnabled
          ? framePacingRecorder.getFrameSummary() ?? null
          : null,
      };
    };

    type CameraPreset = 'A' | 'B' | 'C';

    const terrainWidth = grid.cols * grid.cellSizeMeters;
    const terrainDepth = grid.rows * grid.cellSizeMeters;
    const diagonal = Math.sqrt(
      terrainWidth * terrainWidth + terrainDepth * terrainDepth,
    );
    let maxElevation = -Infinity;
    for (let i = 0; i < grid.values.length; i += 1) {
      const elevation = grid.values[i];
      if (elevation > maxElevation) {
        maxElevation = elevation;
      }
    }
    maxElevation *= settings.elevationScale;

    const presetOverlay = document.createElement('div');
    presetOverlay.style.cssText = [
      'position: fixed',
      'top: 12px',
      'left: 12px',
      'z-index: 1000',
      'padding: 6px 8px',
      'color: #fff',
      'background: rgba(0, 0, 0, 0.65)',
      'font: 12px/1.4 monospace',
      'pointer-events: none',
    ].join(';');
    document.body.appendChild(presetOverlay);

    const presetLabels: Record<CameraPreset, string> = {
      A: '現行（斜め低角度）',
      B: '高め見下ろし',
      C: '正面寄り・望遠',
    };

    let currentPreset: CameraPreset = 'A';
    let lastProgress = 0;

    const renderOverlayText = (): void => {
      const progressPercent = Math.round(lastProgress * 100);
      const cameraState = isAutoCameraPaused
        ? `PAUSED (Preset ${currentPreset}) ${presetLabels[currentPreset]}`
        : 'AUTO';
      presetOverlay.textContent = `Camera: ${cameraState} | Route: ${progressPercent}%`;
    };

    updateOverlayText = (progress: number): void => {
      lastProgress = progress;
      renderOverlayText();
    };

    const setCameraPreset = (preset: CameraPreset): void => {
      camera.fov = preset === 'C' ? 22 : 45;

      if (preset === 'A') {
        camera.position.set(
          cameraPosition.x,
          cameraPosition.y,
          cameraPosition.z,
        );
      } else if (preset === 'B') {
        const offsetPerAxis = (diagonal * 0.5) / Math.sqrt(2);
        camera.position.set(
          lookAtTarget.x + offsetPerAxis,
          maxElevation * 4 + diagonal * 0.6,
          lookAtTarget.z + offsetPerAxis,
        );
      } else {
        // Preset C(正面寄り・望遠): 山の比高(約600m)に対し裾野の幅(約6km)が
        // 広いため、遠距離×狭FOVだけで構図を作ると relief が角度的に潰れて
        // 帯状に見えてしまう(初回試作で確認済み)。そのため距離は中距離に抑え、
        // カメラ高度も山頂よりかなり低い位置に置くことで、仰角を持たせて
        // 手前の斜面を強調する構図にする。
        camera.position.set(
          lookAtTarget.x + diagonal * 0.05,
          maxElevation * 0.35 + diagonal * 0.05,
          lookAtTarget.z + diagonal * 0.55,
        );
      }

      camera.updateProjectionMatrix();
      camera.lookAt(lookAtTarget.x, lookAtTarget.y, lookAtTarget.z);
      currentPreset = preset;
      renderOverlayText();
    };

    window.addEventListener('keydown', (event) => {
      const presetByKey: Record<string, CameraPreset | undefined> = {
        '1': 'A',
        '2': 'B',
        '3': 'C',
      };
      const preset = presetByKey[event.key];
      if (preset) {
        setCameraPreset(preset);
      }

      if (event.key === '0') {
        isAutoCameraPaused = !isAutoCameraPaused;
        if (!isAutoCameraPaused) {
          // The existing rail owns the next unpaused camera update; clearing the
          // spike session prevents a stale manual pose from becoming unrecoverable.
          clearManualOrbitSession();
          camera.fov = 45;
          camera.updateProjectionMatrix();
        }
        renderOverlayText();
      }
    });

    let capturePoseId: string | undefined;
    let captureTarget: Vec3 | undefined;
    const applyCapturePose = (
      pose: { position: Vec3; target: Vec3; fov: number },
      poseId: string,
    ): void => {
      camera.position.set(pose.position.x, pose.position.y, pose.position.z);
      camera.fov = pose.fov;
      camera.updateProjectionMatrix();
      camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
      capturePoseId = poseId;
      captureTarget = { ...pose.target };
    };

    (window as any).__forestCapture = {
      freezeClock(elapsedMs = FOREST_CAPTURE_ELAPSED_MS): void {
        captureFrozenElapsedMs = elapsedMs;
      },
      releaseClock(): void {
        captureFrozenElapsedMs = undefined;
      },
      pause(on = true): void {
        isAutoCameraPaused = on;
        if (!on) {
          // On resume the unchanged camera rail overwrites the manual camera pose.
          clearManualOrbitSession();
        }
        renderOverlayText();
      },
      hideOverlay(): void {
        presetOverlay.style.display = 'none';
      },
      showOverlay(): void {
        presetOverlay.style.display = '';
      },
      pose(poseId: string): void {
        const pose = resolveCapturePose(poseId, routePoints);
        if (pose !== undefined) {
          applyCapturePose(pose, poseId);
        }
      },
      sweep(routeFraction: number, distanceMeters: number): void {
        const pose = resolvePopSweepPose(
          routeFraction,
          distanceMeters,
          routePoints,
        );
        applyCapturePose(pose, `sweep:${routeFraction}:${distanceMeters}`);
      },
      state() {
        return {
          poseId: capturePoseId,
          elapsedMs: animationState.elapsedMs,
          paused: isAutoCameraPaused,
          fov: camera.fov,
          position: {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
          },
          target: captureTarget === undefined ? undefined : { ...captureTarget },
        };
      },
    };
    const scopeProofRuntimeDev = scopeProofRuntime!;
    type ScopeProofWindowState = {
      id: string;
      label: string;
      fallbackReason: string | null;
      bounds: ScopeProofBounds | null;
      clipping: boolean;
      planeCount: number;
      metrics: ScopeProofMetrics | null;
      grid: {
        cols: number;
        rows: number;
        cellSizeMeters: number;
        bounds: { north: number; south: number; east: number; west: number };
        spanXMeters: number;
        spanZMeters: number;
      };
      camera: {
        position: { x: number; y: number; z: number };
        target: { x: number; y: number; z: number } | undefined;
        fov: number;
        near: number;
        far: number;
        aspect: number;
        matrixWorld: number[];
        projectionMatrix: number[];
      };
      elapsedMs: number;
      paused: boolean;
      canvas: {
        width: number;
        height: number;
        clientWidth: number;
        clientHeight: number;
        pixelRatio: number;
        devicePixelRatio: number;
      };
    };

    const getScopeProofState = (): ScopeProofWindowState => {
      const runtimeState = scopeProofRuntimeDev.getState();
      camera.updateMatrixWorld(true);
      return {
        ...runtimeState,
        clipping: runtimeState.bounds !== null,
        planeCount: terrainMaterial.clippingPlanes?.length ?? 0,
        metrics: runtimeState.bounds === null
          ? null
          : computeScopeProofMetrics(runtimeState.bounds, grid),
        grid: {
          cols: grid.cols,
          rows: grid.rows,
          cellSizeMeters: grid.cellSizeMeters,
          bounds: { ...grid.bounds },
          spanXMeters: (grid.cols - 1) * grid.cellSizeMeters,
          spanZMeters: (grid.rows - 1) * grid.cellSizeMeters,
        },
        camera: {
          position: {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
          },
          target: captureTarget === undefined ? undefined : { ...captureTarget },
          fov: camera.fov,
          near: camera.near,
          far: camera.far,
          aspect: camera.aspect,
          matrixWorld: Array.from(camera.matrixWorld.elements),
          projectionMatrix: Array.from(camera.projectionMatrix.elements),
        },
        elapsedMs: animationState.elapsedMs,
        paused: isAutoCameraPaused,
        canvas: {
          width: renderer.domElement.width,
          height: renderer.domElement.height,
          clientWidth: renderer.domElement.clientWidth,
          clientHeight: renderer.domElement.clientHeight,
          pixelRatio: renderer.getPixelRatio(),
          devicePixelRatio: window.devicePixelRatio,
        },
      };
    };

    const runScopeProofAttribution = (options?: {
      width?: number;
      height?: number;
      bounds?: ScopeProofBounds | null;
    }): ScopeProofAttribution => {
      const canvasWidth = renderer.domElement.clientWidth || renderer.domElement.width;
      const canvasHeight = renderer.domElement.clientHeight || renderer.domElement.height;
      const canvasHeightPerWidth = canvasWidth > 0 ? canvasHeight / canvasWidth : 9 / 16;
      const requestedWidth = options?.width ?? 960;
      const requestedHeight = options?.height ?? requestedWidth * canvasHeightPerWidth;
      const width = Number.isFinite(requestedWidth)
        ? Math.max(1, Math.round(requestedWidth))
        : 960;
      const height = Number.isFinite(requestedHeight)
        ? Math.max(1, Math.round(requestedHeight))
        : Math.max(1, Math.round(960 * canvasHeightPerWidth));
      const currentBounds = scopeProofRuntimeDev.getState().bounds;
      const attributionBounds = options?.bounds === undefined
        ? currentBounds
        : options.bounds;

      if (attributionBounds === null) {
        return classifyScopeProofPixels(
          new Uint8Array(width * height * 4),
          width,
          height,
          grid,
          grid.bounds,
        );
      }

      const renderTarget = new WebGLRenderTarget(width, height, {
        type: UnsignedByteType,
        format: RGBAFormat,
        minFilter: NearestFilter,
        magFilter: NearestFilter,
        depthBuffer: true,
        generateMipmaps: false,
      });
      const cellIdMaterial = new ShaderMaterial({
        uniforms: {
          uCellSize: { value: grid.cellSizeMeters },
          uMaxColIndex: { value: grid.cols - 1 },
          uMaxRowIndex: { value: grid.rows - 1 },
        },
        vertexShader: `
          uniform float uCellSize;
          varying vec2 vCell;
          void main() {
            vCell = vec2(position.x, position.z) / uCellSize;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uMaxColIndex;
          uniform float uMaxRowIndex;
          varying vec2 vCell;
          void main() {
            gl_FragColor = vec4(
              clamp(vCell.x / uMaxColIndex, 0.0, 1.0),
              clamp(vCell.y / uMaxRowIndex, 0.0, 1.0),
              1.0,
              1.0
            );
          }
        `,
        clipping: false,
        fog: false,
        toneMapped: false,
        depthTest: true,
        depthWrite: true,
        side: terrainMaterial.side,
      });
      const pixels = new Uint8Array(width * height * 4);
      const attributionTerrain = terrain as THREE.Mesh;
      const originalMaterial = attributionTerrain.material;
      const originalRenderTarget = renderer.getRenderTarget();
      const originalClearColor = renderer.getClearColor(new Color()).clone();
      const originalClearAlpha = renderer.getClearAlpha();
      const visibility: Array<{ object: THREE.Object3D; visible: boolean }> = [];

      try {
        scene.traverse((object) => {
          if (object !== scene && object !== terrain) {
            visibility.push({ object, visible: object.visible });
            object.visible = false;
          }
        });
        attributionTerrain.material = cellIdMaterial;
        renderer.setClearColor(0x000000, 0);
        renderer.setRenderTarget(renderTarget);
        renderer.clear();
        renderer.render(scene, camera);
        renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, pixels);
        renderer.setRenderTarget(null);
      } finally {
        attributionTerrain.material = originalMaterial;
        for (const entry of visibility) {
          entry.object.visible = entry.visible;
        }
        renderer.setClearColor(originalClearColor, originalClearAlpha);
        try {
          renderer.setRenderTarget(null);
          renderer.render(scene, camera);
        } finally {
          renderer.setRenderTarget(originalRenderTarget);
          cellIdMaterial.dispose();
          renderTarget.dispose();
        }
      }

      return classifyScopeProofPixels(pixels, width, height, grid, attributionBounds);
    };

    (window as any).__scopeProof = {
      setBounds(bounds: ScopeProofBounds | null): void {
        scopeProofRuntimeDev.applyScopeProofBounds(bounds);
      },
      setCandidate(id: string): boolean {
        return scopeProofRuntimeDev.setCandidate(id);
      },
      state(): ScopeProofWindowState {
        return getScopeProofState();
      },
      attribution(options?: {
        width?: number;
        height?: number;
        bounds?: ScopeProofBounds | null;
      }): ScopeProofAttribution {
        return runScopeProofAttribution(options);
      },
    };

    // Matsu H01 Takao Local Still Export: DEV限定の高品質静止画書き出しハーネス。
    // production buildには一切含まれない(import.meta.env.DEV ガード内)。
    // pose/poseSpecは既存applyCapturePose()にそのまま委譲し、カメラ操作ロジックは
    // 自前実装しない。export()の描画自体はrunScopeProofAttribution()と同様に
    // WebGLRenderTarget + readRenderTargetPixels()を使うが、scopeProofと異なり
    // マテリアル差し替え・visible操作は一切行わず、production同一の見た目で描く。
    let takaoStillLabelsVisible = true;
    let takaoStillChromeVisible = true;
    const takaoStillDefaultPixelRatio = renderer.getPixelRatio();
    const TAKAO_STILL_MAX_RENDER_DIMENSION = 8192;

    const setTakaoStillLabels = (on: boolean): void => {
      const labelRendererEl = document.querySelector<HTMLElement>(
        '.route-label-renderer',
      );
      if (labelRendererEl) {
        labelRendererEl.style.visibility = on ? '' : 'hidden';
      }
      takaoStillLabelsVisible = on;
    };

    const setTakaoStillChrome = (on: boolean): void => {
      if (presetOverlay) {
        presetOverlay.style.visibility = on ? '' : 'hidden';
      }
      // attribution overlay(src/scene/attribution.ts)はclass/idを持たないため、
      // 既知のhref(ATTRIBUTION_HREF)を持つ<a>から親のoverlay divを辿って特定する。
      const attributionAnchor = document.querySelector<HTMLAnchorElement>(
        `a[href="${ATTRIBUTION_HREF}"]`,
      );
      const attributionOverlay = attributionAnchor?.parentElement ?? null;
      if (attributionOverlay) {
        attributionOverlay.style.visibility = on ? '' : 'hidden';
      }
      const arrivalCardEl = document.querySelector<HTMLElement>('.arrival-card');
      if (arrivalCardEl) {
        arrivalCardEl.style.visibility = on ? '' : 'hidden';
      }
      takaoStillChromeVisible = on;
    };

    const setTakaoStillRenderScale = (ratio: number): void => {
      if (!Number.isFinite(ratio)) {
        return;
      }
      const clamped = Math.min(4, Math.max(1, ratio));
      renderer.setPixelRatio(clamped);
      renderer.setSize(
        renderer.domElement.clientWidth,
        renderer.domElement.clientHeight,
      );
    };

    const isValidTakaoStillDimension = (value: number): boolean =>
      Number.isFinite(value) &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= 20000;

    // export()の`background:'app'`用: WebGLキャンバスの下に実際に見えている
    // DOM側グラデーション(src/scene/background.ts computeBackgroundGradientCss
    // と同じ stop 構成)をreadback側でも再現するための色補間ヘルパー。
    // background.ts自体は変更しない(色定義は必ずsettings.visual.backgroundから読む)。
    interface TakaoStillGradientStop {
      percent: number;
      r: number;
      g: number;
      b: number;
    }

    const parseTakaoStillHexColor = (
      hex: string,
    ): { r: number; g: number; b: number } => {
      const normalized = hex.replace('#', '');
      const r = Number.parseInt(normalized.substring(0, 2), 16);
      const g = Number.parseInt(normalized.substring(2, 4), 16);
      const b = Number.parseInt(normalized.substring(4, 6), 16);
      return {
        r: Number.isFinite(r) ? r : 0,
        g: Number.isFinite(g) ? g : 0,
        b: Number.isFinite(b) ? b : 0,
      };
    };

    const buildTakaoStillGradientStops = (
      config: BackgroundFogConfig,
    ): TakaoStillGradientStop[] => {
      const top = parseTakaoStillHexColor(config.gradientTopColor);
      const bottom = parseTakaoStillHexColor(config.gradientBottomColor);
      if (config.gradientMidColor === undefined) {
        return [
          { percent: 0, ...top },
          { percent: 100, ...bottom },
        ];
      }
      const mid = parseTakaoStillHexColor(config.gradientMidColor);
      const midPercent = config.gradientMidStopPercent ?? 45;
      return [
        { percent: 0, ...top },
        { percent: midPercent, ...mid },
        { percent: 100, ...bottom },
      ];
    };

    // 行yに対応するstop位置t(0..1)から、隣り合うstop間をsRGBバイト空間で
    // 線形補間する(CSSのlinear-gradientと同じ補間)。縦方向グラデーションなので
    // 行ごとに一度だけ呼べば足りる。
    const sampleTakaoStillGradient = (
      stops: TakaoStillGradientStop[],
      t: number,
    ): { r: number; g: number; b: number } => {
      const percent = Math.min(100, Math.max(0, t * 100));
      for (let i = 0; i < stops.length - 1; i += 1) {
        const from = stops[i];
        const to = stops[i + 1];
        if (percent <= to.percent || i === stops.length - 2) {
          const span = to.percent - from.percent;
          const localT =
            span === 0 ? 0 : Math.min(1, Math.max(0, (percent - from.percent) / span));
          return {
            r: from.r + (to.r - from.r) * localT,
            g: from.g + (to.g - from.g) * localT,
            b: from.b + (to.b - from.b) * localT,
          };
        }
      }
      return stops[stops.length - 1];
    };

    const exportTakaoStill = async (opts: {
      bucket: string;
      name: string;
      width?: number;
      height?: number;
      supersample?: number;
      background?: 'app' | 'transparent';
    }): Promise<{
      ok: boolean;
      path?: string;
      bytes?: number;
      width?: number;
      height?: number;
      supersample?: number;
      poseId?: string;
      background?: 'app' | 'transparent';
      error?: string;
    }> => {
      try {
        if (
          (opts.width !== undefined && !isValidTakaoStillDimension(opts.width)) ||
          (opts.height !== undefined && !isValidTakaoStillDimension(opts.height))
        ) {
          return { ok: false, error: 'invalid size' };
        }
        if (!opts.bucket || !opts.name) {
          return { ok: false, error: 'invalid target' };
        }
        // 不正な値(未定義含む)は既定の'app'へフォールバックする(throwしない)。
        const resolvedBackground: 'app' | 'transparent' =
          opts.background === 'transparent' ? 'transparent' : 'app';

        const outW = opts.width ?? renderer.domElement.width;
        const outH = opts.height ?? renderer.domElement.height;

        const requestedSupersample =
          opts.supersample !== undefined &&
          Number.isFinite(opts.supersample) &&
          opts.supersample > 0
            ? opts.supersample
            : 2;
        const maxSupersampleForWidth =
          outW > 0 ? TAKAO_STILL_MAX_RENDER_DIMENSION / outW : requestedSupersample;
        const maxSupersampleForHeight =
          outH > 0 ? TAKAO_STILL_MAX_RENDER_DIMENSION / outH : requestedSupersample;
        const maxSupersample = Math.max(
          1,
          Math.min(maxSupersampleForWidth, maxSupersampleForHeight),
        );
        const ss = Math.min(requestedSupersample, maxSupersample);
        const renderW = Math.max(1, Math.round(outW * ss));
        const renderH = Math.max(1, Math.round(outH * ss));

        const originalAspect = camera.aspect;
        const originalRenderTarget = renderer.getRenderTarget();
        let renderTarget: WebGLRenderTarget | undefined;
        // readback(readRenderTargetPixels)がJS側Uint8Arrayへ同期完了した時点で
        // 3D側(render target / camera.aspect)の後始末を前倒しで済ませる。以降は
        // await を含む純CPU処理(反転補正・背景合成・PNG化・fetch)のみになるため、
        // animateループを8K render targetへ描画させ続けたまま待たせずに済む。
        // finallyとの二重復元を防ぐためフラグで一度だけ実行する。
        let restored = false;
        const restoreTakaoStillRenderState = (): void => {
          if (restored) {
            return;
          }
          camera.aspect = originalAspect;
          camera.updateProjectionMatrix();
          renderer.setRenderTarget(originalRenderTarget);
          if (renderTarget) {
            renderTarget.dispose();
          }
          renderer.render(scene, camera);
          restored = true;
        };

        try {
          camera.aspect = outW / outH;
          camera.updateProjectionMatrix();

          renderTarget = new WebGLRenderTarget(renderW, renderH, {
            type: UnsignedByteType,
            format: RGBAFormat,
            minFilter: LinearFilter,
            magFilter: LinearFilter,
            depthBuffer: true,
            generateMipmaps: false,
          });
          // three.jsはdefault framebufferへ描くときだけrenderer.outputColorSpaceを
          // 適用する。WebGLRenderTargetへの描画はtarget.textureのcolorSpaceが
          // 使われ、既定はlinearのまま(=readbackがlinearになり暗く沈む)ため、
          // 画面表示と同じエンコードをここで明示的に揃える。
          renderTarget.texture.colorSpace = renderer.outputColorSpace;

          renderer.setRenderTarget(renderTarget);
          renderer.clear();
          renderer.render(scene, camera);

          const pixels = new Uint8Array(renderW * renderH * 4);
          renderer.readRenderTargetPixels(
            renderTarget,
            0,
            0,
            renderW,
            renderH,
            pixels,
          );

          // ピクセルはここでJS側に取り終わっている。ここから先(反転補正・
          // 背景合成・2D canvas描画・縮小・PNG化・fetch)はrendererに一切
          // 触れないため、3D側の復元をここで前倒しして済ませる。
          restoreTakaoStillRenderState();

          const canUseOffscreen = typeof OffscreenCanvas !== 'undefined';
          const renderCanvas: HTMLCanvasElement | OffscreenCanvas = canUseOffscreen
            ? new OffscreenCanvas(renderW, renderH)
            : document.createElement('canvas');
          if (!canUseOffscreen) {
            (renderCanvas as HTMLCanvasElement).width = renderW;
            (renderCanvas as HTMLCanvasElement).height = renderH;
          }
          const renderCtx = renderCanvas.getContext('2d') as
            | CanvasRenderingContext2D
            | OffscreenCanvasRenderingContext2D
            | null;
          if (!renderCtx) {
            return { ok: false, error: 'canvas 2d context unavailable' };
          }

          // WebGLは左下原点でreadRenderTargetPixelsを返すため、行単位で
          // 上下反転してからImageData(左上原点)へ書き込む。この反転補正の
          // 段階(縮小前・renderW×renderHのまま)で背景合成/premultiply解除も行う。
          // WebGL context は premultipliedAlpha:true(実測)のため、
          // readbackしたsrcは乗算済みアルファである。
          const gradientStops =
            resolvedBackground === 'app'
              ? buildTakaoStillGradientStops(settings.visual.background)
              : undefined;

          const imageData = renderCtx.createImageData(renderW, renderH);
          const rowBytes = renderW * 4;
          for (let y = 0; y < renderH; y += 1) {
            const srcRowStart = y * rowBytes;
            // dstY: putImageData後のcanvas上の行(0=上端)。WebGLのy(0=下端)を反転。
            const dstY = renderH - 1 - y;
            const dstRowStart = dstY * rowBytes;

            if (resolvedBackground === 'app' && gradientStops) {
              // 縦方向グラデーションなので、行ごとに背景色を1回だけ求める
              // (CSSのlinear-gradientと同じstop間sRGBバイト補間)。
              const t = renderH > 1 ? dstY / (renderH - 1) : 0;
              const bg = sampleTakaoStillGradient(gradientStops, t);

              for (let x = 0; x < renderW; x += 1) {
                const srcOffset = srcRowStart + x * 4;
                const dstOffset = dstRowStart + x * 4;
                const srcR = pixels[srcOffset];
                const srcG = pixels[srcOffset + 1];
                const srcB = pixels[srcOffset + 2];
                const srcA = pixels[srcOffset + 3];
                const coverage = 1 - srcA / 255;
                // srcは乗算済みアルファのため、over合成はそのまま加算でよい。
                imageData.data[dstOffset] = Math.min(255, srcR + bg.r * coverage);
                imageData.data[dstOffset + 1] = Math.min(
                  255,
                  srcG + bg.g * coverage,
                );
                imageData.data[dstOffset + 2] = Math.min(
                  255,
                  srcB + bg.b * coverage,
                );
                imageData.data[dstOffset + 3] = 255;
              }
            } else {
              // background:'transparent'。乗算済みアルファを解除してから
              // ImageData(非乗算)へ書き込む(解除しないと半透明の縁が暗く沈む)。
              for (let x = 0; x < renderW; x += 1) {
                const srcOffset = srcRowStart + x * 4;
                const dstOffset = dstRowStart + x * 4;
                const srcR = pixels[srcOffset];
                const srcG = pixels[srcOffset + 1];
                const srcB = pixels[srcOffset + 2];
                const srcA = pixels[srcOffset + 3];
                if (srcA > 0) {
                  imageData.data[dstOffset] = Math.min(
                    255,
                    Math.round((srcR * 255) / srcA),
                  );
                  imageData.data[dstOffset + 1] = Math.min(
                    255,
                    Math.round((srcG * 255) / srcA),
                  );
                  imageData.data[dstOffset + 2] = Math.min(
                    255,
                    Math.round((srcB * 255) / srcA),
                  );
                } else {
                  imageData.data[dstOffset] = 0;
                  imageData.data[dstOffset + 1] = 0;
                  imageData.data[dstOffset + 2] = 0;
                }
                imageData.data[dstOffset + 3] = srcA;
              }
            }
          }
          renderCtx.putImageData(imageData, 0, 0);

          let finalCanvas: HTMLCanvasElement | OffscreenCanvas = renderCanvas;
          if (renderW !== outW || renderH !== outH) {
            const outCanvas: HTMLCanvasElement | OffscreenCanvas = canUseOffscreen
              ? new OffscreenCanvas(outW, outH)
              : document.createElement('canvas');
            if (!canUseOffscreen) {
              (outCanvas as HTMLCanvasElement).width = outW;
              (outCanvas as HTMLCanvasElement).height = outH;
            }
            const outCtx = outCanvas.getContext('2d') as
              | CanvasRenderingContext2D
              | OffscreenCanvasRenderingContext2D
              | null;
            if (!outCtx) {
              return { ok: false, error: 'canvas 2d context unavailable' };
            }
            outCtx.imageSmoothingEnabled = true;
            (outCtx as CanvasRenderingContext2D).imageSmoothingQuality = 'high';
            outCtx.drawImage(
              renderCanvas as CanvasImageSource,
              0,
              0,
              renderW,
              renderH,
              0,
              0,
              outW,
              outH,
            );
            finalCanvas = outCanvas;
          }

          const blob: Blob = canUseOffscreen
            ? await (finalCanvas as OffscreenCanvas).convertToBlob({
                type: 'image/png',
              })
            : await new Promise<Blob>((resolve, reject) => {
                (finalCanvas as HTMLCanvasElement).toBlob((result) => {
                  if (result) {
                    resolve(result);
                  } else {
                    reject(new Error('toBlob failed'));
                  }
                }, 'image/png');
              });

          const response = await fetch(
            `/__still-export?bucket=${encodeURIComponent(opts.bucket)}&name=${encodeURIComponent(opts.name)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'image/png' },
              body: blob,
            },
          );
          const json = await response.json().catch(() => undefined);
          if (!response.ok || json?.ok === false) {
            return {
              ok: false,
              error: json?.error ?? `HTTP ${response.status}`,
            };
          }

          return {
            ok: true,
            path: json?.path,
            bytes: json?.bytes,
            width: outW,
            height: outH,
            supersample: ss,
            poseId: capturePoseId,
            background: resolvedBackground,
          };
        } finally {
          // readback後の正常系では既に前倒し復元済み(restored===true)のため
          // ここは no-op。readbackより前で例外が起きた場合のみ、ここで確実に
          // 復元する。
          restoreTakaoStillRenderState();
        }
      } catch (error) {
        return { ok: false, error: String(error) };
      }
    };

    (window as any).__takaoStill = {
      pose(id: string): boolean {
        const resolved = resolveTakaoLocalPose(id, routePoints);
        if (resolved === undefined) {
          return false;
        }
        applyCapturePose(resolved, id);
        return true;
      },
      poseSpec(spec: TakaoLocalPoseSpec): boolean {
        if (routePoints.length === 0) {
          return false;
        }
        const resolved = resolveTakaoLocalPoseSpec(spec, routePoints);
        applyCapturePose(resolved, spec.id);
        return true;
      },
      freeze(elapsedMs: number): void {
        if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
          return;
        }
        captureFrozenElapsedMs = elapsedMs;
      },
      release(): void {
        captureFrozenElapsedMs = undefined;
      },
      setLabels(on: boolean): void {
        setTakaoStillLabels(on);
      },
      setChrome(on: boolean): void {
        setTakaoStillChrome(on);
      },
      setRenderScale(ratio: number): void {
        setTakaoStillRenderScale(ratio);
      },
      export(opts: {
        bucket: string;
        name: string;
        width?: number;
        height?: number;
        supersample?: number;
        background?: 'app' | 'transparent';
      }) {
        return exportTakaoStill(opts);
      },
      state(): object {
        // routeFollowProgress(reveal進捗)はanimateループ内のローカル定数で
        // window公開されていないため、既存のcomputeRouteFollowProgress()を
        // animationState.elapsedMsへ再適用して同値を導出する(ループ本体には
        // 手を入れない)。
        const routeProgress = computeRouteFollowProgress(
          animationState.elapsedMs,
          routeFollowStartMs,
          settings.routeAnimation.playDurationMs,
          routeFollowTimeline,
        );
        return {
          poseId: capturePoseId,
          position: {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
          },
          target:
            captureTarget === undefined ? undefined : { ...captureTarget },
          fov: camera.fov,
          aspect: camera.aspect,
          elapsedMs: animationState.elapsedMs,
          paused: isAutoCameraPaused,
          frozenElapsedMs: captureFrozenElapsedMs,
          labelsVisible: takaoStillLabelsVisible,
          chromeVisible: takaoStillChromeVisible,
          canvas: {
            width: renderer.domElement.width,
            height: renderer.domElement.height,
            clientWidth: renderer.domElement.clientWidth,
            clientHeight: renderer.domElement.clientHeight,
            pixelRatio: renderer.getPixelRatio(),
            devicePixelRatio: window.devicePixelRatio,
          },
          routeProgress,
        };
      },
      restore(): void {
        setTakaoStillLabels(true);
        setTakaoStillChrome(true);
        captureFrozenElapsedMs = undefined;
        setTakaoStillRenderScale(takaoStillDefaultPixelRatio);
        isAutoCameraPaused = false;
        clearManualOrbitSession();
        renderOverlayText();
      },
    };

    (window as any).__cap = (poseId: string) =>
      (window as any).__forestCapture.pose(poseId);
    (window as any).__hideOverlay = () =>
      (window as any).__forestCapture.hideOverlay();

    (window as any).__setCameraPreset = setCameraPreset;
    // Phase 1検証用: ルートの地形追従をリーダーが目視確認するための一時的なフック。
    // 本番挙動には影響しない(DEVガード内、カメラ参照を公開するだけ)。
    (window as any).__camera = camera;
    (window as any).__lookAtTarget = lookAtTarget;
    (window as any).__routePoints = routePoints;
    (window as any).__mockRouteRaw = takaoTrail1Route;
    (window as any).__routeAnimationConfig = settings.routeAnimation;
    (window as any).__gridInfo = {
      bounds: grid.bounds,
      cols: grid.cols,
      rows: grid.rows,
      cellSizeMeters: grid.cellSizeMeters,
    };
    setCameraPreset('A');
  }
}
