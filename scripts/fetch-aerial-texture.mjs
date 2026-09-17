import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The preflight-confirmed range is the z14 DEM grid (x=14528-14530,
// y=6453-6455) scaled by 2 zoom levels (4x in each axis).
const ZOOM = 16;
const X_MIN = 58112;
const X_MAX = 58123;
const Y_MIN = 25812;
const Y_MAX = 25823;
const TILE_SIZE = 256;
const TILE_URL_TEMPLATE =
  'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const temporaryRoot = resolve(scriptDirectory, '../.aerial-texture-tmp');
const tileRoot = resolve(temporaryRoot, 'tiles');
// This is an intermediate output only; a later step will choose and write the
// final asset under public/data/terrain-texture/.
const outputPath = resolve(temporaryRoot, 'takao-aerial-z16.webp');

function tileUrl(z, x, y) {
  return TILE_URL_TEMPLATE.replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
}

function tilePath(z, x, y) {
  return resolve(tileRoot, String(z), String(x), `${y}.jpg`);
}

async function fetchTile(z, x, y) {
  const url = tileUrl(z, x, y);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const destination = tilePath(z, x, y);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
  console.log(`Saved ${url} -> ${destination}`);
}

function runFfmpeg(args) {
  return new Promise((fulfill, reject) => {
    const child = spawn('ffmpeg', args, { stdio: 'inherit' });

    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code === 0) {
        fulfill();
        return;
      }

      const reason = signal === null ? `exit code ${code}` : `signal ${signal}`;
      reject(new Error(`ffmpeg failed with ${reason}`));
    });
  });
}

async function generateMosaic() {
  const inputArguments = [];
  const inputLabels = [];
  const layout = [];
  let inputIndex = 0;

  // XYZ y increases southward, so Y_MIN is row 0 (the image top). X_MIN is
  // column 0 (the image left). Inputs are deliberately enumerated row-major.
  for (let y = Y_MIN; y <= Y_MAX; y += 1) {
    const row = y - Y_MIN;
    for (let x = X_MIN; x <= X_MAX; x += 1) {
      const col = x - X_MIN;
      inputArguments.push('-i', tilePath(ZOOM, x, y));
      inputLabels.push(`[${inputIndex}:v]`);
      layout.push(`${col * TILE_SIZE}_${row * TILE_SIZE}`);
      inputIndex += 1;
    }
  }

  const filter =
    `${inputLabels.join('')}xstack=inputs=${inputIndex}:` +
    `layout=${layout.join('|')}[mosaic]`;

  await mkdir(dirname(outputPath), { recursive: true });
  await runFfmpeg([
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    ...inputArguments,
    '-filter_complex',
    filter,
    '-map',
    '[mosaic]',
    '-frames:v',
    '1',
    '-c:v',
    'libwebp',
    '-lossless',
    '1',
    outputPath,
  ]);

  console.log(`Saved aerial texture mosaic -> ${outputPath}`);
}

const columns = X_MAX - X_MIN + 1;
const rows = Y_MAX - Y_MIN + 1;
const total = columns * rows;
console.log(
  `Aerial photo z${ZOOM}: range x=${X_MIN}..${X_MAX}, ` +
    `y=${Y_MIN}..${Y_MAX} (${columns}x${rows}, ${total} tiles)`,
);

let succeeded = 0;
let failed = 0;
const failedTiles = [];

// Fetch sequentially to avoid placing an unbounded request load on GSI.
for (let x = X_MIN; x <= X_MAX; x += 1) {
  for (let y = Y_MIN; y <= Y_MAX; y += 1) {
    try {
      await fetchTile(ZOOM, x, y);
      succeeded += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      failedTiles.push({ x, y, error: message });
      console.error(`Failed ${tileUrl(ZOOM, x, y)}: ${message}`);
    }
  }
}

console.log(
  `Aerial photo download complete: ${succeeded} succeeded, ${failed} failed.`,
);
if (failed > 0) {
  console.error('Mosaic generation skipped. Failed tiles:');
  for (const tile of failedTiles) {
    console.error(`  x=${tile.x}, y=${tile.y}: ${tile.error}`);
  }
  process.exitCode = 1;
} else {
  try {
    await generateMosaic();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Mosaic generation failed: ${message}`);
    process.exitCode = 1;
  }
}
