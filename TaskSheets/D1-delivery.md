# D1: CD（Windows / Android / Web と本の自動配布）

- 状態: 実装完了(受け入れ基準1-5は自動テスト・ワークフロー実行・curlで確認済み。
  基準6はタグを打たないことで遵守。v0.1.0タグは所有者がREADMEの手順で打つ)
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

### Opus の手動実行（run 37093162067）の結果

03:25 UTC 頃に開始されていた手動実行（`workflow_dispatch`、D1 着手前の P1-4 版
`release.yml`）は、**android ジョブが成功していた**（7分31秒、`gh run view
37093162067`で確認）。失敗していたら診断・修正するよう指示されていたが、
修正が必要な不具合は無かった。D1-1 の変更（check-version/windows ジョブの追加）は
不具合修正ではなく、タスクシートの要求（タグを打てば配布物が揃う）に応じた
機能追加として行った。

### D1-1: release.yml を配布用に広げる

**やったこと**: `check-version` ジョブ（タグと `package.json`/
`src-tauri/tauri.conf.json`/`src-tauri/Cargo.toml` の version が一致するか確認。
`workflow_dispatch` では比較を飛ばす）、`windows` ジョブ（新設。`windows-latest`で
`tauri build`、NSIS インストーラのみ）、`android` ジョブ（既存のビルド手順はそのまま、
タグのときだけ Release に添付する手順を追加）。`src-tauri/tauri.conf.json` の
`bundle.active` を `true`、`targets` を `["nsis"]` にした。

**理由・退けた案**:
- point-cloud-viewer の `windows`/`android` ジョブ構成（`needs`・`permissions:
  contents: write`をジョブ単位に絞る・`fail_on_unmatched_files: true`）をそのまま
  踏襲した。構成を変える理由がタスクシートに無いため。
- ui-forge にはルートの Cargo ワークスペースが無いため、ビルド成果物は
  `src-tauri/target/release/bundle/`に出る（point-cloud-viewer は`target/`直下。
  ci.yml の rust ジョブが`workspaces: src-tauri`を指定しているのと同じ理由）。
  `windows`ジョブでも同じ`workspaces: src-tauri`を指定した。
- APK の添付ファイル名に版を含める指定（`ui-forge_0.1.0_android-aarch64.apk`）を
  満たすため、署名済み APK を `release-assets/`へ版入りの名前でコピーする step を
  追加した。NSIS 側はコピー不要（Tauri の既定の命名規則が
  `ui-forge_0.1.0_x64-setup.exe`になり、指定の形とそのまま一致することを
  実際のビルド（run 37093713079）で確認した）。
- **手動実行（run 37093713079）で見つけた不具合**: 受け入れ基準4「実行ごとの
  成果物に`.exe`と`.apk`がある」を確認したところ、android は
  `actions/upload-artifact`で常に APK を残すが、windows には同等の step が無く、
  Release への添付（`Upload installer to GitHub Release`）は
  `workflow_dispatch`では skip されるため、**手動実行では `.exe` がどこにも
  残らない**ことが分かった。windows ジョブにも android と同じ形で
  `actions/upload-artifact`の step（`windows-installer`、常に実行）を追加して
  修正した（別コミット、`fix(D1-1)`）。再実行（run 37094550174）で
  `windows-installer`（2,301,291 bytes）・`android-apk`（4,367,080 bytes）の
  両方がワークフロー成果物に残ることを確認した。

**触ったファイル**: `.github/workflows/release.yml`、`src-tauri/tauri.conf.json`

**確認手順**: `gh workflow run release.yml --ref main` → `gh run watch <id>
--exit-status` → `gh api repos/dOtOb9/ui-forge/actions/runs/<id>/artifacts`で
`android-apk`/`windows-installer`の両方が存在することを確認する。

### D1-2: pages.yml を新設する

**やったこと**: `.github/workflows/pages.yml`（`build`→`deploy`、
`concurrency`でPages同時デプロイを防止、`pull_request`では`build`のみ）。
`vite.config.ts`に`isGithubPagesBuild`（`GITHUB_PAGES_BUILD`環境変数）を追加し、
サブパス（`/ui-forge/`）の時だけ`base`を切り替える。`mdbook build docs/book`で
本をビルドし、`dist/book/`へコピー。ビルド中に`node scripts/check-book-links.mjs`を
走らせる。

**理由・退けた案**:
- point-cloud-viewer の`pages.yml`と同じ構成に揃えたが、ui-forge には wasm の
  ビルドが無いため、Rust/wasm-bindgen 関連の step は一切持ち込まなかった
  (Node/mdbook だけで完結する)。
- リンク検査(`check-book-links.mjs`)の実行位置は、本のビルド前に置いた。
  リンクが壊れていることが分かってから本をビルドしても無駄にならないため
  (ビルドに時間がかかるわけではないが、失敗の理由が早く分かる方を優先した)。

**触ったファイル**: `.github/workflows/pages.yml`（新設）、`vite.config.ts`

**確認手順**: push 後 `gh run watch <id> --exit-status` で成功を確認し、
`curl -sI https://dotob9.github.io/ui-forge/`・
`curl -sI https://dotob9.github.io/ui-forge/book/`が200を返すこと、
`curl -s https://dotob9.github.io/ui-forge/ | grep ui-forge/assets`で
サブパス付きの参照になっていることを確認する。

### D1-3: 版の上げ方を書く

**やったこと**: `scripts/bump-version.mjs`（Node標準モジュールのみ、追加依存
なし）。`package.json`/`src-tauri/tauri.conf.json`の`"version": "x.y.z"`を
正規表現で1箇所だけ置き換え、`src-tauri/Cargo.toml`は行頭の`version = "x.y.z"`
(`[package]`直下のものだけ)を置き換える。READMEに「リリースの出し方」節を
追加した。

**理由・退けた案**:
- JSON.parseして丸ごと再シリアライズする案は採らなかった。インデントや
  キーの並び順が変わる可能性があり、版の変更以外の差分がコミットに混ざって
  読みにくくなるため。正規表現での行単位の置き換えなら、同じ版を指定して
  2回実行しても出力が完全に同じになる(受け入れ基準2)。
- 版の形式チェック(`x.y.z`、先頭に`v`を含めない)をスクリプト側に入れた。
  `check-version`ジョブはタグから`v`を剥がした上で比較するため、`v`付きで
  版を揃えてしまうタイプミスを早期に止める。

**触ったファイル**: `scripts/bump-version.mjs`(新設)、`README.md`

**確認手順**: `node scripts/bump-version.mjs 0.1.0`を2回実行し、
`git diff`に差分が出ないことを確認する(実際に確認済み)。

### D1-4: 記録

この節と、`docs/book/src/platforms.md`の「Android のビルド」節の更新
(D1でRelease添付が追加されたことを反映)。`mdbook build docs/book`と
`node scripts/check-book-links.mjs`で確認済み。

### 追加作業: ライセンス表記(所有者からの追加指示)

**やったこと**: point-cloud-viewerと同じMIT OR Apache-2.0のデュアルライセンスに
する。`LICENSE-MIT`/`LICENSE-APACHE`をpoint-cloud-viewerからコピー(著作権者の
表記はpoint-cloud-viewerを指すものではなく汎用的な表記だったため変更不要)。
`package.json`/`src-tauri/Cargo.toml`の`license`フィールドは調査の結果、
既に`"MIT OR Apache-2.0"`になっていたため変更不要だった。READMEに
「ライセンス」節を追加した。別コミット(`chore: license ui-forge under MIT OR
Apache-2.0`)にしてある。

## 所有者が確かめる手順

1. `npm run typecheck && npm run lint && npm run test && npm run build` が
   通ることを確認する。
2. `https://dotob9.github.io/ui-forge/` と `https://dotob9.github.io/ui-forge/book/`
   を実際にブラウザで開き、プレビューアプリと本が表示されることを確認する。
3. `v0.1.0` のタグを打つ前に、3ファイルの版が揃っていることを
   `node scripts/bump-version.mjs 0.1.0`で確認する(差分が無ければ揃っている)。
4. README「リリースの出し方」の手順で `git tag v0.1.0 && git push --tags` を実行し、
   `release.yml` が`check-version`→`windows`→`android`の順に成功し、
   `https://github.com/dOtOb9/ui-forge/releases` に `ui-forge_0.1.0_x64-setup.exe`と
   `ui-forge_0.1.0_android-aarch64.apk` が添付されることを確認する(本実装では
   タグを打っていないため、この最終確認は所有者が行う)。
5. Windows実機で`ui-forge_0.1.0_x64-setup.exe`を実行し、SmartScreenの警告が
   出ること(想定どおり。署名していないため)・インストール後にアプリが
   起動することを確認する。
