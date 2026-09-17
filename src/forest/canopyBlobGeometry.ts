import * as THREE from 'three';

import type { ForestCanopyConfig } from '../types';
import { createSeededRandom } from './forestRandom';

/** Creates one normalized, irregular canopy blob with baked vertical ambient shading. */
export function createCanopyBlobGeometry(config: ForestCanopyConfig): THREE.BufferGeometry {
  const source = new THREE.IcosahedronGeometry(1, config.subdivision);
  const sourcePosition = source.getAttribute('position');
  const random = createSeededRandom(0x6c8e9cf5 ^ config.subdivision);
  const positions = new Float32Array(sourcePosition.count * 3);

  for (let index = 0; index < sourcePosition.count; index += 1) {
    const radius = 1 + (random() * 2 - 1) * config.lumpiness;
    const offset = index * 3;
    positions[offset] = sourcePosition.getX(index) * radius;
    // A centered blob is already half below ground, so offset upward to bury only its base; downward buries about 76%.
    positions[offset + 1] = sourcePosition.getY(index) * radius * config.heightRatio + config.sinkRatio;
    positions[offset + 2] = sourcePosition.getZ(index) * radius;
  }
  source.dispose();

  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(positions, 3);
  geometry.setAttribute('position', position);
  geometry.computeBoundingBox();

  const bounds = geometry.boundingBox!;
  const colors = new Float32Array(position.count * 3);
  const canopyColor = new THREE.Color(config.color);
  const height = bounds.max.y - bounds.min.y;
  for (let index = 0; index < position.count; index += 1) {
    const shade = height === 0
      ? 1
      : config.bottomShade + (1 - config.bottomShade) * (
        (position.getY(index) - bounds.min.y) / height
      );
    const offset = index * 3;
    colors[offset] = canopyColor.r * shade;
    colors[offset + 1] = canopyColor.g * shade;
    colors[offset + 2] = canopyColor.b * shade;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}
