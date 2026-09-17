import { describe, expect, it } from 'vitest';

import { arrivalCardDefaults } from './arrivalCard';

describe('arrivalCardDefaults', () => {
  it('keeps a safe margin above the 8px attribution overlay', () => {
    expect(arrivalCardDefaults.bottomMarginPx).toBeGreaterThan(8);
  });

  it('uses subtle transition values without strong zoom or bouncing', () => {
    expect(arrivalCardDefaults.fadeMs).toBeLessThanOrEqual(400);
    expect(arrivalCardDefaults.slideOffsetPx).toBeLessThanOrEqual(16);
  });

  it('places the enabled card at the bottom center', () => {
    expect(arrivalCardDefaults.position).toBe('bottom-center');
    expect(arrivalCardDefaults.enabled).toBe(true);
  });

  it('uses the darker arrival-card surface color', () => {
    expect(arrivalCardDefaults.backgroundColor).toBe('rgba(6, 8, 6, 0.85)');
    expect(arrivalCardDefaults.accentColor).toBe(0xffb84d);
  });
});
