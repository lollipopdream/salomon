import { SPOT_ARRIVAL_VISUAL_DEFAULTS } from '../config/defaults/spotArrival';
import { elevationToWorldHeight } from '../geo/elevation';
import type {
  AppSettings,
  ElevationGrid,
  LabelPresentationConfig,
  RoutePath,
  RoutePoint,
  Vec3,
} from '../types';
import type { SpotArrivalState } from './spotArrival';
import {
  projectLatLngToGridIndex,
  sampleElevationBilinear,
} from './routePath';

export interface PoiAnchor {
  poiId: string;
  displayText: string;
  /** 地表面(heightOffset=0)の world-space 基準座標。 */
  base: Vec3;
}

export function selectLabeledRoutePoints(
  route: RoutePath,
  presentations: LabelPresentationConfig[],
): Array<{
  point: RoutePoint & { poiId: string };
  presentation: LabelPresentationConfig;
}> {
  const selected: Array<{
    point: RoutePoint & { poiId: string };
    presentation: LabelPresentationConfig;
  }> = [];

  route.points.forEach((point) => {
    if (point.poiId === undefined) {
      return;
    }

    const presentation = presentations.find(
      (candidate) => candidate.poiId === point.poiId,
    );

    if (presentation !== undefined) {
      selected.push({
        point: { ...point, poiId: point.poiId },
        presentation,
      });
    }
  });

  return selected;
}

export function computePoiAnchors(
  selected: Array<{
    point: RoutePoint & { poiId: string };
    presentation: LabelPresentationConfig;
  }>,
  grid: ElevationGrid,
  settings: AppSettings,
): PoiAnchor[] {
  return selected.map(({ point, presentation }) => {
    const { col, row } = projectLatLngToGridIndex(point, grid);
    const elevation = sampleElevationBilinear(grid, col, row);

    return {
      poiId: point.poiId,
      displayText: presentation.displayText,
      base: {
        x: col * grid.cellSizeMeters,
        y: elevationToWorldHeight(elevation, settings.elevationScale),
        z: row * grid.cellSizeMeters,
      },
    };
  });
}

export function deriveMarkerAnchor(poi: PoiAnchor): Vec3 {
  return { ...poi.base };
}

export function deriveLabelAnchor(
  poi: PoiAnchor,
  heightOffsetMeters: number,
): Vec3 {
  return {
    x: poi.base.x,
    y: poi.base.y + heightOffsetMeters,
    z: poi.base.z,
  };
}

export function computeLabelWorldAnchors(
  selected: Array<{
    point: RoutePoint & { poiId: string };
    presentation: LabelPresentationConfig;
  }>,
  grid: ElevationGrid,
  settings: AppSettings,
  heightOffsetMeters: number,
): Array<{ anchor: Vec3; displayText: string; poiId: string }> {
  return selected.map(({ point, presentation }) => {
    const { col, row } = projectLatLngToGridIndex(point, grid);
    const elevation = sampleElevationBilinear(grid, col, row);

    return {
      anchor: {
        x: col * grid.cellSizeMeters,
        y: elevationToWorldHeight(elevation, settings.elevationScale)
          + heightOffsetMeters,
        z: row * grid.cellSizeMeters,
      },
      displayText: presentation.displayText,
      poiId: point.poiId,
    };
  });
}

export function computeLabelEmphasisAppearance(
  state: SpotArrivalState | undefined,
  anyPrimaryActive: boolean,
): {
  scaleMultiplier: number;
  opacityMultiplier: number;
  emphasized: boolean;
} {
  if (state === undefined || !state.isActive) {
    return {
      scaleMultiplier: 1,
      opacityMultiplier: anyPrimaryActive
        ? SPOT_ARRIVAL_VISUAL_DEFAULTS.otherSpotDimOpacity
        : 1,
      emphasized: false,
    };
  }

  return {
    scaleMultiplier: 1 + (
      SPOT_ARRIVAL_VISUAL_DEFAULTS.labelEmphasisScale - 1
    ) * state.intensity,
    opacityMultiplier: 1,
    emphasized: state.phase === 'arrive' || state.phase === 'dwell',
  };
}
