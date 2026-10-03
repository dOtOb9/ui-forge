# P1: Web / Android / Windows 対応

- 状態: 未着手
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
