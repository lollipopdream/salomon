import { describe, expect, it } from 'vitest';

import { computeCumulativeDistances } from './routeProgress';
import { takaoTrail1Route } from './takaoTrail1Route';

describe('takaoTrail1Route', () => {
  it('contains all 256 researched route points', () => {
    expect(takaoTrail1Route.points).toHaveLength(256);
  });

  it('starts at the documented Kiyotaki Station coordinate', () => {
    expect(takaoTrail1Route.points[0].lat).toBeCloseTo(35.6311026, 6);
    expect(takaoTrail1Route.points[0].lng).toBeCloseTo(139.2668989, 6);
  });

  it('ends at the independently verified Mount Takao summit', () => {
    const summit = takaoTrail1Route.points[takaoTrail1Route.points.length - 1];

    expect(summit.lat).toBeCloseTo(35.6252267, 6);
    expect(summit.lng).toBeCloseTo(139.2436878, 6);
  });

  it('is explicitly marked as unofficial', () => {
    expect(takaoTrail1Route.isOfficial).toBe(false);
  });

  it.each(['kiyotaki', 'yakuoin', 'summit'])(
    'contains poiId %s exactly once',
    (poiId) => {
      expect(
        takaoTrail1Route.points.filter((point) => point.poiId === poiId),
      ).toHaveLength(1);
    },
  );

  it('keeps the existing POIs unchanged', () => {
    expect(takaoTrail1Route.points[0]).toMatchObject({
      lat: 35.631103,
      lng: 139.266899,
      label: '清滝駅',
      poiId: 'kiyotaki',
    });
    expect(takaoTrail1Route.points[205]).toMatchObject({
      lat: 35.626142,
      lng: 139.249976,
      label: '薬王院',
      poiId: 'yakuoin',
    });
    expect(takaoTrail1Route.points[takaoTrail1Route.points.length - 1]).toMatchObject({
      lat: 35.625227,
      lng: 139.243688,
      label: '高尾山頂',
      poiId: 'summit',
    });
  });

  it.each([
    [140, 'takaosanguchi_kasumidai', '高尾山駅・霞台', 35.630898, 139.256432],
    [161, 'joshinmon', '浄心門', 35.629887, 139.25317],
    [170, 'otokozaka_onnazaka', '男坂・女坂分岐', 35.62883, 139.251433],
  ])(
    'attaches a POI at index %i with its route coordinate',
    (index, poiId, label, lat, lng) => {
      expect(takaoTrail1Route.points[index]).toEqual({
        lat,
        lng,
        label,
        poiId,
      });
    },
  );

  it('has strictly increasing cumulative distance at every point', () => {
    const cumulativeDistances = computeCumulativeDistances(
      takaoTrail1Route.points.map(({ lat, lng }) => ({
        x: lat,
        y: 0,
        z: lng,
      })),
    );

    for (let index = 1; index < cumulativeDistances.length; index += 1) {
      expect(cumulativeDistances[index]).toBeGreaterThan(
        cumulativeDistances[index - 1],
      );
    }
  });
});
