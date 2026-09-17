// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
import { createHash } from 'node:crypto';
// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
import { existsSync, readFileSync } from 'node:fs';
// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { forestImpostorV2Defaults } from '../../config/defaults/forestImpostorV2';
import { parseGroveTopCapMeta } from './groveTopCapMeta';
import { parseImpostorAtlasMeta } from './impostorAtlasMeta';

// @ts-expect-error このプロジェクトはNode型定義を依存に含めない。
const projectRoot = process.cwd();
const publicRoot = join(projectRoot, 'public');
const assetRoot = join(publicRoot, 'data/forest/impostor-v2');
const metadataPath = join(assetRoot, 'impostor-atlas-meta.json');
const topMetadataPath = join(assetRoot, 'grove_top_atlas_meta.json');

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

describe('forest impostor v2 asset integrity', () => {
  it('runtime metadata と 2 枚の atlas PNG が存在する', () => {
    for (const file of [
      'impostor-atlas-meta.json',
      'tree_atlas_2048.png',
      'grove_atlas_3072x2048.png',
      'grove_top_atlas_meta.json',
      'grove_top_atlas_3072x2048.png',
    ]) {
      expect(existsSync(join(assetRoot, file)), file).toBe(true);
    }
  });

  it('top atlas sha256 is pinned and agrees with its metadata', () => {
    const raw = readJson(topMetadataPath) as { atlas: { file: string; sha256: string } };
    const expected = '2fc0c887f0e44306862cd331c9692fcee3288589a0046d9cd8d6f0611ebf770e';
    const actual = sha256(join(assetRoot, raw.atlas.file));
    expect(actual).toBe(expected);
    expect(raw.atlas.sha256).toBe(actual);
  });

  it('atlas PNG の sha256 が runtime metadata と実測期待値に一致する', () => {
    const raw = readJson(metadataPath) as {
      atlases: Record<'tree' | 'grove', { file: string; sha256: string }>;
    };
    // 2026-09-13 の one-shot bake で実測した atlas の sha256 を pin する。
    // atlas を再 bake した場合は次の 2 箇所を必ず同時に更新すること:
    //   1) public/data/forest/impostor-v2/impostor-atlas-meta.json(bake が生成)
    //   2) この expected(pin)
    // 片方だけ更新すると本テストが落ちて差異を知らせる(意図した fail-loud)。
    const expected = {
      tree: 'ea88e5e015476dc66b28e2a1c9f5513afd1bc57b2e588c68a001a6cb96fa80ec',
      grove: '709388457f4987ec781fb9971ecc1d7659d11588ab57dbc6d09334c75c5bf2d2',
    } as const;

    for (const atlas of ['tree', 'grove'] as const) {
      const actual = sha256(join(assetRoot, raw.atlases[atlas].file));
      expect(actual).toBe(expected[atlas]);
      expect(raw.atlases[atlas].sha256).toBe(actual);
    }
  });

  it('runtime metadata は parser を通り 56 cells を持つ', () => {
    const parsed = parseImpostorAtlasMeta(readJson(metadataPath));
    expect(parsed.cells).toHaveLength(56);
  });

  it('top metadata は parser を通り 24 cells を持つ', () => {
    const parsed = parseGroveTopCapMeta(readJson(topMetadataPath));
    expect(parsed).not.toBeNull();
    expect(parsed!.cells).toHaveLength(24);
  });

  it('default assets の URL は public 配下の実ファイルへ解決する', () => {
    for (const url of Object.values(forestImpostorV2Defaults.assets)) {
      expect(url.startsWith('/')).toBe(true);
      expect(existsSync(join(publicRoot, url.slice(1))), url).toBe(true);
    }
  });

  it('共有 forest mask と metadata は存在し、v2 defaults と一致する', () => {
    const maskPath = join(publicRoot, 'data/forest/takao-forest-mask.png');
    const maskMetaPath = join(publicRoot, 'data/forest/takao-forest-mask-meta.json');
    expect(existsSync(maskPath)).toBe(true);
    expect(existsSync(maskMetaPath)).toBe(true);

    const maskMeta = readJson(maskMetaPath) as {
      worldExtentMeters: number;
      size: number;
    };
    expect(maskMeta.worldExtentMeters).toBe(5940.950684);
    expect(maskMeta.size).toBe(1024);
    expect(forestImpostorV2Defaults.mask.extentMeters).toBe(maskMeta.worldExtentMeters);
    expect(forestImpostorV2Defaults.mask.size).toBe(maskMeta.size);
  });
});
