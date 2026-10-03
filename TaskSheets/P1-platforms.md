# P1: Web / Android / Windows 対応

- 状態: 実装完了(自動テスト・コマンドでの確認(受け入れ基準1-8)は済み。
  所有者の目視確認(受け入れ基準9-12)は未確認。Android実機が無くGitHubの
  リモートも無いため、基準12の確認には所有者によるリポジトリ作成・push・
  ワークフロー実行が必要)
- 前提: [ADR-0001](./ADR-0001-design.md)、[F1](./F1-foundation.md)

## このマイルストーンの目的

**F1 のプレビューアプリを、Windows・Android・Web のそれぞれで単独で動かす。**
各端末で `.ui` ファイルを開き、プレビューし、ファイルが変わったら読み直す。

所有者の判断（2026-10-03）: 「PC が正で各端末はプレビューの窓になる」方式ではなく、
**point-cloud-viewer と同じく各端末で単独動作する**方式を採る。

編集と書き戻し（F2）はまだ入れない。ただし F2 で書き込みを足すことを見越して、
ファイルの扱いは下の「ファイルホスト」の 1 箇所にまとめておく。

## 設計

### ファイルホスト（プラットフォームの違いを閉じ込める場所）

point-cloud-viewer の `DataSource`（`src/datasource/DataSource.ts`）と同じ考え方。
プレビューの画面はこのインターフェースだけを見て、どのプラットフォームかを知らない。

```ts
// src/preview/host/FileHost.ts
export interface OpenedFile {
  /** 画面に出す名前（パスまたはファイル名）。 */
  displayName: string;
  /** 現在の中身を読む。 */
  read(): Promise<string>;
  /** 中身が変わるたびに handler を呼ぶ。返り値を呼ぶと止まる。 */
  watch(handler: () => void): () => void;
}

export interface FileHost {
  /** ファイルを選ばせる。キャンセルなら null。 */
  pick(): Promise<OpenedFile | null>;
}
```

実装は 3 つ。

| 実装 | ファイル | 選択 | 読み込み | 変更の検知 |
|---|---|---|---|---|
| Windows | `host/tauri-desktop.ts` | `plugin-dialog` | Rust の `read_ui_file`（F1 のまま） | Rust の `notify`（F1 のまま） |
| Android | `host/tauri-android.ts` | `plugin-dialog`（`content://` URI が返る） | `plugin-fs` の `readTextFile` | **1 秒ごとに読み直して、前回の中身と比べる** |
| Web | `host/web.ts` | File System Access API の `showOpenFilePicker` | `handle.getFile()` | **1 秒ごとに `lastModified` と `size` を比べ、変わっていたら読み直す** |

変更検知を 2 種類（`notify` とポーリング）持つ理由:
- `content://` URI はファイルシステム上のパスではないので、`notify` で監視できない
- ブラウザにはファイル監視の標準 API がない（`FileSystemObserver` は Chromium の一部の
  版にしかなく、当てにしない）
- `.ui` は数 KB なので、1 秒ごとの読み直しは負荷として無視できる。
  ポーリングの実装は `host/poll.ts` に 1 つだけ書き、Android と Web で共有する

### Web 版で File System Access API が無いブラウザ（Firefox / Safari）

`<input type="file">` で開けるようにする。ただしこの方法では、ブラウザがファイルの
中身をその時点で写し取るだけなので、**変更の検知はできない**。
画面上部に「このブラウザではファイルの変更を自動で読み直せません（Chrome / Edge を推奨）」と
出し、手動の「再読み込み」ではなく**もう一度開いてもらう**形にする（`input` では同じファイルを
読み直す手段が無いため）。

### プラットフォームの判定

- Tauri かブラウザか: point-cloud-viewer の `src/datasource/environment.ts` と同じく
  `"__TAURI_INTERNALS__" in window` で判定する（判定のためだけに Tauri の npm パッケージを import しない）
- Tauri の中で Android かデスクトップか: point-cloud-viewer は起動時に Rust のコマンドで
  一度だけ問い合わせている（`src/state/useCopcViewer.ts` 220 行付近、`src-tauri/src/lib.rs` の
  `cfg(target_os = "android")`）。同じ方式にする
- どのホストを使うかを決めるのは `host/index.ts` の 1 箇所だけ

### Tauri の import を閉じ込める

**`@tauri-apps/*` を import してよいのは `src/preview/host/tauri-*.ts` だけ。**
point-cloud-viewer の規約 2 と同じ。Web 版のビルドに Tauri の呼び出しが紛れ込まないようにするため。
F1 の `src/preview/tauriBridge.ts` はこの構成に吸収して消す。

### Rust 側

- `notify` を使う `watch_ui_file` / `read_ui_file` はデスクトップだけで登録する（`#[cfg(desktop)]`）。
  Android では読み込みを `plugin-fs` に任せる
- `plugin-fs` を追加し、capability に読み取りの権限だけを足す（point-cloud-viewer の
  `src-tauri/capabilities/default.json` と同じ `fs:read-files`）
- モバイル用のエントリポイント（`#[cfg_attr(mobile, tauri::mobile_entry_point)]`）を用意する

### Android のビルド

この PC には Android SDK / NDK が無い。point-cloud-viewer と同じく **GitHub Actions でビルドする**。
- `.github/workflows/ci.yml`: typecheck / lint / test / build、`cargo check`（Windows ランナー）
- `.github/workflows/release.yml`: `tauri android init` → `tauri android build` で APK を作り、
  成果物として添付する。**point-cloud-viewer の `release.yml` の android ジョブを手本にする**
  （JDK 17、NDK r26d、`aarch64-linux-android` のみ、debug.keystore のキャッシュ、
  `src-tauri/gen/android/` は `.gitignore` して CI で生成）
- 手動実行（`workflow_dispatch`）でも走るようにする
- **ui-forge にはまだ GitHub のリモートが無い。** リポジトリの作成とプッシュは所有者が行う。
  実装者はワークフローのファイルを書くところまで

ローカルでは、Android 向けの Rust がコンパイルできるところまでを確かめる
（`rustup target add aarch64-linux-android` → `cargo check --target aarch64-linux-android`。
リンクは NDK が無いのでできなくてよい。`check` が通らない場合は理由を記録する）。

### Web 版の公開

`npm run build` の `dist/` を静的ファイルとして置けば動く形にする。
GitHub Pages への公開ワークフローは、リモートができてから別タスクで足す（今回は書かない）。

---

## 作業の分け方とコミット

1 項目 = 1 コミット（以上）。各コミットで `npm run typecheck` / `lint` / `test` が通ること。

### P1-1: ファイルホストの抽象とデスクトップ実装
- `FileHost` / `OpenedFile` と `host/tauri-desktop.ts`、`host/index.ts`
- `PreviewApp.tsx` を `FileHost` 経由に書き換え、`tauriBridge.ts` を消す
- この時点で Windows 版の振る舞いは F1 と変わらないこと

### P1-2: Web 実装
- `host/web.ts`、`host/poll.ts`、File System Access API が無い場合の `<input>` 経路と注意書き
- `npm run dev`（Vite 単体）をブラウザで開いて動くこと

### P1-3: Android 実装と Rust 側
- `host/tauri-android.ts`、Android 判定コマンド、`#[cfg(desktop)]` の切り分け、
  `plugin-fs` と capability、モバイルのエントリポイント

### P1-4: CI とリリースのワークフロー
- `ci.yml`、`release.yml`（上記）

### P1-5: 記録
- この下の「実装記録」と、`README.md` に 3 プラットフォームの起動方法を書く

---

## 受け入れ基準

自動テスト（vitest）で確認するもの:

1. **ポーリング**: `host/poll.ts` は、中身（または `lastModified` / `size`）が変わったときだけ handler を呼び、
   変わっていなければ呼ばない。止める関数を呼んだ後は二度と呼ばない（フェイクタイマーで確認）
2. **ホストの選択**: `host/index.ts` が、Tauri デスクトップ / Tauri Android / File System Access API ありのブラウザ /
   無いブラウザ の 4 通りで正しい実装を選ぶ（環境はテスト内で差し替える）
3. **Tauri の import の閉じ込め**: `src/` 以下で `@tauri-apps/` を import しているのは
   `src/preview/host/tauri-*.ts` だけ（F1 の `architecture.test.ts` に足す）
4. F1 の受け入れ基準 1〜7 のテストが引き続き通る

コマンドで確認するもの:

5. `npm run typecheck` / `npm run lint` / `npm test` / `npm run build` がすべて通る
6. `cargo check`（`src-tauri`、Windows）が通る
7. `cargo check --target aarch64-linux-android`（`src-tauri`）が通る。
   通らない場合は、原因と、CI では通る見込みの根拠を記録する
8. `npm run build` の出力（`dist/`）に Tauri の呼び出しが含まれていても、ブラウザで開いたときに
   Tauri 用のコードが**実行されない**こと（`npm run preview` で開いて、コンソールにエラーが出ないことを確認）

所有者の目視で確認するもの（実装者は手順だけ書けばよい）:

9. **Windows**: F1 と同じ確認（ガラス表示 / 値パネル / 1 秒以内の反映 / 赤い帯）がそのまま通る
10. **Web（Chrome / Edge）**: `examples/Dock.ui` を開き、VS Code で保存すると 2 秒以内に反映される
11. **Web（Firefox）**: 開けて表示され、自動で読み直せない旨の注意書きが出る
12. **Android**: GitHub Actions でできた APK を入れ、端末内の `.ui` を開いて表示される。
    別のアプリでそのファイルを書き換えると 2 秒以内に反映される

## 範囲外

- 編集と書き戻し（F2）。書き込みの API は F2 で `OpenedFile` に足す
- GitHub Pages への公開
- iOS / macOS / Linux
- リリース用の署名鍵（point-cloud-viewer と同じく debug 署名のまま）

## 実装記録

（実装者が記入する。各項目について: やったこと / その方法を選んだ理由と退けた案 /
触ったファイル / 所有者が動かして確かめる手順）

### P1-1: ファイルホストの抽象とデスクトップ実装

**やったこと**: `src/preview/host/FileHost.ts`(`OpenedFile`/`FileHost`の定義)、
`host/environment.ts`(`isTauriEnvironment`)、`host/tauri-desktop.ts`(F1の
`tauriBridge.ts`を吸収したデスクトップ実装)、`host/index.ts`
(`resolveFileHost()`、この時点ではTauri分岐のみ)。`PreviewApp.tsx`を
`FileHost`/`OpenedFile`経由に書き換え、`tauriBridge.ts`を削除した。
`architecture.test.ts`に受け入れ基準3(`@tauri-apps/`のimportは
`host/tauri-*.ts`だけ)のテストを足した。

**理由・退けた案**:
- `FileHost`インターフェースに、設計のコード例には無い
  `readonly supportsAutoReload: boolean`を足した(P1-2参照。Web版で
  File System Access APIが無いブラウザの注意書きをPreviewApp.tsxが出すために
  必要で、P1-1時点では常にtrueだが、先に生やしておかないとP1-2で
  インターフェースを破壊的に変更することになる)。
- Rust側の監視開始(`watch_ui_file`の呼び出し)は、`pick()`ではなく
  `OpenedFile.watch()`が呼ばれた時点に移した。F1では「開く」ボタンの中で
  `watchUiFile`→`reload`の順に直接呼んでいたが、`FileHost`の設計は
  「選ぶ」と「監視する」を別メソッドに分けているため、その約束に合わせた。
  実行されるタイミング自体はReactのeffectがコミット直後に走るので、F1までと
  実質同じ(受け入れ条件「Windows版の振る舞いはF1と変わらないこと」)。
- 退けた案: Web/Android分岐も先にインターフェースだけ用意して`host/index.ts`
  に書いてしまう案も考えたが、まだ実装が無い分岐を書くと「存在しない関数を
  呼ぶ穴」を一時的に残すことになり読み手を混乱させる。P1-1時点では
  非Tauri環境は例外を投げるだけにして、P1-2でそのまま書き換えた(1項目1コミット
  の方針に素直に従った)。

**触ったファイル**: `src/preview/host/{FileHost,environment,tauri-desktop,index}.ts`、
`src/preview/PreviewApp.tsx`、`src/preview/tauriBridge.ts`(削除)、
`src/core/architecture.test.ts`

**確認手順**: `npm run typecheck && npm run lint && npm test && npm run build`。
`npm run tauri dev`で起動し、F1の受け入れ基準11-13(ガラス表示・値パネル・
1秒以内の反映・赤い帯)がそのまま通ることを確認する(下記「Windows」参照)。

### P1-2: Web実装

**やったこと**: `host/poll.ts`(`pollForChange`、AndroidとWebの共通ポーリング)、
`host/web.ts`(`webFileSystemAccessHost`/`webInputFallbackHost`)、
`host/file-system-access.d.ts`(`window.showOpenFilePicker`のアンビエント宣言)、
`host/index.ts`にWeb分岐を追加、`PreviewApp.tsx`に「自動で読み直せない」の
注意書きを追加。`host/poll.test.ts`(受け入れ基準1)。

**理由・退けた案**:
- `pollForChange<T>`は、比較対象の型`T`と等価判定`equals`を引数で受け取る
  汎用関数にした。Android版は中身の文字列そのもの、Web版は
  `{size, lastModified}`を比べる(P1-platforms.mdの表どおり)。退けた案:
  中身の文字列だけを比べる関数にして、Web版もファイルを都度読んで比較する案も
  考えたが、Web版は`size`/`lastModified`だけ見れば済むのにわざと重い方法を
  選ぶことになり、表の意図(軽い比較で済ませる)に反する。
- `pollForChange`は呼び出し直後に一度基準値を取ってから、以後`intervalMs`
  (既定1000ms)ごとに比較する設計にした。退けた案: 最初の基準値も1秒待って
  取る案もあったが、それだと「開いてから1秒は何も検知できない区間」が
  余分に増えるだけで、どちらにしても得るものが無い。
- `window.showOpenFilePicker`の型は、TypeScript標準の`lib.dom.d.ts`には
  まだ無い(`FileSystemFileHandle`自体はTS 5系で追加済みだが、入口の
  `showOpenFilePicker`メソッドは未収録。2026-10時点、typescript ~6.0.3で確認)。
  point-cloud-viewerの`file-system-sync-access-handle.d.ts`と同じやり方で
  最小限をアンビエント宣言した。
- `<input type="file">`のフォールバック実装で、キャンセルの検知に`cancel`
  イベントを使った。これは比較的新しいブラウザ(Chrome 113+等)にしか無く、
  無いブラウザではキャンセルしても`pick()`のPromiseが解決されないまま残る。
  退けた案: `window`の`focus`イベントでキャンセルを推測する方法も検討したが、
  ダイアログを閉じた後のフォーカス移動のタイミングはOS依存で当てにできないと
  判断し、より素直な`cancel`イベントの方を採った(無い場合の実害は
  「開く」をもう一度押せば新しい`input`を作り直すだけで小さいと判断)。
- 受け入れ基準8(`npm run preview`で開いてTauriコードが実行されないこと)は、
  ヘッドレスブラウザの道具が無いため(Playwright等は許可された追加依存に
  無く、新規に入れる理由をタスクシートに書く必要があるほどの重さだと判断し
  見送った)、`curl`で`npm run preview`/`npm run dev`のページが200で返ること
  を確認した上で、コードパスの検査で代替した: `resolveFileHost()`は
  `isTauriEnvironment()`(`"__TAURI_INTERNALS__" in window`)を最初に見て、
  これがfalseのときはWeb分岐(`webFileSystemAccessHost`/
  `webInputFallbackHost`)だけが選ばれ、`@tauri-apps/*`のimportは
  `host/tauri-*.ts`の3ファイルに閉じている(受け入れ基準3のテストで機械的に
  保証)ため、ブラウザの`window.__TAURI_INTERNALS__`が無い限り、
  `@tauri-apps/*`のコードは呼び出されるコードパス上に存在しない。

**触ったファイル**: `src/preview/host/{poll,web,file-system-access.d,index}.ts`、
`src/preview/host/poll.test.ts`、`src/preview/PreviewApp.tsx`

**確認手順**: `npm run dev`でブラウザ(Chrome/Edge)を開き、「開く」から
`examples/Dock.ui`を選んでプレビューが表示されることを確認する(下記「Web」
参照)。

### P1-3: Android実装とRust側

**やったこと**: Rust側: `src-tauri/src/lib.rs`に`is_android`コマンドを追加し、
`notify`を使う`watch`モジュールを`#[cfg(desktop)]`で丸ごと外した。
`tauri-plugin-fs`を依存に追加し、プラグインとして登録、
`capabilities/default.json`に`fs:read-files`を追加。`invoke_handler`の
コマンド一覧をデスクトップ/モバイルで分けた(`#[cfg(desktop)]`/
`#[cfg(mobile)]`)。フロント側: `host/tauri-platform.ts`(`isAndroid()`、
Rustの`is_android`を1回だけ呼ぶ)、`host/tauri-android.ts`
(`tauriAndroidHost`、`@tauri-apps/plugin-fs`の`readTextFile`+`poll.ts`)、
`host/index.ts`にAndroid分岐を追加して4分岐を完成。`host/index.test.ts`
(受け入れ基準2、4分岐すべて)。

**理由・退けた案**:
- AndroidかどうかのRustコマンドは、point-cloud-viewerの
  `supports_custom_temp_dir`(「デスクトップなら true」を間接的に返す)とは
  違い、`is_android() -> bool`という直接の名前・返り値にした。ui-forgeには
  「カスタム一時ディレクトリ」のような借りてこれる具体的な機能が無く、
  間接的な名前にする理由が無いため、素直な名前の方が読みやすいと判断した。
- Android判定(`isAndroid()`)を`tauri-desktop.ts`/`tauri-android.ts`の
  どちらにも置かず、`tauri-platform.ts`という3つ目のファイルを作った。
  `host/index.ts`はこの関数の結果で「どちらの実装を使うか」を決めるため、
  判定ロジックをどちらか一方の実装ファイルに置くと、デスクトップ実装が
  Android実装の存在を知っている(or逆)ような依存がねじれて生まれる。
  ファイル名は`tauri-*.ts`の命名規則に合わせてあるので、受け入れ基準3の
  テスト(`architecture.test.ts`)もそのまま通る。
- `watch`モジュールはAndroidでも関数単位で`#[cfg(desktop)]`を付ける案も
  検討したが、`notify`クレート自体をAndroidターゲットの依存グラフに含めない
  (タスクシートが明示する「デスクトップだけで登録する」の意図はおそらく
  単なる未登録よりも一歩進んで「使わない」ことだと解釈した)ため、
  モジュールごと`#[cfg(desktop)]`で外した。これにより
  `cargo check --target aarch64-linux-android`では`watch.rs`が
  コンパイル対象にそもそも入らない。
- **Android向けのローカル確認で発覚した問題**: `cargo check --target
  aarch64-linux-android`を初回実行したところ、`tauri::generate_context!()`が
  「`icons/icon.png`が見つからない」→(配置後)「RGBAでない」という2段階の
  エラーで失敗した。F1-1時点では`icons/icon.ico`(Windowsのリソース生成用)
  だけを置いていたが、モバイルターゲットのビルドには(バンドルしない
  `cargo check`であっても)`generate_context!`マクロの中でアイコンの検証が
  走る。手元に適切なソース画像が無かったため、既存の`icon.ico`相当の
  プレースホルダー(F1-1で入れたpoint-cloud-viewerの既定Tauriアイコン)を
  ソースに`npx tauri icon src-tauri/icons/icon.png`を実行し、Windows
  (ico)・macOS(icns)・Android(mipmap一式)・Windows Store向けの正式なアイコン
  セットを生成し直した(iOS向けの出力はこのタスクの範囲外なので削除した)。
  退けた案: RGBA化だけを手で行う(パレットPNGをRGBAに変換する)案も考えたが、
  どのみちAndroidのmipmapアイコン一式が無いと`tauri android init`が完走しない
  見込みが高く、`tauri icon`コマンドに任せる方が確実で楽だった。
  見た目はpoint-cloud-viewerの既定プレースホルダーのままなので、
  ui-forge自身のブランドを持たせる際に差し替える(F1-1の実装記録に書かれた
  方針のまま)。
- `cargo check --target aarch64-linux-android`はNDKが無い環境でも通った
  (タスクシートの予想どおり。`cargo check`はコンパイルのみでリンクしない
  ため、NDKのリンカが無くても検査できる)。CIでは`nttld/setup-ndk@v1`で
  NDK r26dを入れた上で`tauri android build`(リンクを含む)まで行うので、
  ローカルで通った`check`より厳しい確認がCI側で行われる。

**触ったファイル**: `src-tauri/src/lib.rs`、`src-tauri/Cargo.toml`、
`src-tauri/capabilities/default.json`、`src-tauri/icons/`一式(再生成)、
`package.json`/`package-lock.json`(`@tauri-apps/plugin-fs`追加)、
`src/preview/host/{tauri-platform,tauri-android,index}.ts`、
`src/preview/host/index.test.ts`

**確認手順**: `cd src-tauri && cargo check`(Windows、デスクトップ)、
`cargo check --target aarch64-linux-android`(両方実施済み、結果は下記参照)。
Android実機での確認は受け入れ基準12(所有者の目視)。

### P1-4: CIとリリースのワークフロー

**やったこと**: `.github/workflows/ci.yml`(frontendジョブ: typecheck/lint/
test/build、rustジョブ: windows-latestで`cargo check`)、
`.github/workflows/release.yml`(androidジョブ: point-cloud-viewerの
release.ymlのandroidジョブを手本に、JDK17・NDK r26d・aarch64-linux-android
のみ・debug.keystoreのキャッシュ・APKのビルドと手動署名)。

**理由・退けた案**:
- `ci.yml`のrustジョブは`cargo check`だけにした(`fmt`/`clippy`/`cargo test`
  は含めない)。タスクシートの受け入れ基準6が求めているのは`cargo check`
  のみで、point-cloud-viewerのように`clippy`/`fmt`/`test`まで足すのは
  タスクシートが明示していない範囲の追加になる(「タスクシートが指定する
  以上の抽象を増やさない」方針)。Rustのテスト自体が今のところ無い
  (`watch.rs`にユニットテストが無い)ことも、`cargo test`を足す優先度を
  下げた理由。
- `ci.yml`の`frontend`ジョブは`ubuntu-latest`にした。Rustを一切ビルドしない
  (typecheck/lint/test/buildはNode/Viteだけで完結する)ので、
  point-cloud-viewerの`frontend`/`invariants`ジョブと同じ考え方(Rust絡みの
  ジョブだけwindows-latestにする)に揃えた。
- `ci.yml`にはpoint-cloud-viewerの`invariants`ジョブ(grepでTauriの
  import閉じ込めをCIで検査)に相当するものを作らなかった。ui-forgeでは
  同じ検査を`architecture.test.ts`(vitest)で既に行っており、`frontend`
  ジョブの`npm run test`で毎回実行されるため、同じ検査を2つの仕組みで
  重複させる理由が無い。
- `release.yml`は、point-cloud-viewerのandroidジョブと違い、
  `check-version`ジョブへの依存・`windows`ジョブへの依存・GitHub
  Releaseへのアセット添付(`softprops/action-gh-release`)を**持たせなかった**。
  ui-forgeには(a)Windows用インストーラをビルド・添付するリリースジョブが
  このタスクの範囲外、(b)タグとバージョンの整合性チェックの対象になる
  「バージョン表示」の仕組みがまだ無い、という理由で、point-cloud-viewerの
  構成をそのまま持ち込む前提が成立しない。タスクシートの「成果物として
  添付する」は`actions/upload-artifact`によるワークフロー成果物への添付と
  解釈した(ui-forgeにはまだGitHubのリモートも無く、Releaseを作る対象の
  リポジトリが存在しないため、Release作成の経路を今から書いても検証できない)。
  将来Releaseへの添付が必要になったら、point-cloud-viewerのandroidジョブを
  参考に足す。
- 両ワークフローのYAML構文は、ローカルにGitHub Actionsランナーが無いため
  `npm install --no-save js-yaml`で一時的に入れた`js-yaml`でパースできることを
  確認した(`package.json`/`package-lock.json`には残していない。
  追加の許可依存リストに無いものを一時検証だけに使い、コミットに含めない
  判断)。実際のジョブの成否(Android SDK/NDKの取得、ビルドそのもの)は
  所有者がリポジトリを作ってpushした後、Actions上で確認する必要がある。

**触ったファイル**: `.github/workflows/ci.yml`、`.github/workflows/release.yml`

**確認手順**: ローカルではYAMLの構文確認のみ(上記)。実際の実行確認は、
所有者がGitHubリポジトリを作成してpushした後に行う(下記「Android」参照)。

### P1-5: 記録

この節と`README.md`の更新。やったことは各項目の記述どおり。

---

## 受け入れ基準の確認状況

1. **ポーリング**: `src/preview/host/poll.test.ts`で確認(フェイクタイマー)。
2. **ホストの選択**: `src/preview/host/index.test.ts`で4分岐すべて確認。
3. **Tauriのimportの閉じ込め**: `src/core/architecture.test.ts`に追加した
   describeで確認。
4. **F1の受け入れ基準1-7**: `npm test`で全30件(P1追加分を除く)が
   引き続き通ることを確認済み。
5. `npm run typecheck`/`lint`/`test`/`build`: すべて通ることを確認済み
   (各コミット時点、および最終状態で再実行して確認)。
6. `cargo check`(`src-tauri`、Windows): 通ることを確認済み。
7. `cargo check --target aarch64-linux-android`: 通ることを確認済み
   (`rustup target add aarch64-linux-android`実行後。NDKが無い環境でも
   `check`はリンクしないため通る。詳細はP1-3の実装記録参照)。
8. `npm run build`のdist/にTauri呼び出しが実行されないこと:
   `npm run build`→`npm run preview`で200応答を確認、かつ`resolveFileHost()`
   が`isTauriEnvironment()`で分岐しTauri実装は`host/tauri-*.ts`の3ファイルに
   閉じている(基準3で機械的に保証)ことから、ブラウザ実行時に`@tauri-apps/*`
   のコードがコードパス上に存在しないことを確認した(ヘッドレスブラウザでの
   実行時コンソール確認は道具が無く行えていない。詳細はP1-2の実装記録参照)。

基準9-12(所有者の目視確認)は未実施。以下、所有者が確認する手順。

## 所有者が確認する手順(受け入れ基準9-12)

### Windows(基準9、F1と同じ確認)

1. `npm run tauri dev`でアプリを起動する。
2. 「開く」で`examples/Dock.ui`を選び、ガラス表示・値パネルでの
   `layerOpen`切り替え・VS Codeでの編集が1秒以内に反映されること・不正な値で
   赤い帯が出ることを確認する(F1-foundation.mdの手順と同じ)。

### Web / Chrome・Edge(基準10)

1. `npm run build`してから`npm run preview`(または`npm run dev`)でブラウザを
   開く。
2. 「開く」から`examples/Dock.ui`を選ぶ(File System Access APIのダイアログ
   が出る)。ガラス表示のドックが出ることを確認する。
3. VS Codeで`examples/Dock.ui`のラベルを書き換えて保存する。2秒以内に
   プレビューへ反映されることを確認する(ポーリング間隔1秒+読み直しの時間)。

### Web / Firefox(基準11)

1. Firefoxで同じページを開く。「開く」から`examples/Dock.ui`を選ぶ
   (`<input type="file">`のダイアログになる)。ガラス表示のドックが出ることを
   確認する。
2. 画面上部に「このブラウザではファイルの変更を自動で読み直せません
   (Chrome / Edge を推奨)」という注意書きが出ていることを確認する。
3. VS Codeでファイルを書き換えて保存しても反映されないこと、「開く」を
   もう一度押して同じファイルを選び直すと新しい内容が表示されることを
   確認する。

### Android(基準12)

ui-forgeにはまだGitHubのリモートが無いため、所有者が以下を行う必要がある。

1. GitHubにリポジトリを作成し、このリポジトリをpushする
   (実装者はここまでを行っていない。タスクシート「Androidのビルド」節の
   指定どおり)。
2. Actionsタブから`Release`ワークフローを`workflow_dispatch`(手動実行)で
   走らせる、またはバージョンタグ(`v*`)をpushする。
3. ワークフロー実行が終わったら、実行結果のページから`android-apk`という
   名前の成果物(アーティファクト)をダウンロードする。
4. 展開したAPKをAndroid端末にインストールする(debug署名のため、同じ端末に
   インストール済みの場合はいったんアンインストールしてから入れ直す必要が
   あるかもしれない)。
5. 端末内の`.ui`ファイル(`examples/Dock.ui`を端末へコピーする等)を開き、
   ガラス表示のドックが出ることを確認する。
6. 別のアプリ(ファイルマネージャ等)でそのファイルを書き換え、2秒以内に
   プレビューへ反映されることを確認する(ポーリング間隔1秒+読み直しの時間)。
