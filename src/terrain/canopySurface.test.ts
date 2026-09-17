// @ts-expect-error Node types are not part of this browser project.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import ts from 'typescript';
import { DataTexture, MeshStandardMaterial, RepeatWrapping, NoColorSpace, Texture } from 'three';
import { canopySurfaceDefaults } from '../config/defaults/canopySurface';
import * as aerialLuminance from './aerialLuminance';
import {
  createCanopyTileTexture, generateAerialCanopyRgba, generateCanopyTile,
  prepareCanopySurface, textureMipBytes,
} from './canopySurface';

const parameters = canopySurfaceDefaults.parameters;

describe('procedural canopy tile', () => {
  it('is deterministic, seed-dependent, finite and encoded as normal RGB + cavity/AO A', () => {
    // This checks encoding and seed determinism, not high-resolution detail;
    // 64² provides ample samples while making its three independent tile
    // generations resilient to full-suite CPU contention.
    const resolution = 64;
    const tile = generateCanopyTile(resolution, 64, 7);
    expect(tile.data).toEqual(generateCanopyTile(resolution, 64, 7).data);
    expect(tile.data).not.toEqual(generateCanopyTile(resolution, 64, 8).data);
    expect(tile.data.byteLength).toBe(resolution*resolution*4);
    let meanAlpha = 0;
    const alphaValues = new Set<number>();
    for (let i = 0; i < tile.data.length; i += 4) {
      const length = Math.hypot((tile.data[i]-128)/127, (tile.data[i+1]-128)/127, tile.data[i+2]/127.5-1);
      expect(length).toBeCloseTo(1, 1);
      alphaValues.add(tile.data[i+3]);
      meanAlpha += tile.data[i+3]/255;
    }
    // A is a cavity/AO ratio (height / nearby crown-top height), not a
    // centered albedo tint, so its mean reflects real gap coverage rather
    // than sitting at 0.5 (reference: gaps are a substantial minority of the
    // canopy, not half of it).
    expect(meanAlpha/(resolution*resolution)).toBeGreaterThan(0.12);
    expect(meanAlpha/(resolution*resolution)).toBeLessThan(0.45);
    expect(alphaValues.size).toBeGreaterThan(80);
  });
  it('cavity/AO channel is deep in gaps, high at crown tops, with a wide, non-trivial spread', () => {
    // A weak modulation (e.g. the old +-0.23 albedo grain) would cluster
    // tightly around one byte value; a real cavity/AO signal must use most
    // of the 0..255 range and include both near-zero (deep gap) and
    // near-255 (crown top) texels.
    const { data } = generateCanopyTile(256, 96, parameters.seed);
    let min = 255, max = 0, sum = 0, sumSquares = 0, count = 0;
    for (let i = 3; i < data.length; i += 4) {
      const a = data[i];
      if (a < min) min = a;
      if (a > max) max = a;
      sum += a; sumSquares += a*a; count++;
    }
    const mean = sum/count;
    const stddev = Math.sqrt(sumSquares/count - mean*mean);
    expect(min).toBeLessThan(10);
    expect(max).toBeGreaterThan(245);
    expect(stddev).toBeGreaterThan(40);
  });
  it('has wrap-boundary variation comparable to interior neighbors, with no seam stripe', () => {
    const { data, resolution: n } = generateCanopyTile(512, 128, parameters.seed);
    let interior = 0, boundary = 0;
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        for (let channel = 0; channel < 4; channel++) {
          const current = data[(row*n+col)*4+channel];
          const dx = Math.abs(current-data[(row*n+(col+1)%n)*4+channel]);
          const dy = Math.abs(current-data[(((row+1)%n)*n+col)*4+channel]);
          if (col === n-1) boundary += dx; else interior += dx;
          if (row === n-1) boundary += dy; else interior += dy;
        }
      }
    }
    const ratio = (boundary/(n*2*4))/(interior/(n*(n-1)*2*4));
    expect(ratio).toBeGreaterThan(0.5);
    expect(ratio).toBeLessThan(1.5);
  });
  it('cavity/AO channel is toroidally continuous at both the column and row seam', () => {
    // Same continuity check as above, isolated to the A channel and both
    // axes, since the local-max envelope used for cavity/AO is a separate
    // wrap()-based pass from the normal RGB and could regress independently.
    const { data, resolution: n } = generateCanopyTile(256, 96, parameters.seed);
    const alphaAt = (row: number, col: number) => data[(((row%n)+n)%n*n+((col%n)+n)%n)*4+3];
    let interiorCol = 0, seamCol = 0, interiorRow = 0, seamRow = 0;
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const dx = Math.abs(alphaAt(row,col)-alphaAt(row,col+1));
        const dy = Math.abs(alphaAt(row,col)-alphaAt(row+1,col));
        if (col === n-1) seamCol += dx; else interiorCol += dx;
        if (row === n-1) seamRow += dy; else interiorRow += dy;
      }
    }
    const colRatio = (seamCol/n)/(interiorCol/(n*(n-1)));
    const rowRatio = (seamRow/n)/(interiorRow/(n*(n-1)));
    expect(colRatio).toBeGreaterThan(0.4);
    expect(colRatio).toBeLessThan(1.8);
    expect(rowRatio).toBeGreaterThan(0.4);
    expect(rowRatio).toBeLessThan(1.8);
  });
  it('does not correlate at a regular crown spacing', () => {
    const { data, resolution: n } = generateCanopyTile(256, 128, parameters.seed);
    let mean = 0;
    for (let i = 3; i < data.length; i += 4) mean += data[i];
    mean /= (n*n);
    for (const shift of [10, 14, 20]) { // 5, 7, 10 m
      let cross = 0, square = 0;
      for (let row = 0; row < n; row++) {
        for (let col = 0; col < n; col++) {
          // Mean-centered (not centered on the byte midpoint 128): the
          // cavity/AO channel's own mean sits well below 128 by design (see
          // above), so centering on 128 would inject a large spurious DC
          // term into the cross-correlation regardless of actual structure.
          const a = data[(row*n+col)*4+3]-mean;
          const b = data[(row*n+(col+shift)%n)*4+3]-mean;
          cross += a*b; square += a*a;
        }
      }
      expect(Math.abs(cross/square)).toBeLessThan(0.25);
    }
  });
  it('uses repeating linear-data mipmaps and the exact memory accounting', () => {
    const texture = createCanopyTileTexture(generateCanopyTile(512,128,7),32);
    expect(texture.wrapS).toBe(RepeatWrapping);
    expect(texture.wrapT).toBe(RepeatWrapping);
    expect(texture.colorSpace).toBe(NoColorSpace);
    expect(texture.generateMipmaps).toBe(true);
    expect(texture.anisotropy).toBe(16);
    expect(texture.image.data.byteLength).toBe(1048576);
    expect(textureMipBytes(512)).toBe(1398100);
    expect(textureMipBytes(2048)).toBe(22369620);
    expect(textureMipBytes(3072)).toBe(50331640);
    texture.dispose();
  });
  it.each([[0,128,7], [2048,128,7], [128,0,7], [128,Infinity,7], [128,128,NaN]])(
    'rejects invalid generation input %s %s %s', (size, period, seed) => {
      expect(() => generateCanopyTile(size,period,seed)).toThrow(RangeError);
    },
  );
  it('accepts the new tilePeriodMeters floor of 16 without throwing', () => {
    expect(() => generateCanopyTile(128, 16, 7)).not.toThrow();
  });
  it('rejects a non-positive crownSizeMeters or crownDensity', () => {
    expect(() => generateCanopyTile(128, 64, 7, 0, 1.3)).toThrow(RangeError);
    expect(() => generateCanopyTile(128, 64, 7, 5.5, 0)).toThrow(RangeError);
  });
  it('rejects invalid clump controls outside the documented 20-80 m scale', () => {
    expect(() => generateCanopyTile(128, 96, 7, 5.5, 1.3, -0.1, 48)).toThrow(RangeError);
    expect(() => generateCanopyTile(128, 96, 7, 5.5, 1.3, 1.2, 19.9)).toThrow(RangeError);
    expect(() => generateCanopyTile(128, 96, 7, 5.5, 1.3, 1.2, 80.1)).toThrow(RangeError);
  });
  it('crownSizeMeters and crownDensity actually change the generated tile', () => {
    const baseline = generateCanopyTile(256, 96, parameters.seed, 5.5, 1.3);
    const smallerCrowns = generateCanopyTile(256, 96, parameters.seed, 2, 1.3);
    const biggerCrowns = generateCanopyTile(256, 96, parameters.seed, 10, 1.3);
    expect(smallerCrowns.data).not.toEqual(baseline.data);
    expect(biggerCrowns.data).not.toEqual(baseline.data);
    // Density is a count multiplier: raising it must raise crownCount, and
    // lowering it must lower crownCount, monotonically.
    const sparse = generateCanopyTile(256, 96, parameters.seed, 5.5, 0.5);
    const dense = generateCanopyTile(256, 96, parameters.seed, 5.5, 2.5);
    expect(sparse.crownCount).toBeLessThan(baseline.crownCount);
    expect(baseline.crownCount).toBeLessThan(dense.crownCount);
    expect(sparse.data).not.toEqual(baseline.data);
    expect(dense.data).not.toEqual(baseline.data);
  });
  it('adds deterministic 48 m + 24 m clump octaves to normals and cavity AO', () => {
    // 96 samples still resolve the 48 m and 24 m octaves within this 96 m
    // tile, while reducing each procedural generation by about 86% from the
    // previous 256² workload. Keep independent same-seed generation here so
    // determinism is tested rather than inferred from a shared fixture.
    const resolution = 96;
    const noClumps = generateCanopyTile(resolution, 96, parameters.seed, 5.5, 1.3, 0, 48);
    const clumped = generateCanopyTile(resolution, 96, parameters.seed, 5.5, 1.3, 1.2, 48);
    expect(clumped.data).toEqual(generateCanopyTile(resolution, 96, parameters.seed, 5.5, 1.3, 1.2, 48).data);
    expect(clumped.data).not.toEqual(noClumps.data);
    const changed = [0, 0, 0, 0];
    for (let i = 0; i < clumped.data.length; i++) {
      if (clumped.data[i] !== noClumps.data[i]) changed[i%4]++;
    }
    // Preserve the original 256² test's minimum changed surface coverage:
    // 1,000 / 256² is just over 1.5% of each encoded channel.
    const minimumChangedSamples = resolution**2 / 64;
    expect(changed[0]).toBeGreaterThan(minimumChangedSamples);
    expect(changed[1]).toBeGreaterThan(minimumChangedSamples);
    expect(changed[3]).toBeGreaterThan(minimumChangedSamples);
    expect(generateCanopyTile(resolution, 96, parameters.seed, 5.5, 1.3, 1.2, 32).data)
      .not.toEqual(clumped.data);
  });
  it('keeps the enabled coarse octaves toroidally seamless', () => {
    const { data, resolution: n } = generateCanopyTile(256, 96, parameters.seed, 5.5, 1.3, 1.2, 48);
    for (const channel of [0, 1, 3]) {
      let seam = 0, interior = 0;
      for (let row = 0; row < n; row++) {
        seam += Math.abs(data[(row*n+n-1)*4+channel]-data[(row*n)*4+channel]);
        for (let col = 0; col < n-1; col++) {
          interior += Math.abs(data[(row*n+col)*4+channel]-data[(row*n+col+1)*4+channel]);
        }
      }
      const ratio = (seam/n)/(interior/(n*(n-1)));
      expect(ratio).toBeGreaterThan(0.35);
      expect(ratio).toBeLessThan(1.9);
    }
  });
});

describe('canopy runtime and aerial detail', () => {
  it('off allocates no textures and never attaches a material hook', () => {
    const runtime = prepareCanopySurface({ variant: 'off', parameters }, undefined, 5940.95);
    const material = new MeshStandardMaterial();
    const before = { ...material };
    runtime.attach(material);
    expect({ ...material }).toEqual(before);
    expect(runtime.summary()).toMatchObject({ textures: [], estimatedPeakCpuBytes: 0,
      initTimingsMs: { prepareTotal: 0 }, shader: { attempted: false, injected: false } });
  });
  it('base adds no texture and a preserves the DEM texture and disposes its own resource', () => {
    const base = prepareCanopySurface({ variant: 'base', parameters }, undefined,5940.95);
    expect(base.summary().textures).toEqual([]);
    const a = prepareCanopySurface({ variant: 'a', parameters },undefined,5940.95);
    const dem = new DataTexture();
    const material = new MeshStandardMaterial({ normalMap: dem });
    const dispose = vi.spyOn(DataTexture.prototype, 'dispose');
    a.attach(material);
    expect(material.normalMap).toBe(dem);
    expect(a.summary().textures[0].width).toBe(512);
    material.dispose();
    expect(dispose).toHaveBeenCalledOnce();
    dispose.mockRestore();
  });
  it('b without image/DOM falls back to base explicitly without touching DEM', () => {
    const runtime = prepareCanopySurface({ variant: 'b', parameters }, new Texture(),5940.95);
    expect(runtime.summary()).toMatchObject({ variant: 'b', effectiveVariant: 'base',
      textures: [], fallbackReason: 'Aerial luminance unavailable' });
  });
  it('b handles extraction exceptions without breaking scene initialization', () => {
    const spy = vi.spyOn(aerialLuminance, 'extractTextureLuminance').mockImplementation(() => { throw new Error('unreadable image'); });
    try {
      expect(prepareCanopySurface({ variant: 'b', parameters }, new Texture(),5940.95).summary())
        .toMatchObject({ effectiveVariant: 'base', fallbackReason: 'unreadable image' });
    } finally { spy.mockRestore(); }
  });
  it('b retains north/south orientation and source luminance without mutation', () => {
    const luminance = new Float32Array(64);
    luminance[1*8+3] = 1;
    const before = luminance.slice();
    const rgba = generateAerialCanopyRgba(luminance,80,{ ...parameters, aerialResolution: 8 });
    expect(luminance).toEqual(before);
    // Peak in northern input rows is in upper v rows after bottom-up encoding.
    const energy = (start: number, end: number) => {
      let sum = 0;
      for (let row = start; row < end; row++) for (let col = 0; col < 8; col++) {
        sum += Math.abs(rgba[(row*8+col)*4]-128)+Math.abs(rgba[(row*8+col)*4+1]-128);
      }
      return sum;
    };
    expect(energy(4,8)).toBeGreaterThan(energy(0,4));
    const flat = generateAerialCanopyRgba(new Float32Array(64).fill(0.5),80,{ ...parameters, aerialResolution: 8 });
    expect([...flat.slice(0,4)]).toEqual([128,128,255,255]);
  });
  it('reports structurally consistent resources and accounting at small synthetic sizes', () => {
    // Keep this as a unit test, not a production-size CPU benchmark: the
    // default b path is 2048² and its wall-clock duration varies wildly when
    // the full suite is running in parallel. These power-of-two dimensions
    // preserve exact mip accounting while completing quickly under contention.
    const smallParameters = { ...parameters, tileResolution: 128, aerialResolution: 256 };
    const luminance = Float32Array.from({ length: smallParameters.aerialResolution**2 }, (_, i) =>
      0.5+0.2*Math.sin(i*0.21)+0.1*Math.cos(Math.floor(i/smallParameters.aerialResolution)*0.37),
    );
    const spy = vi.spyOn(aerialLuminance, 'extractTextureLuminance').mockReturnValue(luminance);
    try {
      for (const variant of ['off','base','a','b'] as const) {
        const runtime = prepareCanopySurface({ variant, parameters: smallParameters },new Texture(),5940.95);
        const material = new MeshStandardMaterial();
        runtime.attach(material);
        const summary = runtime.summary();
        expect(summary.effectiveVariant).toBe(variant);
        const expectedTimingKeys = variant === 'off' ? ['prepareTotal']
          : variant === 'base' ? ['prepareTotal', 'shaderHookSetup', 'total']
          : variant === 'a' ? ['tileGeneration', 'textureSetup', 'prepareTotal', 'shaderHookSetup', 'total']
          : ['luminanceExtraction', 'normalGenerationAndEncoding', 'textureSetup', 'prepareTotal', 'shaderHookSetup', 'total'];
        expect(Object.keys(summary.initTimingsMs).sort()).toEqual(expectedTimingKeys.sort());
        for (const key of expectedTimingKeys) {
          expect(summary.initTimingsMs[key]).toSatisfy((value: number) => Number.isFinite(value) && value >= 0);
        }
        const expectedResolution = variant === 'a' ? smallParameters.tileResolution : smallParameters.aerialResolution;
        if (variant === 'a' || variant === 'b') {
          expect(summary.textures).toHaveLength(1);
          const [texture] = summary.textures;
          expect(texture).toMatchObject({ width: expectedResolution, height: expectedResolution,
            bytes: expectedResolution**2*4 });
          // For a power-of-two RGBA texture, the complete mip chain is the
          // 4/3 series less its one-texel tail: baseBytes * 4/3 - 4/3.
          expect(texture.gpuBytesWithMipmaps).toBe(texture.bytes*4/3-4/3);
          expect(summary.estimatedPeakCpuBytes).toBe(expectedResolution**2*(variant === 'a' ? 8 : 36));
        } else {
          expect(summary.textures).toEqual([]);
          expect(summary.estimatedPeakCpuBytes).toBe(0);
        }
        material.dispose();
      }
    } finally { spy.mockRestore(); }
  });
});

function read(path: string): string { return readFileSync(path,'utf8'); }
function codeWithoutComments(path: string): string {
  const source = ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true);
  return ts.createPrinter({ removeComments: true }).printFile(source);
}
function files(directory: string): string[] {
  return readdirSync(directory,{ withFileTypes: true }).flatMap((entry: { name: string; isDirectory(): boolean }) =>
    entry.isDirectory() ? files(`${directory}/${entry.name}`) : entry.name.endsWith('.ts') ? [`${directory}/${entry.name}`] : [],
  );
}

describe('canopy isolation guards', () => {
  it('keeps canopy imports/globals out of camera, route, Lite and protected scene files', () => {
    const paths = [...files('src/camera'),...files('src/route'),...files('src/presentation'),
      'src/scene/labelRenderer.ts','src/scene/waypointMarkers.ts','src/scene/arrivalCard.ts'];
    expect(paths.filter((path) => /canopySurface|__canopySurface/.test(codeWithoutComments(path)))).toEqual([]);
  });
  it('Lite returns before canopy initialization, which is DEV-only and dynamically imported', () => {
    const source = codeWithoutComments('src/scene/sceneSetup.ts');
    const lite = source.slice(source.indexOf('async function setupLiteScene'),source.indexOf('export async function setupScene'));
    expect(lite).not.toMatch(/canopySurface|CanopySurface|__canopySurface/);
    expect(source).toMatch(/if \(mode === 'lite'\) \{\s*await setupLiteScene\(container\);\s*return;/);
    const setup = source.slice(source.indexOf('export async function setupScene'));
    expect(setup.indexOf('return;')).toBeLessThan(setup.indexOf('resolveCanopySurfaceFlags('));
    expect(setup).toMatch(/if \(import\.meta\.env\.DEV\) \{\s*const selection = resolveCanopySurfaceFlags/);
    expect(setup).toMatch(/if \(selection.variant !== 'off'\) \{\s*const \{ prepareCanopySurface \} = await import/);
  });
  it('does not add per-frame canopy work or alter the capture method contract', () => {
    const ast = ts.createSourceFile('sceneSetup.ts',read('src/scene/sceneSetup.ts'),ts.ScriptTarget.Latest,true);
    let loopFound = false;
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && node.expression.getText(ast) === 'renderer.setAnimationLoop') {
        loopFound = true;
        expect(node.getText(ast)).not.toMatch(/canopySurface|CanopySurface/);
      }
      ts.forEachChild(node,visit);
    };
    visit(ast);
    expect(loopFound).toBe(true);
    const code = codeWithoutComments('src/scene/sceneSetup.ts');
    const capture = code.slice(code.indexOf('__forestCapture = {'),code.indexOf('__cap ='));
    for (const method of ['freezeClock','releaseClock','pause','hideOverlay','showOverlay','pose','sweep','state']) {
      expect(capture).toContain(`${method}(`);
    }
  });
});
