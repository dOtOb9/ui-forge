# プラットフォーム

P1（[`TaskSheets/P1-platforms.md`](https://github.com/dOtOb9/ui-forge/blob/main/TaskSheets/P1-platforms.md)）で、
プレビューアプリは Windows・Android・Web のそれぞれで単独で動くようになりました。
この章は、ファイルを開く・読む・変更を検知する部分（`src/preview/host/` と
`src-tauri/src/watch.rs`）を扱います。[src/preview の章](./preview.md#rendertsx-実行時の解釈)で
見た `PreviewApp.tsx` は、この章で説明する `FileHost` だけを見ています。

## ファイルホスト: プラットフォームの違いを閉じ込める場所

[`src/preview/host/FileHost.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/host/FileHost.ts) は
point-cloud-viewer の `DataSource`（`src/datasource/DataSource.ts`）と同じ考え方です。
`PreviewApp.tsx` はこのインターフェースだけを見て、今動いているのが Windows・Android・Web の
どれかを知りません。

```ts
export interface OpenedFile {
  displayName: string;
  read(): Promise<string>;
  watch(handler: () => void): () => void;
}

export interface FileHost {
  pick(): Promise<OpenedFile | null>;
  readonly supportsAutoReload: boolean;
}
```

`supportsAutoReload` は P1 の設計のコード例には無く、実装時に足されたフィールドです。
Web 版で File System Access API が無いブラウザ（後述）は変更を自動検知できないため、
`PreviewApp.tsx` が注意書きを出す必要があります。「どのホストか」を `PreviewApp.tsx` 側に
漏らさずにそれを伝える手段として、`OpenedFile` ではなく `FileHost` 側に生やされています
（同じホストが返す `OpenedFile` はどれも同じ能力を持つため）。

## 3つの実装

| 実装 | ファイル | 選択 | 読み込み | 変更の検知 |
|---|---|---|---|---|
| Windows | [`host/tauri-desktop.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/host/tauri-desktop.ts) | `@tauri-apps/plugin-dialog` の `open()` | Rust の `read_ui_file`（F1 のまま） | Rust の `notify`（`watch_ui_file`、F1 のまま） |
| Android | [`host/tauri-android.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/host/tauri-android.ts) | 同じ `open()`（`content://` URI が返る） | `@tauri-apps/plugin-fs` の `readTextFile()` | `pollForChange()` で1秒ごとに中身の文字列を比較 |
| Web（FSA あり） | [`host/web.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/host/web.ts) の `webFileSystemAccessHost` | File System Access API の `showOpenFilePicker()` | `handle.getFile()` | `pollForChange()` で1秒ごとに `size`/`lastModified` を比較 |
| Web（FSA なし） | 同ファイルの `webInputFallbackHost` | `<input type="file">` | 選んだ時点の `File` を丸ごと保持 | できない（`supportsAutoReload: false`） |

Windows はファイルパスを直接扱える唯一の実装なので、F1 で作った Rust 側の
`read_ui_file` / `watch_ui_file` をそのまま使っています。Android と Web（FSA あり）は
どちらも「変更を直接知る手段が無い」という共通の制約を持つため、ポーリングの
実装（次節）を共有しています。

## 変更検知が2種類ある理由と `poll.ts`

変更検知に `notify`（Windows だけ）とポーリング（Android・Web）の2種類があるのは、
それぞれ別の理由で `notify` が使えないからです。

- Android の `open()` が返す `content://` URI は、ファイルシステム上のパスではないので
  `notify`（`watch.rs`）で監視できません
- ブラウザにはファイル監視の標準 API がありません（`FileSystemObserver` は Chromium の
  一部の版にしかなく、当てにされていません）

`.ui` は数 KB なので、1秒ごとの読み直しは負荷として無視できると判断されています。
ポーリングの実装は [`host/poll.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/host/poll.ts) の `pollForChange()` 1つにまとまっていて、
Android と Web の両方から呼ばれます。

```ts
export function pollForChange<T>(
  getSnapshot: () => Promise<T>,
  equals: (a: T, b: T) => boolean,
  onChange: () => void,
  intervalMs = 1000,
): () => void
```

呼び出した直後に一度 `getSnapshot()` を呼んで基準値を取り、以後 `intervalMs`
（既定1秒）ごとに取り直して `equals` で比べます。変わっていたら `onChange` を呼びます。
`T` と `equals` は呼び出し側が決めるので、比べるものの重さを選べます。Android 版は
ファイルの中身の文字列そのもの（`(a, b) => a === b`）、Web 版は `{ size, lastModified }`
（中身をまるごと読むより軽い）を比べています。返り値の関数を呼ぶと止まり、
止めた後は進行中の取得が後から戻ってきても `onChange` は呼ばれません
（[`host/poll.test.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/host/poll.test.ts)、受け入れ基準1。フェイクタイマーで確認しています）。

## Firefox / Safari の `<input>` フォールバックと `supportsAutoReload`

File System Access API を持たないブラウザ（Firefox・Safari）向けに、`web.ts` の
`webInputFallbackHost` は `<input type="file">` でファイルを開かせます。この方法では
ブラウザがその時点の中身を `File` としてまるごと渡すだけで、以後そのファイルを
読み直す標準の手段がありません。そのため `watch()` は何もせず、呼べば何もしない
unsubscribe 関数だけを返します。

`supportsAutoReload: false` を `PreviewApp.tsx` が見て、画面上部に
「このブラウザではファイルの変更を自動で読み直せません（Chrome / Edge を推奨）」
という注意書きを出します。手動の「再読み込み」ボタンは無く、**もう一度「開く」を
押して同じファイルを選び直す**形です（`<input>` には同じファイルを明示的に
読み直す手段が無いため）。

キャンセルの検知には `input` の `cancel` イベントを使っていますが、これは
比較的新しいブラウザ（Chrome 113+ 等）にしかありません。無いブラウザでキャンセルすると
`pick()` の Promise は解決されないまま残りますが、「開く」をもう一度押せば新しい
`input` を作り直すだけなので実害は小さいと判断されています。

## `host/index.ts`: どの実装を使うか決める1箇所

[`host/index.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/host/index.ts) の `resolveFileHost()` だけが、4通りの環境を判定して
`FileHost` を選びます。

```ts
export async function resolveFileHost(): Promise<FileHost> {
  if (isTauriEnvironment()) {
    return (await isAndroid()) ? tauriAndroidHost : tauriDesktopHost;
  }
  return hasFileSystemAccessApi() ? webFileSystemAccessHost : webInputFallbackHost;
}
```

- **Tauri かブラウザか**: [`host/environment.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/host/environment.ts) の `isTauriEnvironment()` が
  `"__TAURI_INTERNALS__" in window` を見ます。point-cloud-viewer の
  `src/datasource/environment.ts` と同じ判定方法で、判定のためだけに Tauri の npm
  パッケージを import しません
- **Tauri の中でさらに Android かデスクトップか**: `__TAURI_INTERNALS__` だけでは
  区別できません（Android の WebView にも同じ目印が生えます）。
  [`host/tauri-platform.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/host/tauri-platform.ts) の `isAndroid()` が、起動時に一度だけ Rust の
  `is_android` コマンドに問い合わせます。point-cloud-viewer が
  `src/state/useCopcViewer.ts` で行っている方式と同じです
- **ブラウザの中でどちらか**: `environment.ts` の `hasFileSystemAccessApi()` が
  `"showOpenFilePicker" in window` を見ます

`tauri-platform.ts` は `tauri-desktop.ts`/`tauri-android.ts` どちらの実装ファイルにも
置かれていません。判定ロジックをどちらか一方の実装ファイルに置くと、デスクトップ実装が
Android実装の存在を知っている（あるいは逆）という依存のねじれが生まれるためです。

## `@tauri-apps` の import を閉じ込める規約

[規約の章](./conventions.md#依存の向き-srccore-は-reacttauri-を知らない)で触れた
「`@tauri-apps/*` を import してよいのは `src/preview/host/tauri-*.ts` だけ」という
point-cloud-viewer の規約2と同じ約束が、P1 でも守られています。対象は
`tauri-desktop.ts`・`tauri-android.ts`・`tauri-platform.ts` の3ファイルです。F1 の
`src/preview/tauriBridge.ts` はこの構成に吸収されて消えました。

[`src/core/architecture.test.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/core/architecture.test.ts) の2つめの `describe` が、`src/` 以下の全
`.ts`/`.tsx` を読み、`@tauri-apps/` を import しているファイルが
`host/tauri-*.ts` 以外に無いことを機械的に確認します（P1 の受け入れ基準3）。
`web.ts`・`poll.ts`・`index.ts`・`FileHost.ts`・`environment.ts` はどれも
`@tauri-apps/*` を import しません。これにより、Web 版のビルドに Tauri の呼び出しが
紛れ込む心配がありません（後述の「未確認なこと」で、この保証の限界にも触れます）。

## Rust 側: `cfg(desktop)` の切り分けと `plugin-fs` の capability

[`src-tauri/src/lib.rs`](https://github.com/dOtOb9/ui-forge/blob/main/src-tauri/src/lib.rs) は、`notify` を使う
[`watch.rs`](https://github.com/dOtOb9/ui-forge/blob/main/src-tauri/src/watch.rs) モジュールを `#[cfg(desktop)]` でまるごと外しています。関数単位では
なくモジュールごと外しているのは、`notify` クレート自体を Android ターゲットの
依存グラフに含めないためです。

```rust
#[cfg(desktop)]
mod watch;
```

Android では読み込みを `tauri-plugin-fs` の `readTextFile()` に任せます。この
プラグインを使うための権限が、[`src-tauri/capabilities/default.json`](https://github.com/dOtOb9/ui-forge/blob/main/src-tauri/capabilities/default.json) の
`"fs:read-files"` です（point-cloud-viewer の `default.json` と同じ権限）。

```json
"permissions": ["core:default", "dialog:allow-open", "fs:read-files"]
```

`invoke_handler` は1回しか呼べないため、デスクトップ/モバイルで登録するコマンドの
一覧も `#[cfg(desktop)]`/`#[cfg(mobile)]` で分かれています。`is_android` コマンドは
どちらでも登録されます（`host/tauri-platform.ts` の `isAndroid()` が Tauri 内なら
必ず呼ぶため）が、`read_ui_file`/`watch_ui_file` はデスクトップだけです。モバイル用の
エントリポイントは `#[cfg_attr(mobile, tauri::mobile_entry_point)]` を `run()` に
付けて用意されています。

## Android のビルド: ローカルに SDK が無いので CI で作る

この PC には Android SDK/NDK が入っていません。ローカルでは
`cargo check --target aarch64-linux-android`（リンクしないので NDK 無しでも通ります）
までしか確かめられず、APK そのものは [`.github/workflows/release.yml`](https://github.com/dOtOb9/ui-forge/blob/main/.github/workflows/release.yml) の
`android` ジョブが GitHub Actions 上で作ります。point-cloud-viewer の `release.yml` の
android ジョブを手本にしていて、構成はほぼ同じです。

- JDK 17、NDK r26d（`nttld/setup-ndk@v1`）、ターゲットは `aarch64-linux-android` のみ
- `~/.android/debug.keystore` を `actions/cache` でキャッシュ（無ければ生成）
- `npm run tauri android init` → `npm run tauri android build -- --target aarch64 --apk`
  （`--debug` を付けないので Rust 側も最適化ビルドになる）
- 未署名の APK を `zipalign` → `apksigner` で debug 鍵を使って後付け署名
- バージョンタグ（`v*`）を push したときだけ、版入りの名前
  （`ui-forge_<version>_android-aarch64.apk`）に揃えて GitHub Release に添付する
- タグの有無にかかわらず、`actions/upload-artifact` でワークフロー実行の成果物
  （`android-apk`）としても残す（`workflow_dispatch` での手動実行のビルド確認経路）

D1（[`TaskSheets/D1-delivery.md`](https://github.com/dOtOb9/ui-forge/blob/main/TaskSheets/D1-delivery.md)）までは、
ui-forge にはまだバージョン表示やタグとの整合性チェックの仕組みが無く、
GitHub のリモート自体も存在しなかったため、Release 添付を持たず
ワークフロー成果物への保存だけに留めていました。D1 で `check-version`
ジョブ（タグと `package.json`/`tauri.conf.json`/`Cargo.toml` の版の一致を確認）と、
Windows 向けの `windows` ジョブ（NSIS インストーラをビルドして Release に添付）を
足し、point-cloud-viewer の `release.yml` と同じ「タグを打てば配布物が揃う」形に
揃えました。`windows` ジョブ・`android` ジョブとも Release へのアセット添付には
`permissions: contents: write` が要るため、それぞれのジョブにだけ付けています。

[`.github/workflows/ci.yml`](https://github.com/dOtOb9/ui-forge/blob/main/.github/workflows/ci.yml) は Android ターゲットを含みません。`frontend`
ジョブ（`ubuntu-latest`、typecheck/lint/test/build）と、`rust` ジョブ
（`windows-latest`、`src-tauri` で `cargo check`）の2つだけです。

## 未確認なこと

P1 の実装記録（[`TaskSheets/P1-platforms.md`](https://github.com/dOtOb9/ui-forge/blob/main/TaskSheets/P1-platforms.md)）が明記している通り、
自動テストとコマンドでの確認（受け入れ基準1〜8）は済んでいますが、所有者の目視確認
（受け入れ基準9〜12）はこの本の執筆時点でまだ行われていません。

- **Web（Chrome/Edge）**: `examples/Dock.ui` を開いて編集が2秒以内に反映されることは
  未確認
- **Web（Firefox）**: 開けて表示され、注意書きが出ることは未確認
- **Android**: GitHub のリモートがまだ無いため、`release.yml` 自体がまだ一度も
  実行されていません。実機への導入・別アプリでの書き換えが2秒以内に反映されることは
  どちらも未確認です
- 受け入れ基準8（ブラウザで `@tauri-apps/*` のコードが実行されないこと）は、
  ヘッドレスブラウザの道具が無いため実際のコンソール確認はされておらず、
  「`isTauriEnvironment()` が false のときは Web の2実装しか選ばれず、
  `@tauri-apps/*` の import は `tauri-*.ts` の3ファイルに閉じている」という
  コードパスの検査で代替されています
- Android 向けのローカル確認では、`cargo check --target aarch64-linux-android` の
  実行時に `generate_context!()` がアイコン欠落で失敗する問題が見つかり、
  `npx tauri icon` でアイコン一式を再生成することで解決しています（見た目は
  point-cloud-viewer の既定プレースホルダーのままです）

## 既知の弱点: ポーリングはエラーでも1秒ごとに呼び直す

`pollForChange()` は `getSnapshot()` の失敗を考慮していません。ファイルが削除された、
Android の権限が失われた、といった理由で `readTextFile()`（Android）や
`handle.getFile()`（Web）が例外を投げると、`checkOnce()` 内の `await` がそのまま
失敗し、`catch` が無いため**ハンドルされない Promise の拒否**になります。しかも
`setInterval` は止まらないので、次の1秒後にまた同じ失敗が起きます。

```ts
const checkOnce = async () => {
  const snapshot = await getSnapshot(); // ここで失敗すると catch されない
  ...
};
```

利用者の画面には何も表示されず、エラーが延々と繰り返されるだけになります。
編集と書き戻し（F2）で `OpenedFile` に書き込み API を足す際、ファイルが無くなった・
権限が無くなった状態を利用者に見せる仕組みが必要になるはずなので、このタイミングで
`pollForChange()` にも失敗を一度だけ `onChange` 相当の形で伝える経路を足すのが
妥当だと考えられます（この本の執筆時点では未着手です）。

## まず読むファイル

- [`src/preview/host/FileHost.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/host/FileHost.ts) — インターフェースそのもの。短いので全部読めます
- [`src/preview/host/index.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/host/index.ts) — どの実装を使うか決める1箇所。ここから4つの実装ファイルを辿れます
- [`TaskSheets/P1-platforms.md`](https://github.com/dOtOb9/ui-forge/blob/main/TaskSheets/P1-platforms.md) — このマイルストーンの設計と実装記録
