import type { SpotArrivalState } from '../route/spotArrival';
import type { ArrivalCardConfig } from '../types';

export interface ArrivalCardOptions {
  container: HTMLElement;
  config: ArrivalCardConfig;
  poiDisplayTextById: ReadonlyMap<string, string>;
}

export interface ArrivalCardController {
  element: HTMLElement;
  update(states: SpotArrivalState[]): void;
  dispose(): void;
}

export function createArrivalCard(
  options: ArrivalCardOptions,
): ArrivalCardController {
  const { container, config, poiDisplayTextById } = options;
  const element = document.createElement('div');
  const accentColor = config.accentColor.toString(16).padStart(6, '0');

  element.className = 'arrival-card arrival-card--hidden';
  element.style.position = 'fixed';
  element.style.left = '50%';
  element.style.bottom = `${config.bottomMarginPx}px`;
  element.style.transform = (
    `translateX(-50%) translateY(${config.slideOffsetPx}px)`
  );
  element.style.opacity = '0';
  element.style.transition = (
    `opacity ${config.fadeMs}ms ease, transform ${config.fadeMs}ms ease`
  );
  element.style.pointerEvents = 'none';
  element.style.zIndex = '15';
  element.style.background = config.backgroundColor;
  element.style.color = config.textColor;
  element.style.borderTop = `2px solid #${accentColor}`;
  element.style.boxShadow = '0 4px 18px rgba(0, 0, 0, 0.35)';
  element.style.border = '2px solid rgba(255, 184, 77, 0.5)';
  element.style.padding = '10px 24px 11px';
  element.style.borderRadius = '4px';
  element.style.fontFamily = 'sans-serif';
  element.style.fontSize = '20px';
  element.style.fontWeight = '600';
  element.style.letterSpacing = '0.08em';
  element.style.lineHeight = '1.4';
  element.style.textAlign = 'center';
  element.style.whiteSpace = 'nowrap';
  element.style.boxSizing = 'border-box';

  container.appendChild(element);

  let previousVisible = false;
  let previousText = '';

  return {
    element,
    update(states: SpotArrivalState[]): void {
      const state = states.find(
        (candidate) => candidate.isPrimaryActive && (
          candidate.phase === 'arrive'
          || candidate.phase === 'dwell'
          || candidate.phase === 'depart'
        ),
      );
      const visible = state !== undefined;
      const text = state === undefined
        ? ''
        : (poiDisplayTextById.get(state.poiId) ?? state.poiId);
      const opacityValue = state?.phase === 'depart'
        ? state.intensity
        : (visible ? 1 : 0);
      const visibleChanged = visible !== previousVisible;
      const textChanged = text !== previousText;

      if (visibleChanged) {
        element.className = visible
          ? 'arrival-card arrival-card--visible'
          : 'arrival-card arrival-card--hidden';
        element.style.transform = visible
          ? 'translateX(-50%) translateY(0)'
          : `translateX(-50%) translateY(${config.slideOffsetPx}px)`;

        if (state?.phase !== 'depart') {
          element.style.opacity = String(opacityValue);
        }
      }

      if (textChanged) {
        element.textContent = text;
      }

      if (visibleChanged || textChanged) {
        previousVisible = visible;
        previousText = text;
      }

      if (state?.phase === 'depart') {
        element.style.opacity = String(opacityValue);
      }
    },
    dispose(): void {
      element.remove();
    },
  };
}
