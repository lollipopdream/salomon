import type { LabelConfig, WaypointMarkerConfig } from '../../types';

export const labelDefaults: LabelConfig = {
  points: [
    { poiId: 'kiyotaki', displayText: '清滝駅' },
    { poiId: 'takaosanguchi_kasumidai', displayText: '高尾山駅・霞台' },
    { poiId: 'joshinmon', displayText: '浄心門' },
    { poiId: 'otokozaka_onnazaka', displayText: '男坂・女坂分岐' },
    { poiId: 'yakuoin', displayText: '薬王院' },
    { poiId: 'summit', displayText: '高尾山頂' },
  ],
  heightOffsetMeters: 15,
  occlusion: {
    epsilonMeters: 5,
    throttleFrames: 6,
  },
  distanceScaling: {
    nearDistanceMeters: 1500,
    farDistanceMeters: 6000,
    minScale: 0.5,
    hideBeyondMeters: 9000,
  },
};

export const waypointDefaults: WaypointMarkerConfig = {
  enabled: true,
  style: 'pin-stand',
  headRadiusMeters: 3.5,
  standHeightMeters: 9,
  color: 0xffb84d,
  glow: {
    enabled: true,
    color: 0xffd166,
    radiusFactor: 2.2,
    opacity: 0.55,
  },
  beaconRing: {
    enabled: true,
    color: 0xffd166,
    innerRadiusFactor: 3.0,
    outerRadiusFactor: 4.2,
    opacity: 0.6,
  },
  emphasizedPoiIds: [
    'yakuoin',
    'summit',
    'takaosanguchi_kasumidai',
    'joshinmon',
  ],
  emphasis: {
    scaleMultiplier: 1.28,
    glowOpacityMultiplier: 1.5,
    beaconOpacityMultiplier: 1.4,
  },
};
