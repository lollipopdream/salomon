import {
  DataTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace,
  RepeatWrapping, RGBAFormat, UnsignedByteType,
  type MeshStandardMaterial, type Texture,
} from 'three';
import type { CanopySurfaceParameters } from '../types';
import type { ExtendedCanopySurfaceParameters } from '../config/defaults/canopySurface';
import { extractTextureLuminance } from './aerialLuminance';
import { computeCanopyDetailNormalField } from './canopyDetailNormal';
import { createNormalMapDataTexture, encodeTangentNormalFieldToRgba } from './normalFieldTexture';
import { installCanopySurfaceShader, type CanopyShaderStatus } from './canopySurfaceShader';
import type { CanopySurfaceSelection } from './canopySurfaceVariant';

/** Local mulberry32 keeps terrain independent of the object-forest subsystem. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    let value = (state += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth value noise whose integer lattice wraps exactly on both axes. */
function generateToroidalNoise(
  resolution: number,
  cycles: number,
  random: () => number,
): Float32Array {
  const lattice = new Float32Array(cycles*cycles);
  for (let i = 0; i < lattice.length; i++) lattice[i] = random()*2-1;
  const result = new Float32Array(resolution*resolution);
  const wrap = (value: number): number => ((value%cycles)+cycles)%cycles;
  const smooth = (value: number): number => value*value*(3-2*value);
  for (let row = 0; row < resolution; row++) {
    const y = (row+0.5)*cycles/resolution;
    const y0 = Math.floor(y), fy = smooth(y-y0);
    for (let col = 0; col < resolution; col++) {
      const x = (col+0.5)*cycles/resolution;
      const x0 = Math.floor(x), fx = smooth(x-x0);
      const a = lattice[wrap(y0)*cycles+wrap(x0)];
      const b = lattice[wrap(y0)*cycles+wrap(x0+1)];
      const c = lattice[wrap(y0+1)*cycles+wrap(x0)];
      const d = lattice[wrap(y0+1)*cycles+wrap(x0+1)];
      result[row*resolution+col] = (a+(b-a)*fx)*(1-fy)+(c+(d-c)*fx)*fy;
    }
  }
  return result;
}

export interface CanopyTile {
  data: Uint8Array;
  resolution: number;
  periodMeters: number;
  crownCount: number;
}

/** Pure toroidal height field -> tangent RGB normal + gap-AO/cavity A channel.
 * Random continuous crown centers (no placement lattice), elongated/pointed
 * conifer-like crowns sized by crownSizeMeters (diameter) and crownDensity
 * (count multiplier), varying amplitude, and wrap-around splatting,
 * differentiation and local-max cavity extraction.
 * Texels represent cell centers, so first/last rows are adjacent, not duplicates.
 *
 * The A channel is NOT an albedo tint: it is a cavity/AO scalar in [0,1] where
 * ~0 = deep gap between crowns and ~1 = a crown top, derived from the ratio of
 * each texel's height to the tallest nearby crown (a toroidal local-max
 * envelope). The shader uses this to darken gaps, since reference photography
 * shows the canopy's "grain" is made mostly of dark inter-crown shadow, not
 * bright foliage (see reference-analysis.md §5).
 */
export function generateCanopyTile(
  resolution: number,
  periodMeters: number,
  seed: number,
  crownSizeMeters = 5.5,
  crownDensity = 1.3,
  clumpStrength = 0,
  clumpScaleMeters = 48,
): CanopyTile {
  if (!Number.isInteger(resolution) || resolution < 16 || resolution > 1024
    || !Number.isFinite(periodMeters) || periodMeters < 16 || periodMeters > 256
    || !Number.isInteger(seed)
    || !Number.isFinite(crownSizeMeters) || crownSizeMeters <= 0
    || !Number.isFinite(crownDensity) || crownDensity <= 0
    || !Number.isFinite(clumpStrength) || clumpStrength < 0
    || !Number.isFinite(clumpScaleMeters) || clumpScaleMeters < 20 || clumpScaleMeters > 80
  ) throw new RangeError('Invalid canopy tile dimensions or seed.');
  const random = seededRandom(seed);
  const heights = new Float32Array(resolution * resolution);
  const metersPerTexel = periodMeters / resolution;
  const wrap = (index: number): number => ((index % resolution) + resolution) % resolution;
  // crownSizeMeters is a diameter; oversample count so randomly-placed crowns
  // still knit into a near-continuous canopy at density=1, same as before.
  const baseRadiusMeters = crownSizeMeters / 2;
  const crownAreaMeters = Math.PI * baseRadiusMeters * baseRadiusMeters;
  const coverageOversample = 3.4;
  const crownCount = Math.max(1, Math.round(
    (periodMeters * periodMeters / crownAreaMeters) * coverageOversample * crownDensity,
  ));
  for (let crown = 0; crown < crownCount; crown++) {
    const x = random() * resolution, y = random() * resolution;
    // Elongated, randomly-rotated footprint (raised eccentricity vs. previous
    // near-circular crowns) to read as pointed conifer crowns, not pebbles.
    const radiusX = (baseRadiusMeters * (0.55 + random() * 0.9)) / metersPerTexel;
    const flatten = 0.28 + random() * 0.32;
    const radiusY = radiusX * flatten;
    const amplitude = 1.5 + random() * 2.5;
    const angle = random() * Math.PI * 2;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const radius = Math.max(radiusX, radiusY);
    for (let row = Math.floor(y-radius); row <= Math.ceil(y+radius); row++) {
      for (let col = Math.floor(x-radius); col <= Math.ceil(x+radius); col++) {
        const dx = col+0.5-x, dy = row+0.5-y;
        const u = (dx*cos+dy*sin)/radiusX, v = (-dx*sin+dy*cos)/radiusY;
        const r2 = u*u+v*v;
        if (r2 >= 1) continue;
        // Steep, pointed radial falloff (cone-like) rather than a soft dome:
        // shoulders drop fast, so gaps between neighboring crowns stay real
        // dips instead of Math.max blending them into a flat blanket.
        const r = Math.sqrt(r2);
        const height = amplitude * (1-r) ** 1.4;
        const index = wrap(row)*resolution+wrap(col);
        heights[index] = Math.max(heights[index], height);
      }
    }
  }
  // Deepen valleys between crown clusters: a power curve on the normalized
  // height pulls mid/low shoulders further toward zero while crown tops
  // (ratio 1) are unchanged. Pointwise, so periodicity is preserved for free.
  let maxHeight = 0;
  for (const height of heights) if (height > maxHeight) maxHeight = height;
  if (maxHeight > 0) {
    const sharpness = 1.3;
    for (let i = 0; i < heights.length; i++) {
      heights[i] = maxHeight * (heights[i]/maxHeight) ** sharpness;
    }
  }
  // Two coarse, toroidal octaves add stand-scale height changes above the
  // 4-7 m crown layer. Integer cycle counts are the nearest tile-compatible
  // periods to the requested scale (48 m and 24 m at the 96 m default tile).
  // Both value-noise lattices and all subsequent sampling wrap, so the field,
  // its finite-difference normal, and its cavity signal have no edge seam.
  const clumpCycles = Math.max(1, Math.round(periodMeters/clumpScaleMeters));
  const clumpA = generateToroidalNoise(resolution, clumpCycles, random);
  const clumpB = generateToroidalNoise(resolution, clumpCycles*2, random);
  const clumps = new Float32Array(resolution*resolution);
  for (let i = 0; i < heights.length; i++) {
    clumps[i] = Math.max(-1, Math.min(1, clumpA[i]*0.72+clumpB[i]*0.28));
    heights[i] = Math.max(0, heights[i]+clumpStrength*clumps[i]);
  }
  // Toroidal local-max envelope (separable box max, wrap-around) used below
  // to turn absolute height into a relative cavity/AO ratio.
  const windowRadiusTexels = Math.max(1, Math.min(64, Math.floor(resolution/4),
    Math.round((baseRadiusMeters*0.6)/metersPerTexel)));
  const rowEnvelope = new Float32Array(resolution*resolution);
  for (let row = 0; row < resolution; row++) {
    for (let col = 0; col < resolution; col++) {
      let localMax = 0;
      for (let d = -windowRadiusTexels; d <= windowRadiusTexels; d++) {
        const value = heights[row*resolution+wrap(col+d)];
        if (value > localMax) localMax = value;
      }
      rowEnvelope[row*resolution+col] = localMax;
    }
  }
  const envelope = new Float32Array(resolution*resolution);
  for (let col = 0; col < resolution; col++) {
    for (let row = 0; row < resolution; row++) {
      let localMax = 0;
      for (let d = -windowRadiusTexels; d <= windowRadiusTexels; d++) {
        const value = rowEnvelope[wrap(row+d)*resolution+col];
        if (value > localMax) localMax = value;
      }
      envelope[row*resolution+col] = localMax;
    }
  }
  const data = new Uint8Array(resolution*resolution*4);
  for (let row = 0; row < resolution; row++) {
    for (let col = 0; col < resolution; col++) {
      const index = row*resolution+col;
      const nx = -(heights[row*resolution+wrap(col+1)]-heights[row*resolution+wrap(col-1)])/(2*metersPerTexel);
      const ny = -(heights[wrap(row+1)*resolution+col]-heights[wrap(row-1)*resolution+col])/(2*metersPerTexel);
      const inverseLength = 1/Math.hypot(nx,ny,1);
      data[index*4] = Math.round(128+127*nx*inverseLength);
      data[index*4+1] = Math.round(128+127*ny*inverseLength);
      data[index*4+2] = Math.round(127.5+127.5*inverseLength);
      const cavity = envelope[index] > 1e-6 ? heights[index]/envelope[index] : 0;
      // Carry the same coarse stands into gap AO, rather than limiting the
      // large-scale octave to normals. clumpStrength=0 remains an exact no-op.
      const clumpMix = Math.min(1,clumpStrength/1.2);
      const standOcclusion = 1-clumpMix*(0.28*(1-(clumps[index]+1)*0.5));
      data[index*4+3] = Math.round(255*Math.min(1,Math.max(0,cavity*standOcclusion)));
    }
  }
  return { data, resolution, periodMeters, crownCount };
}

export function createCanopyTileTexture(tile: CanopyTile, maxAnisotropy = 1): DataTexture {
  const texture = new DataTexture(tile.data, tile.resolution, tile.resolution, RGBAFormat, UnsignedByteType);
  texture.colorSpace = NoColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.flipY = false;
  texture.anisotropy = Math.min(16, maxAnisotropy);
  texture.needsUpdate = true;
  return texture;
}

/** Pure high-resolution b pipeline, shared with benchmark/unit tests. */
export function generateAerialCanopyRgba(
  luminance: Float32Array,
  extentMeters: number,
  p: CanopySurfaceParameters,
): Uint8ClampedArray {
  const field = computeCanopyDetailNormalField(
    luminance, p.aerialResolution, p.aerialResolution, extentMeters/p.aerialResolution,
    { resolution: p.aerialResolution, blurRadiusTexels: p.blurRadiusTexels,
      heightScale: p.heightScale, weight: p.weight },
  );
  return encodeTangentNormalFieldToRgba(field, { rowOrder: 'bottom-up' });
}

export function textureMipBytes(resolution: number): number {
  let bytes = 0;
  for (let size = resolution; size >= 1; size = Math.floor(size/2)) bytes += size*size*4;
  return bytes;
}

export interface CanopySurfaceRuntime {
  attach(material: MeshStandardMaterial): void;
  summary(): {
    variant: CanopySurfaceSelection['variant'];
    effectiveVariant: CanopySurfaceSelection['variant'];
    parameters: CanopySurfaceParameters;
    textures: { width: number; height: number; bytes: number; gpuBytesWithMipmaps: number }[];
    initTimingsMs: Record<string, number>;
    estimatedPeakCpuBytes: number;
    shader: CanopyShaderStatus;
    fallbackReason: string | null;
  };
}

/** Called once, BEFORE hillshade modifies the aerial image. No frame callbacks. */
export function prepareCanopySurface(
  selection: CanopySurfaceSelection,
  aerial: Texture | undefined,
  extentMeters: number,
  maxAnisotropy = 1,
  metersPerUnit = 1,
): CanopySurfaceRuntime {
  const { variant, parameters: p } = selection;
  const startedAt = performance.now();
  const timings: Record<string, number> = {};
  let texture: DataTexture | undefined;
  let shader: CanopyShaderStatus = { attempted: false, injected: false, missingMarkers: [] };
  let effectiveVariant = variant;
  let fallbackReason: string | null = null;
  let estimatedPeakCpuBytes = 0;
  if (variant === 'a') {
    const start = performance.now();
    const extended = p as ExtendedCanopySurfaceParameters;
    const tile = generateCanopyTile(
      p.tileResolution, p.tilePeriodMeters, p.seed, p.crownSizeMeters, p.crownDensity,
      extended.clumpStrength ?? 1.2, extended.clumpScaleMeters ?? 48,
    );
    timings.tileGeneration = performance.now()-start;
    const uploadStart = performance.now();
    texture = createCanopyTileTexture(tile, maxAnisotropy);
    timings.textureSetup = performance.now()-uploadStart;
    estimatedPeakCpuBytes = p.tileResolution**2*8;
  } else if (variant === 'b') {
    try {
      const start = performance.now();
      const luminance = aerial && extractTextureLuminance(aerial, p.aerialResolution, p.aerialResolution);
      timings.luminanceExtraction = performance.now()-start;
      if (luminance === undefined) throw new Error('Aerial luminance unavailable');
      const normalStart = performance.now();
      const rgba = generateAerialCanopyRgba(luminance, extentMeters, p);
      timings.normalGenerationAndEncoding = performance.now()-normalStart;
      const textureStart = performance.now();
      texture = createNormalMapDataTexture(rgba, p.aerialResolution, p.aerialResolution, maxAnisotropy);
      if (aerial) { texture.wrapS = aerial.wrapS; texture.wrapT = aerial.wrapT; }
      timings.textureSetup = performance.now()-textureStart;
      // Conservative live typed-array + extraction canvas estimate, not heap telemetry.
      estimatedPeakCpuBytes = p.aerialResolution**2*36;
    } catch (error) {
      effectiveVariant = 'base';
      fallbackReason = error instanceof Error ? error.message : String(error);
    }
  }
  timings.prepareTotal = variant === 'off' ? 0 : performance.now()-startedAt;
  const runtime: CanopySurfaceRuntime = {
    attach(material) {
      if (variant === 'off') return;
      const start = performance.now();
      shader = installCanopySurfaceShader(material, effectiveVariant, p, texture, metersPerUnit);
      timings.shaderHookSetup = performance.now()-start;
      timings.total = timings.prepareTotal+timings.shaderHookSetup;
      // GPU upload/compile happen lazily at first render and are not CPU init timings.
      material.addEventListener('dispose', () => texture?.dispose());
    },
    summary: () => ({
      variant, effectiveVariant, parameters: { ...p },
      textures: texture ? [{ width: texture.image.width, height: texture.image.height,
        bytes: texture.image.data.byteLength, gpuBytesWithMipmaps: textureMipBytes(texture.image.width) }] : [],
      initTimingsMs: { ...timings }, estimatedPeakCpuBytes,
      shader: { ...shader, missingMarkers: [...shader.missingMarkers] }, fallbackReason,
    }),
  };
  return runtime;
}
