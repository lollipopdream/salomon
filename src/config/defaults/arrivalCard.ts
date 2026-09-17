import type { ArrivalCardConfig } from '../../types';

export const arrivalCardDefaults: ArrivalCardConfig = {
  enabled: true,
  position: 'bottom-center',
  // Keeps the card clear of the attribution overlay, which sits at bottom: 8px.
  bottomMarginPx: 40,
  fadeMs: 220,
  slideOffsetPx: 6,
  backgroundColor: 'rgba(6, 8, 6, 0.85)',
  textColor: '#f5f2ea',
  accentColor: 0xffb84d,
};
