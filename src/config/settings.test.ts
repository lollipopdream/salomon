import { describe, expect, it } from 'vitest';

import { computeRouteFollowSpotExtraMs } from '../animation/progress';
import { computeRouteFollowStartMs } from '../camera/cameraTimeline';
import type {
  AppSettings,
  ArrivalCardConfig,
  TerrainSurfaceConfig,
} from '../types';
import {
  ROUTE_FOLLOW_BASE_TRAVEL_MS,
  routeFollowSpotsDefaults,
} from './defaults/cameraSpotHold';
import { cameraTimelineDefaults } from './defaults/cameraTiming';
import { defaultSettings, validateSettings } from './settings';

function settingsWithTimeline(
  overrides: Partial<AppSettings['cameraState']['timeline']>,
): AppSettings {
  return {
    ...defaultSettings,
    cameraState: {
      ...defaultSettings.cameraState,
      timeline: {
        ...defaultSettings.cameraState.timeline,
        ...overrides,
      },
    },
  };
}

function settingsWithFollow(
  overrides: Partial<AppSettings['cameraState']['follow']>,
): AppSettings {
  return {
    ...defaultSettings,
    cameraState: {
      ...defaultSettings.cameraState,
      follow: {
        ...defaultSettings.cameraState.follow,
        ...overrides,
      },
    },
  };
}

function settingsWithGuidance(
  overrides: Partial<AppSettings['cameraState']['guidance']>,
): AppSettings {
  return {
    ...defaultSettings,
    cameraState: {
      ...defaultSettings.cameraState,
      guidance: {
        ...defaultSettings.cameraState.guidance,
        ...overrides,
      },
    },
  };
}

function settingsWithSummit(
  overrides: Partial<AppSettings['cameraState']['summit']>,
): AppSettings {
  return {
    ...defaultSettings,
    cameraState: {
      ...defaultSettings.cameraState,
      summit: {
        ...defaultSettings.cameraState.summit,
        ...overrides,
      },
    },
  };
}

function settingsWithHighOverview(
  overrides: Partial<AppSettings['cameraState']['highOverview']>,
): AppSettings {
  return {
    ...defaultSettings,
    cameraState: {
      ...defaultSettings.cameraState,
      highOverview: {
        ...defaultSettings.cameraState.highOverview,
        ...overrides,
      },
    },
  };
}

function settingsWithOverview(
  overrides: Partial<AppSettings['cameraState']['overview']>,
): AppSettings {
  return {
    ...defaultSettings,
    cameraState: {
      ...defaultSettings.cameraState,
      overview: {
        ...defaultSettings.cameraState.overview,
        ...overrides,
      },
    },
  };
}

function settingsWithTerrain(
  overrides: Partial<AppSettings['visual']['terrain']>,
): AppSettings {
  return {
    ...defaultSettings,
    visual: {
      ...defaultSettings.visual,
      terrain: {
        ...defaultSettings.visual.terrain,
        ...overrides,
      },
    },
  };
}

function settingsWithEdgeFade(
  overrides: Partial<NonNullable<AppSettings['visual']['terrain']['edgeFade']>>,
): AppSettings {
  const baseEdgeFade = defaultSettings.visual.terrain.edgeFade;
  if (baseEdgeFade === undefined) {
    throw new Error('defaultSettings.visual.terrain.edgeFade must be set for this test helper');
  }

  return settingsWithTerrain({
    edgeFade: {
      ...baseEdgeFade,
      ...overrides,
    },
  });
}

function settingsWithTerrainSurface(
  terrainSurface: AppSettings['visual']['terrainSurface'],
): AppSettings {
  return {
    ...defaultSettings,
    visual: {
      ...defaultSettings.visual,
      terrainSurface,
    },
  };
}

function settingsWithWaypoints(
  overrides: Partial<AppSettings['visual']['waypoints']>,
): AppSettings {
  return {
    ...defaultSettings,
    visual: {
      ...defaultSettings.visual,
      waypoints: {
        ...defaultSettings.visual.waypoints,
        ...overrides,
      },
    },
  };
}

function settingsWithDistanceScaling(
  overrides: Partial<AppSettings['labels']['distanceScaling']>,
): AppSettings {
  return {
    ...defaultSettings,
    labels: {
      ...defaultSettings.labels,
      distanceScaling: {
        ...defaultSettings.labels.distanceScaling,
        ...overrides,
      },
    },
  };
}

describe('validateSettings', () => {
  it('provides the default arrival card configuration', () => {
    const arrivalCard: ArrivalCardConfig = defaultSettings.visual.arrivalCard;

    expect(arrivalCard).toEqual({
      enabled: true,
      position: 'bottom-center',
      bottomMarginPx: 40,
      fadeMs: 220,
      slideOffsetPx: 6,
      backgroundColor: 'rgba(6, 8, 6, 0.85)',
      textColor: '#f5f2ea',
      accentColor: 0xffb84d,
    });
    expect(validateSettings(defaultSettings)).toBe(true);
  });

  it('accepts the default settings', () => {
    expect(validateSettings(defaultSettings)).toBe(true);
  });

  it('derives the route play duration from the timeline, travel, and spot events', () => {
    const routeFollowStartMs = computeRouteFollowStartMs(cameraTimelineDefaults);
    const routeFollowSpotExtraMs = computeRouteFollowSpotExtraMs(
      routeFollowSpotsDefaults.events,
    );

    expect(defaultSettings.routeAnimation.playDurationMs).toBe(
      routeFollowStartMs + ROUTE_FOLLOW_BASE_TRAVEL_MS + routeFollowSpotExtraMs,
    );
  });

  it('preserves the end hold required by the outro phases', () => {
    expect(defaultSettings.routeAnimation.holdAtEndMs).toBe(5_800);
  });

  it('accepts valid visual enhancement settings', () => {
    const validSettings = settingsWithTerrain({
      textureUrl: '/data/terrain-texture/takao.jpg',
      textureRepeat: { x: 2, y: 0.5 },
    });

    expect(validSettings.cameraState.highOverview).toEqual({
      radiusFactor: expect.any(Number),
      heightFactor: expect.any(Number),
      orbitDegrees: expect.any(Number),
      holdDriftStartRadiusFactor: expect.any(Number),
      holdDriftStartHeightFactor: expect.any(Number),
      holdDriftStartAzimuthDegrees: expect.any(Number),
    });
    expect(validateSettings(validSettings)).toBe(true);
  });

  it('accepts the vertex-color fallback when textureUrl is unset', () => {
    const fallbackSettings = settingsWithTerrain({ textureUrl: undefined });

    expect(validateSettings(fallbackSettings)).toBe(true);
  });

  it('accepts settings when terrainSurface is unset', () => {
    expect(validateSettings(settingsWithTerrainSurface(undefined))).toBe(true);
  });

  it('rejects invalid terrainSurface settings', () => {
    const terrainSurface = defaultSettings.visual.terrainSurface;
    if (terrainSurface === undefined) {
      throw new Error(
        'defaultSettings.visual.terrainSurface must be set for this test',
      );
    }

    const invalidTerrainSurfaces: Array<[string, TerrainSurfaceConfig]> = [
      [
        'unknown defaultVariant',
        {
          ...terrainSurface,
          defaultVariant: 'unknown' as TerrainSurfaceConfig['defaultVariant'],
        },
      ],
      [
        'empty hillshade scales',
        {
          ...terrainSurface,
          hillshade: { ...terrainSurface.hillshade, scales: [] },
        },
      ],
      [
        'non-positive hillshade stepPixels',
        {
          ...terrainSurface,
          hillshade: {
            ...terrainSurface.hillshade,
            scales: [{ stepPixels: 0, weight: 1 }],
          },
        },
      ],
      [
        'non-integer hillshade stepPixels',
        {
          ...terrainSurface,
          hillshade: {
            ...terrainSurface.hillshade,
            scales: [{ stepPixels: 1.5, weight: 1 }],
          },
        },
      ],
      [
        'non-positive hillshade weight',
        {
          ...terrainSurface,
          hillshade: {
            ...terrainSurface.hillshade,
            scales: [{ stepPixels: 1, weight: 0 }],
          },
        },
      ],
      [
        'non-positive slopeExaggeration',
        {
          ...terrainSurface,
          hillshade: { ...terrainSurface.hillshade, slopeExaggeration: 0 },
        },
      ],
      [
        'non-positive minFactor',
        {
          ...terrainSurface,
          hillshade: { ...terrainSurface.hillshade, minFactor: 0 },
        },
      ],
      [
        'maxFactor equal to minFactor',
        {
          ...terrainSurface,
          hillshade: {
            ...terrainSurface.hillshade,
            maxFactor: terrainSurface.hillshade.minFactor,
          },
        },
      ],
      [
        'non-positive DEM coarseStepPixels',
        {
          ...terrainSurface,
          demNormal: { ...terrainSurface.demNormal, coarseStepPixels: 0 },
        },
      ],
      [
        'non-integer DEM coarseStepPixels',
        {
          ...terrainSurface,
          demNormal: { ...terrainSurface.demNormal, coarseStepPixels: 1.5 },
        },
      ],
      [
        'negative DEM normal strength',
        {
          ...terrainSurface,
          demNormal: { ...terrainSurface.demNormal, strength: -1 },
        },
      ],
      [
        'unsupported canopy resolution',
        {
          ...terrainSurface,
          canopy: { ...terrainSurface.canopy, resolution: 1024 },
        },
      ],
      [
        'negative canopy blurRadiusTexels',
        {
          ...terrainSurface,
          canopy: { ...terrainSurface.canopy, blurRadiusTexels: -1 },
        },
      ],
      [
        'non-integer canopy blurRadiusTexels',
        {
          ...terrainSurface,
          canopy: { ...terrainSurface.canopy, blurRadiusTexels: 1.5 },
        },
      ],
      [
        'negative canopy heightScale',
        {
          ...terrainSurface,
          canopy: { ...terrainSurface.canopy, heightScale: -1 },
        },
      ],
      [
        'negative canopy weight',
        {
          ...terrainSurface,
          canopy: { ...terrainSurface.canopy, weight: -0.1 },
        },
      ],
      [
        'canopy weight above one',
        {
          ...terrainSurface,
          canopy: { ...terrainSurface.canopy, weight: 1.1 },
        },
      ],
      [
        'non-positive normalMapResolution',
        { ...terrainSurface, normalMapResolution: 0 },
      ],
      ['negative normalScale', { ...terrainSurface, normalScale: -1 }],
    ];

    for (const [caseName, invalidTerrainSurface] of invalidTerrainSurfaces) {
      expect(
        validateSettings(settingsWithTerrainSurface(invalidTerrainSurface)),
        caseName,
      ).toBe(false);
    }
  });

  it('uses the Takao aerial texture by default', () => {
    expect(defaultSettings.visual.terrain.textureUrl).toBe(
      '/data/terrain-texture/takao-aerial.webp',
    );
  });

  it.each([
    '',
    'data/terrain-texture/takao.jpg',
    'http://example.com/takao.jpg',
    'https://example.com/takao.jpg',
    '/data/https://example.com/takao.jpg',
  ])('rejects an invalid terrain texture URL: %s', (textureUrl) => {
    expect(validateSettings(settingsWithTerrain({ textureUrl }))).toBe(false);
  });

  it.each([
    ['resampleSpacingMeters', 0],
    ['resampleSpacingMeters', Number.POSITIVE_INFINITY],
    ['smoothingWindowRadiusMeters', -1],
    ['smoothingWindowRadiusMeters', Number.NaN],
    ['maxDeviationMeters', 0],
    ['maxDeviationMeters', Number.POSITIVE_INFINITY],
  ] as const)(
    'rejects an invalid camera guidance %s: %s',
    (field, value) => {
      expect(validateSettings(settingsWithGuidance({ [field]: value }))).toBe(
        false,
      );
    },
  );

  it.each([
    [{ x: 0, y: 1 }],
    [{ x: 1, y: -1 }],
    [{ x: Number.NaN, y: 1 }],
    [{ x: 1, y: Number.POSITIVE_INFINITY }],
  ])('rejects an invalid terrain texture repeat: %o', (textureRepeat) => {
    expect(
      validateSettings(
        settingsWithTerrain({
          textureUrl: '/data/terrain-texture/takao.jpg',
          textureRepeat,
        }),
      ),
    ).toBe(false);
  });

  it('rejects settings with a non-positive resolution width', () => {
    const invalidSettings: AppSettings = {
      ...defaultSettings,
      resolutionWidth: -1,
    };

    expect(validateSettings(invalidSettings)).toBe(false);
  });

  it.each([-1, 0x1000000])(
    'rejects an invalid route core color: %s',
    (coreColor) => {
      const invalidSettings: AppSettings = {
        ...defaultSettings,
        visual: {
          ...defaultSettings.visual,
          route: {
            ...defaultSettings.visual.route,
            coreColor,
          },
        },
      };

      expect(validateSettings(invalidSettings)).toBe(false);
    },
  );

  it.each(['not-a-color', '#zzzzzz'])(
    'rejects an invalid top gradient color: %s',
    (gradientTopColor) => {
      const invalidSettings: AppSettings = {
        ...defaultSettings,
        visual: {
          ...defaultSettings.visual,
          background: {
            ...defaultSettings.visual.background,
            gradientTopColor,
          },
        },
      };

      expect(validateSettings(invalidSettings)).toBe(false);
    },
  );

  it.each([0, 1.5])('rejects an invalid halo opacity: %s', (opacity) => {
    const invalidSettings: AppSettings = {
      ...defaultSettings,
      visual: {
        ...defaultSettings.visual,
        route: {
          ...defaultSettings.visual.route,
          haloLayers: [
            {
              ...defaultSettings.visual.route.haloLayers[0],
              opacity,
            },
            defaultSettings.visual.route.haloLayers[1],
          ],
        },
      },
    };

    expect(validateSettings(invalidSettings)).toBe(false);
  });

  it.each([0, -0.1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects an invalid terrain hillshade minimum factor: %s',
    (hillshadeMinFactor) => {
      const invalidSettings: AppSettings = {
        ...defaultSettings,
        visual: {
          ...defaultSettings.visual,
          terrain: {
            ...defaultSettings.visual.terrain,
            hillshadeMinFactor,
          },
        },
      };

      expect(validateSettings(invalidSettings)).toBe(false);
    },
  );

  it.each([0.12, 0.1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects an invalid terrain hillshade maximum factor: %s',
    (hillshadeMaxFactor) => {
      const invalidSettings: AppSettings = {
        ...defaultSettings,
        visual: {
          ...defaultSettings.visual,
          terrain: {
            ...defaultSettings.visual.terrain,
            hillshadeMaxFactor,
          },
        },
      };

      expect(validateSettings(invalidSettings)).toBe(false);
    },
  );

  it('rejects a fog far factor equal to the near factor', () => {
    const invalidSettings: AppSettings = {
      ...defaultSettings,
      visual: {
        ...defaultSettings.visual,
        background: {
          ...defaultSettings.visual.background,
          fogFarFactor: defaultSettings.visual.background.fogNearFactor,
        },
      },
    };

    expect(validateSettings(invalidSettings)).toBe(false);
  });

  it('accepts valid Phase 4 boundary settings', () => {
    const boundaryHoldAtEndMs =
      defaultSettings.cameraState.timeline.transitionToSummitMs
      + defaultSettings.cameraState.timeline.summitHoldMs
      + defaultSettings.cameraState.timeline.returnToOverviewMs
      + defaultSettings.cameraState.timeline.ascendToHighOverviewMs;

    const validSettings: AppSettings = {
      ...defaultSettings,
      routeAnimation: {
        ...defaultSettings.routeAnimation,
        holdAtEndMs: boundaryHoldAtEndMs,
      },
      cameraState: {
        ...defaultSettings.cameraState,
        follow: {
          ...defaultSettings.cameraState.follow,
          directionSampleDeltaProgress: 1,
          lookAheadProgress: 1,
          targetLiftMeters: 0,
        },
      },
    };

    expect(
      validSettings.cameraState.timeline.transitionToSummitMs +
        validSettings.cameraState.timeline.summitHoldMs +
        validSettings.cameraState.timeline.returnToOverviewMs +
        validSettings.cameraState.timeline.ascendToHighOverviewMs,
    ).toBe(validSettings.routeAnimation.holdAtEndMs);
    expect(validateSettings(validSettings)).toBe(true);
  });

  it.each([
    ['highOverviewHoldMs', 0],
    ['descendToOverviewMs', Number.NaN],
    ['ascendToHighOverviewMs', Number.POSITIVE_INFINITY],
  ] as const)(
    'rejects an invalid high-overview timeline %s: %s',
    (field, value) => {
      expect(validateSettings(settingsWithTimeline({ [field]: value }))).toBe(
        false,
      );
    },
  );

  it.each([
    ['overviewHoldMs', 0],
    ['transitionInMs', 0],
    ['transitionToSummitMs', 0],
    ['summitHoldMs', 0],
    ['returnToOverviewMs', 0],
    ['arcLiftMeters', 0],
    ['overviewHoldMs', Number.NaN],
    ['arcLiftMeters', Number.POSITIVE_INFINITY],
  ] as const)(
    'rejects an invalid camera timeline %s: %s',
    (field, value) => {
      expect(validateSettings(settingsWithTimeline({ [field]: value }))).toBe(
        false,
      );
    },
  );

  it('rejects the play timeline at the strict equality boundary', () => {
    const { timeline } = defaultSettings.cameraState;
    const invalidSettings = settingsWithTimeline({
      overviewHoldMs:
        defaultSettings.routeAnimation.playDurationMs
        - timeline.highOverviewHoldMs
        - timeline.descendToOverviewMs
        - timeline.transitionInMs,
    });

    expect(
      invalidSettings.cameraState.timeline.highOverviewHoldMs +
        invalidSettings.cameraState.timeline.descendToOverviewMs +
        invalidSettings.cameraState.timeline.overviewHoldMs +
        invalidSettings.cameraState.timeline.transitionInMs,
    ).toBe(invalidSettings.routeAnimation.playDurationMs);
    expect(validateSettings(invalidSettings)).toBe(false);
  });

  it('rejects a high-overview intro equal to the play duration', () => {
    const { timeline } = defaultSettings.cameraState;
    const invalidSettings = settingsWithTimeline({
      highOverviewHoldMs:
        defaultSettings.routeAnimation.playDurationMs -
        timeline.descendToOverviewMs -
        timeline.overviewHoldMs -
        timeline.transitionInMs,
    });

    expect(
      invalidSettings.cameraState.timeline.highOverviewHoldMs +
        invalidSettings.cameraState.timeline.descendToOverviewMs +
        invalidSettings.cameraState.timeline.overviewHoldMs +
        invalidSettings.cameraState.timeline.transitionInMs,
    ).toBe(invalidSettings.routeAnimation.playDurationMs);
    expect(validateSettings(invalidSettings)).toBe(false);
  });

  it('rejects a summit and return timeline longer than the end hold', () => {
    const invalidSettings = settingsWithTimeline({
      returnToOverviewMs:
        defaultSettings.routeAnimation.holdAtEndMs
        - defaultSettings.cameraState.timeline.transitionToSummitMs
        - defaultSettings.cameraState.timeline.summitHoldMs
        + 1,
    });

    expect(validateSettings(invalidSettings)).toBe(false);
  });

  it('rejects an outro including high-overview ascent longer than the end hold', () => {
    const invalidSettings = settingsWithTimeline({
      ascendToHighOverviewMs:
        defaultSettings.routeAnimation.holdAtEndMs
        - defaultSettings.cameraState.timeline.transitionToSummitMs
        - defaultSettings.cameraState.timeline.summitHoldMs
        - defaultSettings.cameraState.timeline.returnToOverviewMs
        + 1,
    });

    expect(validateSettings(invalidSettings)).toBe(false);
  });

  it.each([
    ['behindMeters', 0],
    ['behindMeters', Number.POSITIVE_INFINITY],
    ['heightMeters', 0],
    ['heightMeters', Number.NaN],
    ['directionSampleDeltaProgress', 0],
    ['directionSampleDeltaProgress', 1.0001],
    ['lookAheadProgress', 0],
    ['lookAheadProgress', 1.0001],
    ['targetLiftMeters', Number.NaN],
  ] as const)('rejects an invalid route follow %s: %s', (field, value) => {
    expect(validateSettings(settingsWithFollow({ [field]: value }))).toBe(
      false,
    );
  });

  it.each([
    ['radiusFactor', 0],
    ['radiusFactor', Number.POSITIVE_INFINITY],
    ['heightFactor', 0],
    ['heightFactor', Number.NaN],
  ] as const)('rejects an invalid summit camera %s: %s', (field, value) => {
    expect(validateSettings(settingsWithSummit({ [field]: value }))).toBe(
      false,
    );
  });

  it.each([
    ['radiusFactor', 0],
    ['radiusFactor', Number.POSITIVE_INFINITY],
    ['heightFactor', 0],
    ['heightFactor', Number.NaN],
    ['orbitDegrees', -0.1],
    ['orbitDegrees', 360.1],
    ['orbitDegrees', Number.NaN],
    ['orbitDegrees', Number.POSITIVE_INFINITY],
  ] as const)(
    'rejects an invalid high-overview camera %s: %s',
    (field, value) => {
      expect(
        validateSettings(settingsWithHighOverview({ [field]: value })),
      ).toBe(false);
    },
  );

  it.each([
    ['holdDriftStartRadiusFactor', Number.NaN],
    ['holdDriftStartRadiusFactor', 0],
    ['holdDriftStartRadiusFactor', -0.1],
    ['holdDriftStartHeightFactor', Number.NaN],
    ['holdDriftStartHeightFactor', 0],
    ['holdDriftStartHeightFactor', -0.1],
  ] as const)(
    'rejects an invalid high-overview hold drift %s: %s',
    (field, value) => {
      expect(
        validateSettings(settingsWithHighOverview({ [field]: value })),
      ).toBe(false);
    },
  );

  it.each([
    ['radiusFactor', 0],
    ['radiusFactor', Number.POSITIVE_INFINITY],
    ['heightFactor', 0],
    ['heightFactor', Number.NaN],
    ['elevationLiftFactor', 0],
    ['elevationLiftFactor', Number.POSITIVE_INFINITY],
  ] as const)('rejects an invalid overview camera %s: %s', (field, value) => {
    expect(validateSettings(settingsWithOverview({ [field]: value }))).toBe(
      false,
    );
  });

  it.each([
    ['enabled', 0],
    ['fadeStartFactor', 0],
    ['fadeStartFactor', 1.0001],
    ['fadeStartFactor', Number.NaN],
    ['fadeStartFactor', Number.POSITIVE_INFINITY],
    ['fadeColor', -1],
    ['fadeColor', 0x1000000],
  ] as const)('rejects an invalid terrain edge fade %s: %s', (field, value) => {
    expect(
      validateSettings(
        settingsWithEdgeFade({
          [field]: value,
        }),
      ),
    ).toBe(false);
  });

  it.each([
    ['enabled', 0],
    ['style', 'unsupported'],
    ['headRadiusMeters', 0],
    ['headRadiusMeters', Number.NaN],
    ['standHeightMeters', 0],
    ['standHeightMeters', Number.POSITIVE_INFINITY],
    ['color', -1],
    ['color', 0x1000000],
  ] as const)('rejects an invalid waypoint %s: %s', (field, value) => {
    expect(
      validateSettings(
        settingsWithWaypoints({
          [field]: value,
        }),
      ),
    ).toBe(false);
  });

  it.each([
    ['nearDistanceMeters', 0],
    ['nearDistanceMeters', Number.NaN],
    ['farDistanceMeters', 0],
    ['farDistanceMeters', Number.POSITIVE_INFINITY],
    ['minScale', 0],
    ['minScale', 1.0001],
    ['minScale', Number.NaN],
    ['hideBeyondMeters', 0],
    ['hideBeyondMeters', Number.POSITIVE_INFINITY],
  ] as const)(
    'rejects an invalid label distance scaling %s: %s',
    (field, value) => {
      expect(
        validateSettings(settingsWithDistanceScaling({ [field]: value })),
      ).toBe(false);
    },
  );

  it('rejects label distance scaling with non-increasing thresholds', () => {
    expect(
      validateSettings(
        settingsWithDistanceScaling({
          farDistanceMeters:
            defaultSettings.labels.distanceScaling.nearDistanceMeters,
        }),
      ),
    ).toBe(false);
    expect(
      validateSettings(
        settingsWithDistanceScaling({
          hideBeyondMeters:
            defaultSettings.labels.distanceScaling.farDistanceMeters,
        }),
      ),
    ).toBe(false);
  });

  it('rejects an empty label points array', () => {
    const invalidSettings: AppSettings = {
      ...defaultSettings,
      labels: { ...defaultSettings.labels, points: [] },
    };

    expect(validateSettings(invalidSettings)).toBe(false);
  });

  it.each([
    ['poiId', ''],
    ['displayText', '   '],
  ] as const)('rejects an empty label %s', (field, value) => {
    const invalidSettings: AppSettings = {
      ...defaultSettings,
      labels: {
        ...defaultSettings.labels,
        points: [
          { ...defaultSettings.labels.points[0], [field]: value },
          ...defaultSettings.labels.points.slice(1),
        ],
      },
    };

    expect(validateSettings(invalidSettings)).toBe(false);
  });

  it('rejects duplicate label poiIds', () => {
    const invalidSettings: AppSettings = {
      ...defaultSettings,
      labels: {
        ...defaultSettings.labels,
        points: [
          defaultSettings.labels.points[0],
          {
            ...defaultSettings.labels.points[1],
            poiId: defaultSettings.labels.points[0].poiId,
          },
        ],
      },
    };

    expect(validateSettings(invalidSettings)).toBe(false);
  });

  it.each([0, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects an invalid label height offset: %s',
    (heightOffsetMeters) => {
      const invalidSettings: AppSettings = {
        ...defaultSettings,
        labels: { ...defaultSettings.labels, heightOffsetMeters },
      };

      expect(validateSettings(invalidSettings)).toBe(false);
    },
  );

  it.each([0, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects an invalid occlusion epsilon: %s',
    (epsilonMeters) => {
      const invalidSettings: AppSettings = {
        ...defaultSettings,
        labels: {
          ...defaultSettings.labels,
          occlusion: { ...defaultSettings.labels.occlusion, epsilonMeters },
        },
      };

      expect(validateSettings(invalidSettings)).toBe(false);
    },
  );

  it.each([0, -1, 1.5, Number.POSITIVE_INFINITY])(
    'rejects an invalid occlusion throttle frame count: %s',
    (throttleFrames) => {
      const invalidSettings: AppSettings = {
        ...defaultSettings,
        labels: {
          ...defaultSettings.labels,
          occlusion: { ...defaultSettings.labels.occlusion, throttleFrames },
        },
      };

      expect(validateSettings(invalidSettings)).toBe(false);
    },
  );
});

describe('forest settings validation', () => {
  function settingsWithForest(
    overrides: Partial<NonNullable<AppSettings['visual']['forest']>>,
  ): AppSettings {
    const forest = defaultSettings.visual.forest;
    if (forest === undefined) {
      throw new Error('defaultSettings.visual.forest must be set for this test');
    }

    return {
      ...defaultSettings,
      visual: {
        ...defaultSettings.visual,
        forest: { ...forest, ...overrides },
      },
    };
  }

  it('rejects the required invalid forest configurations', () => {
    const forest = defaultSettings.visual.forest;
    if (forest === undefined) {
      throw new Error('defaultSettings.visual.forest must be set for this test');
    }

    const invalidSettings = [
      settingsWithForest({
        tree: { ...forest.tree, budget: { ...forest.tree.budget, maxInstances: 0 } },
      }),
      settingsWithForest({
        placement: {
          ...forest.placement,
          slopeFalloffStartDeg: forest.placement.slopeZeroDeg,
        },
      }),
      settingsWithForest({
        billboard: { ...forest.billboard, textureSize: 100 },
      }),
      settingsWithForest({
        billboard: { ...forest.billboard, alphaTest: 1 },
      }),
      settingsWithForest({
        placement: { ...forest.placement, jitterRatio: 1.5 },
      }),
      settingsWithForest({
        placement: {
          ...forest.placement,
          maxRouteDistanceMeters:
            forest.placement.corridorCoreHalfWidthMeters +
            forest.placement.corridorFeatherMeters -
            1,
        },
      }),
    ];

    for (const settings of invalidSettings) {
      expect(validateSettings(settings)).toBe(false);
    }
  });
});
