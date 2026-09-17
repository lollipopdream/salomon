import { describe, expect, it, beforeEach } from 'vitest';

import { DEFAULT_COVERAGE_FILL_CONFIG } from './coverageFill';
import { DEFAULT_MACRO_SHADE_CONFIG } from './macroShade';
import { getR10Config, parseR10Config, setR10Config } from './r10LabConfig';

describe('parseR10Config', () => {
  it('defaults macroShade.enabled to false when r10light is unspecified', () => {
    const config = parseR10Config(new URLSearchParams(''));
    expect(config.macroShade.enabled).toBe(false);
  });

  it('enables macroShade when r10light=v1', () => {
    const config = parseR10Config(new URLSearchParams('r10light=v1'));
    expect(config.macroShade.enabled).toBe(true);
  });

  it('keeps macroShade disabled for any value other than v1', () => {
    const config = parseR10Config(new URLSearchParams('r10light=v2'));
    expect(config.macroShade.enabled).toBe(false);
  });

  it('falls back to the default sun direction and remaining defaults', () => {
    const config = parseR10Config(new URLSearchParams('r10light=v1'));
    expect(config.macroShade.sun).toEqual(DEFAULT_MACRO_SHADE_CONFIG.sun);
    expect(config.macroShade.ambient).toBe(DEFAULT_MACRO_SHADE_CONFIG.ambient);
    expect(config.macroShade.direct).toBe(DEFAULT_MACRO_SHADE_CONFIG.direct);
    expect(config.macroShade.valleyWeight).toBe(DEFAULT_MACRO_SHADE_CONFIG.valleyWeight);
    expect(config.macroShade.normalStepMeters).toBe(DEFAULT_MACRO_SHADE_CONFIG.normalStepMeters);
    expect(config.macroShade.valleyRadiusMeters).toBe(DEFAULT_MACRO_SHADE_CONFIG.valleyRadiusMeters);
    expect(config.macroShade.reliefScaleMeters).toBe(DEFAULT_MACRO_SHADE_CONFIG.reliefScaleMeters);
    expect(config.macroShade.gain).toBe(DEFAULT_MACRO_SHADE_CONFIG.gain);
    expect(config.macroShade.shadeMin).toBe(DEFAULT_MACRO_SHADE_CONFIG.shadeMin);
    expect(config.macroShade.shadeMax).toBe(DEFAULT_MACRO_SHADE_CONFIG.shadeMax);
  });

  it('applies each numeric override', () => {
    const config = parseR10Config(new URLSearchParams(
      'r10light=v1&r10la=0.7&r10ld=0.5&r10lv=0.3&r10ln=80&r10lr=200&r10lh=100&r10lg=1.3&r10lmin=0.4&r10lmax=1.6',
    ));
    expect(config.macroShade.ambient).toBe(0.7);
    expect(config.macroShade.direct).toBe(0.5);
    expect(config.macroShade.valleyWeight).toBe(0.3);
    expect(config.macroShade.normalStepMeters).toBe(80);
    expect(config.macroShade.valleyRadiusMeters).toBe(200);
    expect(config.macroShade.reliefScaleMeters).toBe(100);
    expect(config.macroShade.gain).toBe(1.3);
    expect(config.macroShade.shadeMin).toBe(0.4);
    expect(config.macroShade.shadeMax).toBe(1.6);
  });

  it('applies the gain override on its own, independent of other overrides', () => {
    const config = parseR10Config(new URLSearchParams('r10light=v1&r10lg=1.8'));
    expect(config.macroShade.gain).toBe(1.8);
    expect(config.macroShade.ambient).toBe(DEFAULT_MACRO_SHADE_CONFIG.ambient);
  });

  it('applies numeric overrides even when r10light is not v1', () => {
    const config = parseR10Config(new URLSearchParams('r10ld=0.5'));
    expect(config.macroShade.enabled).toBe(false);
    expect(config.macroShade.direct).toBe(0.5);
  });

  it.each([
    'r10la',
    'r10ld',
    'r10lv',
    'r10ln',
    'r10lr',
    'r10lh',
    'r10lg',
    'r10lmin',
    'r10lmax',
  ])('throws for a non-numeric %s value', (param) => {
    expect(() => parseR10Config(new URLSearchParams(`r10light=v1&${param}=notanumber`)))
      .toThrow();
  });
});

describe('parseR10Config coverageFill', () => {
  it('defaults coverageFill.enabled to false when r10cov is unspecified', () => {
    const config = parseR10Config(new URLSearchParams(''));
    expect(config.coverageFill.enabled).toBe(false);
    expect(config.coverageFill).toEqual(DEFAULT_COVERAGE_FILL_CONFIG);
  });

  it('enables coverageFill when r10cov=v1', () => {
    const config = parseR10Config(new URLSearchParams('r10cov=v1'));
    expect(config.coverageFill.enabled).toBe(true);
  });

  it('keeps coverageFill disabled for any value other than v1', () => {
    const config = parseR10Config(new URLSearchParams('r10cov=v2'));
    expect(config.coverageFill.enabled).toBe(false);
  });

  it('falls back to the default coverageFill numeric values', () => {
    const config = parseR10Config(new URLSearchParams('r10cov=v1'));
    expect(config.coverageFill.gapRadiusMeters).toBe(DEFAULT_COVERAGE_FILL_CONFIG.gapRadiusMeters);
    expect(config.coverageFill.gapCoverageMax).toBe(DEFAULT_COVERAGE_FILL_CONFIG.gapCoverageMax);
    expect(config.coverageFill.occupancyCellMeters)
      .toBe(DEFAULT_COVERAGE_FILL_CONFIG.occupancyCellMeters);
  });

  it('applies each coverageFill numeric override', () => {
    const config = parseR10Config(new URLSearchParams(
      'r10cov=v1&r10cr=30&r10cc=0.4&r10cs=5',
    ));
    expect(config.coverageFill.gapRadiusMeters).toBe(30);
    expect(config.coverageFill.gapCoverageMax).toBe(0.4);
    expect(config.coverageFill.occupancyCellMeters).toBe(5);
  });

  it('applies coverageFill numeric overrides even when r10cov is not v1', () => {
    const config = parseR10Config(new URLSearchParams('r10cr=15'));
    expect(config.coverageFill.enabled).toBe(false);
    expect(config.coverageFill.gapRadiusMeters).toBe(15);
  });

  it.each(['r10cr', 'r10cc', 'r10cs'])(
    'throws for a non-numeric %s value',
    (param) => {
      expect(() => parseR10Config(new URLSearchParams(`r10cov=v1&${param}=notanumber`)))
        .toThrow();
    },
  );
});

describe('getR10Config / setR10Config', () => {
  beforeEach(() => {
    setR10Config({
      macroShade: DEFAULT_MACRO_SHADE_CONFIG,
      coverageFill: DEFAULT_COVERAGE_FILL_CONFIG,
    });
  });

  it('defaults to disabled macroShade', () => {
    expect(getR10Config().macroShade.enabled).toBe(false);
  });

  it('defaults to disabled coverageFill', () => {
    expect(getR10Config().coverageFill.enabled).toBe(false);
  });

  it('returns whatever was last set', () => {
    const config = parseR10Config(new URLSearchParams('r10light=v1&r10cov=v1'));
    setR10Config(config);
    expect(getR10Config()).toBe(config);
    expect(getR10Config().macroShade.enabled).toBe(true);
    expect(getR10Config().coverageFill.enabled).toBe(true);
  });
});
