import {
  BufferGeometry,
  Camera,
  Mesh,
  Object3D,
  Raycaster,
  Scene,
  Vector3,
  Vector4,
} from 'three';
import {
  CSS2DObject,
  CSS2DRenderer,
} from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import {
  computeHysteresisOcclusion,
  createInitialOcclusionHysteresisState,
  isAnchorOccluded,
  shouldRecomputeOcclusion,
  type OcclusionHysteresisState,
} from '../camera/labelOcclusion';
import { computeLabelHidden } from '../camera/labelDistanceScaling';
import {
  computeLabelOverlapFade,
  type LabelOverlapCandidate,
} from '../camera/labelOverlap';
import { computeLabelProjectionVisibility } from '../camera/labelProjection';
import {
  computeLabelEmphasisAppearance,
  computePoiAnchors,
  deriveMarkerAnchor,
  selectLabeledRoutePoints,
} from '../route/routeLabels';
import type { SpotArrivalState } from '../route/spotArrival';
import type {
  AppSettings,
  ElevationGrid,
  LabelDistanceScalingConfig,
  RoutePath,
} from '../types';
import { computeTerrainRaycastDrawRange } from '../terrain/terrainRaycastRange';
import {
  LABEL_LAYER_PROMOTION_STYLE,
  type LabelLayerPromotionFlags,
} from './labelLayerPromotion';
import type { LabelPerfBypassFlags } from './labelPerfBypass';
import { createWaypointMarkers } from './waypointMarkers';

const LABEL_ANCHOR_GAP_PX = 12;

// Pure display-state logic. These functions deliberately have no Three.js or DOM
// inputs so the throttling/state transition contract can be unit-tested directly.
export interface LabelDisplayState {
  occluded: boolean;
  distanceHidden: boolean;
  offScreen: boolean;
  scale: number;
  visible: boolean;
}

export interface LabelElementAppearance {
  className: string;
  style: {
    visibility: 'visible' | 'hidden';
    scale: string;
    transformOrigin: 'center center';
    pointerEvents: 'none';
    backgroundColor: 'rgba(8, 10, 8, 0.62)';
    border: '2px solid rgba(255, 184, 77, 0.5)';
    color: '#ffffff';
    padding: '3px 10px';
    borderRadius: '4px';
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.4)';
    fontSize: '13px';
  };
}

export function reduceLabelDisplayState(
  previous: LabelDisplayState,
  nextOccluded: boolean,
  nextOffScreen: boolean,
  recomputeOcclusion: boolean,
): LabelDisplayState {
  const occluded = recomputeOcclusion ? nextOccluded : previous.occluded;

  return {
    occluded,
    distanceHidden: previous.distanceHidden,
    offScreen: nextOffScreen,
    scale: previous.scale,
    visible: !occluded && !previous.distanceHidden && !nextOffScreen,
  };
}

export function reduceLabelDistanceDisplayState(
  previous: LabelDisplayState,
  distanceMeters: number,
  config: LabelDistanceScalingConfig,
): LabelDisplayState {
  const distanceHidden = computeLabelHidden(distanceMeters, config);

  return {
    occluded: previous.occluded,
    distanceHidden,
    offScreen: previous.offScreen,
    scale: 1,
    visible: !previous.occluded && !distanceHidden && !previous.offScreen,
  };
}

export function getLabelElementAppearance(
  state: LabelDisplayState,
): LabelElementAppearance {
  return state.visible
    ? {
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
      }
    : {
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
      };
}

// Three.js/DOM integration. P4T9 can create this controller, call setSize from
// its resize handler, then call updateOcclusion and render from the rAF loop.
export interface LabelRendererOptions {
  container: HTMLElement;
  scene: Scene;
  camera: Camera;
  terrainMesh: Object3D;
  route: RoutePath;
  grid: ElevationGrid;
  settings: AppSettings;
  labelLayerPromotion?: LabelLayerPromotionFlags;
  labelPerfBypass?: LabelPerfBypassFlags;
  labelPerfCountersEnabled?: boolean;
  labelRaycastFull?: boolean;
  labelRaycastVerify?: boolean;
}

export interface LabelPerfCounters {
  frames: number;
  raycasts: number;
  projections: number;
  appearanceCalls: number;
  styleWrites: number;
}

export interface LabelRaycastVerification {
  enabled: boolean;
  comparisons: number;
  mismatches: number;
  maxAbsDistanceDeltaM: number;
}

export interface LabelRendererController {
  renderer: CSS2DRenderer;
  objects: readonly CSS2DObject[];
  setSize(width: number, height: number): void;
  updateOcclusion(frameIndex: number, deltaMs: number): void;
  updateArrivalStates(states: SpotArrivalState[], elapsedMs: number): void;
  render(): void;
  dispose(): void;
  getPerfCounters?(): LabelPerfCounters | null;
  getRaycastVerification?(): LabelRaycastVerification | null;
}

interface LabelEntry {
  object: CSS2DObject;
  labelElement: HTMLElement;
  anchor: Vector3;
  poiId: string;
  state: LabelDisplayState;
  arrivalOpacityMultiplier: number;
  occlusionHysteresis: OcclusionHysteresisState;
  lastNdc: { x: number; y: number };
  overlapOpacityMultiplier: number;
  /**
   * Whether `lastNdc` has ever been populated from a real screen-space
   * projection (i.e. `updateOcclusion` has run at least once for this
   * entry). Overlap fade is skipped for entries that haven't projected yet
   * so multiple labels sharing the `{ x: 0, y: 0 }` initial NDC value are
   * not mistaken for a real on-screen collision.
   */
  hasProjected: boolean;
}

function applyLabelElementAppearance(
  element: HTMLElement,
  appearance: LabelElementAppearance,
): void {
  element.className = appearance.className;
  element.style.visibility = appearance.style.visibility;
  element.style.scale = appearance.style.scale;
  element.style.transformOrigin = appearance.style.transformOrigin;
  element.style.pointerEvents = appearance.style.pointerEvents;
  element.style.backgroundColor = appearance.style.backgroundColor;
  element.style.border = appearance.style.border;
  element.style.color = appearance.style.color;
  element.style.padding = appearance.style.padding;
  element.style.borderRadius = appearance.style.borderRadius;
  element.style.boxShadow = appearance.style.boxShadow;
  element.style.fontSize = appearance.style.fontSize;
}

function applyLabelEntryAppearance(entry: LabelEntry): void {
  const appearance = getLabelElementAppearance(entry.state);
  applyLabelElementAppearance(entry.labelElement, appearance);
  entry.labelElement.style.scale = '1';
  entry.labelElement.style.opacity = String(
    entry.arrivalOpacityMultiplier * entry.overlapOpacityMultiplier,
  );
}

function applyLabelEntryAppearanceWithCounters(
  entry: LabelEntry,
  counters: LabelPerfCounters,
): void {
  applyLabelEntryAppearance(entry);
  counters.appearanceCalls += 1;
  // className + 11 applyLabelElementAppearance style assignments + the
  // entry-level scale and opacity assignments.
  counters.styleWrites += 14;
}

export function createLabelRenderer(
  options: LabelRendererOptions,
): LabelRendererController {
  const {
    container,
    scene,
    camera,
    terrainMesh,
    route,
    grid,
    settings,
  } = options;
  const renderer = new CSS2DRenderer();
  renderer.domElement.className = 'route-label-renderer';
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.top = '0';
  renderer.domElement.style.left = '0';
  renderer.domElement.style.pointerEvents = 'none';
  renderer.setSize(
    container.clientWidth || settings.resolutionWidth,
    container.clientHeight || settings.resolutionHeight,
  );
  container.appendChild(renderer.domElement);

  const selected = selectLabeledRoutePoints(route, settings.labels.points);
  const poiAnchors = computePoiAnchors(selected, grid, settings);
  const labelAnchors = poiAnchors.map((poi) => ({
    anchor: deriveMarkerAnchor(poi),
    displayText: poi.displayText,
    poiId: poi.poiId,
  }));
  const waypointAnchors = poiAnchors.map((poi) => ({
    anchor: deriveMarkerAnchor(poi),
    displayText: poi.displayText,
    poiId: poi.poiId,
  }));
  const waypointMarkers = createWaypointMarkers({
    scene,
    anchors: waypointAnchors,
    config: settings.visual.waypoints,
  });
  const initialState: LabelDisplayState = {
    occluded: false,
    distanceHidden: false,
    offScreen: false,
    scale: 1,
    visible: true,
  };
  // 既定は OFF。2026-09-12 の計測で昇格は非改善かつ text antialiasing を変えたため
  // 不採用とし、production では有効化できない (labelLayerPromotion.ts 参照)。
  // 呼び出し側が flag を渡し忘れても昇格しないよう、fallback も false にする。
  const labelLayerPromotion = options.labelLayerPromotion ?? {
    promoteLabelLayers: false,
  };
  const entries: LabelEntry[] = labelAnchors.map(
    ({ anchor, displayText, poiId }) => {
      const wrapper = document.createElement('div');
      wrapper.style.pointerEvents = 'none';

      const labelElement = document.createElement('div');
      labelElement.textContent = displayText;
      labelElement.style.position = 'absolute';
      labelElement.style.left = '0';
      labelElement.style.top = '0';
      // `wrapper` has no in-flow content of its own (its only child is this
      // absolutely-positioned element), so it resolves to a 0-width
      // containing block. Without `white-space: nowrap`, that collapses this
      // element's shrink-to-fit width down to its min-content width, and for
      // CJK text (which allows a line-break opportunity between any two
      // characters) that min-content width is a single character — wrapping
      // the whole label into a vertical stack of one-character lines.
      // `nowrap` forces min-content to equal the full text width instead.
      labelElement.style.whiteSpace = 'nowrap';
      labelElement.style.transform =
        `translate(-50%, calc(-100% - ${LABEL_ANCHOR_GAP_PX}px))`;
      if (labelLayerPromotion.promoteLabelLayers) {
        labelElement.style.willChange = LABEL_LAYER_PROMOTION_STYLE.willChange;
      }
      wrapper.appendChild(labelElement);

      const object = new CSS2DObject(wrapper);
      object.position.set(anchor.x, anchor.y, anchor.z);
      scene.add(object);

      const entry: LabelEntry = {
        object,
        labelElement,
        anchor: new Vector3(anchor.x, anchor.y, anchor.z),
        poiId,
        state: initialState,
        arrivalOpacityMultiplier: 1,
        occlusionHysteresis: createInitialOcclusionHysteresisState(false),
        lastNdc: { x: 0, y: 0 },
        overlapOpacityMultiplier: 1,
        hasProjected: false,
      };
      applyLabelEntryAppearance(entry);

      return entry;
    },
  );
  const raycaster = new Raycaster();
  const cameraPosition = new Vector3();
  const rayDirection = new Vector3();
  const clipSpacePosition = new Vector4();
  const expectedTerrainIndexCount = (grid.rows - 1) * (grid.cols - 1) * 6;
  const terrainGeometry = terrainMesh instanceof Mesh
    && terrainMesh.geometry instanceof BufferGeometry
    ? terrainMesh.geometry
    : null;
  const actualTerrainIndexCount = terrainGeometry?.getIndex()?.count ?? null;
  const terrainPosition = terrainGeometry?.getAttribute('position');
  const rangeOptimizationEnabled = terrainGeometry !== null
    && terrainPosition !== undefined
    && actualTerrainIndexCount === expectedTerrainIndexCount;
  let collisionGeometry: BufferGeometry | null = null;
  let collisionMesh: Mesh | null = null;

  if (rangeOptimizationEnabled && terrainGeometry !== null) {
    collisionGeometry = new BufferGeometry();
    // This geometry shares the terrain's position attribute and index. Never
    // render it or add it to the scene: WebGLGeometries would attach dispose
    // listeners, and disposing it could release GPU buffers shared by terrain.
    // It owns only its drawRange, so changing it cannot affect terrain triangles.
    collisionGeometry.setAttribute('position', terrainPosition);
    collisionGeometry.setIndex(terrainGeometry.getIndex());
    collisionMesh = new Mesh(collisionGeometry, terrainMesh instanceof Mesh
      ? terrainMesh.material
      : undefined);
    collisionMesh.matrixAutoUpdate = false;
    collisionMesh.matrixWorldAutoUpdate = false;
    console.info('[label-raycast-range] enabled', {
      actualIndexCount: actualTerrainIndexCount,
      expectedIndexCount: expectedTerrainIndexCount,
    });
  } else {
    console.warn('[label-raycast-range] disabled; using full terrain raycast', {
      actualIndexCount: actualTerrainIndexCount,
      expectedIndexCount: expectedTerrainIndexCount,
    });
  }

  const labelRaycastFull = options.labelRaycastFull === true;
  const verifyState: LabelRaycastVerification | null =
    options.labelRaycastVerify === true
      ? {
          enabled: true,
          comparisons: 0,
          mismatches: 0,
          maxAbsDistanceDeltaM: 0,
        }
      : null;
  const recordRaycastVerification = (
    limitedDistance: number | null,
    fullDistance: number | null,
  ): void => {
    if (verifyState === null) return;

    verifyState.comparisons += 1;
    if (limitedDistance === null || fullDistance === null) {
      if (limitedDistance !== fullDistance) {
        verifyState.mismatches += 1;
      }
      return;
    }

    const absoluteDelta = Math.abs(limitedDistance - fullDistance);
    verifyState.maxAbsDistanceDeltaM = Math.max(
      verifyState.maxAbsDistanceDeltaM,
      absoluteDelta,
    );
    if (absoluteDelta > 1e-6) {
      verifyState.mismatches += 1;
    }
  };
  const raycastTerrain = (entry: LabelEntry): number | null => {
    if (collisionGeometry === null || collisionMesh === null) {
      return raycaster.intersectObject(terrainMesh, true)[0]?.distance ?? null;
    }
    if (labelRaycastFull && verifyState === null) {
      return raycaster.intersectObject(terrainMesh, true)[0]?.distance ?? null;
    }

    // The collision mesh is deliberately not in the scene, so synchronize its
    // world transform explicitly immediately before every raycast.
    collisionMesh.matrixWorld.copy(terrainMesh.matrixWorld);
    const limitedRange = computeTerrainRaycastDrawRange(
      cameraPosition.z,
      entry.anchor.z,
      grid.cellSizeMeters,
      grid.rows,
      grid.cols,
    );
    if (limitedRange.useFullTerrainRaycast) {
      const fullDistance = raycaster.intersectObject(
        terrainMesh,
        true,
      )[0]?.distance ?? null;
      if (verifyState !== null) {
        recordRaycastVerification(fullDistance, fullDistance);
      }
      return fullDistance;
    }
    collisionGeometry.setDrawRange(limitedRange.start, limitedRange.count);
    const limitedDistance = raycaster.intersectObject(
      collisionMesh,
      false,
    )[0]?.distance ?? null;

    if (verifyState !== null) {
      const fullDistance = raycaster.intersectObject(
        terrainMesh,
        true,
      )[0]?.distance ?? null;
      recordRaycastVerification(limitedDistance, fullDistance);
      return labelRaycastFull ? fullDistance : limitedDistance;
    }

    return limitedDistance;
  };
  const labelPerfBypass = options.labelPerfBypass ?? {
    skipRaycast: false,
    skipAppearanceWrite: false,
    skipProjection: false,
  };
  const perfCounters: LabelPerfCounters | null =
    options.labelPerfCountersEnabled
      ? {
          frames: 0,
          raycasts: 0,
          projections: 0,
          appearanceCalls: 0,
          styleWrites: 0,
        }
      : null;

  // Keep production and diagnostic update loops separate. The diagnostic
  // updater is selected once during controller creation, so disabled counters
  // and bypasses add no per-frame branch work around projection/DOM writes.
  const updateOcclusionBaseline = (
    frameIndex: number,
    _deltaMs: number,
  ): void => {
    camera.getWorldPosition(cameraPosition);
    terrainMesh.updateWorldMatrix(true, true);

    for (const [index, entry] of entries.entries()) {
      const recomputeOcclusion = shouldRecomputeOcclusion(
        frameIndex,
        settings.labels.occlusion.throttleFrames,
        index,
      );
      let nextOccluded = entry.state.occluded;

      clipSpacePosition
        .set(entry.anchor.x, entry.anchor.y, entry.anchor.z, 1)
        .applyMatrix4(camera.matrixWorldInverse)
        .applyMatrix4(camera.projectionMatrix);
      const projection = computeLabelProjectionVisibility(clipSpacePosition);
      entry.lastNdc = { x: projection.ndcX, y: projection.ndcY };
      entry.hasProjected = true;

      if (recomputeOcclusion) {
        rayDirection.subVectors(entry.anchor, cameraPosition);
        const distanceToAnchor = rayDirection.length();
        rayDirection.normalize();
        raycaster.set(cameraPosition, rayDirection);
        raycaster.far = distanceToAnchor;

        const terrainHitDistance = raycastTerrain(entry);
        nextOccluded = isAnchorOccluded(
          distanceToAnchor,
          terrainHitDistance,
          settings.labels.occlusion.epsilonMeters,
        );
      }

      const hysteresis = computeHysteresisOcclusion(
        nextOccluded,
        entry.occlusionHysteresis,
      );
      entry.occlusionHysteresis = hysteresis.nextState;

      entry.state = reduceLabelDisplayState(
        entry.state,
        hysteresis.occluded,
        !projection.visible,
        recomputeOcclusion,
      );
      entry.state = reduceLabelDistanceDisplayState(
        entry.state,
        cameraPosition.distanceTo(entry.anchor),
        settings.labels.distanceScaling,
      );

      applyLabelEntryAppearance(entry);
    }
  };

  const updateOcclusionWithDiagnostics = (
    frameIndex: number,
    _deltaMs: number,
  ): void => {
    if (perfCounters !== null) {
      perfCounters.frames += 1;
    }

    camera.getWorldPosition(cameraPosition);
    terrainMesh.updateWorldMatrix(true, true);

    for (const [index, entry] of entries.entries()) {
      const recomputeOcclusion = shouldRecomputeOcclusion(
        frameIndex,
        settings.labels.occlusion.throttleFrames,
        index,
      );
      let nextOccluded = entry.state.occluded;
      let projectionVisible = !entry.state.offScreen;

      if (!labelPerfBypass.skipProjection) {
        clipSpacePosition
          .set(entry.anchor.x, entry.anchor.y, entry.anchor.z, 1)
          .applyMatrix4(camera.matrixWorldInverse)
          .applyMatrix4(camera.projectionMatrix);
        const projection = computeLabelProjectionVisibility(clipSpacePosition);
        entry.lastNdc = { x: projection.ndcX, y: projection.ndcY };
        entry.hasProjected = true;
        projectionVisible = projection.visible;
        if (perfCounters !== null) {
          perfCounters.projections += 1;
        }
      }

      if (recomputeOcclusion && !labelPerfBypass.skipRaycast) {
        rayDirection.subVectors(entry.anchor, cameraPosition);
        const distanceToAnchor = rayDirection.length();
        rayDirection.normalize();
        raycaster.set(cameraPosition, rayDirection);
        raycaster.far = distanceToAnchor;

        const terrainHitDistance = raycastTerrain(entry);
        if (perfCounters !== null) {
          perfCounters.raycasts += 1;
        }
        nextOccluded = isAnchorOccluded(
          distanceToAnchor,
          terrainHitDistance,
          settings.labels.occlusion.epsilonMeters,
        );
      }

      const hysteresis = computeHysteresisOcclusion(
        nextOccluded,
        entry.occlusionHysteresis,
      );
      entry.occlusionHysteresis = hysteresis.nextState;

      entry.state = reduceLabelDisplayState(
        entry.state,
        hysteresis.occluded,
        !projectionVisible,
        recomputeOcclusion,
      );
      entry.state = reduceLabelDistanceDisplayState(
        entry.state,
        cameraPosition.distanceTo(entry.anchor),
        settings.labels.distanceScaling,
      );

      if (!labelPerfBypass.skipAppearanceWrite) {
        if (perfCounters === null) {
          applyLabelEntryAppearance(entry);
        } else {
          applyLabelEntryAppearanceWithCounters(entry, perfCounters);
        }
      }
    }
  };

  const diagnosticsEnabled = perfCounters !== null
    || labelPerfBypass.skipRaycast
    || labelPerfBypass.skipAppearanceWrite
    || labelPerfBypass.skipProjection;
  const updateOcclusion = diagnosticsEnabled
    ? updateOcclusionWithDiagnostics
    : updateOcclusionBaseline;

  return {
    renderer,
    objects: entries.map(({ object }) => object),
    setSize(width: number, height: number): void {
      renderer.setSize(width, height);
    },
    updateOcclusion,
    updateArrivalStates(states: SpotArrivalState[], elapsedMs: number): void {
      const anyPrimaryActive = states.some((state) => state.isPrimaryActive);

      const overlapCandidates: LabelOverlapCandidate[] = entries.map(
        (entry, index) => {
          const state = states.find(
            (candidate) => candidate.poiId === entry.poiId,
          );

          return {
            poiId: entry.poiId,
            ndcX: entry.lastNdc.x,
            ndcY: entry.lastNdc.y,
            // Entries that have never had a real screen-space projection
            // computed yet (updateOcclusion not called) are treated as
            // active so they are excluded from overlap-fade pairing rather
            // than being mistaken for a real collision at the shared
            // { x: 0, y: 0 } initial NDC value.
            isActive: entry.hasProjected
              ? (state?.isActive ?? false)
              : true,
            priority: index,
          };
        },
      );
      const overlapResults = computeLabelOverlapFade(overlapCandidates);
      const overlapOpacityByPoiId = new Map(
        overlapResults.map((result) => [result.poiId, result.opacityMultiplier]),
      );

      for (const entry of entries) {
        const state = states.find(
          (candidate) => candidate.poiId === entry.poiId,
        );
        const { opacityMultiplier } = computeLabelEmphasisAppearance(
          state,
          anyPrimaryActive,
        );
        entry.arrivalOpacityMultiplier = opacityMultiplier;
        entry.overlapOpacityMultiplier = overlapOpacityByPoiId.get(
          entry.poiId,
        ) ?? 1;
        applyLabelEntryAppearance(entry);
      }

      waypointMarkers.updateArrivalStates(states, elapsedMs);
    },
    render(): void {
      renderer.render(scene, camera);
    },
    dispose(): void {
      for (const entry of entries) {
        scene.remove(entry.object);
      }
      waypointMarkers.dispose();
      collisionGeometry?.dispose();
      renderer.domElement.remove();
    },
    getPerfCounters(): LabelPerfCounters | null {
      return perfCounters === null ? null : { ...perfCounters };
    },
    getRaycastVerification(): LabelRaycastVerification | null {
      return verifyState === null ? null : { ...verifyState };
    },
  };
}
