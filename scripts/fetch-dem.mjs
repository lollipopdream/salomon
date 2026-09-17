import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CENTER = { lat: 35.6255, lng: 139.2432 };
const RADIUS_METERS = 1_800;
const ZOOM = 14;
const METERS_PER_DEGREE_LATITUDE = 111_320;
// Source: Geospatial Information Authority of Japan (GSI), elevation tiles ("dem_png").
// Note: the path segment is "dem_png", not "dem" — verified against the live endpoint
// (2026-08-11) after the initial "dem" path returned HTTP 404 for all tiles in range.
const TILE_URL_TEMPLATE =
  'https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputRoot = resolve(scriptDirectory, '../public/data/dem');

function latLngToTileXY(lat, lng, zoom) {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 -
      Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
      2) *
      n,
  );
  return { x, y };
}

function getTileRange(center, radiusMeters, zoom) {
  const latitudeDelta = radiusMeters / METERS_PER_DEGREE_LATITUDE;
  const longitudeDelta =
    radiusMeters /
    (METERS_PER_DEGREE_LATITUDE * Math.cos((center.lat * Math.PI) / 180));

  const corners = [
    { lat: center.lat + latitudeDelta, lng: center.lng - longitudeDelta },
    { lat: center.lat + latitudeDelta, lng: center.lng + longitudeDelta },
    { lat: center.lat - latitudeDelta, lng: center.lng - longitudeDelta },
    { lat: center.lat - latitudeDelta, lng: center.lng + longitudeDelta },
  ].map(({ lat, lng }) => latLngToTileXY(lat, lng, zoom));

  return {
    minX: Math.min(...corners.map(({ x }) => x)),
    maxX: Math.max(...corners.map(({ x }) => x)),
    minY: Math.min(...corners.map(({ y }) => y)),
    maxY: Math.max(...corners.map(({ y }) => y)),
  };
}

function tileUrl(z, x, y) {
  return TILE_URL_TEMPLATE.replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
}

async function fetchTile(z, x, y) {
  const url = tileUrl(z, x, y);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const destination = resolve(outputRoot, String(z), String(x), `${y}.png`);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
  console.log(`Saved ${url} -> ${destination}`);
}

const range = getTileRange(CENTER, RADIUS_METERS, ZOOM);
const centerTile = latLngToTileXY(CENTER.lat, CENTER.lng, ZOOM);
console.log(
  `DEM z${ZOOM}: center tile ${centerTile.x}/${centerTile.y}, ` +
    `range x=${range.minX}..${range.maxX}, y=${range.minY}..${range.maxY}`,
);

let succeeded = 0;
let failed = 0;

for (let x = range.minX; x <= range.maxX; x += 1) {
  for (let y = range.minY; y <= range.maxY; y += 1) {
    try {
      await fetchTile(ZOOM, x, y);
      succeeded += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed ${tileUrl(ZOOM, x, y)}: ${message}`);
    }
  }
}

console.log(`DEM download complete: ${succeeded} succeeded, ${failed} failed.`);
if (failed > 0) {
  process.exitCode = 1;
}
