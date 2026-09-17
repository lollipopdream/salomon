import { describe, expect, it } from 'vitest';

import { farCanopyDefaults } from '../config/defaults/farCanopy';
import { defaultSettings } from '../config/settings';
import type { ElevationGrid } from '../types';

import { DEFAULT_MACRO_SHADE_CONFIG } from './macroShade';
import {
  applyMacroShadeToFarVertexColors,
  buildFarCanopyGeometry,
  computeFarCanopyUVs,
  resolveFarCanopyFlags,
} from './farCanopyOverlay';

/** 小さな合成 DEM。標高は尾根と谷がはっきり出るように作る。 */
function makeGrid(size = 9, cellSizeMeters = 100): ElevationGrid {
  const values = new Float32Array(size * size);
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      // 列方向に山なりの尾根を作る。
      values[row * size + col] = 200 + 300 * Math.sin((col / (size - 1)) * Math.PI);
    }
  }
  return { values, cols: size, rows: size, cellSizeMeters } as ElevationGrid;
}

describe('resolveFarCanopyFlags', () => {
  it('既定(パラメータなし)では無効', () => {
    expect(resolveFarCanopyFlags(new URLSearchParams('')).enabled).toBe(false);
  });

  it('r10far=1 でのみ有効になる', () => {
    expect(resolveFarCanopyFlags(new URLSearchParams('r10far=1')).enabled).toBe(true);
  });

  it('他の値では有効にならない(完全一致のみ)', () => {
    for (const q of ['r10far=0', 'r10far=true', 'r10far=v1', 'r10far=', 'r10far=11']) {
      expect(resolveFarCanopyFlags(new URLSearchParams(q)).enabled).toBe(false);
    }
  });

  it('既存の mode パラメータを壊さない', () => {
    const params = new URLSearchParams('mode=lite&r10far=1');
    expect(resolveFarCanopyFlags(params).enabled).toBe(true);
    expect(params.get('mode')).toBe('lite');
  });
});

describe('computeFarCanopyUVs', () => {
  it('world 位置を texture 範囲へ線形写像する', () => {
    const grid = makeGrid(5, 100);
    const extent = (grid.cols - 1) * grid.cellSizeMeters; // 400
    const uvs = computeFarCanopyUVs(grid, extent);

    expect(uvs.length).toBe(grid.rows * grid.cols * 2);
    // 原点
    expect(uvs[0]).toBeCloseTo(0, 12);
    expect(uvs[1]).toBeCloseTo(0, 12);
    // 最終頂点は 1,1
    const last = (grid.rows * grid.cols - 1) * 2;
    expect(uvs[last]).toBeCloseTo(1, 12);
    expect(uvs[last + 1]).toBeCloseTo(1, 12);
  });

  it('v は z の増加方向と同じ向き(pngRowZeroIsZMin contract)', () => {
    const grid = makeGrid(5, 100);
    const extent = (grid.cols - 1) * grid.cellSizeMeters;
    const uvs = computeFarCanopyUVs(grid, extent);
    const vAtRow0 = uvs[1];
    const vAtRow1 = uvs[(1 * grid.cols) * 2 + 1];
    expect(vAtRow1).toBeGreaterThan(vAtRow0);
  });

  it('全 UV が有限', () => {
    const uvs = computeFarCanopyUVs(makeGrid(), farCanopyDefaults.extentMeters);
    expect(uvs.every((v) => Number.isFinite(v))).toBe(true);
  });
});

describe('applyMacroShadeToFarVertexColors', () => {
  const grid = makeGrid();
  const terrainYAt = (x: number, z: number): number => {
    void z;
    return 200 + 300 * Math.sin((x / ((grid.cols - 1) * grid.cellSizeMeters)) * Math.PI);
  };
  const config = { ...DEFAULT_MACRO_SHADE_CONFIG, enabled: true };

  function freshColors(): Float32Array {
    return new Float32Array(grid.rows * grid.cols * 3).fill(0.5);
  }

  it('決定論的: 同じ入力なら同じ結果', () => {
    const a = freshColors();
    const b = freshColors();
    applyMacroShadeToFarVertexColors(a, grid, config, terrainYAt);
    applyMacroShadeToFarVertexColors(b, grid, config, terrainYAt);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('尾根と谷で明暗差が生まれる(一律倍率ではない)', () => {
    const colors = freshColors();
    applyMacroShadeToFarVertexColors(colors, grid, config, terrainYAt);
    const min = Math.min(...colors);
    const max = Math.max(...colors);
    expect(max).toBeGreaterThan(min);
  });

  it('平均 1 正規化により全体の明るさが概ね保たれる', () => {
    const colors = freshColors();
    const before = colors.reduce((a, b) => a + b, 0) / colors.length;
    applyMacroShadeToFarVertexColors(colors, grid, config, terrainYAt);
    const after = colors.reduce((a, b) => a + b, 0) / colors.length;
    // gain 1.3 と clamp が入るため厳密一致はしないが、桁が変わるような変化はしない。
    expect(after).toBeGreaterThan(before * 0.5);
    expect(after).toBeLessThan(before * 2.0);
  });

  it('terrainYAt が NaN/Infinity を返しても NaN を出さない', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const colors = freshColors();
      applyMacroShadeToFarVertexColors(colors, grid, config, () => bad);
      expect(colors.every((v) => Number.isFinite(v))).toBe(true);
    }
  });
});

describe('buildFarCanopyGeometry', () => {
  const grid = makeGrid();
  const config = farCanopyDefaults;

  it('terrain と同じ頂点数・同じ頂点位置を持つ(地形から浮かない)', () => {
    const geometry = buildFarCanopyGeometry({ grid, settings: defaultSettings, config });
    const position = geometry.getAttribute('position');
    expect(position.count).toBe(grid.rows * grid.cols);
    // x, z は grid 座標そのもの
    expect(position.getX(0)).toBeCloseTo(0, 12);
    expect(position.getZ(0)).toBeCloseTo(0, 12);
    expect(position.getX(1)).toBeCloseTo(grid.cellSizeMeters, 12);
  });

  it('index は (rows-1)*(cols-1)*2 三角形', () => {
    const geometry = buildFarCanopyGeometry({ grid, settings: defaultSettings, config });
    const index = geometry.getIndex();
    expect(index).not.toBeNull();
    expect(index!.count / 3).toBe((grid.rows - 1) * (grid.cols - 1) * 2);
  });

  it('color / uv 属性を持ち、すべて有限', () => {
    const geometry = buildFarCanopyGeometry({ grid, settings: defaultSettings, config });
    const color = geometry.getAttribute('color');
    const uv = geometry.getAttribute('uv');
    expect(color.count).toBe(grid.rows * grid.cols);
    expect(uv.count).toBe(grid.rows * grid.cols);
    expect((color.array as Float32Array).every((v) => Number.isFinite(v))).toBe(true);
    expect((uv.array as Float32Array).every((v) => Number.isFinite(v))).toBe(true);
  });

  it('macroShade を渡さない場合と enabled:false は同一結果', () => {
    const a = buildFarCanopyGeometry({ grid, settings: defaultSettings, config });
    const b = buildFarCanopyGeometry({
      grid,
      settings: defaultSettings,
      config,
      macroShade: { ...DEFAULT_MACRO_SHADE_CONFIG, enabled: false },
      terrainYAt: () => 100,
    });
    expect(Array.from(a.getAttribute('color').array as Float32Array))
      .toEqual(Array.from(b.getAttribute('color').array as Float32Array));
  });

  it('macroShade 有効時は頂点色が変化する', () => {
    const off = buildFarCanopyGeometry({ grid, settings: defaultSettings, config });
    const on = buildFarCanopyGeometry({
      grid,
      settings: defaultSettings,
      config,
      macroShade: { ...DEFAULT_MACRO_SHADE_CONFIG, enabled: true },
      terrainYAt: (x) => 200 + 300 * Math.sin((x / 800) * Math.PI),
    });
    expect(Array.from(on.getAttribute('color').array as Float32Array))
      .not.toEqual(Array.from(off.getAttribute('color').array as Float32Array));
  });

  it('決定論的: 同じ入力で 2 回作っても同一', () => {
    const a = buildFarCanopyGeometry({ grid, settings: defaultSettings, config });
    const b = buildFarCanopyGeometry({ grid, settings: defaultSettings, config });
    expect(Array.from(a.getAttribute('position').array as Float32Array))
      .toEqual(Array.from(b.getAttribute('position').array as Float32Array));
    expect(Array.from(a.getAttribute('color').array as Float32Array))
      .toEqual(Array.from(b.getAttribute('color').array as Float32Array));
  });
});
