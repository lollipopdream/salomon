# SALOMON高尾山3Dアニメーション PoC v0.1

SALOMON高尾店のデジタルサイネージ構想「AI MOUNTAIN CONCIERGE」のうち、高尾山の3Dアニメーション部分だけを先行検証するPoCです。AIコンシェルジュを含むサイネージ全体のシステムではありません。

## 現在の状態

Phase 0「3D地形成立性」・Phase 0.5「Terrain Visual Calibration（地形の縦横スケール補正）」・Phase 1「登山ルート配置」・Phase 2「ルート進行アニメーション」・Phase 3「ビジュアル演出」・Phase 4「カメラ・地点表示」が完了しています。実際の高尾山周辺の標高データをChrome上で3D地形として表示し、その上にOpenStreetMap由来の1号路ルートを地形追従させて描画し、麓側から山頂側へ時間経過とともに自動で伸びていくアニメーションとして表示できることを検証済みです。

技術方式には **TypeScript + Vite + Three.js + WebGL + DEM（国土地理院）** を採用しています。単一山岳のリアルタイム表現、ローカル実行、将来のルート差し替えや演出追加との相性を考慮した選択です。Phase 0の検証結果から、Three.js + DEM方式は成立すると判断されています。

**Phase 0.5（2026-08-12）**: Human Visual Gateでのユーザー確認で「高尾山というより険しい岩山・アルプス的に見える」という指摘を受け、地形の縦横スケールを診断・補正しました。ダウンサンプリング後のグリッドセルサイズがハードコード値（10m）と実際の値（約46.6m）で食い違っており、水平方向が約4.66倍圧縮＝地形が約4.66倍垂直誇張されて見えていたことが原因でした。`ElevationGrid`に実測`cellSizeMeters`を追加してこれを解消し、ダウンサンプリング方式もnearest-neighborからbox averagingへ変更しています（地形特徴の保持率99.9%以上、実測済み）。詳細は [`outputs/phase0_5_evidence/phase0_5_summary.md`](outputs/phase0_5_evidence/phase0_5_summary.md) を参照してください。

**Phase 1（2026-08-12）**: 実DEM地形の上へ、PoC用仮登山ルート（清滝駅相当→1号路相当→薬王院付近→高尾山頂、`isOfficial: false`）を配置しました。地形メッシュと同じグリッド座標系（`grid.bounds`基準の投影＋双線形標高補間）でルート点を変換することで、緯度経度ベースの`coords.ts`との座標系混同（Phase 0.5と同種のバグ）を避けています。

**Phase 1 修正ラウンド（2026-08-12）**: Human Visual Gateでの指摘（ルートが小さく固まる／closeupで線が途切れる）を受け、(1) 実DEMを独自デコードして仮ルート座標を11点へ全面見直し（旧座標は「清滝駅仮」が標高542mと不適切な位置だった）、(2) 疎な点の直線結合が地形を貫通する問題を解消するため、`grid.cellSizeMeters`の半分（約23.3m）間隔で高密度リサンプリングし各点で地形標高を個別取得する方式に変更しました。詳細は [`outputs/phase1_evidence/phase1_fix_summary.md`](outputs/phase1_evidence/phase1_fix_summary.md) を参照してください。**この仮ルートは実測・公式データではなく、DEMの実標高を参考にしつつ選定した概算・模式的な座標です。**

**Phase 2(2026-08-12)**: ルートが麓側から山頂側へ、時間ベース(`requestAnimationFrame`)で0%から100%まで滑らかに進行するアニメーションを実装しました。再生時間(初期値11秒)・山頂到達後の待機時間(初期値2秒)は`AppSettings.routeAnimation`経由の設定値であり、Working Assumption(最終仕様確定ではない)です。自動再生・自動ループ・リロード後の正常な再開を確認済みです。カメラはPhase 1の基準カメラを維持し、Phase 2ではカメラアニメーションを追加していません。詳細は [`outputs/phase2_evidence/phase2_summary.md`](outputs/phase2_evidence/phase2_summary.md) を参照してください。

**Phase 3（2026-08-13）**: Phase 0〜2の技術基盤を維持したまま、ルートの発光表現、地形の標高別頂点色とライティング、背景グラデーション、フォグによるビジュアル演出を追加しました。実Chromeでルート進行と既存機能を含めた表示・動作を確認済みです。

**Phase 4**: 清滝駅相当・薬王院付近・高尾山頂の主要地点ラベルと、山全景からルート追従・山頂を経て全景へ戻る自動カメラ演出を追加しました。Chrome実機で2ループ分の連続動作と、カメラの滑らかな連続性を確認済みです。

現段階は3D地形・ルート配置・ルート進行アニメーション・ビジュアル演出・主要地点ラベル・自動カメラ演出の技術的成立性を確認した基礎成果です。地点ラベルと自動カメラ演出はPhase 4で実装済みであり、16:9サイネージ統合などは今後の予定です。

**Matsu Phase 1（2026-09-09、Full 3D視覚品質改善、CR8以降の別トラック）**: 既存のroute/camera/final framingを変更せず、(1) terrain gridを128×128から**256×256へ解像度向上**(近距離カメラでの「粗い地形に航空写真を貼った感じ」を軽減。以下「Phase 0.5の動作確認記録」節の128×128という記述はPhase 0.5時点の履歴として保持し書き換えていません)、(2) anisotropic filteringを追加しテクスチャの視認性を改善、(3) 1号路の主要地点ラベルを清滝駅・薬王院・高尾山頂の3地点から**高尾山駅・霞台/浄心門/男坂・女坂分岐を加えた6地点**へ拡張しました(いずれも公式source照合済み、既存OSMルート座標配列からの転記のみで新規座標の推測なし)。詳細・before/after screenshot・reviewer結果は [`outputs/matsu-h01-phase1/README.md`](outputs/matsu-h01-phase1/README.md) を参照してください。Liteモード(`?mode=lite`)は無変更です。commit/push/deployは未実施です。

**Matsu Phase 2（2026-09-09、micro-stutter解消 + スポット強化、Matsu Phase 1の続き）**: (1) route-followカメラの補間を一様Catmull-Romから、実際のkeyPose間隔を考慮した非一様(Barry & Goldman)Catmull-Romへ置換し、camera motionの「パッパッパッ」というコマ送り感(spline breakpointでの速度不連続)を解消(境界での移動量比を実測で最大5.79倍→1.07倍以下へ改善)、(2) 1号路6スポットの既存マーカーへ発光(glow)とビーコンリングを追加し視認性を向上、(3) 各スポット到達時にhold(一時停止)またはslow-down(減速)を新規導入(1ループ全長は約27.1秒→約29.8秒)。rail自体のkeyPose座標データ・既存CR8のroute/camera/final framingは無変更です。詳細・原因診断・before/afterスクリーンショット・reviewer結果は[`outputs/matsu-h01-phase2/README.md`](outputs/matsu-h01-phase2/README.md)を参照してください。Liteモードは無変更です。commit/push/deployは未実施です。

**Matsu Phase 3（2026-09-09、frame pacing実測改善 + スポット到着演出、Matsu Phase 2の続き）**: (1) frame pacing instrumentation（`?perf=1`）・PerformanceObserver Long Tasks実測を追加（main-thread blocking 47%を確認）、(2) `getPartialRoutePoints`重複呼び出しを削減（controlled A/Bでmicro-stutterの主因ではないと確定、正直に非採用と報告）、(3) 各スポットにAPPROACH→ARRIVE→DWELL→DEPARTの到着演出を追加。既存CR8のroute/camera/terrain・Liteモードは無変更です。詳細は[`outputs/matsu-h01-phase3/README.md`](outputs/matsu-h01-phase3/README.md)を参照してください。commit/push/deployは未実施です。

**Matsu Phase 4（2026-09-09、camera jitter根絶 + frame stall真因特定 + spot cadence統一、Matsu Phase 3の続き）**: 「パパパパ」「揺れて酔う」の真因をfrom stall→camera jumpの複合と特定（main-thread hot pathの60.7%を占めていた`labelController.updateOcclusion`のraycast集中が原因）。(1) 6ラベルのraycastタイミングを6フレームへ分散（stagger、over100msフレーム比率14.4%→1.1%）、(2) motion clock capping採用（long-frame→camera jump相関 pearsonR 0.44〜0.46→0.12〜0.15）、(3) 全5スポット（清滝駅・高尾山駅霞台・浄心門・男坂女坂分岐・薬王院）のarrival cadenceを薬王院の実測値へ統一、(4) summit到着ビジュアルの既存の欠落（summit-hold中は常にidleへ戻っていた）を発見・修正。position/orientation smoothingはA/B実測で効果が確認できず不採用（正直に非採用と報告）。既存CR8のroute/camera/terrain・Liteモードは無変更です。詳細・binary isolation実測・before/afterスクリーンショット・reviewer結果は[`outputs/matsu-h01-phase4/README.md`](outputs/matsu-h01-phase4/README.md)を参照してください。commit/push/deployは未実施です。

## 前提環境

- Node.jsおよびnpm
- Google Chrome（主な確認対象ブラウザ）

## セットアップと開発サーバー

リポジトリのルートで次を実行します。

```sh
npm install
npm run fetch:dem   # 初回のみ
npm run dev         # 開発サーバー（http://localhost:5173）
```

DEMタイルはすでにリポジトリへ同梱されているため、通常は `npm run fetch:dem` を実行する必要はありません。再取得する場合のみ、ネットワークへ接続できる環境で実行してください。

起動後、Chromeで <http://localhost:5173> を開きます。

起動時は`renderer.setAnimationLoop`の登録前に`renderer.compile`と明示的な`renderer.render`でGPUウォームアップを行い、完了後に`elapsedMs = 0`としてanimation epochを開始します。これにより起動直後にサイクルが途中から始まって見えることを防ぎ、`advanceAnimationState`でも1フレームあたりの経過時間を250msにクランプしています。

## テスト

```sh
npm run test -- --run
```

Phase 4完了時点では、23テストファイル・209テストがすべて成功していました。その後のVE track・Correction Round v3.5〜v3.7（CR7-debug-8時点、2026-08-17）を経て、**現在は42テストファイル・490テストがすべて成功**しています。詳細な経緯は`PROJECT_STATE.md`を参照してください。

```text
Test Files  23 passed (23)
     Tests  209 passed (209)
```

## buildとbuild成果物の確認

```sh
npm run build
npm run preview
```

`npm run build` は `dist/` にbuild成果物を生成します。build後のファイルを `file://` で直接開くと、ESM importに対するCORSエラーが発生しやすいため、必ず `npm run preview` などのローカルサーバー経由で確認してください。ターミナルに表示されたpreview URLをChromeで開きます。

## Phase 0の動作確認記録

以下は `outputs/phase0_evidence/phase0_verification.md` に記録された、2026-08-11時点（Phase 0.5補正前）の確認結果です。

- `npm run build` 成功（13 modules transformed、複数回の実行で約3〜7秒）
- `npm run test -- --run` 成功（7ファイル・27テスト、Phase 0.5後は32テスト）
- Chromeで3D地形を表示し、console error 0件
- 国土地理院の実DEMタイル9枚をHTTP 200で読み込み（合成DEMへのフォールバックではない）
- 統合GPU環境で、DEMダウンサンプリング前の約34fpsから、最大150×150点程度へのダウンサンプリング後は約58fpsへ改善
- 高尾山の尾根筋を反映した起伏を目視確認

これらにより、Phase 0成功条件 `[P0-S1]`〜`[P0-S4]`（build、Chrome表示とconsole error 0件、FPSの記録と目視評価、ユニットテスト）を満たしたことが記録されています。

## Phase 0.5の動作確認記録（地形スケール補正後）

詳細は `outputs/phase0_5_evidence/phase0_5_summary.md` を参照してください。2026-08-12時点の確認結果の要点:

- `ElevationGrid`に実測`cellSizeMeters`（約46.596m）を導入し、地形の水平スケールのハードコード誤り（約4.66倍の意図しない垂直誇張）を解消。
- ダウンサンプリング方式をnearest-neighborからbox averagingへ変更（標高差の保持率99.9%、最大標高の保持率100.0%を実測、地形特徴の破壊なし）。
- FPS計測（1920x1080・devicePixelRatio=1に固定、本番相当build、4回平均）: **約43.6fps**。console error 0件。
- 頂点数・グリッド解像度（128×128）はPhase 0.5前後で変更なし。FPS計測値の違いは主に計測条件（canvas解像度）の違いによるもので、スケール補正自体による負荷増加ではない。
- カメラ構図3種（現行/高め見下ろし/正面寄り望遠）を一時的なDEV限定機構で比較し、極端な歪みがないことを確認（本番ビルドへの混入がないことをgrepで確認済み、`dist/`に該当コードは含まれない）。
- Claude reviewerによる検証: score **0.90**で合格。

## Phase 1の動作確認記録（登山ルート配置）

詳細は `outputs/phase1_evidence/phase1_summary.md` を参照してください。2026-08-12時点の確認結果の要点:

- Phase 1当時はPoC用仮ルート（`src/route/mockRoute.ts`、`isOfficial: false`、清滝駅→1号路相当→薬王院→高尾山頂の8点）を実装。このファイルは参照用に残っているが、現在のシーン描画では使用していない。
- 地形メッシュ（`terrainMesh.ts`）と同一のグリッド座標系（`grid.bounds`基準の投影＋双線形標高補間、`src/route/routePath.ts`）でルート点を変換し、`coords.ts`（原点基準の別座標系）との混同を回避。
- `heightOffsetMeters = 5`で地形表面から浮かせ、z-fighting回避と視認性を両立。
- 拡大スクリーンショット（`outputs/phase1_evidence/route_closeup_terrain_following.png`）で、ルート線が谷・尾根の起伏に追従し、浮き過ぎ・埋没がないことを確認。
- FPS（本番相当build、1920x1080、4回平均）: **約47.4fps**（Phase 0.5の約43.6fpsから悪化なし）。console error 0件。
- 新規19テスト追加（座標投影・双線形補間・非公式データ検証）、既存23テストを含め全42テスト成功。
- Claude reviewerによる検証: score **0.92**で合格(修正前の初版)。修正ラウンドの詳細は
  [`outputs/phase1_evidence/phase1_fix_summary.md`](outputs/phase1_evidence/phase1_fix_summary.md)を参照。

## Phase 2の動作確認記録(ルート進行アニメーション)

詳細は [`outputs/phase2_evidence/phase2_summary.md`](outputs/phase2_evidence/phase2_summary.md) を参照してください。2026-08-12時点の確認結果の要点:

- `src/animation/progress.ts`(時間→進捗の状態管理)・`src/route/routeProgress.ts`(進捗→部分ルート形状)を純粋関数として新規実装し、`sceneSetup.ts`のrAFループへ統合。フレームレートに依存せず、`renderer.setAnimationLoop`が渡す高精度timestampの差分で進行させている。
- 再生時間11秒・山頂到達後の待機2秒(1サイクル計13秒)は`AppSettings.routeAnimation`経由の設定値(Working Assumption)。
- 実機確認の過程で、ルート線の`BufferGeometry`初期化が原因で線が実質描画されない不具合(console warn 948回連続)を発見・修正した(詳細はphase2_summary.md参照)。
- 自動再生・自動ループ・リロード後の正常再開・麓側→山頂側の進行方向をブラウザ実機で確認。
- FPS(本番相当build、1920x1080、devicePixelRatio=1固定、4回平均): **約60.5fps**(Phase 1の約60.1fpsから悪化なし)。console error/warn 0件。
- 新規21テスト追加(progress計算12件、routeProgress計算9件)。既存45テストを含め全66テスト成功。
- Codex Plugin不在によりcircuit breakerが発動し、Phase 2の実装・デバッグはすべてClaudeサブエージェントへフォールバックして実施。
- Claude reviewerによる検証: score **0.96**で合格。requirements 0.97 / tests 0.97 / code_quality 0.95 / docs 0.95。improvement_instructionsなし。

## Phase 3の動作確認記録(ビジュアル演出)

2026-08-13時点の確認結果の要点:

- Phase 0〜2で確立した地形スケール、座標変換、`heightOffsetMeters = 5`、ルート進捗アニメーションのロジックは変更せず、その上にビジュアル要素を追加した。
- ルート描画を`THREE.Line`＋`LineBasicMaterial`から、three.jsに同梱される`Line2`系アドオン（`three/addons/lines/Line2.js`等）へ移行。新規npm依存は追加せず、白色・幅3.5pxの明るいコア線と、半透明・加算合成・幅10px/20pxの2層ハローによる発光表現を`src/route/routeVisual.ts`へ実装した。線幅はスクリーン上のピクセル単位（`worldUnits: false`）とし、遠距離でも視認性が変わりにくい構成としている。
- 山のライティングを`AmbientLight`＋単一の`DirectionalLight`から、空・地面の色勾配を持つ`HemisphereLight`＋`DirectionalLight`へ変更し、尾根と谷の陰影を強調した（`src/scene/lighting.ts`）。
- 標高に応じた頂点色を追加し、谷の深いフォレストグリーン（`0x16241a`）から尾根のくすんだグレーグリーン（`0x5a6b5e`）まで線形補間して、`MeshStandardMaterial`の`vertexColors`として適用した（`src/terrain/terrainMaterial.ts`）。テクスチャおよび航空写真APIは使用していない。
- 暗いネイビーから黒へ変化するCSSグラデーション背景と`THREE.Fog`を追加し、軽い空気遠近感を持たせた（`src/scene/background.ts`）。ルート線は視認性を優先して`fog: false`とし、フォグの影響を受けない設定としている。
- `src/route/routeVisual.ts`、`src/scene/lighting.ts`、`src/terrain/terrainMaterial.ts`、`src/scene/background.ts`と、対応するテスト3ファイルを新規追加。`src/types.ts`と`src/config/settings.ts`には`VisualSettings`関連の型・初期値・バリデーションを追加した。`src/scene/sceneSetup.ts`はこれら4要素の接続のみを変更し、既存のPhase 1/2ロジック呼び出しは変更していない。
- 初回実装では、`Line2`を使用して進捗更新のたびに`geometry.setFromPoints(partialPoints)`を呼び出す構成にしたところ、実Chrome確認で発光ルートが進捗に合わせて伸びず、開始点付近の小さな塊のままになる重大な不具合が見つかった。
- ブラウザのJavaScript consoleで調査した結果、three.jsの`Line2`／`LineSegmentsGeometry.setPositions()`は呼び出しごとに新しい`InstancedInterleavedBuffer`を生成するため、同一の`LineGeometry`へ毎フレーム`setFromPoints`を実行すると、JavaScript側の`geometry.instanceCount`は正しく更新される一方、WebGLRendererがGPUへ発行する実際の描画インスタンス数が最初の小さい値のまま更新されないことが原因と判明した。
- 修正後の`createRouteVisual`では、固定された全ルート点リスト用のバッファを一度だけ確保し、`updatePoints`で既存バッファ（`geometry.attributes.instanceStart.data.array`）の内容を直接更新しながら`geometry.instanceCount`のみを変化させる方式とした（`src/route/routeVisual.ts`）。修正後の実Chrome確認では、ルートが麓から山頂まで正しく伸び、ループ再開時に残像となる形状が残らないことを確認した。
- 本番相当buildを`npm run preview`で配信し、Chrome（1920x1080、devicePixelRatio=1固定）で確認。console error/warn 0件で、発光ルートが麓から山頂まで正しく伸びること、山のライティング・マテリアル・背景グラデーション・フォグが描画されること、自動再生・自動ループおよびPhase 2の進行方向・地形追従が引き続き動作することを確認した。
- 先方参考資料（`docs/reference/`、社外秘）との8項目比較（[`outputs/phase3_evidence/reference_comparison.md`](outputs/phase3_evidence/reference_comparison.md)）を実施し、「陰影」が「要改善」と判定されたため、`defaultSettings.visual`のライティング・マテリアル値のみを調整するP3T7（visual fallback第1回、新規ファイルなし）を実施した：`hemisphereIntensity` 0.65→0.5、`directionalIntensity` 1.35→1.7、`terrain.roughness` 0.92→0.85、`terrain.metalness` 0.04→0.06。この時点ではユーザーがHuman Visual Gateで「山が均一なオリーブ色に見える」「技術デモ感が強い」として不合格と判定した。
- **P3T8（visual fallback第2回・最終ラウンド）**: 地形の頂点カラーが標高のみで決まり傾斜を考慮していなかったことが陰影不足の根本原因と特定し、GISのhillshade（陰影起伏図）手法を導入した。近傍2セルから近似した法線と光源方向の内積を実際の分布に合わせてコントラストストレッチし、尾根は標高色より明るくブースト・谷はより暗く沈める双方向係数（`hillshadeMinFactor=0.12`〜`hillshadeMaxFactor=1.9`）を標高色に掛け合わせる方式とした（`src/terrain/terrainMaterial.ts`に`computeVertexNormalsApprox`・`computeHillshadeFactors`・`computeTerrainVertexColors`を追加、いずれもTDD対象）。`highElevationColor`もやや明るいトーン（`0x788c76`）へ調整した。Chrome実機で尾根・谷の陰影が明確に判別できることを確認し、P3T7時点とのスクリーンショットのピクセル差分比較でも地形領域の輝度標準偏差が34.5→41.8（約21%増）と定量的に改善を確認した。
- 全14テストファイル・101テスト（Phase 0〜2の66テスト＋Phase 3の新規35テスト）が成功。`npx tsc --noEmit`はエラーなし、`npm run build`も成功した。
- FPS計測（本番相当build、1920x1080、devicePixelRatio=1固定、4回平均、単一タブでの計測）: P3T7実施前は約60.48fps、P3T7実施後は約60.13fps、**P3T8実施後（最終状態）は約60.49fps**。Phase 2の計測値（約60.5fps）から目立った低下は確認されなかった（新たなハード下限は設けていない）。
- 有料API・航空写真テクスチャを使わない制約下、「山肌の質感（テクスチャの精細さ）」には依然として先方参考資料との差が残る。「発光ルートの存在感」向上（Bloom等）はP3T8では対象外とし、Phase 4以降またはユーザー判断に委ねる。追加ラウンドはdesign.md §7.8の方針（最大2回）に基づき、P3T8で終了している。

## Phase 4の動作確認記録(カメラ・地点表示)

Phase 4完了時点の確認結果の要点:

- **主要地点ラベル表示（[P4-S1]）**: 清滝駅相当・薬王院付近・高尾山頂の3地点に、three.js同梱addonの`CSS2DRenderer`によるラベルを表示する。追加npm依存は導入していない。暗い半透明背景（`rgba(0, 0, 0, 0.55)`）＋白文字＋軽いpadding/角丸のプレート表現とし、地形の陰影上でも視認性を確保している（visual修正ラウンド1）。
- ラベルの表示対象は`poiId`（安定識別子）の厳密一致だけで判定し、`label`文字列の内容には一切依存しない（`src/route/routeLabels.ts`）。
- カメラから地形への`Raycaster`による遮蔽判定を6フレームに1回（`throttleFrames=6`）実行し、山の裏側に回ったラベルを非表示にする（`src/camera/labelOcclusion.ts`、`src/scene/labelRenderer.ts`）。
- **自動カメラ演出（[P4-S2]）**: 山全景（OVERVIEW）→トランジション→ルート追従（ROUTE FOLLOW）→トランジション→山頂（SUMMIT HOLD）→全景へ戻る（RETURN TO OVERVIEW）の6フェーズを、Phase 2の既存経過時間クロックに基づいて自動遷移させる。独立タイマーは新設していない（`src/camera/cameraTimeline.ts`、`src/camera/cameraPose.ts`）。
- ROUTE FOLLOWカメラは、アンカー点の前後サンプルからルートの進行方向を推定し、後方・上方へオフセットした位置から進行方向をやや先読みして注視する（`src/camera/routeFollowCamera.ts`）。Human Visual Gateでの指摘を受け、`cameraState.follow`のWorking Assumption値を調整（`behindMeters` 500→600、`heightMeters` 300→500、`targetLiftMeters` 20→220）し、地表すれすれに近すぎる印象を抑えつつ、routeの追従・山の稜線や空が画面上部に残る構図へ改善した（visual修正ラウンド1）。
- 全フェーズ境界、特にROUTE FOLLOW→SUMMIT境界とループ継ぎ目では、境界の`progress`値を再計算する形でカメラ位置・注視点の連続性を保証している（`src/camera/cameraPose.ts`）。リーダーがブラウザ上で約13.5秒・約52,000サンプルの連続トレースを取得し、数値上も急変のない滑らかな連続性を確認した(ROUTE FOLLOW区間調整後も同様に再確認済み)。
- **カメラタイムライン境界の修正（visual修正ラウンド2）**: 従来は`transitionToSummitStartMs`が`playDurationMs - transitionToSummitMs`（route progress約86%相当）で計算されており、ルートが山頂へ到達しきる前にカメラがSUMMITへ向けて動き出す不具合があった。`transitionToSummitStartMs = playDurationMs`（route progress 100%到達時点）へ修正し、`transitionToSummitMs`分を`playDurationMs`の**後ろ**（既存`holdAtEndMs`の枠内）へ移動した。`playDurationMs`/`holdAtEndMs`/`loopDurationSec`自体は変更していない。`cameraState.timeline`のWorking Assumption値を`transitionToSummitMs` 1500→400ms・`summitHoldMs` 700→800ms・`returnToOverviewMs` 1300→800msへ再配分し、合計2000ms（=`holdAtEndMs`）に正確に収めている。
- **SUMMIT構図の修正（visual修正ラウンド2）**: SUMITの注視点の持ち上げ量がカメラ自身の垂直オフセットと同じ計算式だったため視線がほぼ水平になり空が支配的な構図になっていた。注視点の持ち上げ量をカメラの高さから分離し（`terrainDiagonal * 0.006`の小さい固定係数）、`cameraState.summit.heightFactor`も0.08→0.05へ調整することで、山頂・稜線が主役で空は画面上部の一部にとどまる下向きの視線へ改善した。
- **RETURNのペース調整（visual修正ラウンド3）**: SUMMITからOVERVIEWへ戻るRETURNが速く見えるとの指摘を受け、cameraロジック自体は変更せず`cameraState.timeline`の内訳のみ再配分した（`transitionToSummitMs` 400→300ms・`summitHoldMs` 800→500ms・`returnToOverviewMs` 800→**1200ms**、合計2000ms=`holdAtEndMs`は維持）。RETURN区間のフレーム間最大移動速度が約12,275→約7,957 units/秒（約35%減）に緩和されたことを確認した。
- DEV限定（`import.meta.env.DEV`）で新規`0`キーにより自動カメラの一時停止・再開をトグルできる。一時停止中はルート進行とカメラ自動更新の両方が停止し、Phase 0.5から継続している既存`1`/`2`/`3`キーのカメラpreset比較機構をそのまま利用できる。この機構は本番ビルドには含まれず、既存preset機構自体も変更していない。再開時は、望遠プリセット（preset C）で`fov`が変わっていた場合も自動的に標準へ戻る。
- 全23テストファイル・211テスト（Phase 0〜3分101テスト＋Phase 4新規110テスト）が成功。`npx tsc --noEmit`はエラーなし、`npm run build`も成功した。
- 本番相当buildを`npm run preview`で配信し、Chrome（1920x1080、devicePixelRatio=1固定）で2ループ分（約27秒）連続実行した。console error/warnは0件だった。
- FPS計測（§13の手順、本番相当build、1920x1080、devicePixelRatio=1固定）: Phase 4実装直後は平均約45〜51fps、visual修正ラウンド1後は約29.5〜31.5fps、visual修正ラウンド2後は約23.3fpsと低下したが、visual修正ラウンド3では不要なプロセス（このセッション中のdev server・余分なブラウザタブ）を整理した上で再計測した結果、**平均約35.25fps**まで改善した。Chrome DevTools MCP自身の検証用Chromeインスタンスはテストに必須のため完全なクリーン環境ではなく、Phase 3実測（約60.49fps）は依然として下回っている。本プロジェクトのFPS計測は実行環境の影響を受けやすいことがPhase 3から一貫して確認されている。

## DEMデータと出典

高尾山周辺のPoC検証用DEMを `public/data/dem/` に同梱しています。

- 出典: 国土地理院 地理院タイル（標高タイル）
- データ種別: `dem_png`
- URL: `https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png`
- 取得日: 2026-08-11
- 取得範囲: 高尾山頂付近（緯度35.6255、経度139.2432）を中心とする半径約1.8km、ズームレベル14、9タイル
- 出典表記例: 「出典: 国土地理院ウェブサイト（地理院タイル）」

中心タイルをデコードした確認では、標高範囲は約198m〜583mでした。本データは**PoCの開発・検証用途に限定**して取得したものです。

**[2026-08-14 GSI利用条件のresearch-loop再検証]** 当初は「店舗サイネージでの本番運用または外部公開へ進む前に、オフライン同梱の扱いなどの利用条件を国土地理院へ個別に確認する必要がある」としていましたが、2026-08-14の一次情報再検証(地理院タイル一覧・国土地理院コンテンツ利用規約・デジタル庁PDL1.0・測量成果の利用手続・承認申請Q&A・出典の記載の6点、reviewer score 0.93・fact-checker reliability 0.9で検証済み、詳細は`outputs/gsi_dem_license_recheck_final.md`参照)により、`dem_png`は地理院タイル一覧上「基本測量成果以外で出典の記載のみで利用可能なもの」に分類され、**個別申請・問い合わせは規約上必須ではないと判断**しました。出典・加工表示は引き続き必要であり(下記参照)、本PoCでは実装済みです。ただし「ローカル保存」という語への直接的な一次情報上の言及がないこと等の軽微な留保が残るため、国土地理院への確認は禁止ではなく、慎重を期す場合の任意の追加確認として残しています(deployのblockerではありません)。

詳細は [`public/data/dem/README.md`](public/data/dem/README.md) を参照してください。

**production-visible出典表記**: 画面右下に「地形データ: 地理院タイル(標高タイル(基盤地図情報数値標高モデル))を加工して作成 - 国土地理院」を常時表示しています(`src/scene/attribution.ts`、2026-08-14追加)。国土地理院コンテンツ利用規約(PDL1.0)は、システム/Webサイトでは測量成果が表示されている間は常に見えるよう出典を明示することを原則とし、技術的に困難などやむを得ない場合には説明ページやREADME等への記載も可としています。本PoCは常時表示が技術的に可能なため、この原則に従いproduction build配信時にも(DEV限定ではなく)常に画面上へ表示する対応にしています。

## 登山ルートについて

**現在シーンで使用しているルート**は、`src/route/takaoTrail1Route.ts`の`takaoTrail1Route`です。OpenStreetMap relation 1216428（`ref=1号路`）を出典とする256点のルートで、清滝駅の実座標から高尾山頂の実座標までを結び、実測総延長は約3875mです。取得日は2026-08-16、ライセンスはODbLで、`src/scene/attribution.ts`により画面上に「© OpenStreetMap contributors」を表示しています。

`takaoTrail1Route`の`isOfficial: false`は維持しています。これは公式機関が配布したgeometryではなく、OSMコミュニティにより「1号路」として検証されたcommunity-mappedデータであるためです。

`src/route/mockRoute.ts`の`mockTakaoRoute`は、過去のPhase 1相当で使用した旧PoC用仮ルートとして参照用にコード上に残っていますが、現在のシーン描画には使用していません。

## 既知の制限と今後の課題

- 現在の成果はPhase 0〜4の3D地形+ルート表示+ルート進行アニメーション+ビジュアル演出+主要地点ラベル+自動カメラ演出を中心とする技術検証です。完成版の3Dアニメーションではありません。
- 主要地点ラベルと自動カメラ演出はPhase 4で実装済みです。16:9サイネージ統合は今後の予定です。
- ルート進行アニメーションの再生時間・待機時間はWorking Assumptionであり、クライアント確定仕様ではありません(Phase 2実装時点は11秒/2秒でしたが、Correction Round v3.6時点では実route距離〈約3875m〉を踏まえ再生時間20.9秒・待機時間4.9秒〈1サイクル計25.8秒〉へ再基準化しています。`AppSettings.routeAnimation`経由の設定値)。
- Phase 2ではカメラアニメーションを追加せずPhase 1の基準カメラ（斜め低角度）を維持していましたが、Phase 4で自動カメラ演出を追加済みです。
- （visual修正ラウンド1で対応済み）ROUTE FOLLOWカメラが地形へ近すぎ空・稜線が見えない構図になっていた点は、`cameraState.follow`の値調整（`heightMeters`/`behindMeters`/`targetLiftMeters`）で改善済みです。
- （visual修正ラウンド2で対応済み）route progress 100%到達前にカメラがSUMMITへ動き出していた点、SUMIT構図で空が支配的だった点は、`cameraTimeline.ts`の境界修正・`cameraState.timeline`/`cameraState.summit`の値調整で改善済みです。
- （visual修正ラウンド3で対応済み）RETURNのペースが速く見えた点は、`cameraState.timeline`の内訳再配分（`returnToOverviewMs` 800→1200ms等、合計は`holdAtEndMs`のまま）で改善済みです。
- Phase 4のFPS計測は、実装直後はセッション平均約45〜51fps、visual修正ラウンド1後は約29.5〜31.5fps、visual修正ラウンド2後は約23.3fpsと低下したが、visual修正ラウンド3では不要なプロセスを整理した上で再計測し約35.25fpsまで改善した。Phase 3実測（約60.49fps）は依然として下回っており、Chrome DevTools MCP自身の検証用Chromeインスタンスがテストに必須なため完全なクリーン環境での計測ではない点に留意が必要です。Phase 3時点でも複数タブ同時オープン時に約10.7fpsまで低下するアーティファクトがあり、本プロジェクトのFPS計測は実行環境の影響を受けやすい。
- 元の768×768 DEMグリッド（約59万頂点）は約34fpsだったため、最大150×150点程度へダウンサンプリングし、記録上は約58fpsへ改善しています。今後の演出追加時も描画負荷の継続確認が必要です。
- Phase 0.5でダウンサンプリング後のセルサイズ計算を実測値（約46.6m）に補正しました（旧ハードコード値10mによる約4.66倍の意図しない垂直誇張を解消）。あわせてダウンサンプリング方式もbox averagingへ変更しています。
- 大規模配列に対する `Math.max(...grid.values)` のスタックオーバーフローリスクは、ループベースの処理へ変更済みです。
- 初回確認時のfavicon 404は解消済みで、修正後のconsole errorは0件と記録されています。
- 確認環境はChromeと統合GPUです。他ブラウザ、店舗実機、本番配信環境での動作は未確認です。

## 今回のNon-goal

次の機能・領域はPoC v0.1のスコープ外であり、未実装です。

- AIコンシェルジュ、LLM連携、音声認識・音声合成、多言語対応
- タッチパネル操作、商品提案、店舗在庫連携
- 天気API、登山指数、管理画面、QR連携、ライブカメラ
- 混雑予測、AI混雑ヒートマップ
- ヘッダー、天気パネル、商品カルーセル、AI会話UIなど、3D山マップ以外のサイネージ完成画面
- 他店舗対応、VPS配置、外部公開、本番環境の構築・変更

## VPS Deploy Preparation(VD track、仲介者確認用VPS限定公開の準備、2026-08-14、既存Phase 5「サイネージ統合」とは別トラック)

最終ビジュアル制作の前段階として、動作PoCを仲介者にURLで確認してもらうためのVPS限定公開に向けた準備を実施しました。**[2026-08-14更新] その後ユーザー自身の対話セッションでVPSへの実deployを実施し、`https://49.212.213.226`(Basic認証あり)で仲介者確認用PoCとして限定公開中です**(詳細は`docs/deploy_plan.md`・`PROJECT_STATE.md`「actual VPS deploy: COMPLETED」節参照)。正式な「Phase 5: サイネージ統合」は引き続き未着手のままです。

準備した内容:

- production-visible GSI出典表記(上記「GSI標高データについて」参照)
- 検索エンジンindex防止(`<meta name="robots" content="noindex, nofollow">` + `public/robots.txt`)
- VPS側で有効化する想定のNginx設定テンプレート(`deploy/nginx.conf.example`、Basic認証・HTTPS・directory listing禁止・server情報非公開を含む。**未適用**)
- VPS deploy計画書(`docs/deploy_plan.md`): 推奨構成、必要ファイル、実行予定コマンド、rollback手順、公開後verification手順、および現時点で不足しているVPS固有情報の一覧
- `.gitignore`へ`.htpasswd`/`*.pem`/`*.key`等secretsパターンを予防的に追加

production build(`npm run build && npm run preview`)をChrome DevTools MCPで実機確認し、GSIサーバー(`cyberjapandata.gsi.go.jp`)への実行時ネットワークリクエストが0件であること(DEMタイルはすべて`/data/dem/...`のローカル配信)、`docs/reference/`等confidential資料がGit追跡・dist成果物いずれにも含まれないこと、console error/warn 0件を確認済みです。詳細は`docs/deploy_plan.md`と`PROJECT_STATE.md`を参照してください。

## クライアント提供資料の取り扱い

`docs/reference/` 配下のクライアント提供資料は社外秘です。Git管理対象外とし、原本を変更・削除・公開しないでください。

## 関連ドキュメント

- [要件定義](docs/spec.md)
- [技術設計](docs/design.md)
- [Phase 0動作確認記録](outputs/phase0_evidence/phase0_verification.md)
- [Phase 0.5完了報告(地形スケール補正)](outputs/phase0_5_evidence/phase0_5_summary.md)
- [Phase 0.5 縦横スケール診断](outputs/phase0_5_evidence/scale_diagnosis.md)
- [Phase 1完了報告(登山ルート配置)](outputs/phase1_evidence/phase1_summary.md)
- [Phase 1修正ラウンド報告](outputs/phase1_evidence/phase1_fix_summary.md)
- [Phase 2完了報告(ルート進行アニメーション)](outputs/phase2_evidence/phase2_summary.md)
- [DEMデータの詳細](public/data/dem/README.md)
- [VPS限定公開 計画書(仲介者確認用)](docs/deploy_plan.md)
- [GSI DEM利用条件 research-loop再検証(2026-08-14)](outputs/gsi_dem_license_recheck_final.md)

---

## realtime forest v2(whole-tree / whole-grove impostor)— 2026-09-13 / Human Visual pending

実在の Poly Haven tree mesh(CC0)を Blender Cycles CPU で 1 回だけ preprocessing して
**whole-tree / whole-grove impostor atlas** を焼き、それを source にした realtime forest。
Human Visual FAIL となった forest candidate v1(`?forestCandidate=1`)とは**独立**で、
v1 は凍結(read-only)のまま。

### 使い方

```bash
npm run dev
# 既定(current Full)。v2 は完全 OFF。asset fetch 0 / window hook 0
open http://localhost:5173/
# v2 ON
open 'http://localhost:5173/?forestImpostorV2=1'
```

| query | 意味 | 既定 |
|---|---|---|
| `forestImpostorV2=1` | v2 を有効化 | OFF |
| `forestImpostorV2Density=0.1..4` | 密度スケール | 1 |
| `forestImpostorV2Max=1..200000` | primitive 上限 override | 40,000 |
| `forestImpostorV2Kinds=both\|grove\|tree` | 使う impostor 種別 | both |
| `forestImpostorV2AlphaTest=0.05..0.95` | alphaTest override | grove .45 / tree .50 |
| `forestImpostorV2Material=lambert\|unlit` | impostor の lighting model(V2.1) | lambert |
| `forestImpostorV2TopCap=1` | grove へ top-down canopy cap を追加(V2.2)。`forestImpostorV2=1` かつ `Material=unlit` のときだけ有効 | OFF |

検証用フック(v2 を明示 opt-in したときだけ露出):
`window.__forestImpostorV2Summary()` / `__forestImpostorV2Dispose()` / `__forestImpostorV2SetVisible(bool)` /
`__forestImpostorV2SetMaterialMode('lambert'|'unlit')` / `__forestImpostorV2SetTopCapVisible(bool)`

### 実測(2026-09-13)

primitive 11,811(grove 7,385 / tree 4,426。v1 の 231,228 の **1/19.6**)/ draw call 36 /
triangle 47,244 / texture 約 56 MB(mip 込み)/ build 465.8 ms / **per-frame 更新 0**。

### 既知の課題(Human Visual 判定待ち)

1. **森林 mass として疎い。**可視域の大半が mid/ridge band(spacing 30–44 m)で、
   「点在する樹木」に見える。cap まで 3.4 倍の余裕があるが、本フェーズでは密度を上げていない。
2. **overview(高い見下ろし角)で impostor が暗い粒のノイズに崩れる。**
   pitch 0°(水平)1 段 + 非 billboard の垂直板という atlas 仕様上の確定的限界。
3. 1080p performance は p50 33.4 ms(v2 OFF 時 18.8 ms)。v1 の 51.0 ms より大幅に軽いが
   60fps 予算内ではない。**なお benchmark の readiness gate が UNSTABLE だったため正式判定ではない。**

詳細: `outputs/matsu-h01-realtime-forest-whole-tree-impostor-v2/forest-v2-report.md`
