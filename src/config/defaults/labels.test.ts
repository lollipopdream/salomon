import { describe, expect, it } from 'vitest';

import { defaultSettings, validateSettings } from '../settings';
import { labelDefaults, waypointDefaults } from './labels';

// pre-v3 baseline (P3, outputs/motion_specification_v3.md)
const PRE_V3_BASELINE = {
  headRadiusMeters: 15,
  standHeightMeters: 40,
} as const;

describe('waypointDefaults', () => {
  it('reduces headRadiusMeters below the pre-v3 baseline (P3)', () => {
    expect(waypointDefaults.headRadiusMeters).toBeLessThan(
      PRE_V3_BASELINE.headRadiusMeters,
    );
    expect(waypointDefaults.headRadiusMeters).toBeGreaterThan(0);
  });

  it('reduces standHeightMeters below the pre-v3 baseline (P3)', () => {
    expect(waypointDefaults.standHeightMeters).toBeLessThan(
      PRE_V3_BASELINE.standHeightMeters,
    );
    expect(waypointDefaults.standHeightMeters).toBeGreaterThan(0);
  });

  it('keeps validateSettings satisfied with the reduced marker size', () => {
    expect(validateSettings(defaultSettings)).toBe(true);
  });

  it('uses visible, bounded glow and beacon-ring settings', () => {
    expect(waypointDefaults.glow).toMatchObject({
      enabled: true,
      color: 0xffd166,
    });
    expect(waypointDefaults.glow?.radiusFactor).toBeGreaterThan(1);
    expect(waypointDefaults.glow?.opacity).toBeGreaterThan(0);
    expect(waypointDefaults.glow?.opacity).toBeLessThanOrEqual(1);

    expect(waypointDefaults.beaconRing).toMatchObject({
      enabled: true,
      color: 0xffd166,
    });
    expect(waypointDefaults.beaconRing?.innerRadiusFactor).toBeGreaterThan(1);
    expect(waypointDefaults.beaconRing?.outerRadiusFactor).toBeGreaterThan(
      waypointDefaults.beaconRing?.innerRadiusFactor ?? Infinity,
    );
    expect(waypointDefaults.beaconRing?.opacity).toBeGreaterThan(0);
    expect(waypointDefaults.beaconRing?.opacity).toBeLessThanOrEqual(1);
  });

  it('emphasizes selected landmarks with the stronger C2 treatment', () => {
    expect(waypointDefaults.color).toBe(0xffb84d);
    expect(waypointDefaults.glow?.opacity).toBe(0.55);
    expect(waypointDefaults.beaconRing?.opacity).toBe(0.6);
    expect(waypointDefaults.emphasizedPoiIds).toEqual([
      'yakuoin',
      'summit',
      'takaosanguchi_kasumidai',
      'joshinmon',
    ]);
    expect(waypointDefaults.emphasis).toEqual({
      scaleMultiplier: 1.28,
      glowOpacityMultiplier: 1.5,
      beaconOpacityMultiplier: 1.4,
    });
  });
});

describe('labelDefaults', () => {
  it('includes display text for the three new Trail 1 POIs', () => {
    expect(labelDefaults.points).toEqual(
      expect.arrayContaining([
        { poiId: 'takaosanguchi_kasumidai', displayText: '高尾山駅・霞台' },
        { poiId: 'joshinmon', displayText: '浄心門' },
        { poiId: 'otokozaka_onnazaka', displayText: '男坂・女坂分岐' },
      ]),
    );
  });
});
