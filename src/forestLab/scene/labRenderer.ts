import * as THREE from 'three';

import { backgroundDefaults } from '../../config/defaults/background';
import { lightingDefaults } from '../../config/defaults/lighting';
import { computeBackgroundGradientCss, computeFogRange } from '../../scene/background';
import { createSceneLights } from '../../scene/lighting';
import {
  CANONICAL_CELL_SIZE_METERS,
  CAPTURE_HEIGHT,
  CAPTURE_PIXEL_RATIO,
  CAPTURE_WIDTH,
  PRIMARY_CAMERA,
} from '../labConstants';

export const LAB_FOG_GRID = {
  cols: 256,
  rows: 256,
  cellSizeMeters: CANONICAL_CELL_SIZE_METERS,
} as const;

export function createLabFog(): THREE.Fog {
  const { color, near, far } = computeFogRange(LAB_FOG_GRID, backgroundDefaults);
  return new THREE.Fog(color, near, far);
}

export function createLabRenderer(
  container: HTMLElement,
  { capture }: { capture: boolean },
): {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  lights: ReturnType<typeof createSceneLights>;
} {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(CAPTURE_PIXEL_RATIO);
  const camera = new THREE.PerspectiveCamera(
    PRIMARY_CAMERA.fov,
    CAPTURE_WIDTH / CAPTURE_HEIGHT,
    PRIMARY_CAMERA.near,
    PRIMARY_CAMERA.far,
  );
  const scene = new THREE.Scene();
  scene.background = null;
  container.style.background = computeBackgroundGradientCss(backgroundDefaults);
  scene.fog = createLabFog();
  const lights = createSceneLights(lightingDefaults);
  scene.add(lights.hemisphere, lights.directional);
  container.appendChild(renderer.domElement);

  if (capture) {
    renderer.domElement.style.width = `${CAPTURE_WIDTH}px`;
    renderer.domElement.style.height = `${CAPTURE_HEIGHT}px`;
    renderer.setSize(CAPTURE_WIDTH, CAPTURE_HEIGHT, false);
  }

  return { renderer, camera, scene, lights };
}
