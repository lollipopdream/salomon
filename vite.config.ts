// @ts-expect-error -- Node builtin; this project has no @types/node dependency, but
// node:fs is always available at runtime under Vite's Node dev server.
import { mkdirSync, writeFileSync } from 'node:fs';
// @ts-expect-error -- Node builtin; see note above.
import { dirname, join } from 'node:path';
// @ts-expect-error -- Node builtin; see note above.
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

import { resolveStillExportTarget } from './src/dev/stillExportName';

const here: string = dirname(fileURLToPath(import.meta.url));
const STILL_EXPORT_ROOT: string = join(here, 'outputs', 'matsu-h01-takao-local-still-export');
const STILL_EXPORT_PATHNAME = '/__still-export';
const MAX_BODY_BYTES = 64 * 1024 * 1024; // 64 MiB

/**
 * DEV限定: 高尾山1号路 scene から書き出す高品質静止画(PNG)を
 * `outputs/matsu-h01-takao-local-still-export/<bucket>/<fileName>` へ保存する middleware。
 * production build には含まれない(apply: 'serve')。
 */
function takaoStillExportPlugin(): Plugin {
  return {
    name: 'takao-still-export',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.method !== 'POST') {
          next();
          return;
        }

        let url: URL;
        try {
          url = new URL(req.url, 'http://localhost');
        } catch {
          // 不正な req.url。自分の担当リクエストではないものとして素通しする。
          next();
          return;
        }
        if (url.pathname !== STILL_EXPORT_PATHNAME) {
          next();
          return;
        }

        const sendJson = (statusCode: number, payload: unknown): void => {
          if (res.headersSent) return;
          res.statusCode = statusCode;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(payload));
        };

        const bucket = url.searchParams.get('bucket') ?? '';
        const name = url.searchParams.get('name') ?? '';
        const target = resolveStillExportTarget(bucket, name);

        if (!target) {
          sendJson(400, { ok: false, error: 'invalid bucket or name' });
          return;
        }

        const chunks: any[] = [];
        let totalBytes = 0;
        let responded = false;

        req.on('data', (chunk: any) => {
          if (responded) return;
          totalBytes += chunk.length;
          if (totalBytes > MAX_BODY_BYTES) {
            responded = true;
            sendJson(413, { ok: false, error: 'payload too large' });
            req.destroy();
            return;
          }
          chunks.push(chunk);
        });

        req.on('error', (error: unknown) => {
          if (responded) return;
          responded = true;
          console.error('[takao-still-export] request error:', error);
          if (res.headersSent) {
            req.destroy();
            return;
          }
          sendJson(500, { ok: false, error: 'write failed' });
        });

        req.on('end', () => {
          if (responded) return;
          responded = true;
          try {
            // @ts-expect-error -- Buffer is a Node global, unavailable without @types/node.
            const body = Buffer.concat(chunks);
            const dir = join(STILL_EXPORT_ROOT, target.bucket);
            mkdirSync(dir, { recursive: true });
            const filePath = join(dir, target.fileName);
            writeFileSync(filePath, body);
            sendJson(200, {
              ok: true,
              path: `outputs/matsu-h01-takao-local-still-export/${target.bucket}/${target.fileName}`,
              bytes: body.length,
            });
          } catch (error) {
            console.error('[takao-still-export] write failed:', error);
            sendJson(500, { ok: false, error: 'write failed' });
          }
        });
      });
    },
  };
}

export default defineConfig({
  publicDir: 'public',
  plugins: [takaoStillExportPlugin()],
});
