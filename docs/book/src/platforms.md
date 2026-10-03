# プラットフォーム

枠のみ。P1（[`TaskSheets/P1-platforms.md`](https://github.com/dOtOb9/ui-forge/blob/main/TaskSheets/P1-platforms.md)、Windows / Android / Web 対応）の
合流後に、別の作業でこの章を書きます。

この本の執筆時点で分かっている範囲だけ書いておきます。ファイルを開く・読む・
変更を検知する処理は `FileHost` / `OpenedFile`（[`src/preview/host/FileHost.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/host/FileHost.ts)）
という2つのインターフェース越しに行われ、[`src/preview`の章](./preview.md#ファイルを開く読む監視する部分について)で見たとおり
`PreviewApp.tsx` 自身はどのプラットフォームで動いているかを知りません。実装の詳細
（Windows・Android・Web それぞれの `FileHost` 実装、`src-tauri/src/watch.rs` の
ファイル監視）はここでは扱いません。

## まず読むファイル

- [`TaskSheets/P1-platforms.md`](https://github.com/dOtOb9/ui-forge/blob/main/TaskSheets/P1-platforms.md) — このマイルストーンの設計
