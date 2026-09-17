import { describe, expect, it } from 'vitest';

import { resolveLabelPerfBypassFlags } from './labelPerfBypass';

const allDisabled = {
  skipRaycast: false,
  skipAppearanceWrite: false,
  skipProjection: false,
};

describe('resolveLabelPerfBypassFlags', () => {
  it('returns all flags false when the query is unspecified', () => {
    expect(resolveLabelPerfBypassFlags(new URLSearchParams(), true)).toEqual(
      allDisabled,
    );
  });

  it('returns all flags false outside development', () => {
    expect(
      resolveLabelPerfBypassFlags(
        new URLSearchParams('labelPerfBypass=no-raycast'),
        false,
      ),
    ).toEqual(allDisabled);
  });

  it.each([
    ['no-raycast', 'skipRaycast'],
    ['no-appearance-write', 'skipAppearanceWrite'],
    ['no-projection', 'skipProjection'],
  ] as const)('enables only %s', (queryValue, enabledFlag) => {
    const flags = resolveLabelPerfBypassFlags(
      new URLSearchParams(`labelPerfBypass=${queryValue}`),
      true,
    );

    expect(flags).toEqual({ ...allDisabled, [enabledFlag]: true });
    expect(Object.values(flags).filter(Boolean)).toHaveLength(1);
  });

  it.each(['', 'no-raycast-extra', 'NO-RAYCAST', 'other'])(
    'returns all flags false for invalid value %j',
    (value) => {
      expect(
        resolveLabelPerfBypassFlags(
          new URLSearchParams(`labelPerfBypass=${value}`),
          true,
        ),
      ).toEqual(allDisabled);
    },
  );

  it('uses only the single value returned by URLSearchParams.get', () => {
    const flags = resolveLabelPerfBypassFlags(
      new URLSearchParams(
        'labelPerfBypass=no-raycast&labelPerfBypass=no-projection',
      ),
      true,
    );

    expect(flags).toEqual({ ...allDisabled, skipRaycast: true });
    expect(Object.values(flags).filter(Boolean)).toHaveLength(1);
  });
});
