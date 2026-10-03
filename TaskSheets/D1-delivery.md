# D1: CD（Windows / Android / Web と本の自動配布）

- 状態: 未着手
- 前提: [P1](./P1-platforms.md)、[B1](./B1-book.md)
- リポジトリ: https://github.com/dOtOb9/ui-forge （Public、2026-10-03 作成）

## 目的

**タグを打てば Windows と Android の配布物が GitHub Releases に揃い、main に push すれば
Web 版と本が GitHub Pages に出る**状態にする。所有者の判断（2026-10-03）で、3 つすべてを CD に乗せる。

手本は point-cloud-viewer の `.github/workflows/release.yml` と `pages.yml`。
**構成・ジョブの分け方・コメントの書き方をこれに揃える。** ただし ui-forge に無いもの
（wasm のビルド、更新マニフェストの署名、Tauri の updater）は持ち込まない。

## 配布の流れ

```
git tag v0.1.0 && git push --tags
   └─ release.yml
        check-version   タグと package.json / tauri.conf.json / Cargo.toml の版が一致するか
        windows         NSIS インストーラを作って Release に添付
        android         APK を作って Release に添付

git push（main）
   └─ pages.yml
        build           Web 版（dist/）と本（docs/book/book/）を作り、dist/book/ に本を入れる
        deploy          GitHub Pages に公開
   公開先: https://dotob9.github.io/ui-forge/       Web 版プレビューアプリ
           https://dotob9.github.io/ui-forge/book/  設計読解ガイド
```

## やること

### D1-1: release.yml を配布用に広げる

P1-4 の `release.yml` は、Android の APK を実行ごとの成果物（14 日で消える）として
保存するだけだった。これを point-cloud-viewer と同じ形に広げる。

- `check-version` ジョブ: タグ（`v0.1.0` → `0.1.0`）と、`package.json`・`src-tauri/tauri.conf.json`・
  `src-tauri/Cargo.toml` の `version` がすべて一致しなければ失敗する。手動実行（`workflow_dispatch`）では
  比較を飛ばす（point-cloud-viewer と同じ）
- `windows` ジョブ（新設）: `windows-latest` で `tauri build`。**NSIS インストーラ（`.exe`）だけ**を作る。
  `tauri.conf.json` の `bundle.active` を `true` にし、`targets` を `["nsis"]` にする
  （F1 で `false` にしたのはインストーラが要らなかったため。今回で要るようになった）
- `android` ジョブ: P1-4 のものをそのまま使い、タグのときだけ Release に添付する手順を足す。
  実行ごとの成果物としての保存は残す（手動実行でビルドを確かめる経路として）
- Release への添付は `softprops/action-gh-release@v2`。**タグのときだけ**動かす。
  添付するジョブにだけ `permissions: contents: write` を付ける
- 添付ファイル名には版を含める（例: `ui-forge_0.1.0_x64-setup.exe`、`ui-forge_0.1.0_android-aarch64.apk`）

### D1-2: pages.yml を新設する

- main への push と手動実行で走る。pull_request では build だけ（deploy しない）
- Web 版: GitHub Pages ではサブパス `/ui-forge/` で配信されるので、そのときだけ Vite の `base` を変える。
  **point-cloud-viewer の `vite.config.ts` の `isGithubPagesBuild` と同じ方式**にする
  （Tauri のビルドでは `/` のまま）
- 本: `peaceiris/actions-mdbook@v2` で入れて `mdbook build docs/book`、出力を `dist/book/` にコピー
- 本のリンク検査 `node scripts/check-book-links.mjs` も build の中で走らせる（壊れたリンクのまま公開しない）
- `actions/configure-pages` → `upload-pages-artifact` → `deploy-pages`。同時に 2 つ deploy しない（`concurrency`）
- **Pages の設定（Source = GitHub Actions）は Opus がすでに API で済ませてある**（下の実装記録の冒頭を参照）

### D1-3: 版の上げ方を書く

`README.md` に「リリースの出し方」を書く: 3 つのファイルの `version` を揃えて上げる →
コミット → `git tag vX.Y.Z` → `git push --tags`。所有者が手順だけで出せること。
3 か所を手で揃えるのは間違えやすいので、`scripts/bump-version.mjs <版>` で 3 つを一度に
書き換えられるようにする（Node だけで、依存なし）。

### D1-4: 記録

この下の実装記録、本の「プラットフォーム」章の Android ビルドの節を、実際の配布の流れに合わせて直す。

## 受け入れ基準

1. `npm run typecheck` / `lint` / `test` / `build` が通る（ワークフロー以外の変更で壊さない）
2. `node scripts/bump-version.mjs 0.1.0` を実行すると 3 ファイルの版が `0.1.0` になり、
   もう一度実行しても差分が出ない
3. `pages.yml` を main で動かし（push で自動に走る）、成功する。
   `https://dotob9.github.io/ui-forge/` と `https://dotob9.github.io/ui-forge/book/` が 200 を返す
   （`curl -sI` で確認）
4. `release.yml` を手動実行（`gh workflow run release.yml`）し、windows と android の両ジョブが成功する。
   実行ごとの成果物に `.exe` と `.apk` がある
5. Web 版のページの HTML が `/ui-forge/assets/...` を参照している（サブパス対応ができている。`curl` で確認）
6. **タグは打たない。** 最初のリリース（`v0.1.0` のタグ）は所有者が README の手順で打つ

ワークフローの実行結果は `gh run list` / `gh run view <id> --log-failed` で確認する。
失敗したら直して push し直してよい（main への push は許可する。force push はしない）。

## 範囲外

- コード署名（Windows の SmartScreen 警告は出たままでよい。point-cloud-viewer と同じ）
- 自動更新（updater）
- Android のリリース用署名鍵（debug 署名のまま）

## 実装記録

- （Opus、2026-10-03）リポジトリを Public で作成し main を push。GitHub Pages の Source を
  「GitHub Actions」に設定した（`gh api -X POST repos/dOtOb9/ui-forge/pages -f build_type=workflow`）。
  P1-4 の `release.yml` を手動実行し、Android のビルドが CI 上で通るかを確認している（結果は下に追記）

（以下、実装者が記入する: やったこと / 理由と退けた案 / 触ったファイル / 所有者が確かめる手順）
