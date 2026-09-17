# SALOMON 高尾山 3D マウンテンアニメーション — ソース引き渡しパッケージ

このパッケージは、現在 VPS 上でプレビュー公開している **R12route 版**（2026-09-16 ビルド）と
**同一のソース状態**をそのまま固めたものです。引き渡しのために新たな改修・整理・
リファクタリングは一切行っていません。

---

## 1. このプロジェクトは何か

SALOMON 高尾店のデジタルサイネージ構想「AI MOUNTAIN CONCIERGE」のうち、
**高尾山の 3D アニメーション部分だけ**を先行検証している PoC（技術検証版）です。
AI コンシェルジュ本体やサイネージ全体のシステムは含みません。

- 実データの標高（国土地理院 DEM）から高尾山周辺の 3D 地形を生成
- その上に OpenStreetMap 由来の「1 号路」ルートを地形追従で描画
- 麓 → 山頂へルートが伸びるアニメーション、主要地点ラベル、自動カメラ演出
- 3D 森林表現（インポスター方式）

技術スタック: **TypeScript + Vite + Three.js（WebGL）**

> **これは製品版ではなくプレビュー実装（PoC v0.1）です。**
> 16:9 サイネージ統合、店舗実機での動作確認は未実施です。

---

## 2. このソースの状態

現在公開中のプレビュー **R12route**（`r12route-20260916-122106`）と同じソース状態です。

| 項目 | 値 |
|---|---|
| 配信中バンドル | `assets/index-DvdWGnVo.js` |
| バンドル SHA-256 | `8e1f697c73e8c97a00cd09a4d552f19f0024035709dd8f52c5fc7126e9475e0b` |
| index.html SHA-256 | `2baedbaa7e88a6e23d76db0e8b197c6ef745ece7eedfe2420f37499f5c69d39e` |
| 配信物 | 33 ファイル / 約 69 MB |

R12route で入っている変更は「ルート線を白く・太く」（`?routeWhite=1` の下でのみ有効）のみで、
森林（forest）は直前の R11-K と完全に同一です。

---

## 3. 必要な実行環境

| 項目 | 要件 | 根拠 |
|---|---|---|
| Node.js | `^20.19.0 \|\| >=22.12.0` | 同梱 `package-lock.json` の vite 7.3.6 の `engines` |
| パッケージマネージャ | **npm**（`package-lock.json` 同梱） | lockfile が npm 形式（lockfileVersion 3） |
| ブラウザ | Google Chrome（主な確認対象） | WebGL 必須 |

動作確認済みの実環境: **Node v24.19.0 / npm 11.17.0**（macOS）

yarn / pnpm 用の lockfile は同梱していません。`npm ci` を推奨します。

---

## 4. 依存関係のインストール

```sh
npm ci
```

（lockfile を無視して更新したい場合のみ `npm install`）

依存は少数です。

- 実行時: `three@0.179.1`
- 開発時: `vite@7.3.6` / `vitest@3.2.7` / `typescript@5.9.3` / `@types/three@0.179.0`

DEM タイル・航空写真テクスチャ・森林アトラスなどのアセットは **すべて同梱済み**です。
外部ダウンロードなしでそのまま起動できます。

---

## 5. 開発サーバーの起動

```sh
npm run dev
```

Vite の既定ポートで起動します（`vite.config.ts` にポート指定はありません）。

- 本編アプリ: <http://localhost:5173/>
- 森林ラボ（開発用ツール）: <http://localhost:5173/forest-lab.html>

---

## 6. ビルド

```sh
npm run build
```

出力先は Vite 既定の `dist/` です。

**現在公開中の R12route は、次のコマンドで生成したものです（実際に使用したコマンド）:**

```sh
npx vite build --base /r10-preview/r12route-20260916-122106/ --outDir dist-r12route
```

`--base` はサブディレクトリ配信のために必要です。ルート直下（`/`）で配信する場合は
`npm run build` のままで構いません。アセットの URL 解決は `src/config/assetBase.ts` の
`assetUrl()` が `import.meta.env.BASE_URL` を見て行っています。

---

## 7. ビルド結果のプレビュー / 実行

```sh
npm run preview
```

静的ファイル配信のみで動作します（サーバーサイド処理・API は一切ありません）。
`dist/` を任意の静的ホスティングへそのまま置けば動きます。

参考として、現在の VPS での Nginx 設定テンプレートを `deploy/` に同梱しています
（`nginx.conf.example` / `nginx.bootstrap.conf.example`）。パスワード等の秘密情報は含みません。

### テスト

```sh
npm run test -- --run
```

---

## 8. 必要なクエリパラメータ（重要）

**現在の見た目は、既定状態では再現しません。** 下記のクエリフラグを付けて開く必要があります。
いずれもソース上で実在を確認済みです（推測ではありません）。

| クエリ | 意味 | 実装位置 |
|---|---|---|
| `forestImpostorV2=1` | 森林インポスター v2 を有効化 | `src/forest/impostorV2/forestImpostorV2Flags.ts` |
| `forestImpostorV2TopCap=1` | 樹叢に上面キャノピーキャップを追加 | 同上 |
| `forestImpostorV2Material=unlit` | インポスターのライティングモデル | 同上 |
| `r10wide=1` | 広域カバレッジプリセット | 同上 |
| `r10dense=1` | 密度プリセット | 同上 |
| `r10atlas=1` | R10 アトラス差し替え | 同上 |
| `r10broad=1` | 広葉樹プリセット | 同上 |
| `r10tone=1` | トーン補正プリセット | 同上 |
| `r10light=v1` | マクロ陰影（macro shade）v1 | 同上 |
| `r10far=1` | 遠景キャノピーオーバーレイ | `src/forest/farCanopyOverlay.ts` |
| `routeWhite=1` | **ルート線を白く・太く** | `src/route/r11RouteStylePreset.ts` |

### ローカルでの再現

```
http://localhost:5173/?forestImpostorV2=1&r10wide=1&r10dense=1&r10far=1&r10light=v1&r10atlas=1&r10tone=1&r10broad=1&routeWhite=1&forestImpostorV2TopCap=1&forestImpostorV2Material=unlit
```

### 現在公開中のプレビュー URL（完全形）

```
https://49.212.213.226/r10-preview/r12route-20260916-122106/?forestImpostorV2=1&r10wide=1&r10dense=1&r10far=1&r10light=v1&r10atlas=1&r10tone=1&r10broad=1&routeWhite=1&forestImpostorV2TopCap=1&forestImpostorV2Material=unlit
```

（Basic 認証あり。ID / パスワードは別途ご連絡します。）

---

## 9. 主要ディレクトリ

| パス | 内容 |
|---|---|
| `index.html` | 本編アプリのエントリ HTML（`/src/main.ts` を読み込む） |
| `forest-lab.html` | 開発用の森林ラボのエントリ HTML |
| `src/` | アプリケーションソース（TypeScript）。`*.test.ts` は Vitest 用 |
| `public/` | ビルド時にそのまま配信へコピーされる静的アセット（約 65 MB） |
| `scripts/` | アセット再取得スクリプト（`npm run fetch:dem` 等）。通常は実行不要 |
| `deploy/` | Nginx 設定テンプレート（例。秘密情報なし） |
| `README.md` | プロジェクト本体の開発経緯ドキュメント |

### `src/` の主なサブディレクトリ

| パス | 内容 |
|---|---|
| `src/main.ts` | 本編アプリのエントリポイント |
| `src/scene/` | シーン構築・ラベル・出典表示 |
| `src/terrain/` | DEM 読み込み・地形メッシュ・地形マテリアル |
| `src/route/` | ルートのデータ・描画・進行・スポット到着 |
| `src/camera/` | カメラ演出（全景 / ルート追従 / 山頂 / 復帰） |
| `src/forest/` | 本編で使う森林実装 |
| `src/forestLab/` | **開発用の森林ラボ**（本編アプリの実行には不要） |
| `src/config/` | 設定値と既定値 |
| `src/animation/`, `src/geo/`, `src/interaction/`, `src/perf/`, `src/utils/` | 補助モジュール |

---

## 10. ルート / 森林実装の主要ファイル

### ルート

| ファイル | 役割 |
|---|---|
| `src/route/takaoTrail1Route.ts` | 1 号路のルート座標（OSM relation 1216428 由来、256 点、約 3875 m） |
| `src/route/routeVisual.ts` | ルート線の描画（Three.js `Line2` / `LineMaterial`） |
| `src/route/r11RouteStylePreset.ts` | **`?routeWhite=1` の白・太スタイルプリセット** |
| `src/config/defaults/route.ts` | ルート描画の既定値（フラグなし時の値。**変更していません**） |
| `src/route/routeProgress.ts`, `routePath.ts`, `routeGuidance.ts` | 進行率・経路・誘導 |
| `src/route/spotArrival.ts`, `src/scene/arrivalCard.ts` | スポット到着演出 |
| `src/scene/sceneSetup.ts` | ルートスタイルフラグの配線箇所 |

`?routeWhite=1` の実値（`r11RouteStylePreset.ts`）:

| レイヤ | 色 | 幅(px) | 不透明度 |
|---|---|---|---|
| base | `#ffffff` | 4 | 0.9 |
| core | `#ffffff` | 7.2 | 1 |
| halo 内 | `#ffffff` | 11.2 | 0.176 |
| halo 外 | `#ffffff` | 17.6 | 0.077 |

`worldUnits: false` のため、幅は **画面上の CSS ピクセル**です（ワールド単位ではありません）。

### 森林

| ファイル | 役割 |
|---|---|
| `src/forest/impostorV2/forestImpostorV2Controller.ts` | 森林インポスター v2 の本体 |
| `src/forest/impostorV2/forestImpostorV2Flags.ts` | クエリフラグの解釈 |
| `src/forest/impostorV2/impostorPlacement.ts`, `impostorMeshes.ts`, `impostorMaterial.ts` | 配置 / メッシュ / マテリアル |
| `src/forest/impostorV2/groveTopCap*.ts` | `forestImpostorV2TopCap=1` の上面キャップ |
| `src/forest/impostorV2/r10*Preset.ts` | `r10wide` / `r10dense` / `r10atlas` / `r10tone` 等のプリセット |
| `src/forest/farCanopyOverlay.ts` | `r10far=1` の遠景キャノピー |
| `src/forest/macroShade.ts` | `r10light=v1` のマクロ陰影 |
| `src/config/defaults/forestImpostorV2.ts` | 森林 v2 の既定値 |

---

## 11. 必要アセットの位置

すべて `public/` 配下に同梱済みで、実行時に外部サーバーへは一切アクセスしません。

| パス | 内容 |
|---|---|
| `public/data/dem/14/**` | 標高タイル PNG 9 枚（国土地理院 DEM、z14） |
| `public/data/terrain-texture/takao-aerial.webp` | 航空写真テクスチャ（3072×3072 モザイク） |
| `public/data/forest/impostor-v2/**` | 森林インポスターのアトラス・メタ |
| `public/data/forest/r10/**` | R10 で差し替えたアトラス（`r10atlas=1` 使用時） |
| `public/data/forest/far-canopy-fullmountain-*` | 遠景キャノピー（`r10far=1` 使用時） |
| `public/data/forest/takao-forest-mask.png` | 森林マスク |
| `public/data/forest/foliage/**` | 葉のテクスチャ |
| `public/data/lite-background/**` | Lite モード用背景 |
| `public/robots.txt` | 検索エンジン除け |

`src/forestLab/generated/` にも大きな PNG アトラスがありますが、これは**森林ラボ（開発用ツール）
の生成物**です。本編アプリの実行時に読むのは `public/data/forest/` 側です。
ソース状態をそのまま保つため、削らずに同梱しています。

---

## 12. 既知の問題

- **3D 森林によってルート線が一部遮蔽される箇所があります。**
  これは現時点で**意図的に未修正**のまま引き渡しています。今回は「現在公開中のものと同じ状態」を
  そのままお渡しすることを優先しました。
- `?routeWhite=1` などのフラグは `import.meta.env.DEV` でガードされておらず、production ビルドにも
  含まれます。既定動作は変わりませんが、厳密には「プレビュー限定フラグ」ではなく
  **オプトインのクエリフラグ**です。
- 森林の描画負荷は 60fps 予算内に収まっていません（プレビュー実装のため）。
- 動作確認は Chrome + 統合 GPU が中心です。他ブラウザ・店舗実機・本番配信環境は未確認です。
- 同梱の `README.md` は開発経緯の記録で、`outputs/` 配下のエビデンスを参照するリンクが
  多数ありますが、**それらの内部エビデンスは本パッケージには含めていません**（リンク切れになります）。

---

## 13. 出典 / ライセンスの確認場所

| 対象 | 確認場所 |
|---|---|
| 画面上の常時出典表示（実装） | `src/scene/attribution.ts` |
| DEM（国土地理院 標高タイル） | `public/data/dem/README.md`、`README.md`「DEM データと出典」 |
| 航空写真（国土地理院 写真タイル） | `public/data/terrain-texture/README.md` |
| 登山ルート（OpenStreetMap, ODbL） | `README.md`「登山ルートについて」 |
| 依存ライブラリのライセンス | `npm ci` 後の `node_modules/<パッケージ>/LICENSE`（Three.js は MIT） |

画面右下には常時、以下が表示されます。

- 「地形データ: 地理院タイル(標高タイル(基盤地図情報数値標高モデル))を加工して作成 - 国土地理院」
- 「地理院タイル（写真）を加工して作成」
- 「© OpenStreetMap contributors」

本番運用・外部公開に進む際は、上記の出典表記を必ず維持してください。

---

## 14. 同梱していないもの

`.git/`、`node_modules/`、ビルド成果物（`dist*/`）、開発中の中間生成物・検証エビデンス
（`outputs/`）、クライアント提供資料（社外秘）、進行管理ドキュメント、
`.env` などの秘密情報ファイルは含んでいません。

同梱ファイルの一覧と SHA-256 は `SHA256SUMS.txt`、パッケージの素性は `SOURCE_MANIFEST.txt`
を参照してください。
