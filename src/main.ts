import { defaultSettings, validateSettings } from './config/settings';
import { resolvePresentationMode } from './presentation/lite2d/mode';
import { mountAttributionOverlay } from './scene/attribution';
import { setupScene } from './scene/sceneSetup';

const container = document.getElementById('app');
const mode = resolvePresentationMode(window.location.search);

if (!container) {
  console.error('Scene container #app was not found.');
} else if (!validateSettings(defaultSettings)) {
  console.error('The application settings are invalid.');
} else {
  void setupScene(container, defaultSettings, mode).catch((error: unknown) => {
    console.error('Failed to set up the mountain scene.', error);
  });
}

// The GSI attribution applies to Full's DEM/aerial-photo terrain; Lite's
// fixed background is a separately-sourced generated illustration, not GSI
// data, so the GSI credit line would be inaccurate there.
if (mode === 'full') {
  mountAttributionOverlay(document.body);
}
