# Dance Studio (dance-app v2)

ダンスのショーケース／ナンバー制作のための Web アプリです。
**音源・振付動画・マーカー・隊形（フォーメーション）・メモ**を 1 本のタイムラインで編集し、そのまま通し練習に使えます。

データはすべてブラウザ内（IndexedDB）に自動保存されます。サーバーは不要です。

## 起動

```bash
npm install
npm run dev        # 開発サーバー
npm run build      # 型チェック + 本番ビルド (dist/)
npm test           # 単体テスト (vitest)
npm run lint       # oxlint
```

## できること

| 機能 | 内容 |
| --- | --- |
| 自動 BPM / カウント | 最初の音源を入れると BPM と 1 拍目を推定し、ルーラーに「エイト」、プレビューに `3-5`（3 エイト目の 5）を表示。タップ入力・「再生ヘッドを 1 拍目に」で微調整 |
| マーカー | 再生中でも `M` で何個でも。ドラッグで移動、名前・色、区間ループ |
| **マーカー自動フィット** | 動画クリップの先頭をマーカーにスナップさせると、次のマーカーまでぴったり収まるよう速度（playbackRate）を自動調整。マーカーを動かすと、合わせてあるクリップの速度も追従 |
| 素材モニター | イン点 / アウト点を決めて「再生ヘッドに追加」「マーカー区間にフィット」「クリップを更新」 |
| 滑らかな再生 | 音源をマスタークロックにして、動画はネイティブの playbackRate で同期。小さなズレは速度の微調整で吸収し、大きなズレのときだけシーク |
| 隊形 | ステージ（幅・奥行き m 指定、場ミリ番号、0.5m グリッド吸着）でメンバーをドラッグ。隊形の間は自動で移動アニメーション、次の隊形への動線を表示 |
| マルチアングル | 動画トラックを複数作り、並べて表示。左右反転（鏡）表示 |
| メモ | タイムライン上のメモを映像に字幕のように重ねて表示 |
| 練習モード | 大きな映像・カウント・隊形・区間チップでループ練習。スマホでは自動でこのモード |
| 隊形シート | 全隊形をカウント付きで一覧表示し、印刷 / PDF 保存 |
| 保存 / 共有 | 自動保存、JSON 書き出し / 読み込み。メディアが欠けている場合は同名ファイルを入れると自動で再リンク |
| 旧バージョンの移行 | 旧 dance-app のデータ（LocalStorage + IndexedDB）を検出し、変換して開く |

ショートカット一覧はアプリ内で `?` キーを押すと表示されます。

## 構成

```
src/
  types.ts                 データモデル (Project / Track / Clip / Marker / Member)
  lib/
    timeline.ts            クリップ操作の純粋関数 (分割・トリム・ストレッチ・フィット・スナップ)
    formation.ts           隊形の補間
    engine.ts              再生エンジン (rAF ループ + メディア同期)
    commands.ts            ショートカット / メニュー / ボタン共通のコマンド
    audio.ts               波形・BPM 推定
    media.ts               メディア Blob の保存 (IndexedDB) と ObjectURL 管理
    persistence.ts         プロジェクト保存
    migration.ts           旧バージョンからの移行
  store/
    projectStore.ts        プロジェクト + Undo/Redo (immer, ドラッグは 1 操作にまとめる)
    uiStore.ts             再生位置・選択・表示設定
  components/              library / monitor / stage / inspector / timeline / common
  pages/                   Dashboard / Editor / FormationSheet
```

### 設計メモ

- **Undo/Redo** は「変更前のスナップショットを積む」方式に統一。ドラッグは `beginGesture → preview → endGesture` で 1 回分の履歴になり、Esc でキャンセルできます。
- **メディアの URL は保存しない**。Blob を IndexedDB に置き、開くたびに ObjectURL を作り直すので、リロード後も再生できます。
- クリップの素材位置は常に `mediaTime = sourceIn + (t - start) * rate`。分割・トリム・フィットはすべてこの式を保つ純粋関数で、`src/__tests__` でテストしています。
