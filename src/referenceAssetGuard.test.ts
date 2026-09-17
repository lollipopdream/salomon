/**
 * ユーザー提供のreference画像は完成ビジュアルの方向性を示す資料であり、runtime assetとして
 * 使用してはならない。この回帰テストは参照文字列、コピー、名前付きassetの混入を検出する。
 *
 * dist/の検証はproduction buildを要するため本テストの対象外とし、リーダーが最終検証で
 * `grep -rl "mt-takao-terrain-reference" dist/` などを用いて別途確認する。
 */
// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
import { createHash } from 'node:crypto';
// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
import { existsSync, readFileSync, readdirSync } from 'node:fs';
// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
import { basename, join, relative } from 'node:path';
import { expect, it } from 'vitest';

// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
const projectRoot = process.cwd();
const referencePath = join(
  projectRoot,
  'docs/references/visual-targets/mt-takao-terrain-reference.png',
);
const excludedDirectoryNames = new Set(['node_modules', 'dist', '.git']);
const forbiddenFragments = [
  'docs/references',
  'visual-targets',
  'mt-takao-terrain-reference',
];

function findFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!excludedDirectoryNames.has(entry.name)) {
        files.push(...findFiles(join(directory, entry.name)));
      }
      continue;
    }

    if (entry.isFile()) {
      files.push(join(directory, entry.name));
    }
  }

  return files;
}

function sha256(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

it('reference画像が存在し、検証が空振りしていないこと', () => {
  expect(existsSync(referencePath)).toBe(true);
});

it('srcのTypeScriptがreference画像を参照していないこと', () => {
  const sourceFiles = findFiles(join(projectRoot, 'src')).filter(
    (filePath) =>
      filePath.endsWith('.ts') &&
      basename(filePath) !== 'referenceAssetGuard.test.ts',
  );
  const violations = sourceFiles.flatMap((filePath) => {
    const contents = readFileSync(filePath, 'utf8');
    const matchedFragments = forbiddenFragments.filter((fragment) =>
      contents.includes(fragment),
    );

    return matchedFragments.map(
      (fragment) => `${relative(projectRoot, filePath)}: ${fragment}`,
    );
  });

  expect(violations).toEqual([]);
});

it('index.htmlがreference画像を参照していないこと', () => {
  const indexContents = readFileSync(join(projectRoot, 'index.html'), 'utf8');
  const violations = forbiddenFragments.filter((fragment) =>
    indexContents.includes(fragment),
  );

  expect(violations).toEqual([]);
});

it('public内にreference画像と同一SHA-256のファイルがないこと', () => {
  const referenceHash = sha256(referencePath);
  const matchingFiles = findFiles(join(projectRoot, 'public')).filter(
    (filePath) => sha256(filePath) === referenceHash,
  );

  expect(matchingFiles.map((filePath) => relative(projectRoot, filePath))).toEqual([]);
});

it('public内にreference画像名を含むファイルがないこと', () => {
  const prohibitedFiles = findFiles(join(projectRoot, 'public')).filter((filePath) =>
    basename(filePath).includes('mt-takao-terrain-reference'),
  );

  expect(prohibitedFiles.map((filePath) => relative(projectRoot, filePath))).toEqual([]);
});

it("ViteのpublicDirが'public'に固定されていること", () => {
  const viteConfig = readFileSync(join(projectRoot, 'vite.config.ts'), 'utf8');

  expect(viteConfig).toContain("publicDir: 'public'");
});
