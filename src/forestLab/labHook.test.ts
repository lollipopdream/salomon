import { describe, expect, it, vi } from 'vitest';

import type { CandidateController } from './candidates/candidateController';
import type { CandidateId } from './labTypes';
import { createForestLabHook, parseLayerVisibilitySpec } from './labHook';

function controller(): CandidateController {
  let candidate: 0 | 1 | 2 | 3 = 0;
  let appearance: 'BASELINE' | 'R1' = 'BASELINE';
  return {
    setCandidate: vi.fn(async (id) => { candidate = id; }),
    setAppearance: vi.fn(async (id) => { appearance = id; }),
    getState: () => ({
      candidate,
      appearance,
      shellVertexCount: candidate === 0 ? 0 : 9,
      shellTriangleCount: candidate === 0 ? 0 : 8,
      detailCount: candidate === 3 ? 2 : 0,
      buildMs: 1,
    }),
    dispose: vi.fn(),
  };
}

function clusterController(): CandidateController {
  let candidate: CandidateId = 0;
  let appearance: 'BASELINE' | 'R1' = 'BASELINE';
  return {
    setCandidate: vi.fn(async (id) => { candidate = id; }),
    setAppearance: vi.fn(async (id) => { appearance = id; }),
    getState: () => ({
      candidate,
      appearance,
      shellVertexCount: 0,
      shellTriangleCount: 0,
      detailCount: 0,
      buildMs: 1,
      cluster: {
        clusterLatticeCols: 1,
        clusterCandidateCount: 1,
        clusterAcceptedCount: 10,
        memberPlacedCount: 195,
        memberRejectedByMaskCount: 0,
        memberRejectedByBboxCount: 0,
        groveInstanceCount: 0,
        treeInstanceCount: 0,
        familyClusterCounts: [0, 10, 0],
        meanSquareScale: 1,
        meanColorLuminanceMultiplier: 1,
        atlasCellMeshCount: 0,
        visibleInstanceCount: 200,
      },
    }),
    dispose: vi.fn(),
  };
}

function baseHookOptions(fakeController: CandidateController): Parameters<typeof createForestLabHook>[0] {
  let requestedFrames = 0;
  return {
    renderer: {
      info: { render: { calls: 1, triangles: 2 }, memory: { geometries: 3, textures: 4 } },
      getContext: () => ({ drawingBufferWidth: 1920, drawingBufferHeight: 1080 }),
    },
    controller: fakeController,
    initialPatch: 'A',
    initialCandidate: 0,
    initialCamera: 'PRIMARY',
    replacePatch: async () => fakeController,
    applyCamera: vi.fn(),
    resetCameraPose: vi.fn(),
    setOrbitEnabledValue: vi.fn(),
    isOrbitApplied: () => false,
    hideUi: vi.fn(),
    showUi: vi.fn(),
    setLayerVisibilityValue: vi.fn(),
    getCameraSnapshot: () => ({
      position: { x: 1, y: 2, z: 3 },
      target: { x: 4, y: 5, z: 6 },
      fov: 45,
    }),
    getConfigDumpValue: () => ({
      schemaVersion: 1,
      phase: 'matsu-h01-takao-forest-visual-lab-architecture-bakeoff',
      patchManifest: {} as never,
      constants: {},
    }),
    renderFrame: vi.fn(),
    requestFrame(callback) {
      requestedFrames += 1;
      callback(requestedFrames);
      return requestedFrames;
    },
    now: () => requestedFrames * 16,
  };
}

describe('Forest Lab hook', () => {
  it('exposes the complete API, resolves ready after build and two rendered frames, and hides by display', async () => {
    const fakeController = controller();
    const overlay = { style: { display: '' } };
    let requestedFrames = 0;
    let renderedFrames = 0;
    const hook = createForestLabHook({
      renderer: {
        info: { render: { calls: 1, triangles: 2 }, memory: { geometries: 3, textures: 4 } },
        getContext: () => ({ drawingBufferWidth: 1920, drawingBufferHeight: 1080 }),
      },
      controller: fakeController,
      initialPatch: 'A',
      initialCandidate: 2,
      initialCamera: 'PRIMARY',
      replacePatch: async () => controller(),
      applyCamera: vi.fn(),
      resetCameraPose: vi.fn(),
      setOrbitEnabledValue: vi.fn(),
      isOrbitApplied: () => false,
      hideUi: () => { overlay.style.display = 'none'; },
      showUi: () => { overlay.style.display = ''; },
      setLayerVisibilityValue: vi.fn(),
      getCameraSnapshot: () => ({
        position: { x: 1, y: 2, z: 3 },
        target: { x: 4, y: 5, z: 6 },
        fov: 45,
      }),
      getConfigDumpValue: () => ({
        schemaVersion: 1,
        phase: 'matsu-h01-takao-forest-visual-lab-architecture-bakeoff',
        patchManifest: {} as never,
        constants: {},
      }),
      renderFrame: () => { renderedFrames += 1; },
      requestFrame(callback) {
        requestedFrames += 1;
        callback(requestedFrames);
        return requestedFrames;
      },
      now: () => requestedFrames * 16,
    });

    expect(hook.isReady()).toBe(false);
    await hook.ready;
    expect(fakeController.setCandidate).toHaveBeenCalledWith(2);
    expect(requestedFrames).toBe(2);
    expect(renderedFrames).toBe(2);
    expect(hook.isReady()).toBe(true);

    for (const method of [
      'isReady', 'setPatch', 'setCandidate', 'setCamera', 'resetCamera',
      'setOrbitEnabled', 'hideOverlay', 'showOverlay', 'setLayerVisibility', 'getState',
      'getTelemetry', 'getConfigDump', 'dispose',
    ]) {
      expect(typeof hook[method as keyof typeof hook]).toBe('function');
    }
    hook.hideOverlay();
    expect(overlay.style.display).toBe('none');
    hook.showOverlay();
    expect(overlay.style.display).toBe('');
    expect(hook.getState()).toMatchObject({
      drawingBufferWidth: 1920,
      drawingBufferHeight: 1080,
      cameraPosition: [1, 2, 3],
      cameraTarget: [4, 5, 6],
    });
    await hook.setCandidate(3);
    expect(requestedFrames).toBe(4);
    expect(renderedFrames).toBe(4);
    await hook.setPatch('B');
    expect(requestedFrames).toBe(6);
    expect(renderedFrames).toBe(6);
    expect(hook.getState()).toMatchObject({ patch: 'B', candidate: 3 });
  });

  it('parses layer visibility specs case-insensitively, trims, and deduplicates tokens', () => {
    expect(parseLayerVisibilitySpec(' farcanopy, CLUSTERS,detail,clusters ')).toEqual([
      'FARCANOPY', 'CLUSTERS', 'DETAIL',
    ]);
    expect(parseLayerVisibilitySpec('allforest')).toEqual(['ALLFOREST']);
  });

  it('passes NONE through so the scene callback can restore its exact saved visibility state', async () => {
    const options = baseHookOptions(controller());
    const setLayerVisibilityValue = vi.fn();
    const hook = createForestLabHook({ ...options, setLayerVisibilityValue });
    await hook.ready;
    hook.setLayerVisibility('clusters, shell');
    hook.setLayerVisibility('none');
    expect(setLayerVisibilityValue).toHaveBeenNthCalledWith(1, ['CLUSTERS', 'SHELL']);
    expect(setLayerVisibilityValue).toHaveBeenNthCalledWith(2, ['NONE']);
  });

  it('throws on an unknown layer token without invoking the scene callback', async () => {
    const options = baseHookOptions(controller());
    const setLayerVisibilityValue = vi.fn();
    const hook = createForestLabHook({ ...options, setLayerVisibilityValue });
    await hook.ready;
    expect(() => hook.setLayerVisibility('clusters, mystery')).toThrow(
      'Unknown forest layer visibility token: MYSTERY.',
    );
    expect(setLayerVisibilityValue).not.toHaveBeenCalled();
  });

  it('accepts candidate ids 4 and 5', async () => {
    const fakeController = controller();
    const hook = createForestLabHook(baseHookOptions(fakeController));
    await hook.ready;
    await hook.setCandidate(4);
    expect(fakeController.setCandidate).toHaveBeenCalledWith(4);
    await hook.setCandidate(5);
    expect(fakeController.setCandidate).toHaveBeenCalledWith(5);
    expect(hook.getState().candidate).toBe(5);
  });

  it('surfaces cluster instance/cluster/member counts from a controller stub with cluster stats', async () => {
    const fakeController = clusterController();
    const hook = createForestLabHook(baseHookOptions(fakeController));
    await hook.ready;
    const telemetry = await hook.getTelemetry();
    expect(telemetry.instanceCount).toBe(200);
    expect(telemetry.clusterCount).toBe(10);
    expect(telemetry.memberCount).toBe(195);
  });

  it('still works with an existing mock controller that has no onCameraChanged and no cluster stats', async () => {
    const fakeController = controller();
    const hook = createForestLabHook(baseHookOptions(fakeController));
    await hook.ready;
    const telemetry = await hook.getTelemetry();
    expect(telemetry.instanceCount).toBe(0);
    expect(telemetry.clusterCount).toBe(0);
    expect(telemetry.memberCount).toBe(0);
  });
});
