// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { resolveForestImpostorV2Flags } from './forestImpostorV2Flags';

function flags(query = '') { return resolveForestImpostorV2Flags(new URLSearchParams(query)); }

describe('resolveForestImpostorV2Flags', () => {
  it('returns defaults without query values', () => {
    expect(flags()).toEqual({ enabled: false, densityScale: 1, kinds: 'both',
      maxPrimitivesOverride: undefined, alphaTestOverride: undefined, materialMode: 'lambert', topCap: false,
      macroShade: false, r10Wide: false, r10Atlas: false, r10Broad: undefined, r10Tone: false, r10Air: undefined, r10Dense: undefined,
      maxGrovePrimitivesOverride: undefined, maxTreePrimitivesOverride: undefined });
  });

  it('enables r10broad and r10air only for the exact value 1', () => {
    expect(flags('r10broad=1').r10Broad).toBe(true);
    expect(flags('r10air=1').r10Air).toBe(true);
    for (const value of ['0', 'true', 'v1', '01', '']) {
      expect(flags(`r10broad=${value}`).r10Broad).toBeUndefined();
      expect(flags(`r10air=${value}`).r10Air).toBeUndefined();
    }
  });

  it('enables the R10 forest tone preset only for r10tone=1', () => {
    expect(flags().r10Tone).toBe(false);
    expect(flags('r10tone=1').r10Tone).toBe(true);
    for (const value of ['0', 'true', 'v1', '01', '']) {
      expect(flags(`r10tone=${value}`).r10Tone).toBe(false);
    }
  });

  it('composes r10tone with every adopted R10 preview flag', () => {
    const combined = flags('forestImpostorV2=1&r10wide=1&r10dense=1&r10far=1&r10light=v1&r10atlas=1&forestImpostorV2TopCap=1&forestImpostorV2Material=unlit&r10tone=1');
    expect(combined).toMatchObject({ enabled: true, r10Wide: true, r10Dense: true,
      macroShade: true, r10Atlas: true, topCap: true, materialMode: 'unlit', r10Tone: true });
  });

  it('enables macro shade only for the exact value v1', () => {
    expect(flags('r10light=v1').macroShade).toBe(true);
    for (const value of ['1', 'V1', 'true', 'v10', '']) {
      expect(flags(`r10light=${value}`).macroShade).toBe(false);
    }
  });

  it('enables top cap only for the exact value 1', () => {
    expect(flags('forestImpostorV2TopCap=1').topCap).toBe(true);
    for (const value of ['0', 'true', 'yes', '01', '']) {
      expect(flags(`forestImpostorV2TopCap=${value}`).topCap).toBe(false);
    }
  });

  it('enables whole-mountain coverage only for r10wide=1', () => {
    expect(flags().r10Wide).toBe(false);
    expect(flags('r10wide=1').r10Wide).toBe(true);
    for (const value of ['0', 'true', 'v1', '']) {
      expect(flags(`r10wide=${value}`).r10Wide).toBe(false);
    }
  });

  it('enables the R10 atlas swap only for r10atlas=1', () => {
    expect(flags().r10Atlas).toBe(false);
    expect(flags('r10atlas=1').r10Atlas).toBe(true);
    for (const value of ['0', 'true', 'v1', '01', '']) {
      expect(flags(`r10atlas=${value}`).r10Atlas).toBe(false);
    }
  });

  it('accepts only exact known material modes and otherwise fails safe to lambert', () => {
    expect(flags().materialMode).toBe('lambert');
    expect(flags('forestImpostorV2Material=lambert').materialMode).toBe('lambert');
    expect(flags('forestImpostorV2Material=unlit').materialMode).toBe('unlit');
    for (const value of ['Unlit', 'basic', 'foo', '']) {
      expect(flags(`forestImpostorV2Material=${value}`).materialMode).toBe('lambert');
    }
  });

  it('enables only the exact value 1', () => {
    expect(flags('forestImpostorV2=1').enabled).toBe(true);
    for (const value of ['0', 'true', '', '01']) expect(flags(`forestImpostorV2=${value}`).enabled).toBe(false);
  });

  it('accepts only finite density values in range', () => {
    expect(flags('forestImpostorV2Density=0.5').densityScale).toBe(0.5);
    expect(flags('forestImpostorV2Density=4').densityScale).toBe(4);
    for (const value of ['0.05', '5', 'abc', '']) expect(flags(`forestImpostorV2Density=${value}`).densityScale).toBe(1);
  });

  it('accepts only integer maximums in range', () => {
    expect(flags('forestImpostorV2Max=5000').maxPrimitivesOverride).toBe(5000);
    for (const value of ['0', '200001', '1.5', 'abc']) expect(flags(`forestImpostorV2Max=${value}`).maxPrimitivesOverride).toBeUndefined();
  });

  it('accepts only known kinds', () => {
    for (const kind of ['grove', 'tree', 'both']) expect(flags(`forestImpostorV2Kinds=${kind}`).kinds).toBe(kind);
    for (const kind of ['foo', '']) expect(flags(`forestImpostorV2Kinds=${kind}`).kinds).toBe('both');
  });

  it('accepts only finite alpha test values in range', () => {
    expect(flags('forestImpostorV2AlphaTest=0.35').alphaTestOverride).toBe(0.35);
    for (const value of ['0.04', '0.96', 'abc']) expect(flags(`forestImpostorV2AlphaTest=${value}`).alphaTestOverride).toBeUndefined();
  });

  it('r10dense off leaves densityScale, maxPrimitivesOverride and the new overrides exactly as before', () => {
    // preview flag OFF(既定)のとき、既存の解決結果と完全に一致すること。
    expect(flags()).toEqual({ enabled: false, densityScale: 1, kinds: 'both',
      maxPrimitivesOverride: undefined, alphaTestOverride: undefined, materialMode: 'lambert', topCap: false,
      macroShade: false, r10Wide: false, r10Atlas: false, r10Broad: undefined, r10Tone: false, r10Air: undefined, r10Dense: undefined,
      maxGrovePrimitivesOverride: undefined, maxTreePrimitivesOverride: undefined });
    expect(flags().r10Dense).toBeUndefined();
    expect(flags().maxGrovePrimitivesOverride).toBeUndefined();
    expect(flags().maxTreePrimitivesOverride).toBeUndefined();
    for (const value of ['0', 'true', '', '01']) {
      expect(flags(`r10dense=${value}`).r10Dense).toBeUndefined();
      expect(flags(`r10dense=${value}`).densityScale).toBe(1);
      expect(flags(`r10dense=${value}`).maxPrimitivesOverride).toBeUndefined();
      expect(flags(`r10dense=${value}`).maxGrovePrimitivesOverride).toBeUndefined();
      expect(flags(`r10dense=${value}`).maxTreePrimitivesOverride).toBeUndefined();
    }
  });

  it('r10dense=1 enables the R10 parity density preset', () => {
    const dense = flags('forestImpostorV2=1&r10dense=1');
    expect(dense.r10Dense).toBe(true);
    expect(dense.densityScale).toBeGreaterThan(4); // 既存 forestImpostorV2Density の上限(4)を超える
    expect(dense.maxGrovePrimitivesOverride).toBe(520_000);
    expect(dense.maxTreePrimitivesOverride).toBe(100_000);
    expect(dense.maxPrimitivesOverride).toBe(660_000);
  });

  it('explicit forestImpostorV2Density / forestImpostorV2Max still win over the r10dense preset', () => {
    const combined = flags('r10dense=1&forestImpostorV2Density=2&forestImpostorV2Max=5000');
    expect(combined.r10Dense).toBe(true);
    expect(combined.densityScale).toBe(2);
    expect(combined.maxPrimitivesOverride).toBe(5000);
    // grove/tree 個別 cap には既存 query が存在しないため、r10dense の preset が適用され続ける。
    expect(combined.maxGrovePrimitivesOverride).toBeGreaterThan(30_000);
    expect(combined.maxTreePrimitivesOverride).toBeGreaterThan(14_000);
  });

  it('does not read the v1 query namespace', () => {
    const legacy = ['forest', 'Candidate'].join('');
    expect(flags(`${legacy}=1`).enabled).toBe(false);
    expect(flags('forestImpostorV2=1').enabled).toBe(true);
  });

  it('contains no prohibited term or nondeterministic API', () => {
    // @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
    const source = readFileSync(`${process.cwd()}/src/forest/impostorV2/forestImpostorV2Flags.ts`, 'utf8');
    expect(source).not.toContain(['forest', 'Candidate'].join(''));
    expect(source).not.toContain('Math.' + 'random');
  });
});
