import { computeRouteFollowSpotExtraMs } from '../animation/progress';
import { computeRouteFollowStartMs } from '../camera/cameraTimeline';
import type { AppSettings, ForestConfig, TerrainSurfaceConfig } from '../types';
import { arrivalCardDefaults } from './defaults/arrivalCard';
import { backgroundDefaults } from './defaults/background';
import { routeFollowDefaults } from './defaults/cameraFollow';
import { cameraGuidanceDefaults } from './defaults/cameraGuidance';
import { cinematicRailDefaults } from './defaults/cameraRail';
import {
  highOverviewCameraDefaults,
  overviewCameraDefaults,
} from './defaults/cameraOverview';
import { summitCameraDefaults } from './defaults/cameraSummit';
import {
  ROUTE_FOLLOW_BASE_TRAVEL_MS,
  routeFollowSpotsDefaults,
} from './defaults/cameraSpotHold';
import { cameraTimelineDefaults } from './defaults/cameraTiming';
import { forestDefaults } from './defaults/forest';
import { labelDefaults, waypointDefaults } from './defaults/labels';
import { lightingDefaults } from './defaults/lighting';
import {
  routeHeadMarkerDefaults,
  routeVisualDefaults,
} from './defaults/route';
import { terrainSurfaceDefaults } from './defaults/terrainSurface';
import { terrainMaterialDefaults } from './defaults/terrainVisual';

const routeFollowStartMs = computeRouteFollowStartMs(cameraTimelineDefaults);
const routeFollowSpotExtraMs = computeRouteFollowSpotExtraMs(
  routeFollowSpotsDefaults.events,
);

export const defaultSettings: AppSettings = {
  resolutionWidth: 1920,
  resolutionHeight: 1080,
  loopDurationSec: 25,
  terrainOrigin: { lat: 35.6255, lng: 139.2432 },
  elevationScale: 1.0,
  metersPerUnit: 1.0,
  routeAnimation: {
    // pre-route 4 phase、base route-follow、各POIイベントの正味追加時間を合計する。
    playDurationMs:
      routeFollowStartMs + ROUTE_FOLLOW_BASE_TRAVEL_MS + routeFollowSpotExtraMs,
    // CR7-T3: 終端4遷移(transitionToSummitMs+summitHoldMs+returnToOverviewMs+ascendToHighOverviewMs)
    // の合計5800msと厳密に一致させる(validateSettingsの<=制約は境界〈等号〉を許容する)。
    // これによりcycleDurationMs(playDurationMs+holdAtEndMs)と
    // 実際の最終phase終了時刻が一致し、「ループ末尾にギャップがない」という不変条件を維持する。
    holdAtEndMs: 5_800,
  },
  visual: {
    route: routeVisualDefaults,
    routeHeadMarker: routeHeadMarkerDefaults,
    terrain: terrainMaterialDefaults,
    terrainSurface: terrainSurfaceDefaults,
    lighting: lightingDefaults,
    background: backgroundDefaults,
    waypoints: waypointDefaults,
    arrivalCard: arrivalCardDefaults,
    forest: forestDefaults,
  },
  cameraState: {
    timeline: cameraTimelineDefaults,
    follow: routeFollowDefaults,
    routeFollowSpots: routeFollowSpotsDefaults,
    guidance: cameraGuidanceDefaults,
    rail: cinematicRailDefaults,
    summit: summitCameraDefaults,
    highOverview: highOverviewCameraDefaults,
    overview: overviewCameraDefaults,
  },
  labels: labelDefaults,
};

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isValidHexColor(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 0xffffff;
}

function isValidHexString(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function isUnitInterval(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function isNonNegativeFinite(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function isValidLocalTexturePath(value: string): boolean {
  return value.length > 0 && value.startsWith('/') && !value.includes('://');
}

function isValidTerrainSurfaceConfig(
  terrainSurface: TerrainSurfaceConfig,
): boolean {
  const { hillshade, demNormal, canopy } = terrainSurface;

  return (
    ['baseline', 'c1', 'c2', 'c3', 'c4'].includes(
      terrainSurface.defaultVariant,
    ) &&
    Array.isArray(hillshade.scales) &&
    hillshade.scales.length > 0 &&
    hillshade.scales.every(
      ({ stepPixels, weight }) =>
        Number.isInteger(stepPixels) &&
        isPositiveFinite(stepPixels) &&
        isPositiveFinite(weight),
    ) &&
    isPositiveFinite(hillshade.slopeExaggeration) &&
    isPositiveFinite(hillshade.minFactor) &&
    hillshade.minFactor <= 1 &&
    isPositiveFinite(hillshade.maxFactor) &&
    hillshade.maxFactor >= 1 &&
    hillshade.maxFactor > hillshade.minFactor &&
    Number.isInteger(demNormal.coarseStepPixels) &&
    isPositiveFinite(demNormal.coarseStepPixels) &&
    isNonNegativeFinite(demNormal.strength) &&
    [768, 1536, 3072].includes(canopy.resolution) &&
    Number.isInteger(canopy.blurRadiusTexels) &&
    isNonNegativeFinite(canopy.blurRadiusTexels) &&
    isNonNegativeFinite(canopy.heightScale) &&
    isUnitInterval(canopy.weight) &&
    Number.isInteger(terrainSurface.normalMapResolution) &&
    isPositiveFinite(terrainSurface.normalMapResolution) &&
    isNonNegativeFinite(terrainSurface.normalScale)
  );
}

function isValidForestConfig(forest: ForestConfig): boolean {
  const { placement, tree, billboard, canopy } = forest;
  const budgets = [tree.budget, billboard.budget, canopy.budget];

  return (
    ['none', 'instanced', 'billboard', 'canopy'].includes(
      forest.defaultVariant,
    ) &&
    Number.isInteger(placement.seed) &&
    isUnitInterval(placement.jitterRatio) &&
    isPositiveFinite(placement.corridorCoreHalfWidthMeters) &&
    isPositiveFinite(placement.corridorFeatherMeters) &&
    isNonNegativeFinite(placement.routeClearanceMeters) &&
    isPositiveFinite(placement.slopeFalloffStartDeg) &&
    isPositiveFinite(placement.slopeZeroDeg) &&
    placement.slopeFalloffStartDeg < placement.slopeZeroDeg &&
    placement.slopeZeroDeg <= 90 &&
    isPositiveFinite(placement.distanceFieldCellMeters) &&
    isNonNegativeFinite(placement.maxRouteDistanceMeters) &&
    placement.maxRouteDistanceMeters >=
      placement.corridorCoreHalfWidthMeters + placement.corridorFeatherMeters &&
    budgets.every(
      ({ spacingMeters, maxInstances }) =>
        isPositiveFinite(spacingMeters) &&
        Number.isInteger(maxInstances) &&
        maxInstances > 0,
    ) &&
    isPositiveFinite(tree.minHeightMeters) &&
    isPositiveFinite(tree.maxHeightMeters) &&
    tree.minHeightMeters < tree.maxHeightMeters &&
    isUnitInterval(tree.crownRadiusRatio) &&
    isUnitInterval(tree.crownBaseRatio) &&
    Number.isInteger(tree.crownRadialSegments) &&
    tree.crownRadialSegments >= 3 &&
    Number.isInteger(tree.crownHeightSegments) &&
    tree.crownHeightSegments >= 1 &&
    isUnitInterval(tree.trunkRadiusRatio) &&
    isValidHexColor(tree.crownColor) &&
    isValidHexColor(tree.trunkColor) &&
    isUnitInterval(tree.crownBottomShade) &&
    isUnitInterval(tree.colorJitterStrength) &&
    isPositiveFinite(billboard.minHeightMeters) &&
    isPositiveFinite(billboard.maxHeightMeters) &&
    billboard.minHeightMeters < billboard.maxHeightMeters &&
    isUnitInterval(billboard.aspectRatio) &&
    Number.isInteger(billboard.crossQuadCount) &&
    billboard.crossQuadCount >= 1 &&
    typeof billboard.topCardEnabled === 'boolean' &&
    isUnitInterval(billboard.topCardHeightRatio) &&
    isUnitInterval(billboard.topCardSizeRatio) &&
    Number.isInteger(billboard.textureSize) &&
    billboard.textureSize >= 32 &&
    billboard.textureSize <= 512 &&
    (billboard.textureSize & (billboard.textureSize - 1)) === 0 &&
    Number.isInteger(billboard.textureSeed) &&
    isPositiveFinite(billboard.alphaTest) &&
    billboard.alphaTest < 1 &&
    isValidHexColor(billboard.tintColor) &&
    isUnitInterval(billboard.colorJitterStrength) &&
    isPositiveFinite(canopy.minRadiusMeters) &&
    isPositiveFinite(canopy.maxRadiusMeters) &&
    canopy.minRadiusMeters < canopy.maxRadiusMeters &&
    isUnitInterval(canopy.heightRatio) &&
    isUnitInterval(canopy.sinkRatio) &&
    isUnitInterval(canopy.lumpiness) &&
    Number.isInteger(canopy.subdivision) &&
    canopy.subdivision >= 0 &&
    canopy.subdivision <= 2 &&
    isValidHexColor(canopy.color) &&
    isUnitInterval(canopy.bottomShade) &&
    isUnitInterval(canopy.colorJitterStrength)
  );
}

export function validateSettings(settings: AppSettings): boolean {
  const { lat, lng } = settings.terrainOrigin;
  const {
    route,
    routeHeadMarker,
    terrain,
    lighting,
    background,
    waypoints,
  } = settings.visual;
  const { directionalPosition } = lighting;
  const { edgeFade } = terrain;
  const { directionCue } = routeHeadMarker;
  const { distanceScaling } = settings.labels;
  const { highOverview, rail } = settings.cameraState;

  return (
    Number.isInteger(settings.resolutionWidth) &&
    isPositiveFinite(settings.resolutionWidth) &&
    Number.isInteger(settings.resolutionHeight) &&
    isPositiveFinite(settings.resolutionHeight) &&
    isPositiveFinite(settings.loopDurationSec) &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180 &&
    isPositiveFinite(settings.elevationScale) &&
    isPositiveFinite(settings.metersPerUnit) &&
    isPositiveFinite(settings.routeAnimation.playDurationMs) &&
    isPositiveFinite(settings.routeAnimation.holdAtEndMs) &&
    isValidHexColor(route.baseLayer.color) &&
    Number.isFinite(route.baseLayer.opacity) &&
    route.baseLayer.opacity > 0 &&
    route.baseLayer.opacity <= 1 &&
    isPositiveFinite(route.baseLayer.widthPx) &&
    isValidHexColor(route.coreColor) &&
    isPositiveFinite(route.coreWidthPx) &&
    route.haloLayers.every(
      (layer) =>
        isPositiveFinite(layer.widthPx) &&
        Number.isFinite(layer.opacity) &&
        layer.opacity > 0 &&
        layer.opacity <= 1 &&
        isValidHexColor(layer.color),
    ) &&
    typeof routeHeadMarker.enabled === 'boolean' &&
    isPositiveFinite(routeHeadMarker.radiusMeters) &&
    isValidHexColor(routeHeadMarker.color) &&
    isPositiveFinite(routeHeadMarker.glowRadiusMeters) &&
    routeHeadMarker.glowRadiusMeters > routeHeadMarker.radiusMeters &&
    Number.isFinite(routeHeadMarker.glowOpacity) &&
    routeHeadMarker.glowOpacity > 0 &&
    routeHeadMarker.glowOpacity <= 1 &&
    Number.isInteger(directionCue.dashCount) &&
    directionCue.dashCount >= 2 &&
    directionCue.dashCount <= 4 &&
    isPositiveFinite(directionCue.spacingMeters) &&
    isPositiveFinite(directionCue.radiusMeters) &&
    directionCue.radiusMeters < routeHeadMarker.radiusMeters &&
    isUnitInterval(directionCue.minOpacity) &&
    isUnitInterval(directionCue.maxOpacity) &&
    directionCue.maxOpacity > directionCue.minOpacity &&
    isPositiveFinite(directionCue.pulsePeriodMs) &&
    isPositiveFinite(directionCue.phaseStep) &&
    directionCue.phaseStep < 1 &&
    isValidHexColor(terrain.lowElevationColor) &&
    isValidHexColor(terrain.highElevationColor) &&
    isUnitInterval(terrain.roughness) &&
    isUnitInterval(terrain.metalness) &&
    Number.isFinite(terrain.hillshadeMinFactor) &&
    terrain.hillshadeMinFactor > 0 &&
    Number.isFinite(terrain.hillshadeMaxFactor) &&
    terrain.hillshadeMaxFactor > terrain.hillshadeMinFactor &&
    (edgeFade === undefined ||
      (typeof edgeFade.enabled === 'boolean' &&
        Number.isFinite(edgeFade.fadeStartFactor) &&
        edgeFade.fadeStartFactor > 0 &&
        edgeFade.fadeStartFactor <= 1 &&
        isValidHexColor(edgeFade.fadeColor))) &&
    (terrain.textureUrl === undefined ||
      (isValidLocalTexturePath(terrain.textureUrl) &&
        (terrain.textureRepeat === undefined ||
          (isPositiveFinite(terrain.textureRepeat.x) &&
            isPositiveFinite(terrain.textureRepeat.y))))) &&
    (settings.visual.terrainSurface === undefined ||
      isValidTerrainSurfaceConfig(settings.visual.terrainSurface)) &&
    (settings.visual.forest === undefined ||
      isValidForestConfig(settings.visual.forest)) &&
    isValidHexColor(lighting.hemisphereSkyColor) &&
    isValidHexColor(lighting.hemisphereGroundColor) &&
    isNonNegativeFinite(lighting.hemisphereIntensity) &&
    isValidHexColor(lighting.directionalColor) &&
    isNonNegativeFinite(lighting.directionalIntensity) &&
    Number.isFinite(directionalPosition.x) &&
    Number.isFinite(directionalPosition.y) &&
    Number.isFinite(directionalPosition.z) &&
    isValidHexString(background.gradientTopColor) &&
    isValidHexString(background.gradientBottomColor) &&
    isValidHexColor(background.fogColor) &&
    isPositiveFinite(background.fogNearFactor) &&
    isPositiveFinite(background.fogFarFactor) &&
    background.fogFarFactor > background.fogNearFactor &&
    (background.gradientMidColor === undefined ||
      isValidHexString(background.gradientMidColor)) &&
    (background.gradientMidStopPercent === undefined ||
      (Number.isFinite(background.gradientMidStopPercent) &&
        background.gradientMidStopPercent > 0 &&
        background.gradientMidStopPercent < 100)) &&
    (background.fogMode === undefined ||
      background.fogMode === 'linear' ||
      background.fogMode === 'exp2') &&
    (background.fogDensityFactor === undefined ||
      isPositiveFinite(background.fogDensityFactor)) &&
    typeof waypoints.enabled === 'boolean' &&
    (waypoints.style === 'pin-stand' || waypoints.style === 'anchor-box') &&
    isPositiveFinite(waypoints.headRadiusMeters) &&
    isPositiveFinite(waypoints.standHeightMeters) &&
    isValidHexColor(waypoints.color) &&
    isPositiveFinite(settings.cameraState.timeline.highOverviewHoldMs) &&
    isPositiveFinite(settings.cameraState.timeline.descendToOverviewMs) &&
    isPositiveFinite(settings.cameraState.timeline.overviewHoldMs) &&
    isPositiveFinite(settings.cameraState.timeline.transitionInMs) &&
    isPositiveFinite(settings.cameraState.timeline.transitionToSummitMs) &&
    isPositiveFinite(settings.cameraState.timeline.summitHoldMs) &&
    isPositiveFinite(settings.cameraState.timeline.returnToOverviewMs) &&
    isPositiveFinite(settings.cameraState.timeline.ascendToHighOverviewMs) &&
    isPositiveFinite(settings.cameraState.timeline.arcLiftMeters) &&
    settings.cameraState.timeline.highOverviewHoldMs +
      settings.cameraState.timeline.descendToOverviewMs +
      settings.cameraState.timeline.overviewHoldMs +
      settings.cameraState.timeline.transitionInMs <
      settings.routeAnimation.playDurationMs &&
    settings.cameraState.timeline.transitionToSummitMs +
      settings.cameraState.timeline.summitHoldMs +
      settings.cameraState.timeline.returnToOverviewMs +
      settings.cameraState.timeline.ascendToHighOverviewMs <=
      settings.routeAnimation.holdAtEndMs &&
    Number.isFinite(settings.cameraState.follow.behindMeters) &&
    settings.cameraState.follow.behindMeters > 0 &&
    Number.isFinite(settings.cameraState.follow.heightMeters) &&
    settings.cameraState.follow.heightMeters > 0 &&
    Number.isFinite(
      settings.cameraState.follow.directionSampleDeltaProgress,
    ) &&
    settings.cameraState.follow.directionSampleDeltaProgress > 0 &&
    settings.cameraState.follow.directionSampleDeltaProgress <= 1 &&
    Number.isFinite(settings.cameraState.follow.headingSmoothingProgress) &&
    settings.cameraState.follow.headingSmoothingProgress > 0 &&
    settings.cameraState.follow.headingSmoothingProgress <= 1 &&
    Number.isFinite(settings.cameraState.follow.headingLagProgress) &&
    settings.cameraState.follow.headingLagProgress > 0 &&
    settings.cameraState.follow.headingLagProgress <= 1 &&
    Number.isFinite(settings.cameraState.follow.lateralOffsetMeters) &&
    settings.cameraState.follow.lateralOffsetMeters > 0 &&
    Number.isFinite(settings.cameraState.follow.lookAheadProgress) &&
    settings.cameraState.follow.lookAheadProgress > 0 &&
    settings.cameraState.follow.lookAheadProgress <= 1 &&
    Number.isFinite(settings.cameraState.follow.targetLiftMeters) &&
    isPositiveFinite(
      settings.cameraState.guidance.resampleSpacingMeters,
    ) &&
    isPositiveFinite(
      settings.cameraState.guidance.smoothingWindowRadiusMeters,
    ) &&
    isPositiveFinite(settings.cameraState.guidance.maxDeviationMeters) &&
    Array.isArray(rail.keyPoses) &&
    rail.keyPoses.length >= 2 &&
    rail.keyPoses.every(
      (keyPose, index, keyPoses) =>
        isUnitInterval(keyPose.progress) &&
        (index === 0 || keyPose.progress > keyPoses[index - 1].progress) &&
        isPositiveFinite(keyPose.heightMeters) &&
        isPositiveFinite(keyPose.behindMeters) &&
        Number.isFinite(keyPose.lateralOffsetMeters) &&
        isPositiveFinite(keyPose.headingWindowProgress) &&
        keyPose.headingWindowProgress <= 1 &&
        isPositiveFinite(keyPose.lookAheadProgress) &&
        keyPose.lookAheadProgress <= 1 &&
        (keyPose.landmarkPoiId === undefined ||
          keyPose.landmarkPoiId === 'yakuoin' ||
          keyPose.landmarkPoiId === 'summit') &&
        isUnitInterval(keyPose.landmarkWeight) &&
        Number.isFinite(keyPose.targetLiftMeters),
    ) &&
    isPositiveFinite(settings.cameraState.summit.radiusFactor) &&
    isPositiveFinite(settings.cameraState.summit.heightFactor) &&
    isPositiveFinite(highOverview.radiusFactor) &&
    isPositiveFinite(highOverview.heightFactor) &&
    isNonNegativeFinite(highOverview.orbitDegrees) &&
    highOverview.orbitDegrees <= 360 &&
    (highOverview.holdDriftStartRadiusFactor === undefined ||
      isPositiveFinite(highOverview.holdDriftStartRadiusFactor)) &&
    (highOverview.holdDriftStartHeightFactor === undefined ||
      isPositiveFinite(highOverview.holdDriftStartHeightFactor)) &&
    isPositiveFinite(settings.cameraState.overview.radiusFactor) &&
    isPositiveFinite(settings.cameraState.overview.heightFactor) &&
    isPositiveFinite(settings.cameraState.overview.elevationLiftFactor) &&
    settings.labels.points.length > 0 &&
    settings.labels.points.every(
      ({ poiId, displayText }) =>
        poiId.trim().length > 0 && displayText.trim().length > 0,
    ) &&
    new Set(settings.labels.points.map(({ poiId }) => poiId)).size ===
      settings.labels.points.length &&
    isPositiveFinite(settings.labels.heightOffsetMeters) &&
    isPositiveFinite(settings.labels.occlusion.epsilonMeters) &&
    Number.isInteger(settings.labels.occlusion.throttleFrames) &&
    settings.labels.occlusion.throttleFrames > 0 &&
    isPositiveFinite(distanceScaling.nearDistanceMeters) &&
    isPositiveFinite(distanceScaling.farDistanceMeters) &&
    distanceScaling.farDistanceMeters > distanceScaling.nearDistanceMeters &&
    Number.isFinite(distanceScaling.minScale) &&
    distanceScaling.minScale > 0 &&
    distanceScaling.minScale <= 1 &&
    isPositiveFinite(distanceScaling.hideBeyondMeters) &&
    distanceScaling.hideBeyondMeters > distanceScaling.farDistanceMeters
  );
}
