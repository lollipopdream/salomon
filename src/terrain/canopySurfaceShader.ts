import { Color, Matrix3, Vector2, type DataTexture, type MeshStandardMaterial } from 'three';
import type { CanopySurfaceParameters, CanopySurfaceVariantId } from '../types';
import type { ExtendedCanopySurfaceParameters } from '../config/defaults/canopySurface';

const TAG = '// CANOPY_SURFACE_V1';
const VERTEX_MARKERS = ['#include <common>', '#include <project_vertex>'];
const FRAGMENT_MARKERS = [
  '#include <common>', '#include <color_fragment>',
  '#include <normal_fragment_maps>', '#include <opaque_fragment>',
];

const COMMON = /* glsl */`
varying vec3 vCsWorld;
varying vec2 vCsUv;
uniform float csMetersPerUnit;
`;
const FRAGMENT = /* glsl */`
uniform float csExposure;
uniform float csSaturation;
uniform float csShadowLift;
uniform float csWarmth;
uniform float csShoulder;
uniform float csToe;
uniform float csDetailStrength;
uniform float csDetailScale;
uniform float csGapContrast;
uniform float csDetailFade;
uniform vec2 csDetailRange;
uniform float csTilePeriod;
uniform float csHaze;
uniform vec2 csHazeRange;
uniform vec3 csHazeColor;
uniform float csPatchStrength;
uniform float csPatchScale;
uniform float csAutumnStrength;
uniform float csWeight;
uniform mat3 csAerialUvTransform;
#if CS_MODE > 0
uniform sampler2D csDetail;
#endif
float csHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float csNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(csHash(i), csHash(i+vec2(1,0)), f.x),
             mix(csHash(i+vec2(0,1)), csHash(i+vec2(1,1)), f.x), f.y);
}
// Distance-based softening (0..1) shared by the normal detail and the gap AO,
// so near and far read as the SAME representation, just fading smoothly
// (reference: localDetail stays ~equal from 500 m to 2 km, then falls off).
float csDetailFadeFactor() {
  float csFadeDistance = length(vViewPosition)*csMetersPerUnit;
  return 1.0 - csDetailFade*smoothstep(csDetailRange.x, csDetailRange.y, csFadeDistance);
}
// Cotangent frame built around the ALREADY DEM-perturbed normal.
// No dependency on USE_NORMALMAP, tangents, or an optional Three.js helper.
vec3 csOverlayNormal(vec3 n, vec2 slopes, vec2 coords) {
  vec3 dp1 = dFdx(-vViewPosition), dp2 = dFdy(-vViewPosition);
  vec2 duv1 = dFdx(coords), duv2 = dFdy(coords);
  vec3 p2 = cross(dp2, n), p1 = cross(n, dp1);
  vec3 t = p2*duv1.x + p1*duv2.x;
  vec3 b = p2*duv1.y + p1*duv2.y;
  float magnitude = max(dot(t,t), dot(b,b));
  float scale = inversesqrt(max(magnitude, 1e-16));
  return normalize(n + (t*slopes.x + b*slopes.y)*scale);
}
vec2 csSlopes(vec4 sampleValue) {
  // Byte 128 is exactly neutral, including mip levels of the detail tile.
  return ((sampleValue.xy*255.0-128.0)/127.0) / max(sampleValue.z*2.0-1.0, 0.3);
}
`;
const DETAIL = /* glsl */`
// Canopy variants must read as matte forest, not wet gravel: cap the
// material's own roughness before lights_physical_fragment accumulates
// specular (roughnessmap_fragment has already run by this injection point,
// but lights_physical_fragment has not, so this still takes effect).
roughnessFactor = clamp(roughnessFactor*0.4 + 0.6, 0.0, 1.0);
#if CS_MODE == 1
  vec2 csPlane = vCsWorld.xz * vec2(1.0, -1.0);
  vec2 csCoord = csPlane / (csTilePeriod*csDetailScale);
  // Incommensurate periods and 37 degree rotation; invert rotation on slopes.
  mat2 csRotation = mat2(0.79863551, 0.60181502, -0.60181502, 0.79863551);
  mat2 csInverseRotation = mat2(0.79863551, -0.60181502, 0.60181502, 0.79863551);
  vec4 csFirst = texture2D(csDetail, csCoord);
  vec4 csSecond = texture2D(csDetail, csRotation*csCoord/1.371 + vec2(0.317, 0.713));
  float csMask = 0.75 + 0.25*csNoise(csPlane/173.0);
  vec2 csSlope = (csSlopes(csFirst)*0.65 + csInverseRotation*csSlopes(csSecond)*0.35/1.371)*csMask;
  normal = csOverlayNormal(normal, csSlope*csDetailStrength*csDetailFadeFactor(), csPlane);
#elif CS_MODE == 2
  vec2 csImageUv = (csAerialUvTransform * vec3(vCsUv, 1.0)).xy;
  vec4 csAerial = texture2D(csDetail, csImageUv);
  normal = csOverlayNormal(normal, csSlopes(csAerial)*csDetailStrength*csWeight*csDetailFadeFactor(), csImageUv);
#endif
`;
const ALBEDO = /* glsl */`
#if CS_MODE == 1
  vec2 csAlbedoPlane = vCsWorld.xz * vec2(1.0, -1.0);
  vec2 csAlbedoUv = csAlbedoPlane / (csTilePeriod*csDetailScale);
  mat2 csAlbedoRotation = mat2(0.79863551, 0.60181502, -0.60181502, 0.79863551);
  // Gap AO: the tile's alpha channel stores a cavity value (0 = deep gap
  // between crowns, 1 = crown top), not an albedo tint. Reference photography
  // shows the canopy's grain is mostly dark inter-crown shadow rather than
  // bright foliage, so darken gaps hard here; csGapContrast=0 is a no-op and
  // csGapContrast=1 makes gaps clearly dark.
  float csCavity = texture2D(csDetail, csAlbedoUv).a*0.65
    + texture2D(csDetail, csAlbedoRotation*csAlbedoUv/1.371+vec2(0.317,0.713)).a*0.35;
  float csGap = csCavity - 1.0; // 0 at crown tops, negative in gaps
  diffuseColor.rgb *= 1.0 + csGap*csGapContrast*csDetailFadeFactor();
  vec2 csPatchUv = csAlbedoPlane/csPatchScale;
  float csStand = csNoise(csPatchUv + 0.65*vec2(csNoise(csPatchUv*0.61), csNoise(csPatchUv*0.61+19.0)));
  // Stand variation stays primarily within forest greens: dark conifer to
  // bright yellow-green deciduous foliage. Autumn is deliberately sparse,
  // muted, and independently controllable.
  vec3 csTint = mix(vec3(0.62,0.88,0.58), vec3(1.12,1.28,0.68), smoothstep(0.18,0.78,csStand));
  float csAutumnMask = smoothstep(0.84,0.97,csNoise(csPatchUv*0.73+vec2(57,13)));
  csTint = mix(csTint,vec3(1.18,1.04,0.64),csAutumnMask*csAutumnStrength);
  diffuseColor.rgb *= mix(vec3(1.0),csTint,csPatchStrength);
#endif
`;
const BASE = /* glsl */`
// Terrain-only correction after lighting, in linear working color space.
float csLuma = dot(outgoingLight,vec3(0.2126,0.7152,0.0722));
vec3 csLit = max(vec3(0.0),mix(vec3(csLuma),outgoingLight,csSaturation))*csExposure;
// Warmth: push the red/blue balance without an extra hue-mapping pass; the
// hue-preserving shoulder below is applied AFTER this, so the warm/cool shift
// survives instead of being washed out by per-channel tonemapping.
// csWarmth: -1 (cool) .. 0 (unchanged) .. +1 (warm, reference's olive canopy).
float csWarmPos = max(csWarmth,0.0), csWarmNeg = max(-csWarmth,0.0);
csLit *= vec3(1.0+csWarmPos*0.28-csWarmNeg*0.10, 1.0+csWarmPos*0.06-csWarmNeg*0.02, 1.0-csWarmPos*0.42+csWarmNeg*0.30);
// Neutral/warm lift (was a saturated blue, which fed the teal cast).
csLit += csShadowLift*vec3(0.85,0.78,0.66)*(1.0-smoothstep(0.0,0.45,csLuma));
// Hue-preserving filmic toe + shoulder. The generalized shoulder approaches
// 1 from below; the toe factor tends to zero at black. Both factors are <= 1,
// so the curve never raises a dark input above its exposed luminance.
float csL = max(dot(csLit,vec3(0.2126,0.7152,0.0722)), 1e-5);
float csShoulderPower = 1.0/max(csShoulder,1e-4);
// Algebraically identical branches keep pow() bases in [0,1]. This avoids
// overflow for bright HDR values when csShoulder is small (power is large).
float csShouldered = csL < 1.0
  ? csL/pow(1.0+pow(csL,csShoulderPower),1.0/csShoulderPower)
  : 1.0/pow(1.0+pow(1.0/csL,csShoulderPower),1.0/csShoulderPower);
float csToeFactor = csL/(csL+max(csToe,0.0));
float csLTonemapped = csShouldered*csToeFactor;
csLit *= csLTonemapped/csL;
float csDistance = length(vViewPosition)*csMetersPerUnit;
float csFog = csHaze*smoothstep(csHazeRange.x,csHazeRange.y,csDistance);
outgoingLight = mix(csLit,csHazeColor,csFog);
`;

/**
 * Pure JS mirror of the BASE glsl chunk's hue-preserving highlight shoulder,
 * for deterministic unit tests (no GPU/WebGL available in this test suite).
 * Keep this in sync with the BASE chunk above.
 */
export function toneMapLuminance(luminance: number, shoulder: number, toe = 0): number {
  if (luminance <= 0) return 0;
  const power = 1/Math.max(shoulder, 1e-4);
  const shouldered = luminance < 1
    ? luminance/(1+luminance**power)**(1/power)
    : 1/(1+(1/luminance)**power)**(1/power);
  return shouldered*(luminance/(luminance+Math.max(toe, 0)));
}

/** Pure JS mirror of the BASE chunk's full hue-preserving shoulder + rescale. */
export function applyHuePreservingShoulder(
  rgb: readonly [number, number, number],
  shoulder: number,
  toe = 0,
): [number, number, number] {
  const luminance = Math.max(0.2126*rgb[0] + 0.7152*rgb[1] + 0.0722*rgb[2], 1e-5);
  const ratio = toneMapLuminance(luminance, shoulder, toe) / luminance;
  return [rgb[0]*ratio, rgb[1]*ratio, rgb[2]*ratio];
}

/** Pure JS mirror of the OLD per-channel Reinhard tonemap this replaces (for
 * A/B comparison in tests only; NOT used by the shader anymore). */
export function applyPerChannelReinhard(rgb: readonly [number, number, number]): [number, number, number] {
  return [rgb[0]/(1+rgb[0]), rgb[1]/(1+rgb[1]), rgb[2]/(1+rgb[2])];
}

/** Pure JS mirror of the BASE chunk's warmth push. See BASE above. */
export function applyWarmth(rgb: readonly [number, number, number], warmth: number): [number, number, number] {
  const warmPos = Math.max(warmth, 0), warmNeg = Math.max(-warmth, 0);
  return [
    rgb[0]*(1+warmPos*0.28-warmNeg*0.10),
    rgb[1]*(1+warmPos*0.06-warmNeg*0.02),
    rgb[2]*(1-warmPos*0.42+warmNeg*0.30),
  ];
}

export interface CanopyShaderSource { vertexShader: string; fragmentShader: string }
export interface CanopyShaderStatus {
  attempted: boolean;
  injected: boolean;
  missingMarkers: string[];
}

/** Atomic pure patch: both stages must match, and neither may be patched twice. */
export function patchCanopySurfaceShader(
  source: CanopyShaderSource,
  variant: CanopySurfaceVariantId,
): CanopyShaderSource & { injected: boolean; missingMarkers: string[] } {
  if (variant === 'off' || source.vertexShader.includes(TAG) || source.fragmentShader.includes(TAG)) {
    return { ...source, injected: false, missingMarkers: [] };
  }
  const missingMarkers = [
    ...VERTEX_MARKERS.filter((marker) => !source.vertexShader.includes(marker)).map((m) => `vertex:${m}`),
    ...FRAGMENT_MARKERS.filter((marker) => !source.fragmentShader.includes(marker)).map((m) => `fragment:${m}`),
  ];
  if (missingMarkers.length) return { ...source, injected: false, missingMarkers };
  const mode = variant === 'a' ? 1 : variant === 'b' ? 2 : 0;
  return {
    injected: true,
    missingMarkers,
    vertexShader: source.vertexShader
      .replace(VERTEX_MARKERS[0], `${VERTEX_MARKERS[0]}\n${TAG}\n${COMMON}`)
      .replace(VERTEX_MARKERS[1], `${VERTEX_MARKERS[1]}\nvCsWorld = (modelMatrix * vec4(transformed,1.0)).xyz * csMetersPerUnit;\nvCsUv = uv;`),
    fragmentShader: source.fragmentShader
      .replace(FRAGMENT_MARKERS[0], `${FRAGMENT_MARKERS[0]}\n${TAG}\n#define CS_MODE ${mode}\n${COMMON}\n${FRAGMENT}`)
      .replace(FRAGMENT_MARKERS[1], `${FRAGMENT_MARKERS[1]}\n${ALBEDO}`)
      .replace(FRAGMENT_MARKERS[2], `${FRAGMENT_MARKERS[2]}\n${DETAIL}`)
      .replace(FRAGMENT_MARKERS[3], `${BASE}\n${FRAGMENT_MARKERS[3]}`),
  };
}

/** Off returns before touching any material field, including the compile hook. */
export function installCanopySurfaceShader(
  material: MeshStandardMaterial,
  variant: CanopySurfaceVariantId,
  p: CanopySurfaceParameters,
  texture?: DataTexture,
  metersPerUnit = 1,
): CanopyShaderStatus {
  const status: CanopyShaderStatus = { attempted: false, injected: false, missingMarkers: [] };
  if (variant === 'off') return status;
  const extended = p as ExtendedCanopySurfaceParameters;
  const previousHook = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey();
  const uvTransform = new Matrix3();
  if (material.map) {
    material.map.updateMatrix();
    uvTransform.copy(material.map.matrix);
  }
  material.onBeforeCompile = (shader, renderer) => {
    previousHook.call(material, shader, renderer);
    const patched = patchCanopySurfaceShader(shader, variant);
    status.attempted = true;
    status.injected = patched.injected;
    status.missingMarkers = patched.missingMarkers;
    if (!patched.injected) return;
    shader.vertexShader = patched.vertexShader;
    shader.fragmentShader = patched.fragmentShader;
    Object.assign(shader.uniforms, {
      csExposure: { value: p.exposure }, csSaturation: { value: p.saturation },
      csShadowLift: { value: p.shadowLift }, csWarmth: { value: p.warmth },
      csShoulder: { value: p.shoulder }, csToe: { value: extended.toe ?? 0.02 },
      csDetailStrength: { value: p.detailStrength },
      csDetailScale: { value: p.detailScale }, csTilePeriod: { value: p.tilePeriodMeters },
      csGapContrast: { value: p.gapContrast }, csDetailFade: { value: p.detailFade },
      csDetailRange: { value: new Vector2(p.detailNearMeters, p.detailFarMeters) },
      csHaze: { value: p.hazeStrength },
      csHazeRange: { value: new Vector2(p.hazeNearMeters, p.hazeFarMeters) },
      csHazeColor: { value: new Color(0x9ebacf) },
      csPatchStrength: { value: p.patchStrength }, csPatchScale: { value: p.patchScaleMeters },
      csAutumnStrength: { value: extended.autumnStrength ?? 0.25 },
      csWeight: { value: p.weight }, csDetail: { value: texture ?? null },
      csMetersPerUnit: { value: metersPerUnit }, csAerialUvTransform: { value: uvTransform },
    });
  };
  material.customProgramCacheKey = () => `${previousKey}|canopy-surface-v1:${variant}`;
  material.needsUpdate = true;
  return status;
}
