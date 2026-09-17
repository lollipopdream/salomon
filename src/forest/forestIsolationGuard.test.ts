// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
import { readFileSync, readdirSync } from 'node:fs';
// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
import { basename, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
const projectRoot = process.cwd();
const guardFileName = 'forestIsolationGuard.test.ts';

function findTypeScriptFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...findTypeScriptFiles(path));
    else if (entry.isFile() && path.endsWith('.ts')) files.push(path);
  }
  return files;
}

function maskNonCode(source: string, maskStrings: boolean): string {
  const output = source.split('');
  let state: 'code' | 'single' | 'double' | 'template' | 'line' | 'block' = 'code';

  const mask = (index: number): void => {
    if (source[index] !== '\n' && source[index] !== '\r') output[index] = ' ';
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (state === 'code') {
      if (char === '/' && next === '/') {
        mask(index);
        mask(index + 1);
        index += 1;
        state = 'line';
      } else if (char === '/' && next === '*') {
        mask(index);
        mask(index + 1);
        index += 1;
        state = 'block';
      } else if (char === "'") {
        if (maskStrings) mask(index);
        state = 'single';
      } else if (char === '"') {
        if (maskStrings) mask(index);
        state = 'double';
      } else if (char === '`') {
        if (maskStrings) mask(index);
        state = 'template';
      }
      continue;
    }

    if (state === 'line') {
      mask(index);
      if (char === '\n') state = 'code';
      continue;
    }
    if (state === 'block') {
      mask(index);
      if (char === '*' && next === '/') {
        mask(index + 1);
        index += 1;
        state = 'code';
      }
      continue;
    }

    if (maskStrings) mask(index);
    if (char === '\\') {
      if (maskStrings) mask(index + 1);
      index += 1;
      continue;
    }
    if (
      (state === 'single' && char === "'") ||
      (state === 'double' && char === '"') ||
      (state === 'template' && char === '`')
    ) {
      state = 'code';
    }
  }

  return output.join('');
}

function findForestImports(source: string): string[] {
  const commentFree = maskNonCode(source, false);
  const paths: string[] = [];
  const patterns = [
    /\b(?:import|export)\s+(?!\.)(?:type\s+)?(?:[^;'"`]*?\bfrom\s*)?(['"])([^'"]+)\1/g,
    /\bimport\s*\(\s*(['"])([^'"]+)\1/g,
  ];

  for (const pattern of patterns) {
    for (const match of commentFree.matchAll(pattern)) {
      if (/forest/i.test(match[2])) paths.push(match[2]);
    }
  }
  return paths;
}

function findForbiddenTerms(source: string, terms: readonly string[]): string[] {
  return terms.filter((term) => source.includes(term));
}

function containsMathRandom(source: string): boolean {
  return /\bMath\s*\.\s*random\s*\(/.test(source);
}

interface SourceRange {
  startIndex: number;
  endIndex: number;
  startLine: number;
  endLine: number;
  lineCount: number;
  code: string;
}

function lineAt(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

function rangeDiagnostic(startLine: number, endLine: number, lineCount: number): string {
  return `animation loop range: start=${startLine}, end=${endLine}, lines=${lineCount}`;
}

function findAnimationLoopRange(source: string): SourceRange {
  const code = maskNonCode(source, true);
  const marker = /\brenderer\s*\.\s*setAnimationLoop\s*\(/g.exec(code);
  if (!marker) {
    throw new Error(`setAnimationLoop start not found; ${rangeDiagnostic(0, 0, 0)}`);
  }

  const startIndex = marker.index;
  const openParen = marker.index + marker[0].lastIndexOf('(');
  const stack: string[] = [];
  const closingFor: Record<string, string> = { '(': ')', '{': '}', '[': ']' };
  let endIndex = -1;

  for (let index = openParen; index < code.length; index += 1) {
    const char = code[index];
    if (char in closingFor) {
      stack.push(char);
      continue;
    }
    if (char !== ')' && char !== '}' && char !== ']') continue;

    const opening = stack.pop();
    if (opening === undefined || closingFor[opening] !== char) {
      const startLine = lineAt(source, startIndex);
      const endLine = lineAt(source, index);
      throw new Error(
        `unbalanced delimiter while locating setAnimationLoop; ${rangeDiagnostic(startLine, endLine, endLine - startLine + 1)}`,
      );
    }
    if (stack.length === 0) {
      endIndex = index;
      break;
    }
  }

  const startLine = lineAt(source, startIndex);
  const endLine = endIndex < 0 ? 0 : lineAt(source, endIndex);
  const lineCount = endIndex < 0 ? 0 : endLine - startLine + 1;
  const diagnostic = rangeDiagnostic(startLine, endLine, lineCount);
  if (endIndex < 0) throw new Error(`setAnimationLoop end not found; ${diagnostic}`);
  if (lineCount < 100) throw new Error(`setAnimationLoop range is too short; ${diagnostic}`);

  return {
    startIndex,
    endIndex,
    startLine,
    endLine,
    lineCount,
    code: code.slice(startIndex, endIndex + 1),
  };
}

function findForestIdentifiers(source: string): string[] {
  return [...source.matchAll(/[$A-Z_a-z][$\w]*/g)]
    .map((match) => match[0])
    .filter((identifier) => /forest/i.test(identifier));
}

const forestFiles = findTypeScriptFiles(join(projectRoot, 'src/forest')).filter(
  (filePath) => basename(filePath) !== guardFileName,
);
const devFiles = findTypeScriptFiles(join(projectRoot, 'src/dev'));
const candidateDirectory = join(projectRoot, 'src/forest/candidate');
const legacyForestFiles = forestFiles.filter(
  (filePath) => !filePath.startsWith(candidateDirectory),
);
const candidateForestFiles = forestFiles.filter(
  (filePath) => filePath.startsWith(candidateDirectory),
);

// matsu-h01-r10 preview: 遠景の空気遠近法(森林レイヤ限定 depth haze)は、three 組み込み
// material へ距離依存の blend を足すため `onBeforeCompile` を必要とする。global fog は
// 変更禁止のため、これが唯一の実現手段である。candidate/canopyCardMesh.ts と同じく、
// 該当ファイルだけを明示的な例外として登録し、直下の assertion で範囲を固定する。
//
// **ガードを迂回する実装は禁止**(文字列分割・`Reflect.set` 等で `onBeforeCompile` の
// 字面を隠す書き方を含む)。新たに shader 注入が必要になった場合は、隠すのではなく
// このリストへ追記して可視化すること。
const SHADER_INJECTION_ALLOWLIST: readonly string[] = [
  'src/forest/impostorV2/r10DepthHaze.ts',
  'src/forest/impostorV2/r10DepthHaze.test.ts',
];

describe('forest isolation regression guard', () => {
  it('camera / route / presentation / terrain /指定sceneファイルがforestをimportしない', () => {
    const files = [
      ...findTypeScriptFiles(join(projectRoot, 'src/camera')),
      ...findTypeScriptFiles(join(projectRoot, 'src/route')),
      ...findTypeScriptFiles(join(projectRoot, 'src/presentation')),
      ...findTypeScriptFiles(join(projectRoot, 'src/terrain')),
      ...['labelRenderer.ts', 'waypointMarkers.ts', 'arrivalCard.ts'].map((file) =>
        join(projectRoot, 'src/scene', file),
      ),
    ];
    const violations = files.flatMap((filePath) =>
      findForestImports(readFileSync(filePath, 'utf8')).map(
        (importPath) => `${relative(projectRoot, filePath)}: ${importPath}`,
      ),
    );

    expect(violations).toEqual([]);
  });

  // 追補10 由来の legacy forest variant(instanced / billboard / canopy)に対する
  // 制約は一切緩めない。2026-09-12 の forest candidate
  // (`src/forest/candidate/`、`?forestCandidate=1` の opt-in)は Y 軸 billboard と
  // atlas UV 再割当のために `onBeforeCompile` を必要とするため、この 1 assertion に
  // 限り candidate ディレクトリを除外する。代わりに下の 2 assertion で
  // 「注入は candidate の 1 ファイルだけ」を明示的に固定する。
  it('legacy forestソースがshader注入APIを使わない', () => {
    const terms = ['ShaderMaterial', 'RawShaderMaterial', 'onBeforeCompile'];
    const violations = legacyForestFiles
      .filter((filePath) => !SHADER_INJECTION_ALLOWLIST.includes(relative(projectRoot, filePath)))
      .flatMap((filePath) =>
        findForbiddenTerms(readFileSync(filePath, 'utf8'), terms).map(
          (term) => `${relative(projectRoot, filePath)}: ${term}`,
        ),
      );
    expect(violations).toEqual([]);
  });

  it('legacy forestのshader注入はallowlistの2ファイルだけに閉じている', () => {
    const terms = ['ShaderMaterial', 'RawShaderMaterial', 'onBeforeCompile'];
    const injections = legacyForestFiles
      .filter((filePath) => SHADER_INJECTION_ALLOWLIST.includes(relative(projectRoot, filePath)))
      .flatMap((filePath) =>
        findForbiddenTerms(readFileSync(filePath, 'utf8'), terms).map(
          (term) => `${relative(projectRoot, filePath)}: ${term}`,
        ),
      );
    expect(injections.sort()).toEqual([
      'src/forest/impostorV2/r10DepthHaze.test.ts: onBeforeCompile',
      'src/forest/impostorV2/r10DepthHaze.ts: onBeforeCompile',
    ]);
  });

  it('candidateのshader注入はcanopyCardMesh.tsのonBeforeCompileだけに閉じている', () => {
    const terms = ['ShaderMaterial', 'RawShaderMaterial', 'onBeforeCompile'];
    const injections = candidateForestFiles.flatMap((filePath) =>
      findForbiddenTerms(readFileSync(filePath, 'utf8'), terms).map(
        (term) => `${relative(projectRoot, filePath)}: ${term}`,
      ),
    );
    expect(injections).toEqual([
      'src/forest/candidate/canopyCardMesh.ts: onBeforeCompile',
    ]);
  });

  it('legacy forest variantのファイル集合が空でない(guardが空振りしていない)', () => {
    expect(legacyForestFiles.length).toBeGreaterThan(0);
    expect(candidateForestFiles.length).toBeGreaterThan(0);
  });

  it('forestソースがshadow APIを使わない', () => {
    const terms = ['castShadow', 'receiveShadow', 'shadowMap'];
    const violations = forestFiles.flatMap((filePath) =>
      findForbiddenTerms(readFileSync(filePath, 'utf8'), terms).map(
        (term) => `${relative(projectRoot, filePath)}: ${term}`,
      ),
    );
    expect(violations).toEqual([]);
  });

  it('forest / devソースがMath.randomを使わない', () => {
    const violations = [...forestFiles, ...devFiles]
      .filter((filePath) => containsMathRandom(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(projectRoot, filePath));
    expect(violations).toEqual([]);
  });

  it('animation loop内にforest識別子がなく、抽出範囲が十分長い', () => {
    const source = readFileSync(join(projectRoot, 'src/scene/sceneSetup.ts'), 'utf8');
    const range = findAnimationLoopRange(source);
    const diagnostic = rangeDiagnostic(range.startLine, range.endLine, range.lineCount);
    expect(findForestIdentifiers(range.code), diagnostic).toEqual([]);
  });
});

describe('positive controls', () => {
  it('shader注入APIを合成文字列から検出する', () => {
    expect(findForbiddenTerms('new ShaderMaterial()', ['ShaderMaterial'])).toEqual([
      'ShaderMaterial',
    ]);
  });

  it('shadow APIを合成文字列から検出する', () => {
    expect(findForbiddenTerms('mesh.castShadow = true', ['castShadow'])).toEqual([
      'castShadow',
    ]);
  });

  it('Math.randomを合成文字列から検出する', () => {
    expect(containsMathRandom('const value = Math.random()')).toBe(true);
  });

  it('括弧を含むコメント・文字列・templateを無視し、合成loop内のforestを検出する', () => {
    const filler = Array.from({ length: 105 }, (_, index) => `work(${index});`).join('\n');
    const source = [
      'renderer.setAnimationLoop((time) => {',
      "const ignored = ')}]'; // }) must not close the call",
      'const template = `ignored ) } ] (`;',
      '/* }]) must not close the call */',
      filler,
      'forestController.update(time);',
      '});',
      'outsideLoop();',
    ].join('\n');
    const range = findAnimationLoopRange(source);

    expect(range.lineCount).toBeGreaterThanOrEqual(100);
    expect(findForestIdentifiers(range.code)).toContain('forestController');
    expect(range.code).not.toContain('outsideLoop');
  });
});
