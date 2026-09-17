import { describe, expect, it } from 'vitest';

import { defaultSettings } from '../config/settings';
import { SPOT_ARRIVAL_VISUAL_DEFAULTS } from '../config/defaults/spotArrival';
import type {
  AppSettings,
  ElevationGrid,
  LabelPresentationConfig,
  RoutePath,
} from '../types';
import { mockTakaoRoute } from './mockRoute';
import type { SpotArrivalState } from './spotArrival';
import {
  computeLabelEmphasisAppearance,
  computeLabelWorldAnchors,
  computePoiAnchors,
  deriveLabelAnchor,
  deriveMarkerAnchor,
  selectLabeledRoutePoints,
} from './routeLabels';

const presentations: LabelPresentationConfig[] = [
  { poiId: 'kiyotaki', displayText: '清滝駅' },
  { poiId: 'yakuoin', displayText: '薬王院' },
  { poiId: 'summit', displayText: '高尾山頂' },
];

describe('selectLabeledRoutePoints', () => {
  it('selects only the three route points whose poiIds strictly match presentations', () => {
    const selected = selectLabeledRoutePoints(mockTakaoRoute, presentations);

    expect(selected.map(({ point }) => point.poiId)).toEqual([
      'kiyotaki',
      'yakuoin',
      'summit',
    ]);
    expect(selected.map(({ presentation }) => presentation.displayText)).toEqual([
      '清滝駅',
      '薬王院',
      '高尾山頂',
    ]);
  });

  it('excludes the summit-adjacent point because it has no poiId', () => {
    const summitAdjacentPoint = mockTakaoRoute.points.find(
      (point) => point.label === '山頂直下(仮)',
    );

    expect(summitAdjacentPoint).toBeDefined();
    expect(summitAdjacentPoint?.poiId).toBeUndefined();
    expect(
      selectLabeledRoutePoints(mockTakaoRoute, presentations)
        .map(({ point }) => point)
        .some((point) => point === summitAdjacentPoint),
    ).toBe(false);
  });

  it('silently omits presentation entries with no matching route poiId', () => {
    const withUnmatchedPresentation = [
      ...presentations,
      { poiId: 'future-route-poi', displayText: '将来の地点' },
    ];

    expect(() => selectLabeledRoutePoints(
      mockTakaoRoute,
      withUnmatchedPresentation,
    )).not.toThrow();
    expect(
      selectLabeledRoutePoints(mockTakaoRoute, withUnmatchedPresentation)
        .map(({ point }) => point.poiId),
    ).toEqual(['kiyotaki', 'yakuoin', 'summit']);
  });

  it('does not change the selected poiId set when route label strings change', () => {
    const relabeledRoute: RoutePath = {
      ...mockTakaoRoute,
      points: mockTakaoRoute.points.map((point, index) => ({
        ...point,
        label: point.poiId === undefined
          ? `高尾山頂 中間点 表示候補 ${index}`
          : `poiIdと無関係な文字列 ${index}`,
      })),
    };

    const originalPoiIds = selectLabeledRoutePoints(
      mockTakaoRoute,
      presentations,
    ).map(({ point }) => point.poiId);
    const relabeledPoiIds = selectLabeledRoutePoints(
      relabeledRoute,
      presentations,
    ).map(({ point }) => point.poiId);

    expect(relabeledPoiIds).toEqual(originalPoiIds);
  });
});

describe('computeLabelWorldAnchors', () => {
  it('projects with the routePath helpers and returns terrain height plus the offset', () => {
    const grid: ElevationGrid = {
      cols: 2,
      rows: 2,
      values: Float32Array.from([0, 100, 200, 300]),
      cellSizeMeters: 10,
      bounds: {
        north: 1,
        south: 0,
        east: 1,
        west: 0,
      },
    };
    const route: RoutePath = {
      isOfficial: false,
      points: [
        { lat: 1, lng: 0, poiId: 'north-west' },
        { lat: 0.5, lng: 0.5, poiId: 'center' },
        { lat: 0, lng: 1, poiId: 'south-east' },
      ],
    };
    const anchorPresentations: LabelPresentationConfig[] = [
      { poiId: 'north-west', displayText: 'NW' },
      { poiId: 'center', displayText: 'Center' },
      { poiId: 'south-east', displayText: 'SE' },
    ];
    const settings: AppSettings = {
      ...defaultSettings,
      elevationScale: 0.5,
    };

    const selected = selectLabeledRoutePoints(route, anchorPresentations);

    const anchors = computeLabelWorldAnchors(selected, grid, settings, 2);

    expect(anchors).toMatchObject([
      { anchor: { x: 0, y: 2, z: 0 }, displayText: 'NW' },
      { anchor: { x: 5, y: 77, z: 5 }, displayText: 'Center' },
      { anchor: { x: 10, y: 152, z: 10 }, displayText: 'SE' },
    ]);
    expect(anchors.map(({ poiId }) => poiId)).toEqual([
      'north-west',
      'center',
      'south-east',
    ]);
  });
});

describe('POI anchors', () => {
  it('uses the same terrain-projected base coordinates as zero-offset label anchors', () => {
    const grid: ElevationGrid = {
      cols: 2,
      rows: 2,
      values: Float32Array.from([0, 100, 200, 300]),
      cellSizeMeters: 10,
      bounds: {
        north: 1,
        south: 0,
        east: 1,
        west: 0,
      },
    };
    const route: RoutePath = {
      isOfficial: false,
      points: [
        { lat: 1, lng: 0, poiId: 'north-west' },
        { lat: 0.5, lng: 0.5, poiId: 'center' },
        { lat: 0, lng: 1, poiId: 'south-east' },
      ],
    };
    const anchorPresentations: LabelPresentationConfig[] = [
      { poiId: 'north-west', displayText: 'NW' },
      { poiId: 'center', displayText: 'Center' },
      { poiId: 'south-east', displayText: 'SE' },
    ];
    const settings: AppSettings = {
      ...defaultSettings,
      elevationScale: 0.5,
    };
    const selected = selectLabeledRoutePoints(route, anchorPresentations);

    const poiAnchors = computePoiAnchors(selected, grid, settings);
    const zeroOffsetAnchors = computeLabelWorldAnchors(
      selected,
      grid,
      settings,
      0,
    );

    expect(poiAnchors.map(({ base }) => base)).toEqual(
      zeroOffsetAnchors.map(({ anchor }) => anchor),
    );
  });

  it('derives a copied marker anchor and a vertically offset label anchor', () => {
    const poi = {
      poiId: 'summit',
      displayText: '高尾山頂',
      base: { x: 10, y: 20, z: 30 },
    };

    const marker = deriveMarkerAnchor(poi);
    const label = deriveLabelAnchor(poi, 15);

    expect(marker).toEqual(poi.base);
    expect(marker).not.toBe(poi.base);
    expect(label).toEqual({ x: 10, y: 35, z: 30 });
    expect(label.x).toBe(poi.base.x);
    expect(label.z).toBe(poi.base.z);
    expect(label.y).toBe(poi.base.y + 15);
  });
});

describe('computeLabelEmphasisAppearance', () => {
  const activeState = (overrides: Partial<SpotArrivalState> = {}): SpotArrivalState => ({
    poiId: 'summit',
    tier: 'primary',
    phase: 'approach',
    intensity: 0,
    isActive: true,
    isPrimaryActive: true,
    ...overrides,
  });

  it('uses the baseline appearance with no active state or primary spot', () => {
    expect(computeLabelEmphasisAppearance(undefined, false)).toEqual({
      scaleMultiplier: 1,
      opacityMultiplier: 1,
      emphasized: false,
    });
  });

  it('dims an inactive label when another primary spot is active', () => {
    expect(computeLabelEmphasisAppearance(undefined, true)).toEqual({
      scaleMultiplier: 1,
      opacityMultiplier: SPOT_ARRIVAL_VISUAL_DEFAULTS.otherSpotDimOpacity,
      emphasized: false,
    });
  });

  it('treats an explicitly inactive state as inactive', () => {
    expect(computeLabelEmphasisAppearance(activeState({ isActive: false }), true))
      .toEqual({
        scaleMultiplier: 1,
        opacityMultiplier: SPOT_ARRIVAL_VISUAL_DEFAULTS.otherSpotDimOpacity,
        emphasized: false,
      });
  });

  it('interpolates active label scale across its arrival intensity', () => {
    const startAppearance = computeLabelEmphasisAppearance(
      activeState({ intensity: 0 }),
      false,
    );
    const middleAppearance = computeLabelEmphasisAppearance(
      activeState({ intensity: 0.5 }),
      false,
    );
    const peakAppearance = computeLabelEmphasisAppearance(
      activeState({ intensity: 1 }),
      false,
    );

    expect(startAppearance.scaleMultiplier).toBe(1);
    expect(middleAppearance.scaleMultiplier).toBeCloseTo(
        (1 + SPOT_ARRIVAL_VISUAL_DEFAULTS.labelEmphasisScale) / 2,
    );
    expect(peakAppearance.scaleMultiplier)
      .toBe(SPOT_ARRIVAL_VISUAL_DEFAULTS.labelEmphasisScale);
    expect(peakAppearance.opacityMultiplier).toBe(1);
  });

  it.each([
    ['arrive', true],
    ['dwell', true],
    ['approach', false],
    ['depart', false],
    ['idle', false],
  ] as const)('sets emphasized for %s according to its phase', (phase, emphasized) => {
    expect(computeLabelEmphasisAppearance(activeState({ phase }), false).emphasized)
      .toBe(emphasized);
  });
});
