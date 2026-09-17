// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
import { readFileSync } from 'node:fs';
// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
const projectRoot = process.cwd();
const sceneSetupPath = join(projectRoot, 'src/scene/sceneSetup.ts');
const source: string = readFileSync(sceneSetupPath, 'utf8');

const GUARD = 'if (forestCandidateFlags.enabled) {';

/** `if (forestCandidateFlags.enabled) { ... }` の本文を波括弧対応で切り出す。 */
function extractGuardedBlock(code: string): string {
  const start = code.indexOf(GUARD);
  if (start === -1) throw new Error(`guard not found: ${GUARD}`);
  let depth = 0;
  for (let index = start + GUARD.length - 1; index < code.length; index += 1) {
    const char = code[index];
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return code.slice(start, index + 1);
    }
  }
  throw new Error('unbalanced braces after the forest candidate guard');
}

const guardedBlock = extractGuardedBlock(source);

/** import 行と型注釈を除いた「実行される側」の出現回数。 */
function countOutsideGuard(identifier: string): number {
  const outside = source.split(guardedBlock).join('\n');
  const withoutImports = outside
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('import ')
      && !line.trimStart().startsWith('type ')
      && !line.includes("from '../forest/candidate/"))
    .join('\n');
  return withoutImports.split(identifier).length - 1;
}

describe('forest candidate の scene 配線', () => {
  it('guard ブロックが 1 つだけ存在する', () => {
    expect(source.split(GUARD).length - 1).toBe(1);
    expect(guardedBlock.length).toBeGreaterThan(100);
  });

  it('createForestCandidate の呼び出しは guard ブロック内だけにある', () => {
    expect(source.split('createForestCandidate(').length - 1).toBe(1);
    expect(guardedBlock).toContain('await createForestCandidate({');
    expect(countOutsideGuard('createForestCandidate(')).toBe(0);
  });

  it('__forestCandidate* の window フックは guard ブロック内だけで公開される', () => {
    for (const hook of [
      '__forestCandidateSummary',
      '__forestCandidateDispose',
      '__forestCandidateSetVisible',
    ]) {
      expect(guardedBlock).toContain(hook);
      expect(countOutsideGuard(hook)).toBe(0);
    }
  });

  it('flag は query から解決され、DEV gate されていない', () => {
    expect(source).toContain('resolveForestCandidateFlags(queryParams)');
    // `import.meta.env.DEV` と同じ行/式で候補 flag を潰していないこと。
    // production preview で performance guardrail を測るため DEV 限定にしない。
    const flagLine = source
      .split('\n')
      .find((line: string) => line.includes('resolveForestCandidateFlags(')) ?? '';
    expect(flagLine).not.toContain('import.meta.env.DEV');
  });

  it('guard ブロックの外に forest candidate の副作用が漏れていない', () => {
    // 既定(query 無し)経路で asset fetch も scene 追加も起きないことの静的保証。
    expect(countOutsideGuard('forestCandidateDefaults')).toBe(0);
  });
});
