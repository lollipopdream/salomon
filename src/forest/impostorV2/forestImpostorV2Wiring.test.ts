// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
import { readFileSync } from 'node:fs';
// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
const projectRoot = process.cwd();
const sceneSetupPath = join(projectRoot, 'src/scene/sceneSetup.ts');
const source: string = readFileSync(sceneSetupPath, 'utf8');

const GUARD = 'if (forestImpostorV2Flags.enabled) {';

function extractBalanced(
  code: string,
  marker: string,
  opening: '{' | '(',
  closing: '}' | ')',
): string {
  const start = code.indexOf(marker);
  if (start === -1) throw new Error(`marker not found: ${marker}`);
  const openingIndex = code.indexOf(opening, start);
  if (openingIndex === -1) throw new Error(`opening token not found after: ${marker}`);
  let depth = 0;
  for (let index = openingIndex; index < code.length; index += 1) {
    const char = code[index];
    if (char === opening) depth += 1;
    else if (char === closing) {
      depth -= 1;
      if (depth === 0) return code.slice(start, index + 1);
    }
  }
  throw new Error(`unbalanced ${opening}${closing} after: ${marker}`);
}

const guardedBlock = extractBalanced(source, GUARD, '{', '}');

function countOutsideGuard(identifier: string): number {
  const outside = source.split(guardedBlock).join('\n');
  const withoutImports = outside
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('import ')
      && !line.trimStart().startsWith('type ')
      && !line.includes("from '../forest/impostorV2/"))
    .join('\n');
  return withoutImports.split(identifier).length - 1;
}

describe('forest impostor v2 の scene 配線', () => {
  it('guard ブロックが 1 つだけ存在する', () => {
    expect(source.split(GUARD).length - 1).toBe(1);
    expect(guardedBlock.length).toBeGreaterThan(100);
  });

  it('createForestImpostorV2 の呼び出しは guard ブロック内だけにある', () => {
    expect(source.split('createForestImpostorV2(').length - 1).toBe(1);
    expect(guardedBlock).toContain('await createForestImpostorV2({');
    expect(countOutsideGuard('createForestImpostorV2(')).toBe(0);
  });

  it('__forestImpostorV2* の window フックは guard ブロック内だけで公開される', () => {
    for (const hook of [
      '__forestImpostorV2Summary',
      '__forestImpostorV2Dispose',
      '__forestImpostorV2SetVisible',
      '__forestImpostorV2SetMaterialMode',
      '__forestImpostorV2SetTopCapVisible',
    ]) {
      expect(guardedBlock).toContain(hook);
      expect(countOutsideGuard(hook)).toBe(0);
    }
  });

  it('guard ブロックの外に v2 default の副作用が漏れていない', () => {
    expect(countOutsideGuard('forestImpostorV2Defaults')).toBe(0);
  });

  it('flag は query から解決され、DEV gate されていない', () => {
    expect(source).toContain('resolveForestImpostorV2Flags(queryParams)');
    const flagLine = source
      .split('\n')
      .find((line: string) => line.includes('resolveForestImpostorV2Flags(')) ?? '';
    expect(flagLine).not.toContain('import.meta.env.DEV');
  });

  it('v2 guard は v1 candidate の識別子を含まない', () => {
    expect(guardedBlock).not.toContain('forestCandidate');
  });

  it('animation loop に v2 識別子を追加していない', () => {
    const loop = extractBalanced(
      source,
      'renderer.setAnimationLoop(',
      '(',
      ')',
    );
    expect(loop.split('\n').length).toBeGreaterThanOrEqual(100);
    expect(loop).not.toMatch(/impostorV2|ImpostorV2|forestImpostorV2/);
  });
});
