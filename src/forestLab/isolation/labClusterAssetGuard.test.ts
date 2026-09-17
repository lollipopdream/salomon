// @ts-expect-error This project intentionally has no Node type dependency.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
// @ts-expect-error This project intentionally has no Node type dependency.
import { dirname, join, relative } from 'node:path';
// @ts-expect-error This project intentionally has no Node type dependency.
import { fileURLToPath } from 'node:url';
import { forestImpostorV2Defaults } from '../../config/defaults/forestImpostorV2';
import { IMPOSTOR_V2_GROVE_TOP_ASSET_URLS } from '../scene/labDataSources';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../');

const SCANNED_EXTENSIONS = ['.ts', '.json', '.mjs'];

function filesBelow(directory: string): string[] {
  if (!existsSync(directory)) return [];
  const result: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...filesBelow(path));
    else result.push(path);
  }
  return result;
}

function isScannedFile(path: string): boolean {
  return SCANNED_EXTENSIONS.some((extension) => path.endsWith(extension));
}

function isTestFile(path: string): boolean {
  return path.endsWith('.test.ts');
}

function scannableFiles(directory: string, { excludeTests }: { excludeTests: boolean }): string[] {
  return filesBelow(directory)
    .filter(isScannedFile)
    .filter((path) => !excludeTests || !isTestFile(path));
}

/** Extracts the contents of quoted string literals (', ", `) from source text. */
function extractStringLiterals(source: string): string[] {
  const literals: string[] = [];
  const regex = /(['"`])((?:\\.|(?!\1).)*)\1/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source)) !== null) {
    literals.push(match[2]);
  }
  return literals;
}

const FORBIDDEN_GEOMETRY_NAMES = [
  'SphereGeometry', 'IcosahedronGeometry', 'ConeGeometry', 'CylinderGeometry',
  'DodecahedronGeometry', 'TorusGeometry', 'LatheGeometry', 'TetrahedronGeometry',
];

const FORBIDDEN_BLENDER_TOKENS = ['blender', 'bpy', '--background'];

const ALLOWED_ASSET_BASENAMES = new Set([
  'tree_atlas_2048.png',
  'grove_atlas_3072x2048.png',
  'grove-atlas-r3-dense-broadleaf-3072x2048.png',
  'impostor-atlas-meta.json',
  'far-canopy-2048.png',
  'far-canopy-meta.json',
  'far-canopy-r1-2048.png',
  'far-canopy-r1-meta.json',
  'far-canopy-r2-2048.png',
  'far-canopy-r2-meta.json',
  'far-canopy-r4-2048.png',
  'far-canopy-r4-meta.json',
  'far-canopy-r5-2048.png',
  'far-canopy-r5-meta.json',
  // R9 iteration 1: canonical far-canopy-2048.png を読み取り専用の入力として、
  // linear light で青チャネルへ加算オフセット c = 0.0180 を足した phase-local な far canopy。
  // R8 の grove(i1)/ tree(i2b)と同一機構。R / G / alpha は不変(実測 mismatch 0 / 0 / 0)、
  // alpha==0 の 593,814 texel は canonical の convention どおり RGB=(0,0,0) のまま。
  // c = 0.0180 は R8 の値であって far canopy の答えではなく、far canopy は
  // vertexColors 乗算 + fog 合成を挟むため、実効 gain を実測するための calibration probe である。
  // canonical は 1 byte も書き換えていない。Blender は起動していない。
  'far-canopy-r9-i1-skylight-blue-2048.png',
  'far-canopy-r9-i1-skylight-blue-meta.json',
  // R9 iteration 2: i1 と同一機構で、offset だけを far canopy 自身の実測 gain から
  // 解いた c = 0.0218 にしたもの。R / G / alpha は不変、alpha==0 は RGB=(0,0,0) のまま。
  'far-canopy-r9-i2-farcanopy-fit-2048.png',
  'far-canopy-r9-i2-farcanopy-fit-meta.json',
  // R9 iteration 3(最終候補): 同一機構で c = 0.0230。3 camera すべてを
  // R8 補正済み component と同じ帯(+1.4〜+3.9)へ入れるために解いた値。
  'far-canopy-r9-i3-farcanopy-fit-2048.png',
  'far-canopy-r9-i3-farcanopy-fit-meta.json',
  'grove-atlas-r4-fine-grain-3072x2048.png',
  // R7: R3 atlas の G4 4 cell だけを real-3D cluster proxy へ差し替えた phase-local atlas。
  'grove-atlas-r7-g4-real3d-3072x2048.png',
  // R7 corrective: same G4 cells re-baked as a 20-tree micro-canopy cluster.
  'grove-atlas-r7-g4v2-micro-canopy-3072x2048.png',
  // R7 v3 corrective: same G4 cells again, 32 trees, densified with a lowered
  // infill tier so trunks sit behind neighbouring crowns.
  'grove-atlas-r7-g4v3-densify-3072x2048.png',
  // R7 v4 corrective: v3's bake with the blue component of both light sources
  // scaled, so the canopy stops reading khaki. Same geometry, same cells.
  'grove-atlas-r7-g4v4-canopy-chroma-3072x2048.png',
  // R8 iteration 1: v4 atlas を base に、**非 G4 の grove cell 20 枚**(G1/G2/G3/G5/G6 × 4 yaw)
  // の青チャネルだけを linear light で c = 0.0180 だけ持ち上げたもの。
  // reference forest は暗い森ほど青い(L*=5 で b* −4.6、L*=63 で +37.9)のに対し、
  // v4 の非 G4 cell は全域でカーキのままで、同じ L* の期待値から +8.9〜+15.1 ずれていた。
  // R / G / alpha は 1 byte も変えておらず、G4 の 4 cell も byte 単位で不変(実測 0 画素差)。
  // Blender は起動していない(決定的な cell RGB 変換のみ)。
  'grove-atlas-r8-i1-skylight-blue-3072x2048.png',
  // R8 iteration 2b: production default の tree_atlas_2048.png を **読み取り専用の入力**として
  // 同じ機構を適用した phase-local な tree atlas。c は variant ごとに fit してあり
  // (FIR_A/FIR_B/FIR_C = 0.0180、BL = 0.0105)、単一 c だと BL だけ reference を
  // 越えて青へ過補正されたため分けた。production asset 自体は書き換えていない
  // (実行前後の SHA-256 一致を assert 済み)。R / G / alpha は不変。
  'tree-atlas-r8-i2b-pervariant-blue-2048x2048.png',
  // R8 iteration 2(単一 c 版)。BL の過補正により **不採用** だが、比較のため削除せず残している。
  'tree-atlas-r8-i2-skylight-blue-2048x2048.png',
  // R6: production の grove top-cap atlas。Lab からは read-only で参照するだけで、
  // 新規 bake も download もしていない。
  'grove_top_atlas_3072x2048.png',
  'grove_top_atlas_meta.json',
  'tree-atlas-r4-crown-dominant-2048x2048.png',
  'takao-forest-mask.png',
]);

describe('Forest Lab cluster asset guard', () => {
  it('never uses procedural geometry primitives in cluster or generated modules', () => {
    const clusterFiles = scannableFiles(join(root, 'src/forestLab/cluster'), { excludeTests: true });
    const generatedFiles = scannableFiles(join(root, 'src/forestLab/generated'), { excludeTests: false });
    for (const path of [...clusterFiles, ...generatedFiles]) {
      const source = readFileSync(path, 'utf8');
      for (const token of FORBIDDEN_GEOMETRY_NAMES) {
        expect(source, `${relative(root, path)} contains ${token}`).not.toContain(token);
      }
    }
  });

  it('never references Blender / bpy / headless CLI invocation', () => {
    const forestLabFiles = scannableFiles(join(root, 'src/forestLab'), { excludeTests: true });
    const toolFiles = scannableFiles(
      join(root, 'outputs/matsu-h01-forest-lab-reference-locked-cluster-hlod-prototype/tools'),
      { excludeTests: true },
    );
    for (const path of [...forestLabFiles, ...toolFiles]) {
      const source = readFileSync(path, 'utf8').toLowerCase();
      for (const token of FORBIDDEN_BLENDER_TOKENS) {
        expect(source, `${relative(root, path)} contains ${token}`).not.toContain(token.toLowerCase());
      }
    }
  });

  it('only references the allow-listed asset files from cluster modules', () => {
    const clusterFiles = scannableFiles(join(root, 'src/forestLab/cluster'), { excludeTests: true });
    const assetPattern = /[A-Za-z0-9_./-]+\.(?:png|json)/g;
    let checkedAny = false;
    for (const path of clusterFiles) {
      const source = readFileSync(path, 'utf8');
      for (const literal of extractStringLiterals(source)) {
        const matches = literal.match(assetPattern);
        if (!matches) continue;
        for (const match of matches) {
          checkedAny = true;
          const basename = match.split('/').pop()!;
          expect(
            ALLOWED_ASSET_BASENAMES.has(basename),
            `${relative(root, path)} references disallowed asset "${match}"`,
          ).toBe(true);
        }
      }
    }
    expect(checkedAny).toBe(true);
  });

  it('keeps the prior-phase visual evidence directory intact', () => {
    const visualDirectory = join(
      root,
      'outputs/matsu-h01-takao-forest-visual-lab-architecture-bakeoff/visual',
    );
    const entries = readdirSync(visualDirectory, { withFileTypes: true });
    let fileCount = 0;
    for (const entry of entries) {
      if (entry.isFile()) fileCount += 1;
    }
    expect(fileCount).toBeGreaterThanOrEqual(20);
  });

  // R6 phase reviewer #6 への対応。
  //
  // reviewer は「R6 の grove top-cap atlas が allow-list に無く、定数経由参照なので
  // literal scan を素通りする」と指摘した。調べたところ実態はもう一歩良く、
  // **Lab 側には top atlas の文字列リテラルが存在しない**。URL は production の
  // forestImpostorV2Defaults からそのまま来ている(labDataSources.ts:162-165)。
  // つまり R6 は新しい asset パスを 1 つも導入していない。
  //
  // literal scan ではこの性質を検証できない(見るべき literal が無いため)。
  // 代わりに値レベルで「Lab が参照する top-cap URL は production 既定と同一であり、
  // その basename は allow-list 済み」を固定する。Lab が独自の asset パスを
  // 発明したらここで落ちる。
  it('binds the grove top-cap atlas straight from the production defaults, inventing no new asset path', () => {
    expect(IMPOSTOR_V2_GROVE_TOP_ASSET_URLS.groveTopAtlasUrl)
      .toBe(forestImpostorV2Defaults.assets.groveTopAtlasUrl);
    expect(IMPOSTOR_V2_GROVE_TOP_ASSET_URLS.groveTopMetaUrl)
      .toBe(forestImpostorV2Defaults.assets.groveTopMetaUrl);

    for (const url of Object.values(IMPOSTOR_V2_GROVE_TOP_ASSET_URLS)) {
      const basename = url.split('/').pop()!;
      expect(
        ALLOWED_ASSET_BASENAMES.has(basename),
        `Lab binds top-cap asset "${url}" which is not allow-listed`,
      ).toBe(true);
    }
  });
});
