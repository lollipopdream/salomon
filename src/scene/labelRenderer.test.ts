import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultSettings } from '../config/settings';
import type { SpotArrivalState } from '../route/spotArrival';
import type { AppSettings } from '../types';
import {
  createLabelRenderer,
  getLabelElementAppearance,
  reduceLabelDistanceDisplayState,
  reduceLabelDisplayState,
  type LabelDisplayState,
} from './labelRenderer';

const waypointMarkerMocks = vi.hoisted(() => ({
  create: vi.fn(),
  dispose: vi.fn(),
  updateArrivalStates: vi.fn(),
}));

vi.mock('./waypointMarkers', () => ({
  createWaypointMarkers: waypointMarkerMocks.create,
}));

const initialState: LabelDisplayState = {
  occluded: false,
  distanceHidden: false,
  offScreen: false,
  scale: 1,
  visible: true,
};

const distanceScaling = {
  nearDistanceMeters: 1_500,
  farDistanceMeters: 6_000,
  minScale: 0.5,
  hideBeyondMeters: 9_000,
};

function createArrivalStates(): SpotArrivalState[] {
  return [
    {
      poiId: 'kiyotaki',
      tier: 'primary',
      phase: 'arrive',
      intensity: 1,
      isActive: true,
      isPrimaryActive: true,
    },
    {
      poiId: 'summit',
      tier: 'primary',
      phase: 'idle',
      intensity: 0,
      isActive: false,
      isPrimaryActive: false,
    },
  ];
}

describe('reduceLabelDisplayState', () => {
  it('hides a label when a recomputed anchor is occluded', () => {
    expect(reduceLabelDisplayState(initialState, true, false, true)).toEqual({
      occluded: true,
      distanceHidden: false,
      offScreen: false,
      scale: 1,
      visible: false,
    });
  });

  it('shows a label when a recomputed anchor is not occluded', () => {
    const previous: LabelDisplayState = {
      ...initialState,
      occluded: true,
      visible: false,
    };

    expect(reduceLabelDisplayState(previous, false, false, true)).toEqual({
      occluded: false,
      distanceHidden: false,
      offScreen: false,
      scale: 1,
      visible: true,
    });
  });

  it('keeps the previous decision on a throttled frame', () => {
    const previous: LabelDisplayState = {
      ...initialState,
      occluded: true,
      visible: false,
    };

    expect(
      reduceLabelDisplayState(previous, false, false, false),
    ).toEqual(previous);
  });

  it('hides an off-screen label even on a throttled raycast frame', () => {
    expect(
      reduceLabelDisplayState(initialState, false, true, false),
    ).toEqual({
      occluded: false,
      distanceHidden: false,
      offScreen: true,
      scale: 1,
      visible: false,
    });
  });
});

describe('reduceLabelDistanceDisplayState', () => {
  it('keeps scale fixed at 1 while the label is within the visible distance', () => {
    expect(
      reduceLabelDistanceDisplayState(
        initialState,
        3_750,
        distanceScaling,
      ),
    ).toEqual({
      occluded: false,
      distanceHidden: false,
      offScreen: false,
      scale: 1,
      visible: true,
    });
  });

  it('hides a label beyond the configured distance', () => {
    expect(
      reduceLabelDistanceDisplayState(
        initialState,
        9_001,
        distanceScaling,
      ),
    ).toEqual({
      occluded: false,
      distanceHidden: true,
      offScreen: false,
      scale: 1,
      visible: false,
    });
  });

  it('does not reveal a terrain-occluded label at a near distance', () => {
    expect(
      reduceLabelDistanceDisplayState(
        { ...initialState, occluded: true, visible: false },
        1_000,
        distanceScaling,
      ).visible,
    ).toBe(false);
  });

  it('does not reveal an off-screen label at a near distance', () => {
    expect(
      reduceLabelDistanceDisplayState(
        { ...initialState, offScreen: true, visible: false },
        1_000,
        distanceScaling,
      ).visible,
    ).toBe(false);
  });
});

describe('getLabelElementAppearance', () => {
  it('maps a visible state to the base class and visible styles', () => {
    expect(getLabelElementAppearance(initialState)).toEqual({
      className: 'route-label',
      style: {
        visibility: 'visible',
        scale: '1',
        transformOrigin: 'center center',
        pointerEvents: 'none',
        backgroundColor: 'rgba(8, 10, 8, 0.62)',
        border: '2px solid rgba(255, 184, 77, 0.5)',
        color: '#ffffff',
        padding: '3px 10px',
        borderRadius: '4px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
        fontSize: '13px',
      },
    });
  });

  it('maps an occluded state to the hidden modifier and hidden styles', () => {
    expect(
      getLabelElementAppearance({
        ...initialState,
        occluded: true,
        visible: false,
      }),
    ).toEqual({
      className: 'route-label route-label--hidden',
      style: {
        visibility: 'hidden',
        scale: '1',
        transformOrigin: 'center center',
        pointerEvents: 'none',
        backgroundColor: 'rgba(8, 10, 8, 0.62)',
        border: '2px solid rgba(255, 184, 77, 0.5)',
        color: '#ffffff',
        padding: '3px 10px',
        borderRadius: '4px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
        fontSize: '13px',
      },
    });
  });

  it('maps distance hiding to DOM-compatible styles without scaling', () => {
    const state = reduceLabelDistanceDisplayState(
      initialState,
      9_001,
      distanceScaling,
    );

    expect(getLabelElementAppearance(state)).toMatchObject({
      className: 'route-label route-label--hidden',
      style: {
        visibility: 'hidden',
        scale: '1',
      },
    });
  });
});

class TestElement {
  readonly children: TestElement[] = [];
  readonly style: Record<string, string> = {};
  className = '';
  private ownTextContent: string | null = null;
  parentNode: TestElement | null = null;
  ownerDocument!: { defaultView: { Element: typeof TestElement } };

  get firstElementChild(): TestElement | null {
    return this.children[0] ?? null;
  }

  get textContent(): string | null {
    if (this.ownTextContent !== null) return this.ownTextContent;
    return this.children.map((child) => child.textContent ?? '').join('');
  }

  set textContent(value: string | null) {
    this.ownTextContent = value;
  }

  appendChild(child: TestElement): TestElement {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  remove(): void {
    if (this.parentNode !== null) {
      const index = this.parentNode.children.indexOf(this);
      if (index !== -1) this.parentNode.children.splice(index, 1);
      this.parentNode = null;
    }
  }

  setAttribute(): void {}
}

function createTestDocument(): { createElement(): TestElement } {
  const document = {
    createElement(): TestElement {
      const element = new TestElement();
      element.ownerDocument = { defaultView: { Element: TestElement } };
      return element;
    },
  };

  return document;
}

function getLabelElement(object: THREE.Object3D & { element: HTMLElement }): HTMLElement {
  const labelElement = object.element.firstElementChild as HTMLElement | null;
  expect(labelElement).not.toBeNull();
  return labelElement!;
}

describe('createLabelRenderer arrival choreography integration', () => {
  const originalDocument = globalThis.document;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: createTestDocument(),
    });
    waypointMarkerMocks.create.mockReturnValue({
      object3D: new THREE.Group(),
      dispose: waypointMarkerMocks.dispose,
      updateArrivalStates: waypointMarkerMocks.updateArrivalStates,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: originalDocument,
    });
    vi.clearAllMocks();
  });

  function createController() {
    const container = new TestElement();
    container.ownerDocument = { defaultView: { Element: TestElement } };
    const route = {
      isOfficial: false as const,
      points: [
        { lat: 1, lng: 0, poiId: 'kiyotaki' },
        { lat: 0, lng: 1, poiId: 'summit' },
      ],
    };
    const grid = {
      cols: 2,
      rows: 2,
      values: Float32Array.from([0, 0, 0, 0]),
      cellSizeMeters: 10,
      bounds: { north: 1, south: 0, east: 1, west: 0 },
    };

    const controller = createLabelRenderer({
      container: container as unknown as HTMLElement,
      scene: new THREE.Scene(),
      camera: new THREE.PerspectiveCamera(),
      terrainMesh: new THREE.Mesh(),
      route,
      grid,
      settings: {
        ...defaultSettings,
        labels: {
          ...defaultSettings.labels,
          points: [
            { poiId: 'kiyotaki', displayText: '清滝駅' },
            { poiId: 'summit', displayText: '高尾山頂' },
          ],
        },
      },
    });

    return controller;
  }

  function createSixLabelController() {
    const container = new TestElement();
    container.ownerDocument = { defaultView: { Element: TestElement } };
    const points = Array.from({ length: 6 }, (_, index) => ({
      lat: index / 5,
      lng: 1 - index / 5,
      poiId: `poi-${index}`,
    }));

    return createLabelRenderer({
      container: container as unknown as HTMLElement,
      scene: new THREE.Scene(),
      camera: new THREE.PerspectiveCamera(),
      terrainMesh: new THREE.Mesh(),
      route: { isOfficial: false, points },
      grid: {
        cols: 2,
        rows: 2,
        values: Float32Array.from([0, 0, 0, 0]),
        cellSizeMeters: 10,
        bounds: { north: 1, south: 0, east: 1, west: 0 },
      },
      settings: {
        ...defaultSettings,
        labels: {
          ...defaultSettings.labels,
          points: points.map(({ poiId }, index) => ({
            poiId,
            displayText: `Label ${index}`,
          })),
          occlusion: {
            ...defaultSettings.labels.occlusion,
            throttleFrames: 6,
          },
        },
      },
    });
  }

  it('keeps scale fixed while applying arrival opacity to matching label DOM elements', () => {
    const controller = createController();

    controller.updateArrivalStates(createArrivalStates(), 1_234);

    const kiyotaki = controller.objects.find(
      (object) => object.element.textContent === '清滝駅',
    )!;
    const summit = controller.objects.find(
      (object) => object.element.textContent === '高尾山頂',
    )!;
    expect(getLabelElement(kiyotaki).style.scale).toBe('1');
    expect(getLabelElement(kiyotaki).style.opacity).toBe('1');
    expect(getLabelElement(summit).style.scale).toBe('1');
    expect(getLabelElement(summit).style.opacity).toBe('0.65');

    controller.dispose();
  });

  it('restores all labels and forwards the exact states and elapsed time to markers', () => {
    const controller = createController();
    const activeStates = createArrivalStates();

    controller.updateArrivalStates(activeStates, 1_234);
    const idleStates = activeStates.map((state) => ({
      ...state,
      phase: 'idle' as const,
      intensity: 0,
      isActive: false,
      isPrimaryActive: false,
    }));
    controller.updateArrivalStates(idleStates, 2_000);

    for (const object of controller.objects) {
      expect(getLabelElement(object).style.scale).toBe('1');
      expect(getLabelElement(object).style.opacity).toBe('1');
    }
    expect(waypointMarkerMocks.updateArrivalStates).toHaveBeenLastCalledWith(
      idleStates,
      2_000,
    );
    expect(waypointMarkerMocks.updateArrivalStates).toHaveBeenCalledWith(
      activeStates,
      1_234,
    );

    controller.dispose();
  });

  it('raycasts each of six labels exactly once across a six-frame stagger cycle', () => {
    const rayDirections: THREE.Vector3[] = [];
    const intersectObject = vi
      .spyOn(THREE.Raycaster.prototype, 'intersectObject')
      .mockImplementation(function (this: THREE.Raycaster) {
        rayDirections.push(this.ray.direction.clone());
        return [];
      });
    const controller = createSixLabelController();
    const expectedEntryOrder = [0, 5, 4, 3, 2, 1];

    for (let frameIndex = 0; frameIndex < 6; frameIndex += 1) {
      controller.updateOcclusion(frameIndex, 16);
      expect(intersectObject).toHaveBeenCalledTimes(frameIndex + 1);
    }

    expect(rayDirections).toHaveLength(6);
    expectedEntryOrder.forEach((entryIndex, callIndex) => {
      expect(rayDirections[callIndex]).toEqual(
        controller.objects[entryIndex].position.clone().normalize(),
      );
    });

    controller.dispose();
  });
});

describe('createLabelRenderer POI anchor / fixed placement / hysteresis / overlap wiring', () => {
  const originalDocument = globalThis.document;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: createTestDocument(),
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: originalDocument,
    });
    vi.clearAllMocks();
  });

  const twoPointRoute = {
    isOfficial: false as const,
    points: [
      { lat: 1, lng: 0, poiId: 'kiyotaki' },
      { lat: 0, lng: 1, poiId: 'summit' },
    ],
  };
  const twoByTwoGrid = {
    cols: 2,
    rows: 2,
    values: Float32Array.from([0, 0, 0, 0]),
    cellSizeMeters: 10,
    bounds: { north: 1, south: 0, east: 1, west: 0 },
  };

  function createControllerWithCamera(
    overrides: {
      route?: typeof twoPointRoute;
      points?: Array<{ poiId: string; displayText: string }>;
      occlusion?: Partial<AppSettings['labels']['occlusion']>;
    } = {},
  ) {
    const container = new TestElement();
    container.ownerDocument = { defaultView: { Element: TestElement } };
    const camera = new THREE.PerspectiveCamera();
    const markerCreate = vi.fn().mockReturnValue({
      object3D: new THREE.Group(),
      dispose: vi.fn(),
      updateArrivalStates: vi.fn(),
    });
    waypointMarkerMocks.create.mockImplementation(markerCreate);
    const controller = createLabelRenderer({
      container: container as unknown as HTMLElement,
      scene: new THREE.Scene(),
      camera,
      terrainMesh: new THREE.Mesh(),
      route: overrides.route ?? twoPointRoute,
      grid: twoByTwoGrid,
      settings: {
        ...defaultSettings,
        labels: {
          ...defaultSettings.labels,
          points: overrides.points ?? [
            { poiId: 'kiyotaki', displayText: '清滝駅' },
            { poiId: 'summit', displayText: '高尾山頂' },
          ],
          occlusion: {
            ...defaultSettings.labels.occlusion,
            ...overrides.occlusion,
          },
        },
      },
    });

    return { controller, camera, markerCreate };
  }

  it('uses the exact same x/y/z world anchor for each marker and label', () => {
    const { controller, markerCreate } = createControllerWithCamera();

    const markerAnchors = markerCreate.mock.calls[0][0].anchors as Array<{
      anchor: { x: number; y: number; z: number };
      poiId: string;
    }>;

    expect(markerAnchors).toHaveLength(controller.objects.length);

    // Labels and markers are built from the same selected POI list in the
    // same order, so pairing by index is exact.
    controller.objects.forEach((object, index) => {
      const markerAnchor = markerAnchors[index];
      expect(object.position.toArray()).toEqual([
        markerAnchor.anchor.x,
        markerAnchor.anchor.y,
        markerAnchor.anchor.z,
      ]);
    });

    controller.dispose();
  });

  it('keeps label scale fixed at 1 across repeated distance changes', () => {
    const { controller, camera } = createControllerWithCamera();

    const kiyotakiEntry = controller.objects.find(
      (object) => object.element.textContent === '清滝駅',
    )!;
    const anchor = kiyotakiEntry.position;

    camera.position.set(anchor.x, anchor.y, anchor.z + 1_000);
    camera.lookAt(anchor.x, anchor.y, anchor.z);
    camera.updateMatrixWorld(true);
    controller.updateOcclusion(0, 1_000);
    expect(getLabelElement(kiyotakiEntry).style.scale).toBe('1');

    camera.position.set(anchor.x, anchor.y, anchor.z + 7_000);
    camera.lookAt(anchor.x, anchor.y, anchor.z);
    camera.updateMatrixWorld(true);
    controller.updateOcclusion(1, 16);
    expect(getLabelElement(kiyotakiEntry).style.scale).toBe('1');

    camera.position.set(anchor.x, anchor.y + 4_000, anchor.z + 2_000);
    camera.lookAt(anchor.x, anchor.y, anchor.z);
    camera.updateMatrixWorld(true);
    controller.updateOcclusion(2, 250);
    expect(getLabelElement(kiyotakiEntry).style.scale).toBe('1');

    controller.dispose();
  });

  it('keeps the fixed screen-space offset across camera, occlusion, and arrival updates', () => {
    const { controller, camera } = createControllerWithCamera();
    const object = controller.objects[0];
    const anchor = object.position;
    const labelElement = getLabelElement(object);
    const fixedTransform = 'translate(-50%, calc(-100% - 12px))';

    expect(labelElement.style.position).toBe('absolute');
    expect(labelElement.style.left).toBe('0');
    expect(labelElement.style.top).toBe('0');
    expect(labelElement.style.transform).toBe(fixedTransform);

    camera.position.set(anchor.x, anchor.y, anchor.z + 1_000);
    camera.lookAt(anchor);
    camera.updateMatrixWorld(true);
    controller.updateOcclusion(0, 16);

    camera.position.set(anchor.x + 5_000, anchor.y + 2_000, anchor.z + 7_000);
    camera.lookAt(anchor);
    camera.updateMatrixWorld(true);
    controller.updateOcclusion(1, 500);
    controller.updateArrivalStates(createArrivalStates(), 1_234);
    controller.updateArrivalStates([], 2_000);

    expect(labelElement.style.transform).toBe(fixedTransform);

    controller.dispose();
  });

  it('keeps scale fixed at 1 for an active label', () => {
    const { controller } = createControllerWithCamera();
    const object = controller.objects.find(
      (candidate) => candidate.element.textContent === '清滝駅',
    )!;

    controller.updateArrivalStates(createArrivalStates(), 800);

    expect(getLabelElement(object).style.scale).toBe('1');
    controller.dispose();
  });

  it('keeps scale fixed at 1 during a high-intensity dwell phase', () => {
    const { controller } = createControllerWithCamera();
    const object = controller.objects.find(
      (candidate) => candidate.element.textContent === '清滝駅',
    )!;
    const dwellState: SpotArrivalState = {
      poiId: 'kiyotaki',
      tier: 'primary',
      phase: 'dwell',
      intensity: 0.99,
      isActive: true,
      isPrimaryActive: true,
    };

    controller.updateArrivalStates([dwellState], 1_500);

    expect(getLabelElement(object).style.scale).toBe('1');
    controller.dispose();
  });

  it('keeps the confirmed occlusion display state stable while the raw raycast toggles every frame', () => {
    let callCount = 0;
    const intersectObject = vi
      .spyOn(THREE.Raycaster.prototype, 'intersectObject')
      .mockImplementation(() => {
        callCount += 1;
        return callCount % 2 === 1
          ? [{ distance: 1 } as THREE.Intersection]
          : [];
      });

    const { controller, camera } = createControllerWithCamera({
      route: { isOfficial: false, points: [{ lat: 1, lng: 0, poiId: 'kiyotaki' }] },
      points: [{ poiId: 'kiyotaki', displayText: '清滝駅' }],
      occlusion: { throttleFrames: 1 },
    });

    camera.position.set(0, 500, 800);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);

    const element = getLabelElement(controller.objects[0]);
    const initialTransform = element.style.transform;
    const visibilityStates: string[] = [];
    for (let frame = 0; frame < 6; frame += 1) {
      controller.updateOcclusion(frame, 16);
      visibilityStates.push(element.style.visibility);
    }

    expect(new Set(visibilityStates).size).toBe(1);
    expect(element.style.transform).toBe(initialTransform);

    controller.dispose();
    intersectObject.mockRestore();
  });

  it('does not change the fixed offset when the label becomes occluded', () => {
    const intersectObject = vi
      .spyOn(THREE.Raycaster.prototype, 'intersectObject')
      .mockReturnValue([{ distance: 1 } as THREE.Intersection]);
    const { controller, camera } = createControllerWithCamera({
      route: { isOfficial: false, points: [{ lat: 1, lng: 0, poiId: 'kiyotaki' }] },
      points: [{ poiId: 'kiyotaki', displayText: '清滝駅' }],
      occlusion: { throttleFrames: 1 },
    });
    const labelElement = getLabelElement(controller.objects[0]);
    const initialTransform = labelElement.style.transform;

    camera.position.set(0, 500, 800);
    camera.lookAt(controller.objects[0].position);
    camera.updateMatrixWorld(true);
    controller.updateOcclusion(0, 16);
    controller.updateOcclusion(1, 16);

    expect(labelElement.style.visibility).toBe('hidden');
    expect(labelElement.style.transform).toBe(initialTransform);

    controller.dispose();
    intersectObject.mockRestore();
  });

  it('reduces opacity for the lower-priority label when two POIs overlap on screen', () => {
    const { controller, camera } = createControllerWithCamera();

    camera.far = 1_000_000;
    camera.position.set(5, 5, 200_000);
    camera.lookAt(5, 0, 5);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);

    controller.updateOcclusion(0, 16);

    const initialTransforms = controller.objects.map(
      (object) => getLabelElement(object).style.transform,
    );

    const states: SpotArrivalState[] = [
      {
        poiId: 'kiyotaki',
        tier: 'primary',
        phase: 'idle',
        intensity: 0,
        isActive: false,
        isPrimaryActive: false,
      },
      {
        poiId: 'summit',
        tier: 'primary',
        phase: 'idle',
        intensity: 0,
        isActive: false,
        isPrimaryActive: false,
      },
    ];
    controller.updateArrivalStates(states, 0);

    const kiyotaki = controller.objects.find(
      (object) => object.element.textContent === '清滝駅',
    )!;
    const summit = controller.objects.find(
      (object) => object.element.textContent === '高尾山頂',
    )!;

    const kiyotakiLabel = getLabelElement(kiyotaki);
    const summitLabel = getLabelElement(summit);
    expect(Number(kiyotakiLabel.style.opacity)).toBe(1);
    expect(Number(summitLabel.style.opacity)).toBeLessThan(1);
    expect(kiyotakiLabel.style.transform).toBe(initialTransforms[0]);
    expect(summitLabel.style.transform).toBe(initialTransforms[1]);

    controller.dispose();
  });

  it('keeps scale fixed while applying arrival opacity after hysteresis/overlap wiring', () => {
    const { controller, camera } = createControllerWithCamera();

    camera.position.set(0, 500, 800);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    controller.updateOcclusion(0, 16);

    const states: SpotArrivalState[] = [
      {
        poiId: 'kiyotaki',
        tier: 'primary',
        phase: 'arrive',
        intensity: 1,
        isActive: true,
        isPrimaryActive: true,
      },
      {
        poiId: 'summit',
        tier: 'primary',
        phase: 'idle',
        intensity: 0,
        isActive: false,
        isPrimaryActive: false,
      },
    ];
    controller.updateArrivalStates(states, 1_234);

    const kiyotaki = controller.objects.find(
      (object) => object.element.textContent === '清滝駅',
    )!;
    const summit = controller.objects.find(
      (object) => object.element.textContent === '高尾山頂',
    )!;

    expect(getLabelElement(kiyotaki).style.scale).toBe('1');
    expect(getLabelElement(kiyotaki).style.opacity).toBe('1');
    expect(getLabelElement(summit).style.scale).toBe('1');
    expect(getLabelElement(summit).style.opacity).toBe('0.65');

    controller.dispose();
  });
});

describe('createLabelRenderer label layer promotion (既定 OFF の回帰防止)', () => {
  const originalDocument = globalThis.document;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: createTestDocument(),
    });
    waypointMarkerMocks.create.mockReturnValue({
      object3D: new THREE.Group(),
      dispose: waypointMarkerMocks.dispose,
      updateArrivalStates: waypointMarkerMocks.updateArrivalStates,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: originalDocument,
    });
    vi.clearAllMocks();
  });

  function createPromotionController(
    labelLayerPromotion?: { promoteLabelLayers: boolean },
  ) {
    const container = new TestElement();
    container.ownerDocument = { defaultView: { Element: TestElement } };

    return createLabelRenderer({
      container: container as unknown as HTMLElement,
      scene: new THREE.Scene(),
      camera: new THREE.PerspectiveCamera(),
      terrainMesh: new THREE.Mesh(),
      route: {
        isOfficial: false as const,
        points: [
          { lat: 1, lng: 0, poiId: 'kiyotaki' },
          { lat: 0, lng: 1, poiId: 'summit' },
        ],
      },
      grid: {
        cols: 2,
        rows: 2,
        values: Float32Array.from([0, 0, 0, 0]),
        cellSizeMeters: 10,
        bounds: { north: 1, south: 0, east: 1, west: 0 },
      },
      settings: {
        ...defaultSettings,
        labels: {
          ...defaultSettings.labels,
          points: [
            { poiId: 'kiyotaki', displayText: '清滝駅' },
            { poiId: 'summit', displayText: '高尾山頂' },
          ],
        },
      },
      ...(labelLayerPromotion === undefined ? {} : { labelLayerPromotion }),
    });
  }

  it('option 省略時は willChange を設定しない', () => {
    const controller = createPromotionController();

    expect(controller.objects.length).toBeGreaterThan(0);
    for (const object of controller.objects) {
      expect(getLabelElement(object).style.willChange).toBeUndefined();
    }

    controller.dispose();
  });

  it('promoteLabelLayers=false では willChange を設定しない', () => {
    const controller = createPromotionController({ promoteLabelLayers: false });

    for (const object of controller.objects) {
      expect(getLabelElement(object).style.willChange).toBeUndefined();
    }

    controller.dispose();
  });

  it('promoteLabelLayers=true のときだけ willChange=transform を設定する', () => {
    const controller = createPromotionController({ promoteLabelLayers: true });

    for (const object of controller.objects) {
      expect(getLabelElement(object).style.willChange).toBe('transform');
    }

    controller.dispose();
  });
});
