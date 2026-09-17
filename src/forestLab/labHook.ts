import {
  TELEMETRY_SAMPLE_FRAMES,
  TELEMETRY_WARMUP_FRAMES,
} from './labConstants';
import type {
  AppearanceId,
  CameraId,
  CandidateId,
  CandidateTelemetry,
  ForestLabCandidateConfig,
  PatchId,
  Vec3Record,
} from './labTypes';
import type {
  CandidateController,
  CandidateControllerState,
} from './candidates/candidateController';
import {
  buildCandidateTelemetry,
  collectFrameIntervals,
  collectRendererCounters,
} from './telemetry/labTelemetry';

export interface ForestLabState {
  patch: PatchId;
  candidate: CandidateId;
  appearance: AppearanceId;
  camera: CameraId;
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
  fov: number;
  drawingBufferWidth: number;
  drawingBufferHeight: number;
  orbitApplied: boolean;
}

export interface ForestLabHook {
  readonly ready: Promise<void>;
  isReady(): boolean;
  setPatch(id: PatchId): Promise<void>;
  setCandidate(id: CandidateId): Promise<void>;
  setAppearance(id: AppearanceId): Promise<void>;
  setCamera(id: CameraId): void;
  resetCamera(): void;
  setOrbitEnabled(enabled: boolean): void;
  hideOverlay(): void;
  showOverlay(): void;
  setLayerVisibility(spec: string): void;
  getState(): ForestLabState;
  getTelemetry(): Promise<CandidateTelemetry>;
  getConfigDump(): ForestLabCandidateConfig;
  dispose(): void;
}

export const FOREST_LAYER_VISIBILITY_TOKENS = [
  'FARCANOPY',
  'CLUSTERS',
  'DETAIL',
  'SHELL',
  'ALLFOREST',
  'NONE',
] as const;

export type ForestLayerVisibilityToken = typeof FOREST_LAYER_VISIBILITY_TOKENS[number];

export function parseLayerVisibilitySpec(spec: string): readonly ForestLayerVisibilityToken[] {
  const tokens = spec.split(',').map((token) => token.trim().toUpperCase()).filter(Boolean);
  if (tokens.length === 0) throw new Error('Forest layer visibility spec is empty.');
  const accepted = new Set<string>(FOREST_LAYER_VISIBILITY_TOKENS);
  for (const token of tokens) {
    if (!accepted.has(token)) throw new Error(`Unknown forest layer visibility token: ${token}.`);
  }
  const unique = [...new Set(tokens)] as ForestLayerVisibilityToken[];
  if (unique.includes('NONE') && unique.length !== 1) {
    throw new Error('NONE cannot be combined with forest layer visibility tokens.');
  }
  return unique;
}

interface RendererLike {
  info: {
    render: { calls: number; triangles: number };
    memory: { geometries: number; textures: number };
  };
  getContext(): { drawingBufferWidth: number; drawingBufferHeight: number };
}

interface CameraSnapshot {
  position: Vec3Record;
  target: Vec3Record;
  fov: number;
}

export interface CreateForestLabHookOptions {
  renderer: RendererLike;
  controller: CandidateController;
  initialPatch: PatchId;
  initialCandidate: CandidateId;
  initialAppearance?: AppearanceId;
  initialCamera: CameraId;
  replacePatch(id: PatchId): Promise<CandidateController>;
  applyCamera(id: CameraId): void;
  resetCameraPose(): void;
  setOrbitEnabledValue(enabled: boolean): void;
  isOrbitApplied(): boolean;
  hideUi(): void;
  showUi(): void;
  setLayerVisibilityValue(tokens: readonly ForestLayerVisibilityToken[]): void;
  getCameraSnapshot(): CameraSnapshot;
  getConfigDumpValue(): ForestLabCandidateConfig;
  renderFrame(): void;
  requestFrame?: (callback: FrameRequestCallback) => number;
  now?: () => number;
  assetMs?: number;
  disposeLab?: () => void;
  stateChanged?: (
    controllerState: CandidateControllerState,
    patch: PatchId,
    camera: CameraId,
  ) => void;
}

function tuple(value: Vec3Record): [number, number, number] {
  return [value.x, value.y, value.z];
}

export function createForestLabHook(options: CreateForestLabHookOptions): ForestLabHook {
  const requestFrame = options.requestFrame ?? window.requestAnimationFrame.bind(window);
  const now = options.now ?? (() => performance.now());
  let controller = options.controller;
  let patch = options.initialPatch;
  let candidate = options.initialCandidate;
  let appearance: AppearanceId = options.initialAppearance ?? 'BASELINE';
  let camera = options.initialCamera;
  let readyState = false;
  let disposed = false;

  const renderFrames = async (count: number): Promise<void> => {
    for (let index = 0; index < count; index += 1) {
      await new Promise<void>((resolve) => {
        requestFrame(() => {
          options.renderFrame();
          resolve();
        });
      });
    }
  };

  const ready = (async (): Promise<void> => {
    await controller.setAppearance(appearance);
    await controller.setCandidate(candidate);
    await renderFrames(2);
    readyState = true;
    options.stateChanged?.(controller.getState(), patch, camera);
  })();

  const assertActive = (): void => {
    if (disposed) throw new Error('Forest Lab hook is disposed.');
  };

  const updateCandidate = async (id: CandidateId): Promise<void> => {
    assertActive();
    await ready;
    readyState = false;
    await controller.setCandidate(id);
    candidate = id;
    await renderFrames(2);
    readyState = true;
    options.stateChanged?.(controller.getState(), patch, camera);
  };

  return {
    ready,
    isReady() {
      return readyState && !disposed;
    },
    async setPatch(id) {
      assertActive();
      await ready;
      readyState = false;
      const previous = controller;
      const replacement = await options.replacePatch(id);
      previous.dispose();
      controller = replacement;
      patch = id;
      await controller.setAppearance(appearance);
      await controller.setCandidate(candidate);
      await renderFrames(2);
      readyState = true;
      options.stateChanged?.(controller.getState(), patch, camera);
    },
    setCandidate: updateCandidate,
    async setAppearance(id) {
      assertActive();
      await ready;
      readyState = false;
      await controller.setAppearance(id);
      appearance = id;
      await renderFrames(2);
      readyState = true;
      options.stateChanged?.(controller.getState(), patch, camera);
    },
    setCamera(id) {
      assertActive();
      camera = id;
      options.applyCamera(id);
      options.stateChanged?.(controller.getState(), patch, camera);
    },
    resetCamera() {
      assertActive();
      options.resetCameraPose();
      options.stateChanged?.(controller.getState(), patch, camera);
    },
    setOrbitEnabled(enabled) {
      assertActive();
      options.setOrbitEnabledValue(enabled);
    },
    hideOverlay() {
      assertActive();
      options.hideUi();
    },
    showOverlay() {
      assertActive();
      options.showUi();
    },
    setLayerVisibility(spec) {
      assertActive();
      options.setLayerVisibilityValue(parseLayerVisibilitySpec(spec));
    },
    getState() {
      const snapshot = options.getCameraSnapshot();
      const context = options.renderer.getContext();
      return {
        patch,
        candidate,
        appearance,
        camera,
        cameraPosition: tuple(snapshot.position),
        cameraTarget: tuple(snapshot.target),
        fov: snapshot.fov,
        drawingBufferWidth: context.drawingBufferWidth,
        drawingBufferHeight: context.drawingBufferHeight,
        orbitApplied: options.isOrbitApplied(),
      };
    },
    async getTelemetry() {
      assertActive();
      await ready;
      const intervals = await collectFrameIntervals({
        requestFrame,
        now,
        warmupFrames: TELEMETRY_WARMUP_FRAMES,
        sampleFrames: TELEMETRY_SAMPLE_FRAMES,
      });
      options.renderFrame();
      const controllerState: CandidateControllerState = controller.getState();
      return buildCandidateTelemetry({
        counters: collectRendererCounters(options.renderer),
        shellVertexCount: controllerState.shellVertexCount,
        shellTriangleCount: controllerState.shellTriangleCount,
        detailCount: controllerState.detailCount,
        buildMs: controllerState.buildMs,
        assetMs: options.assetMs ?? 0,
        intervals,
        ...(controllerState.cluster
          ? {
            instanceCount: controllerState.cluster.visibleInstanceCount,
            clusterCount: controllerState.cluster.clusterAcceptedCount,
            memberCount: controllerState.cluster.memberPlacedCount,
          }
          : {}),
      });
    },
    getConfigDump() {
      return options.getConfigDumpValue();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      readyState = false;
      controller.dispose();
      options.disposeLab?.();
    },
  };
}

declare global {
  interface Window {
    __forestLab?: ForestLabHook;
  }
}
