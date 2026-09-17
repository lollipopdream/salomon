import { hashIndexTo01 } from '../../forest/forestRandom';
import {
  BRIGHT_BROADLEAF_THRESHOLD,
  DARK_CONIFER_THRESHOLD,
  MACRO_FIELD_OCTAVES_BY_APPEARANCE,
  R2_BRIGHT_BROADLEAF_THRESHOLD,
  R2_DARK_CONIFER_THRESHOLD,
} from './appearanceConstants';
import type { AppearanceId } from './appearanceModel';

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function latticeValue(gx: number, gz: number, octave: number, seed: number): number {
  const index = (
    (gz * 73856093) ^
    (gx * 19349663) ^
    (octave * 83492791)
  ) >>> 0;
  return hashIndexTo01(index, seed);
}

type FieldAppearanceId = Exclude<AppearanceId, 'BASELINE'>;

function sampleOctave(
  x: number,
  z: number,
  seed: number,
  octaveIndex: number,
  appearance: FieldAppearanceId,
): number {
  const octave = MACRO_FIELD_OCTAVES_BY_APPEARANCE[appearance][octaveIndex];
  const radians = octave.rotationDeg * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const rotatedX = x * cos - z * sin + octave.offsetX;
  const rotatedZ = x * sin + z * cos + octave.offsetZ;
  const gridX = rotatedX / octave.wavelengthMeters;
  const gridZ = rotatedZ / octave.wavelengthMeters;
  const gx0 = Math.floor(gridX);
  const gz0 = Math.floor(gridZ);
  const tx = smoothstep(gridX - gx0);
  const tz = smoothstep(gridZ - gz0);
  const v00 = latticeValue(gx0, gz0, octaveIndex, seed);
  const v10 = latticeValue(gx0 + 1, gz0, octaveIndex, seed);
  const v01 = latticeValue(gx0, gz0 + 1, octaveIndex, seed);
  const v11 = latticeValue(gx0 + 1, gz0 + 1, octaveIndex, seed);
  const north = v00 + (v10 - v00) * tx;
  const south = v01 + (v11 - v01) * tx;
  return north + (south - north) * tz;
}

/** R1 full field、R2 color-only full field。既定値は R1 で後方互換。 */
export function sampleMacroField(
  x: number,
  z: number,
  seed: number,
  appearance: FieldAppearanceId = 'R1',
): number {
  let result = 0;
  const octaves = MACRO_FIELD_OCTAVES_BY_APPEARANCE[appearance];
  for (let octaveIndex = 0; octaveIndex < octaves.length; octaveIndex += 1) {
    result += octaves[octaveIndex].weight * sampleOctave(x, z, seed, octaveIndex, appearance);
  }
  return Math.max(0, Math.min(1, result));
}

/** 明示名が必要な呼び出し側用。R2 では design §11.2 の fieldFull を返す。 */
export function sampleMacroFieldFull(x: number, z: number, seed: number, appearance: FieldAppearanceId): number {
  return sampleMacroField(x, z, seed, appearance);
}

/** R2 selection 専用: O0/O1 を 0.78 で再正規化し、O2 には依存しない。 */
export function sampleMacroFieldLow(x: number, z: number, seed: number): number {
  return Math.max(0, Math.min(1, (
    0.48 * sampleOctave(x, z, seed, 0, 'R2')
    + 0.30 * sampleOctave(x, z, seed, 1, 'R2')
  ) / 0.78));
}

export function selectionFamilyAt(
  x: number,
  z: number,
  seed: number,
  appearance: FieldAppearanceId = 'R1',
): 0 | 1 | 2 {
  const field = appearance === 'R2'
    ? sampleMacroFieldLow(x, z, seed)
    : sampleMacroField(x, z, seed, 'R1');
  const darkThreshold = appearance === 'R2' ? R2_DARK_CONIFER_THRESHOLD : DARK_CONIFER_THRESHOLD;
  const brightThreshold = appearance === 'R2'
    ? R2_BRIGHT_BROADLEAF_THRESHOLD
    : BRIGHT_BROADLEAF_THRESHOLD;
  if (field < darkThreshold) return 0;
  if (field < brightThreshold) return 1;
  return 2;
}
