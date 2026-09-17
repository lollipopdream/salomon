import { createSeededRandom } from '../forestRandom';
import type { CrownSpritePlacement } from './types';

export interface CrownLayoutOptions {
  spriteCount: number;
  spriteIndexCount: number;
  seed: number;
  baseScale: number;
  scaleJitter: number;
  envelopeExponent: number;
  bottomFraction: number;
  topFraction: number;
  radiusRatio: number;
  rotationJitterRad: number;
  bottomBrightness: number;
  topBrightness: number;
  shape: 'cone' | 'round';
}

export function computeCrownLayout(options: CrownLayoutOptions): CrownSpritePlacement[] {
  if (options.spriteCount <= 0 || options.spriteIndexCount <= 0) return [];

  const random = createSeededRandom(options.seed);
  const placements: CrownSpritePlacement[] = [];
  for (let index = 0; index < options.spriteCount; index += 1) {
    // Exponent < 1 mildly favours the middle/apex without collapsing the base.
    const t = Math.pow(random(), 0.78);
    const bandRadius = options.shape === 'cone'
      ? options.radiusRatio * Math.pow(1 - t, options.envelopeExponent)
      : options.radiusRatio * Math.pow(
        Math.sin(Math.PI * (0.12 + 0.88 * t)),
        options.envelopeExponent,
      );
    const radius = bandRadius * (0.88 + random() * 0.24);
    const centerX = clamp01(0.5 + radius * (2 * random() - 1));
    const centerY = clamp01(
      1 - (options.bottomFraction + t * (options.topFraction - options.bottomFraction)),
    );
    const scaleJitter = 1 + (2 * random() - 1) * options.scaleJitter;
    const coneScale = options.shape === 'cone' ? 0.55 + 0.45 * (1 - t) : 1;
    const scale = Math.max(0, options.baseScale * scaleJitter * coneScale);
    const rotationRad = (2 * random() - 1) * options.rotationJitterRad;
    const mirrored = random() < 0.5;
    const brightnessBase = options.bottomBrightness
      + (options.topBrightness - options.bottomBrightness) * smoothstep(t);
    const brightness = clamp(brightnessBase + (random() - 0.5) * 0.08, 0.15, 1.15);
    const spriteIndex = Math.min(
      options.spriteIndexCount - 1,
      Math.floor(random() * options.spriteIndexCount),
    );

    placements.push({
      spriteIndex,
      centerX,
      centerY,
      scale,
      rotationRad,
      mirrored,
      brightness,
      depth: t,
    });
  }

  placements.sort((left, right) => left.depth - right.depth);
  return placements;
}

function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
