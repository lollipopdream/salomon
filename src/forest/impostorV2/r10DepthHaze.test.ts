import * as THREE from 'three';
import type { WebGLProgramParametersWithUniforms, WebGLRenderer } from 'three';
import { describe, expect, it } from 'vitest';

import {
  applyR10DepthHaze,
  computeHazeBlend,
  R10_DEPTH_HAZE,
} from './r10DepthHaze';

function shader(
  vertexShader = 'void main() {\n#include <project_vertex>\n}',
  fragmentShader = 'void main() {\n#include <tonemapping_fragment>\n}',
): WebGLProgramParametersWithUniforms {
  return { uniforms: {}, vertexShader, fragmentShader } as unknown as WebGLProgramParametersWithUniforms;
}

describe('R10 forest depth haze', () => {
  it('is zero through start, reaches max at end, and grows monotonically between them', () => {
    const config = R10_DEPTH_HAZE;
    expect(computeHazeBlend(config.startMeters - 1, config)).toBe(0);
    expect(computeHazeBlend(config.startMeters, config)).toBe(0);
    expect(computeHazeBlend(config.endMeters, config)).toBe(config.maxBlend);
    expect(computeHazeBlend(config.endMeters + 1, config)).toBe(config.maxBlend);

    const distances = [0, 0.25, 0.5, 0.75, 1]
      .map((t) => config.startMeters + (config.endMeters - config.startMeters) * t);
    const blends = distances.map((distance) => computeHazeBlend(distance, config));
    for (let index = 1; index < blends.length; index += 1) {
      expect(blends[index]).toBeGreaterThan(blends[index - 1]);
    }
  });

  it('does not change any material field when disabled', () => {
    const material = new THREE.MeshBasicMaterial();
    const before = { ...material };
    const compileHook = material.onBeforeCompile;
    const customProgramCacheKey = material.customProgramCacheKey;

    applyR10DepthHaze(material, false);

    expect({ ...material }).toEqual(before);
    expect(material.onBeforeCompile).toBe(compileHook);
    expect(material.customProgramCacheKey).toBe(customProgramCacheKey);
  });

  it('adds all uniforms and patches both shaders when enabled', () => {
    const material = new THREE.MeshBasicMaterial();
    const source = shader();
    applyR10DepthHaze(material, true);

    material.onBeforeCompile(source, {} as WebGLRenderer);

    expect(source.uniforms).toMatchObject({
      r10HazeColor: { value: expect.any(THREE.Color) },
      r10HazeStart: { value: R10_DEPTH_HAZE.startMeters },
      r10HazeEnd: { value: R10_DEPTH_HAZE.endMeters },
      r10HazeMax: { value: R10_DEPTH_HAZE.maxBlend },
    });
    expect(source.vertexShader).toContain('vR10HazeDepth');
    expect(source.fragmentShader).toContain('vR10HazeDepth');
    expect(material.customProgramCacheKey()).toBe('r10haze-v1');
  });

  it.each([
    ['vertex', shader('void main() {}')],
    ['fragment', shader(undefined, 'void main() {}')],
  ])('throws when the %s shader marker is absent', (_stage, source) => {
    const material = new THREE.MeshBasicMaterial();
    applyR10DepthHaze(material, true);
    expect(() => material.onBeforeCompile(source, {} as WebGLRenderer))
      .toThrow(/marker not found/);
  });
});
