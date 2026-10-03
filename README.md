# ui-forge

UI のレイアウトをテキストファイル（`.ui`、中身は JSON）に書き、そこから React の
TSX を生成するツール。point-cloud-viewer の UI シェルで使う。

設計の経緯は [TaskSheets/ADR-0001-design.md](./TaskSheets/ADR-0001-design.md)、
これまでのマイルストーンの作業内容は [TaskSheets/F1-foundation.md](./TaskSheets/F1-foundation.md)・
[TaskSheets/P1-platforms.md](./TaskSheets/P1-platforms.md)・
[TaskSheets/F2-editor.md](./TaskSheets/F2-editor.md) を参照。

コードを読む前に読む本（設計読解ガイド）は `mdbook serve docs/book` で開けます。

## プレビューアプリの起動（Windows / Web / Android）

プレビューアプリは `.ui` ファイルを開いて見た目を確かめ、**その場で触って
編集できる**ツールで、Windows・Web・Android のそれぞれで単独で動く
（P1-platforms.md「設計」）。どの端末でも `.ui` を開くと、外部のエディタで
保存した変更が自動で（Web の File System Access API に対応していないブラウザを
除く）反映される。

### 編集（F2）

上部のツールバーで「編集」「操作」モードを切り替える（既定は編集）。編集モードで
プレビュー中の部品をクリックすると選択され、左の Hierarchy・右の Details と
選択が同期する。Hierarchy で部品を足す・消す・並べ替え、Details でプロパティを
変えると、その場で正規化して `.ui` ファイルへ書き戻される（保存ボタンは無い）。
`Ctrl+Z` / `Ctrl+Shift+Z`（または `Ctrl+Y`）と、ツールバーの ↶↷ で Undo/Redo
できる。外部（AI や VS Code）での変更も Undo で取り消せる。

Web で File System Access API に対応していないブラウザ（Firefox など）と、
ファイルへの書き込みに失敗する環境では、エディタは読み取り専用になる
（Details が無効化され、理由が表示される）。

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

`npm run build` で `dist/` に静的ファイルが生成される。`main` に push すると
`.github/workflows/pages.yml` が自動でビルドして GitHub Pages に公開する
（<https://dotob9.github.io/ui-forge/>）。

### Android

この端末には Android SDK / NDK が無いため、APK は GitHub Actions でビルドする
（`.github/workflows/release.yml`）。手元で試すには、Actions タブから
`Release` ワークフローを手動実行（`workflow_dispatch`）するか、バージョンタグ
（`v*`）を push する。ビルドが終わると `android-apk` という名前の成果物から
APK をダウンロードできる（debug 署名）。バージョンタグを push したときは、
同じ APK（版入りのファイル名）が GitHub Releases にも添付される。

ファイルの変更検知は `content://` URI が `notify` で監視できないため、1 秒ごとの
ポーリングで行う（最大 2 秒程度の遅延がある）。

**`content://` への書き込み（F2 の編集機能）が実機で実際にできるかは未確認。**
Android SDK / NDK がこの端末に無く、コンパイルが通ることまでしか確かめられて
いない。

## リリースの出し方（D1-delivery.md D1-3）

タグ（`vX.Y.Z`）を打って push すると、`.github/workflows/release.yml` が
Windows の NSIS インストーラ（`.exe`）と Android の APK（debug 署名）を
ビルドし、GitHub Releases に添付する。所有者が手順だけで出せるようにする
ための流れ。

1. `package.json`・`src-tauri/tauri.conf.json`・`src-tauri/Cargo.toml` の
   3 か所の `version` を揃えて上げる。手で 3 か所を揃えるのは間違えやすいので、
   代わりに次のコマンドを使う（Node だけで動く。依存の追加なし）。

   ```
   node scripts/bump-version.mjs 0.1.0
   ```

   もう一度同じ版で実行しても差分は出ない（意図せず再実行しても壊れない）。

2. 変更をコミットする（例: `chore: bump version to 0.1.0`）。

3. タグを打って push する。

   ```
   git tag v0.1.0
   git push --tags
   ```

4. `.github/workflows/release.yml` が走り、`check-version` ジョブがタグと
   3 ファイルの版の一致を確認した後、`windows`・`android` の各ジョブが
   ビルドして GitHub Releases にインストーラ・APK を添付する
   （<https://github.com/dOtOb9/ui-forge/releases>）。タグとの不一致、
   ビルド成果物が見つからない場合はジョブが落ちて気付ける（黙って
   インストーラ抜きの Release が公開されることはない）。

Windows のインストーラには署名が無いため、Windows SmartScreen が
「発行元不明」の警告を出す場合がある（範囲外。[範囲外](./TaskSheets/D1-delivery.md#範囲外)参照）。

## ライセンス

本プロジェクトは以下のいずれかを、利用者の選択により適用できます。

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE))
- MIT License ([LICENSE-MIT](LICENSE-MIT))

### 貢献について

特に別段の意思表示がない限り、あなたが本プロジェクトに意図的に提出した貢献は、
Apache-2.0 の定義に従い、追加の条件なく上記のデュアルライセンスで提供されるものとします。
