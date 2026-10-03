# ui-forge

UI のレイアウトをテキストファイル（`.ui`、中身は JSON）に書き、そこから React の
TSX を生成するツール。point-cloud-viewer の UI シェルで使う。

設計の経緯は [TaskSheets/ADR-0001-design.md](./TaskSheets/ADR-0001-design.md)、
これまでのマイルストーンの作業内容は [TaskSheets/F1-foundation.md](./TaskSheets/F1-foundation.md)・
[TaskSheets/P1-platforms.md](./TaskSheets/P1-platforms.md) を参照。

コードを読む前に読む本（設計読解ガイド）は `mdbook serve docs/book` で開けます。

## プレビューアプリの起動（Windows / Web / Android）

プレビューアプリは `.ui` ファイルを開いて見た目を確かめるためのツールで、
Windows・Web・Android のそれぞれで単独で動く（P1-platforms.md「設計」）。
どの端末でも `.ui` を開くと、外部のエディタで保存した変更が自動で（Web の
File System Access API に対応していないブラウザを除く）反映される。

### Windows

```
npm install
npm run tauri dev
```

ネイティブの Tauri アプリとして起動する。ファイル監視は Rust 側の `notify`
によるもので、保存から 1 秒以内に反映される。

### Web

```
npm install
npm run dev
```

表示された URL を Chrome・Edge（File System Access API 対応）または
Firefox・Safari（`<input type="file">` にフォールバックし、画面上部に注意書きが
出る。変更の自動反映はできないので「開く」でもう一度選び直す）で開く。

`npm run build` で `dist/` に静的ファイルが生成される。これをそのまま配置すれば
動く（GitHub Pages への公開ワークフローは別タスク）。

### Android

この端末には Android SDK / NDK が無いため、APK は GitHub Actions でビルドする
（`.github/workflows/release.yml`）。手元で試すには、GitHub にリポジトリを作成・
push した上で、Actions タブから `Release` ワークフローを手動実行
（`workflow_dispatch`）するか、バージョンタグ（`v*`）を push する。ビルドが終わると
`android-apk` という名前の成果物から APK をダウンロードできる（debug 署名）。

ファイルの変更検知は `content://` URI が `notify` で監視できないため、1 秒ごとの
ポーリングで行う（最大 2 秒程度の遅延がある）。

## ライセンス

本プロジェクトは以下のいずれかを、利用者の選択により適用できます。

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE))
- MIT License ([LICENSE-MIT](LICENSE-MIT))

### 貢献について

特に別段の意思表示がない限り、あなたが本プロジェクトに意図的に提出した貢献は、
Apache-2.0 の定義に従い、追加の条件なく上記のデュアルライセンスで提供されるものとします。
