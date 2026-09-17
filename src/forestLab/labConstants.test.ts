import { describe, expect, it } from 'vitest';
import {
  CANDIDATE_B_BASE_METERS,
  CANONICAL_CELL_SIZE_METERS,
  CANONICAL_COLS,
  CANONICAL_ROWS,
  CANOPY_HEIGHT_METERS,
  CAPTURE_HEIGHT,
  CAPTURE_PIXEL_RATIO,
  CAPTURE_WIDTH,
  CAP_HEIGHT_WORLD_BY_CONFIG,
  CROWN_RADIUS_MAX_METERS,
  CROWN_RADIUS_MEDIAN_METERS,
  CROWN_RADIUS_MIN_METERS,
  CROWN_RELIEF_AMPLITUDE_METERS,
  CROWN_SMAX_K_METERS,
  CROWN_SPACING_METERS,
  DETAIL_GROVE_FRACTION,
  DETAIL_SCORE_WEIGHTS,
  DETAIL_SPACING_METERS,
  DETAIL_TOP_DECILE,
  EDGE_TAPER_WIDTH_METERS,
  MASK_EXTENT_METERS,
  MASK_SIZE,
  MASK_THRESHOLD,
  OVERVIEW_CAMERA,
  PATCH_SIZE_CELLS,
  PRIMARY_CAMERA,
  SEED,
  SHELL_CELL_METERS,
  SHELL_SUBDIVISION,
  TELEMETRY_SAMPLE_FRAMES,
  TELEMETRY_WARMUP_FRAMES,
  TERRAIN_UV_EXTENT_METERS,
  TREE_HEIGHT_MEDIAN_METERS,
  smoothstep01,
} from './labConstants';

describe('forest lab fixed parameters', () => {
  it('matches every literal in the parameter fix log', () => {
    expect(CANONICAL_ROWS).toBe(256);
    expect(CANONICAL_COLS).toBe(256);
    expect(CANONICAL_CELL_SIZE_METERS).toBe(23.297845093498204);
    expect(TERRAIN_UV_EXTENT_METERS).toBe(5940.950498842042);
    expect(MASK_EXTENT_METERS).toBe(5940.950684);
    expect(MASK_SIZE).toBe(1024);
    expect(MASK_THRESHOLD).toBe(0.35);
    expect(PATCH_SIZE_CELLS).toBe(96);
    expect(SHELL_SUBDIVISION).toBe(16);
    expect(SHELL_CELL_METERS).toBe(1.4561153183436377);
    expect(SEED).toBe(20260913);
    expect(CAP_HEIGHT_WORLD_BY_CONFIG).toEqual([
      12.025479830307528,
      10.742664162862843,
      12.60467627119325,
      10.703116125697084,
      11.137908928485405,
      11.422648024821944,
    ]);
    expect(CANOPY_HEIGHT_METERS).toBe(11.280278476653674);
    expect(EDGE_TAPER_WIDTH_METERS).toBe(18.7648208974069);
    expect(CROWN_SPACING_METERS).toBe(6.96419413859206);
    expect(CROWN_RADIUS_MIN_METERS).toBe(2.180806860129561);
    expect(CROWN_RADIUS_MEDIAN_METERS).toBe(3.0796529308586367);
    expect(CROWN_RADIUS_MAX_METERS).toBe(5.626388593927432);
    expect(CROWN_RELIEF_AMPLITUDE_METERS).toBe(2.322391832997125);
    expect(CROWN_SMAX_K_METERS).toBe(1.1611959164985626);
    expect(CANDIDATE_B_BASE_METERS).toBe(10.119082560155111);
    expect(TREE_HEIGHT_MEDIAN_METERS).toBe(13.602670309650799);
    expect(DETAIL_SPACING_METERS).toBe(34.742154931237614);
    expect(DETAIL_TOP_DECILE).toBe(0.10);
    expect(DETAIL_GROVE_FRACTION).toBe(0.6252645838625011);
    expect(DETAIL_SCORE_WEIGHTS).toEqual({ ridge: 0.50, near: 0.30, silhouette: 0.20 });
    expect(PRIMARY_CAMERA).toEqual({
      position: [3762.40026479884, 742.5773908062001, 2669.094871624622],
      target: [2877.493113404508, 530.0930003429669, 3207.081273813513],
      worldDirection: [-0.8370411408133829, -0.2009907777535002, 0.5088858770332241],
      fov: 45,
      near: 0.1,
      far: 100000,
    });
    expect(OVERVIEW_CAMERA).toEqual({
      position: [4891.096657075987, 1978.5250967097782, 4850.570741825779],
      target: [3391.096657075987, 478.52509670977815, 2950.5707418257794],
      fov: 45,
      near: 0.1,
      far: 100000,
    });
    expect(CAPTURE_WIDTH).toBe(1920);
    expect(CAPTURE_HEIGHT).toBe(1080);
    expect(CAPTURE_PIXEL_RATIO).toBe(1);
    expect(TELEMETRY_WARMUP_FRAMES).toBe(30);
    expect(TELEMETRY_SAMPLE_FRAMES).toBe(300);
  });

  it('recomputes the canopy median and all derived physical relationships', () => {
    const sorted = [...CAP_HEIGHT_WORLD_BY_CONFIG].sort((a, b) => a - b);
    const median = (sorted[2] + sorted[3]) / 2;
    expect(median).toBe(CANOPY_HEIGHT_METERS);
    expect(CANONICAL_CELL_SIZE_METERS / SHELL_SUBDIVISION).toBe(SHELL_CELL_METERS);
    expect(SHELL_CELL_METERS).toBeLessThanOrEqual(CROWN_RADIUS_MIN_METERS);
    expect(SHELL_CELL_METERS).toBeLessThanOrEqual(CROWN_SPACING_METERS / 2);
    expect(CANOPY_HEIGHT_METERS - CROWN_RELIEF_AMPLITUDE_METERS / 2)
      .toBeCloseTo(CANDIDATE_B_BASE_METERS, 12);
    expect(TREE_HEIGHT_MEDIAN_METERS - CANOPY_HEIGHT_METERS)
      .toBeCloseTo(CROWN_RELIEF_AMPLITUDE_METERS, 12);
  });

  it('implements the shared monotone smoothstep curve', () => {
    expect(smoothstep01(0)).toBe(0);
    expect(smoothstep01(1)).toBe(1);
    expect(smoothstep01(0.5)).toBe(0.5);
    const samples = [-1, 0, 0.25, 0.5, 0.75, 1, 2].map(smoothstep01);
    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index]).toBeGreaterThanOrEqual(samples[index - 1]);
    }
  });
});
