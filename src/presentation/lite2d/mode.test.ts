import { describe, expect, it } from 'vitest';
import { resolvePresentationMode } from './mode';

describe('resolvePresentationMode', () => {
  it.each(['?mode=lite', 'mode=lite', '?foo=bar&mode=lite']) (
    'selects lite mode for an exact mode=lite parameter in %s',
    (search) => {
      expect(resolvePresentationMode(search)).toBe('lite');
    },
  );

  it.each([
    '',
    '?',
    '?mode=',
    '?mode=full',
    '?mode=Lite',
    '?mode=lite-extra',
    '?other=lite',
    '?mode=%E0%A4%A',
  ])('safely defaults to full mode for %s', (search) => {
    expect(() => resolvePresentationMode(search)).not.toThrow();
    expect(resolvePresentationMode(search)).toBe('full');
  });
});
