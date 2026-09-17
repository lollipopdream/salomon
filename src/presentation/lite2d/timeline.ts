export const LITE2D_LOOP_DURATION_MS = 11_000;

export type Lite2DCut = 'hero' | 'ascent' | 'crop';

export interface StageTransform {
  scale: number;
  translateXPercent: number;
  translateYPercent: number;
}

export interface Lite2DFrame {
  cut: Lite2DCut;
  cutElapsedMs: number;
  cutProgress: number;
  routeProgress: number;
  stageTransform: StageTransform;
}

const HERO_END_MS = 3_000;
const ASCENT_END_MS = 8_000;
const ASCENT_DURATION_MS = ASCENT_END_MS - HERO_END_MS;
const CROP_DURATION_MS = LITE2D_LOOP_DURATION_MS - ASCENT_END_MS;

const IDENTITY_STAGE_TRANSFORM: StageTransform = {
  scale: 1,
  translateXPercent: 0,
  translateYPercent: 0,
};

function safeLoopElapsed(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return 0;
  }

  return elapsedMs % LITE2D_LOOP_DURATION_MS;
}

export function computeLite2DFrame(elapsedMs: number): Lite2DFrame {
  const loopElapsedMs = safeLoopElapsed(elapsedMs);

  if (loopElapsedMs < HERO_END_MS) {
    return {
      cut: 'hero',
      cutElapsedMs: loopElapsedMs,
      cutProgress: loopElapsedMs / HERO_END_MS,
      routeProgress: 1,
      stageTransform: { ...IDENTITY_STAGE_TRANSFORM },
    };
  }

  if (loopElapsedMs < ASCENT_END_MS) {
    const cutElapsedMs = loopElapsedMs - HERO_END_MS;
    const cutProgress = cutElapsedMs / ASCENT_DURATION_MS;

    return {
      cut: 'ascent',
      cutElapsedMs,
      cutProgress,
      routeProgress: cutProgress,
      stageTransform: { ...IDENTITY_STAGE_TRANSFORM },
    };
  }

  const cutElapsedMs = loopElapsedMs - ASCENT_END_MS;

  return {
    cut: 'crop',
    cutElapsedMs,
    cutProgress: cutElapsedMs / CROP_DURATION_MS,
    routeProgress: 1,
    stageTransform: { ...IDENTITY_STAGE_TRANSFORM },
  };
}
