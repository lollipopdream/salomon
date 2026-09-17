# Takao aerial terrain texture

- Deployed asset: `takao-aerial.webp`
- Dataset: GSI (国土地理院) 「全国最新写真（シームレス）」 (`seamlessphoto`)
- Zoom: 16
- Tile range: x=58112-58123, y=25812-25823
- Tile count: 144 (12 x 12)
- Mosaic resolution: 3072 x 3072 px
- Acquisition date: 2026-08-15
- Processing: 144 tiles mosaicked in XYZ order via ffmpeg `xstack`; x ascends west to east (left to right), y ascends north to south (top to bottom), so north is up and west is left.
- Attribution: 「地理院タイル（写真）を加工して作成」
- Source and dataset listing: https://maps.gsi.go.jp/development/ichiran.html
- Tile URL template: `https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg`
- Regeneration: `scripts/fetch-aerial-texture.mjs` (`npm run fetch:aerial-texture`)

The application uses this bundled production asset and does not depend on the external tile service at runtime.
