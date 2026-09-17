// @ts-expect-error This project intentionally has no Node type dependency.
import { createHash } from 'node:crypto';
// @ts-expect-error This project intentionally has no Node type dependency.
import { readdirSync, readFileSync } from 'node:fs';
// @ts-expect-error This project intentionally has no Node type dependency.
import { dirname, join, relative } from 'node:path';
// @ts-expect-error This project intentionally has no Node type dependency.
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { backgroundDefaults } from '../../config/defaults/background';
import { forestImpostorV2Defaults } from '../../config/defaults/forestImpostorV2';
import { lightingDefaults } from '../../config/defaults/lighting';
import { terrainMaterialDefaults } from '../../config/defaults/terrainVisual';
import { defaultSettings } from '../../config/settings';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../');

function filesBelow(directory: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...filesBelow(path));
    else result.push(path);
  }
  return result;
}

describe('Forest Lab isolation guard', () => {
  it('keeps production entry files byte-identical', () => {
    const expected = {
      'index.html': '8e50e3f20fd6a2e6834b93f30ab409ef7fce077dd3ec498f41c94cbac617a517',
      'src/main.ts': 'f9abfc6aa1c704fd773b8ab829eab5e2d20ef0b042d6b1eff4bd4dbd1564afa6',
      'vite.config.ts': '7425fa3100a273fdc1f3a02b8797395507cfa7c00a5cf6d30d8e9c3f4978633f',
    };
    for (const [path, hash] of Object.entries(expected)) {
      expect(createHash('sha256').update(readFileSync(join(root, path))).digest('hex')).toBe(hash);
    }
  });

  it('uses only the dedicated Lab entry and has no production back-reference', () => {
    const html = readFileSync(join(root, 'forest-lab.html'), 'utf8');
    expect(html).toContain('/src/forestLab/forestLabMain.ts');
    expect(html).not.toContain('/src/main.ts');
    expect(readFileSync(join(root, 'src/main.ts'), 'utf8')).not.toContain('forestLab');
    expect(readFileSync(join(root, 'src/scene/sceneSetup.ts'), 'utf8')).not.toContain('forestLab');
  });

  it('keeps forbidden renderer and nondeterministic APIs out of implementation modules', () => {
    const forbidden = [
      'Math.random', 'castShadow', 'receiveShadow', 'shadowMap',
      'ShaderMaterial', 'onBeforeCompile',
    ];
    const implementationFiles = filesBelow(join(root, 'src/forestLab'))
      .filter((path) => path.endsWith('.ts') && !path.endsWith('.test.ts'));
    for (const path of implementationFiles) {
      const source = readFileSync(path, 'utf8');
      for (const token of forbidden) {
        expect(source, `${relative(root, path)} contains ${token}`).not.toContain(token);
      }
    }
  });

  it('does not add Forest Lab files below production forest or dev', () => {
    for (const directory of ['src/forest', 'src/dev']) {
      const names = filesBelow(join(root, directory)).map((path) => relative(root, path));
      expect(names.filter((name) => name.toLowerCase().includes('forestlab'))).toEqual([]);
    }
  });

  it('does not mutate production defaults when Lab modules load', async () => {
    const before = structuredClone({
      forestImpostorV2Defaults,
      terrainMaterialDefaults,
      lightingDefaults,
      backgroundDefaults,
      defaultSettings,
    });
    await Promise.all([
      import('../candidates/candidateController'),
      import('../configDump'),
      import('../forestLabMain'),
    ]);
    expect({
      forestImpostorV2Defaults,
      terrainMaterialDefaults,
      lightingDefaults,
      backgroundDefaults,
      defaultSettings,
    }).toEqual(before);
  });
});
