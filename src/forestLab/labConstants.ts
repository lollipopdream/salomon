export const CANONICAL_ROWS = 256 as const;
export const CANONICAL_COLS = 256 as const;
export const CANONICAL_CELL_SIZE_METERS = 23.297845093498204 as const;
export const TERRAIN_UV_EXTENT_METERS = 5940.950498842042 as const;
export const MASK_EXTENT_METERS = 5940.950684 as const;
export const MASK_SIZE = 1024 as const;
export const MASK_THRESHOLD = 0.35 as const;
export const PATCH_SIZE_CELLS = 96 as const;
export const SHELL_SUBDIVISION = 16 as const;
export const SHELL_CELL_METERS = 1.4561153183436377 as const;
export const SEED = 20260913 as const;

export const CAP_HEIGHT_WORLD_BY_CONFIG = [
  12.025479830307528,
  10.742664162862843,
  12.60467627119325,
  10.703116125697084,
  11.137908928485405,
  11.422648024821944,
] as const;
export const CANOPY_HEIGHT_METERS = 11.280278476653674 as const;
export const EDGE_TAPER_WIDTH_METERS = 18.7648208974069 as const;

export const CROWN_SPACING_METERS = 6.96419413859206 as const;
export const CROWN_RADIUS_MIN_METERS = 2.180806860129561 as const;
export const CROWN_RADIUS_MEDIAN_METERS = 3.0796529308586367 as const;
export const CROWN_RADIUS_MAX_METERS = 5.626388593927432 as const;
export const CROWN_RELIEF_AMPLITUDE_METERS = 2.322391832997125 as const;
export const CROWN_SMAX_K_METERS = 1.1611959164985626 as const;
export const CANDIDATE_B_BASE_METERS = 10.119082560155111 as const;
export const TREE_HEIGHT_MEDIAN_METERS = 13.602670309650799 as const;

export const DETAIL_SPACING_METERS = 34.742154931237614 as const;
export const DETAIL_TOP_DECILE = 0.10 as const;
export const DETAIL_GROVE_FRACTION = 0.6252645838625011 as const;
export const DETAIL_SCORE_WEIGHTS = {
  ridge: 0.50,
  near: 0.30,
  silhouette: 0.20,
} as const;

export const PRIMARY_CAMERA = {
  position: [3762.40026479884, 742.5773908062001, 2669.094871624622],
  target: [2877.493113404508, 530.0930003429669, 3207.081273813513],
  worldDirection: [-0.8370411408133829, -0.2009907777535002, 0.5088858770332241],
  fov: 45,
  near: 0.1,
  far: 100000,
} as const;

export const OVERVIEW_CAMERA = {
  position: [4891.096657075987, 1978.5250967097782, 4850.570741825779],
  target: [3391.096657075987, 478.52509670977815, 2950.5707418257794],
  fov: 45,
  near: 0.1,
  far: 100000,
} as const;

export const CAPTURE_WIDTH = 1920 as const;
export const CAPTURE_HEIGHT = 1080 as const;
export const CAPTURE_PIXEL_RATIO = 1 as const;
export const TELEMETRY_WARMUP_FRAMES = 30 as const;
export const TELEMETRY_SAMPLE_FRAMES = 300 as const;

export function smoothstep01(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}
