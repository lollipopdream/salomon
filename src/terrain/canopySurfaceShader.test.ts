import { describe, expect, it, vi } from 'vitest';
import {
  DataTexture, MeshStandardMaterial, ShaderLib, Texture,
  type WebGLProgramParametersWithUniforms, type WebGLRenderer,
} from 'three';
import { canopySurfaceDefaults } from '../config/defaults/canopySurface';
import {
  applyHuePreservingShoulder, applyPerChannelReinhard, applyWarmth,
  installCanopySurfaceShader, patchCanopySurfaceShader, toneMapLuminance,
} from './canopySurfaceShader';

const source = () => ({ vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader });
const params = canopySurfaceDefaults.parameters;

describe('canopy shader atomic injection', () => {
  it.each(['base', 'a', 'b'] as const)('patches installed Three.js standard shader for %s', (variant) => {
    const result = patchCanopySurfaceShader(source(), variant);
    expect(result.injected).toBe(true);
    expect(result.missingMarkers).toEqual([]);
    expect(result.fragmentShader).toContain('outgoingLight = mix(csLit,csHazeColor,csFog);');
    expect(result.fragmentShader).toContain('float csToeFactor = csL/(csL+max(csToe,0.0));');
    expect(result.fragmentShader).toContain('1.0/pow(1.0+pow(1.0/csL,csShoulderPower)');
    expect(result.fragmentShader).toContain('vec3(0.62,0.88,0.58)');
    expect(result.fragmentShader).toContain('vec3(1.12,1.28,0.68)');
    expect(result.fragmentShader).toContain('smoothstep(0.84,0.97');
    expect(result.fragmentShader.indexOf('#include <normal_fragment_maps>')).toBeLessThan(
      result.fragmentShader.indexOf('normal = csOverlayNormal(normal'),
    );
    expect(result.fragmentShader.indexOf('csLit *= csLTonemapped/csL;')).toBeLessThan(result.fragmentShader.indexOf('#include <opaque_fragment>'));
    expect(result.vertexShader).toContain('modelMatrix * vec4(transformed,1.0)');
    expect(result).toEqual(patchCanopySurfaceShader(source(), variant));
  });
  it.each([
    ['vertexShader', '#include <common>'], ['vertexShader', '#include <project_vertex>'],
    ['fragmentShader', '#include <common>'], ['fragmentShader', '#include <color_fragment>'],
    ['fragmentShader', '#include <normal_fragment_maps>'], ['fragmentShader', '#include <opaque_fragment>'],
  ] as const)('missing %s %s preserves BOTH original shaders', (stage, marker) => {
    const input = source();
    input[stage] = input[stage].replace(marker, '');
    const result = patchCanopySurfaceShader(input, 'a');
    expect(result.injected).toBe(false);
    expect(result.missingMarkers).toHaveLength(1);
    expect(result.vertexShader).toBe(input.vertexShader);
    expect(result.fragmentShader).toBe(input.fragmentShader);
  });
  it('does not double inject, even when only one stage is already patched', () => {
    const once = patchCanopySurfaceShader(source(), 'a');
    const twice = patchCanopySurfaceShader(once, 'a');
    expect(twice.vertexShader).toBe(once.vertexShader);
    expect(twice.fragmentShader).toBe(once.fragmentShader);
    const partial = { vertexShader: once.vertexShader, fragmentShader: source().fragmentShader };
    expect(patchCanopySurfaceShader(partial, 'a')).toMatchObject(partial);
  });
  it('off leaves shader sources and ALL material fields untouched', () => {
    expect(patchCanopySurfaceShader(source(), 'off')).toMatchObject({ ...source(), injected: false });
    const material = new MeshStandardMaterial({ normalMap: new DataTexture() });
    const before = { ...material };
    const hook = material.onBeforeCompile, key = material.customProgramCacheKey;
    installCanopySurfaceShader(material, 'off', params);
    expect({ ...material }).toEqual(before);
    expect(material.onBeforeCompile).toBe(hook);
    expect(material.customProgramCacheKey).toBe(key);
  });
  it('preserves DEM map, calls prior hook and reports successful marker matching', () => {
    const normalMap = new DataTexture(), detail = new DataTexture();
    const map = new Texture();
    map.repeat.set(2, 3);
    const material = new MeshStandardMaterial({ normalMap, map });
    const priorHook = vi.fn();
    material.onBeforeCompile = priorHook;
    const status = installCanopySurfaceShader(material, 'b', params, detail);
    expect(status.attempted).toBe(false);
    const shader = { ...source(), uniforms: {} } as unknown as WebGLProgramParametersWithUniforms;
    material.onBeforeCompile(shader, {} as WebGLRenderer);
    expect(priorHook).toHaveBeenCalledOnce();
    expect(status).toEqual({ attempted: true, injected: true, missingMarkers: [] });
    expect(material.normalMap).toBe(normalMap);
    expect(shader.uniforms).toMatchObject({
      csDetail: { value: detail }, csExposure: { value: params.exposure },
      csToe: { value: params.toe }, csAutumnStrength: { value: params.autumnStrength },
    });
    expect(material.customProgramCacheKey()).toContain('canopy-surface-v1:b');
  });
  it('failed compile patch preserves uniform object and reports the missing marker', () => {
    const material = new MeshStandardMaterial();
    const status = installCanopySurfaceShader(material, 'a', params, new DataTexture());
    const uniforms = { existing: { value: 3 } };
    const shader = { vertexShader: 'original', fragmentShader: 'original', uniforms } as unknown as WebGLProgramParametersWithUniforms;
    material.onBeforeCompile(shader, {} as WebGLRenderer);
    expect(shader).toEqual({ vertexShader: 'original', fragmentShader: 'original', uniforms });
    expect(Object.keys(uniforms)).toEqual(['existing']);
    expect(status.attempted).toBe(true);
    expect(status.injected).toBe(false);
    expect(status.missingMarkers.length).toBeGreaterThan(0);
  });
  it('keeps cache keys distinct between base, a, and b', () => {
    const keys = (['base', 'a', 'b'] as const).map((v) => {
      const material = new MeshStandardMaterial();
      installCanopySurfaceShader(material, v, params, new DataTexture());
      return material.customProgramCacheKey();
    });
    expect(new Set(keys).size).toBe(3);
  });
});

describe('BASE tonemap/warmth math (pure JS mirror of the GLSL, no GPU)', () => {
  it('preserves hue across exposure changes, unlike the old per-channel Reinhard', () => {
    // A representative pre-tonemap olive-canopy linear color, in the mid-HDR
    // range where per-channel Reinhard visibly desaturates as it saturates.
    const lit = (exposure: number): [number, number, number] => [0.7*exposure, 0.77*exposure, 0.49*exposure];
    const hueRatio = (rgb: readonly [number, number, number]) => rgb[2]/rgb[1]; // B:G
    const low = applyHuePreservingShoulder(lit(1.0), params.shoulder, params.toe);
    const high = applyHuePreservingShoulder(lit(3.6), params.shoulder, params.toe);
    expect(Math.abs(hueRatio(low)-hueRatio(high))).toBeLessThan(0.01);
    // The old per-channel Reinhard desaturates highlights toward gray as
    // exposure rises: this is the regression the new formula must avoid.
    const oldLow = applyPerChannelReinhard(lit(1.0));
    const oldHigh = applyPerChannelReinhard(lit(3.6));
    expect(Math.abs(hueRatio(oldLow)-hueRatio(oldHigh))).toBeGreaterThan(0.08);
  });
  it('toe + shoulder never exceeds 1 and is monotonically increasing in luminance', () => {
    const samples = [0, 0.0001, 0.001, 0.01, 0.1, 0.5, 1, 5, 20, 1000, 1e6]
      .map((l) => toneMapLuminance(l, params.shoulder, params.toe));
    for (const value of samples) expect(value).toBeLessThan(1);
    for (let i = 1; i < samples.length; i++) expect(samples[i]).toBeGreaterThan(samples[i-1]);
    expect(toneMapLuminance(1e12, params.shoulder, params.toe)).toBeGreaterThan(0.999999);
  });
  it('stays finite and monotonic at the strongest shoulder setting for extreme HDR inputs', () => {
    const samples = [1, 10, 100, 1e6, 1e20, Number.MAX_VALUE]
      .map((l) => toneMapLuminance(l, 0.04, params.toe));
    for (const value of samples) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeLessThanOrEqual(1);
    }
    for (let i = 1; i < samples.length; i++) expect(samples[i]).toBeGreaterThanOrEqual(samples[i-1]);
  });
  it('does not lift black or dark luminance above its input', () => {
    for (const luminance of [0, 1e-6, 1e-5, 1e-4, 0.001, 0.01, 0.05, 0.1]) {
      const output = toneMapLuminance(luminance, params.shoulder, params.toe);
      expect(output).toBeLessThanOrEqual(luminance);
      if (luminance > 0) expect(output/luminance).toBeLessThanOrEqual(1);
    }
    expect(toneMapLuminance(1e-9, params.shoulder, params.toe)/1e-9).toBeLessThan(1e-5);
  });
  it('a smaller shoulder compresses (saturates) highlights sooner, at the same luminance', () => {
    const luminance = 2.5;
    expect(toneMapLuminance(luminance, 0.04)).toBeGreaterThan(toneMapLuminance(luminance, 0.5));
  });
  it('does not blow out a bright, distant-terrain-like luminance at the new exposure default', () => {
    // Regression guard for the documented S5 failure (see candidate-log.md
    // "追加2"): a single global exposure=2.8 pushed the far composition's
    // luminance to 100.7/255 (~0.395 normalized) with darkFrac 0.002, i.e.
    // fully blown out. With the compensated post-toe default exposure=4.2
    // and the hue-preserving toe + shoulder, the RESULT luminance must still be
    // strictly below 1 (never literal white), unlike an unbounded exposure
    // multiply alone. (Individual channels can still slightly exceed 1 for
    // strongly blue-shifted colors, since this is a luminance-domain
    // shoulder, not a per-channel clamp -- the GPU's own framebuffer clamp
    // handles that at output, same as any standard tonemap operator.)
    const distantHazyBlue: [number, number, number] = [0.35, 0.42, 0.5]
      .map((c) => c*canopySurfaceDefaults.parameters.exposure) as [number, number, number];
    const result = applyHuePreservingShoulder(
      distantHazyBlue, canopySurfaceDefaults.parameters.shoulder, canopySurfaceDefaults.parameters.toe,
    );
    const luminance = 0.2126*result[0] + 0.7152*result[1] + 0.0722*result[2];
    expect(luminance).toBeLessThan(0.98);
  });
  it('warmth pushes blue down and red/green up when positive, and the reverse when negative', () => {
    const base: [number, number, number] = [50, 55, 55];
    const warm = applyWarmth(base, 0.65);
    const cool = applyWarmth(base, -0.65);
    const neutral = applyWarmth(base, 0);
    expect(neutral).toEqual(base);
    expect(warm[2]).toBeLessThan(base[2]);
    expect(warm[0]).toBeGreaterThan(base[0]);
    expect(cool[2]).toBeGreaterThan(base[2]);
    // Positive warmth should be able to turn a near-neutral color into one
    // where blue is clearly below green, matching the reference's meanRGB.
    expect(warm[2]).toBeLessThan(warm[1]);
  });
});
