// @ts-expect-error This project deliberately has no Node type dependency.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { createCrossedQuadGeometry } from './impostorGeometry';
import type { ImpostorCellRef } from './types';

function makeCell(pivot: { u: number; v: number } = { u: 0.5, v: 0 }): ImpostorCellRef {
  return {
    key: 'geometry-test', kind: 'tree', atlas: 'tree', groveConfig: null, sourceVariant: 'T', yawDeg: 0,
    uv: { u0: 0.1, v0: 0.2, u1: 0.7, v1: 0.9 }, tightWorldWidth: 1, tightWorldHeight: 1,
    groundPivotInTight: pivot, alphaCoverage: 1,
  };
}

function range(attribute: { count: number; getX(index: number): number }): [number, number] {
  const values = Array.from({ length: attribute.count }, (_, index) => attribute.getX(index));
  return [Math.min(...values), Math.max(...values)];
}

describe('createCrossedQuadGeometry', () => {
  it('creates indexed crossed quads with the requested UV rectangle and up normals', () => {
    const geometry = createCrossedQuadGeometry(makeCell());
    const position = geometry.getAttribute('position');
    const uv = geometry.getAttribute('uv');
    const normal = geometry.getAttribute('normal');
    expect(position).toMatchObject({ count: 8, itemSize: 3 });
    expect(uv).toMatchObject({ count: 8, itemSize: 2 });
    expect(normal).toMatchObject({ count: 8, itemSize: 3 });
    expect(geometry.index).toMatchObject({ count: 12 });
    expect([0, 1, 2, 3].every((index) => position.getZ(index) === 0)).toBe(true);
    expect([4, 5, 6, 7].every((index) => position.getX(index) === 0)).toBe(true);
    for (let index = 0; index < normal.count; index += 1) {
      expect([normal.getX(index), normal.getY(index), normal.getZ(index)]).toEqual([0, 1, 0]);
    }
    expect(range(uv)[0]).toBeCloseTo(0.1);
    expect(range(uv)[1]).toBeCloseTo(0.7);
    const vValues = Array.from({ length: uv.count }, (_, index) => uv.getY(index));
    expect(Math.min(...vValues)).toBeCloseTo(0.2);
    expect(Math.max(...vValues)).toBeCloseTo(0.9);
    expect(geometry.name).toBe('forest-impostor-v2-geometry-test');
    expect(geometry.boundingSphere).not.toBeNull();
    expect(geometry.boundingSphere!.radius).not.toBeNaN();
  });

  it('anchors the unit geometry at the supplied ground pivot', () => {
    const centered = createCrossedQuadGeometry(makeCell());
    const centeredPosition = centered.getAttribute('position');
    expect(range(centeredPosition)).toEqual([-0.5, 0.5]);
    expect(Math.min(...Array.from({ length: 8 }, (_, i) => centeredPosition.getY(i)))).toBeCloseTo(0);
    expect(Math.max(...Array.from({ length: 8 }, (_, i) => centeredPosition.getY(i)))).toBeCloseTo(1);

    const offset = createCrossedQuadGeometry(makeCell({ u: 0.6, v: 0.05 }));
    const position = offset.getAttribute('position');
    expect(range(position)[0]).toBeCloseTo(-0.6);
    expect(range(position)[1]).toBeCloseTo(0.4);
    const zValues = Array.from({ length: 8 }, (_, index) => position.getZ(index));
    expect(Math.min(...zValues)).toBeCloseTo(-0.6);
    expect(Math.max(...zValues)).toBeCloseTo(0.4);
    const yValues = Array.from({ length: 8 }, (_, index) => position.getY(index));
    expect(Math.min(...yValues)).toBeCloseTo(-0.05);
    expect(Math.max(...yValues)).toBeCloseTo(0.95);
  });

  it('contains none of the disallowed source APIs', () => {
    // @ts-expect-error This project deliberately has no Node type dependency.
    const root = process.cwd();
    const source = readFileSync(`${root}/src/forest/impostorV2/impostorGeometry.ts`, 'utf8');
    for (const term of ['on' + 'BeforeCompile', 'Shader' + 'Material', 'Raw' + 'Shader' + 'Material',
      'cast' + 'Shadow', 'receive' + 'Shadow', 'shadow' + 'Map', 'Math.' + 'random',
      'forest' + 'Candidate']) expect(source).not.toContain(term);
  });
});
