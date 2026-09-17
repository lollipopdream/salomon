import { lightingDefaults } from '../config/defaults/lighting';

export interface MacroShadeConfig {
  enabled: boolean;
  sun: { x: number; y: number; z: number };
  ambient: number;
  direct: number;
  valleyWeight: number;
  normalStepMeters: number;
  valleyRadiusMeters: number;
  reliefScaleMeters: number;
  gain: number;
  shadeMin: number;
  shadeMax: number;
}

function normalizeVec3(x: number, y: number, z: number): { x: number; y: number; z: number } {
  const length = Math.sqrt(x * x + y * y + z * z);
  return { x: x / length, y: y / length, z: z / length };
}

const DEFAULT_SUN_DIRECTION = normalizeVec3(
  lightingDefaults.directionalPosition.x,
  lightingDefaults.directionalPosition.y,
  lightingDefaults.directionalPosition.z,
);

export const DEFAULT_MACRO_SHADE_CONFIG: MacroShadeConfig = {
  enabled: false,
  sun: DEFAULT_SUN_DIRECTION,
  ambient: 0.06,
  direct: 0.94,
  valleyWeight: 0.75,
  normalStepMeters: 50,
  valleyRadiusMeters: 260,
  reliefScaleMeters: 90,
  gain: 1.3,
  shadeMin: 0.19,
  shadeMax: 2.5,
};

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const RING_DIRECTION_COUNT = 8;

export function computeRawMacroShade(
  config: MacroShadeConfig,
  terrainYAt: (x: number, z: number) => number,
  x: number,
  z: number,
): number {
  const stepMeters = config.normalStepMeters;
  const hEast = terrainYAt(x + stepMeters, z);
  const hWest = terrainYAt(x - stepMeters, z);
  const hSouth = terrainYAt(x, z + stepMeters);
  const hNorth = terrainYAt(x, z - stepMeters);
  const hCenter = terrainYAt(x, z);

  const dx = finiteOr((hEast - hWest) / (2 * stepMeters), 0);
  const dz = finiteOr((hSouth - hNorth) / (2 * stepMeters), 0);

  const normalLength = Math.sqrt(dx * dx + 1 + dz * dz);
  const nx = finiteOr(-dx / normalLength, 0);
  const ny = finiteOr(1 / normalLength, 1);
  const nz = finiteOr(-dz / normalLength, 0);

  const dot = nx * config.sun.x + ny * config.sun.y + nz * config.sun.z;
  const ndl = finiteOr(Math.max(0, dot), 0);

  let ringSum = 0;
  for (let k = 0; k < RING_DIRECTION_COUNT; k += 1) {
    const angle = (k * 2 * Math.PI) / RING_DIRECTION_COUNT;
    const ringX = x + config.valleyRadiusMeters * Math.cos(angle);
    const ringZ = z + config.valleyRadiusMeters * Math.sin(angle);
    ringSum += finiteOr(terrainYAt(ringX, ringZ), 0);
  }
  const hRef = ringSum / RING_DIRECTION_COUNT;

  const rawRel = (finiteOr(hCenter, 0) - hRef) / config.reliefScaleMeters;
  const rel = finiteOr(clamp(rawRel, -1, 1), 0);

  const raw = (config.ambient + config.direct * ndl) * (1 + config.valleyWeight * rel);
  return finiteOr(raw, 1);
}

export function normalizeMacroShade(
  rawValues: Float32Array | number[],
  config: MacroShadeConfig,
): Float32Array {
  const count = rawValues.length;
  const result = new Float32Array(count);
  if (count === 0) return result;

  let sum = 0;
  for (let i = 0; i < count; i += 1) sum += rawValues[i];
  const mean = sum / count;

  if (!Number.isFinite(mean) || mean === 0) {
    result.fill(1);
    return result;
  }

  const gain = finiteOr(config.gain, 1);
  for (let i = 0; i < count; i += 1) {
    const normalized = finiteOr(rawValues[i] / mean, 1);
    const gained = finiteOr(normalized * gain, 1);
    result[i] = clamp(gained, config.shadeMin, config.shadeMax);
  }
  return result;
}

export function computePlacementMacroShade(
  config: MacroShadeConfig,
  sampleHeight: (x: number, z: number) => number,
  positions: Float32Array,
  count: number,
): Float32Array {
  const rawValues = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    rawValues[index] = computeRawMacroShade(
      config,
      sampleHeight,
      positions[index * 3],
      positions[index * 3 + 2],
    );
  }
  return normalizeMacroShade(rawValues, config);
}
