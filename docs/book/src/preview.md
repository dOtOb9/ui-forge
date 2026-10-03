# src/preview

`src/preview/` は、`.ui` を**実行時に解釈して描画する** React アプリです。
`src/codegen/` が作る TSX とは別の経路で、同じ文書を同じ見た目に描きます
（なぜ2つの経路が要るかは[全体像](./overview.md#2つの経路)、同じ HTML になることの
保証は[次の章](./render-parity.md)で扱います）。

## render.tsx: 実行時の解釈

[`src/preview/render.tsx`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/render.tsx) の `renderDocument()` は、`UiDocument` と「値の組」
（bind 名 → 実際の値、event 名 → 呼び出す関数）から React 要素を作ります。

内部の `widgetClassName()` は、`src/codegen/generate.ts` の `widgetOwnClasses()` と
**わざと同じ順番**でクラス片を組み立てています。読み比べられるようにするためで、
違うのは一点だけです。`generate.ts` は「bind ならどちらを選ぶかの三項演算子を
ソースコードの文字列として書く」のに対し、ここは「実際の値を見てどちらかを選んだ
結果の文字列」を直接作ります。両者を共通のヘルパー関数にまとめることも検討されましたが、
「ソースコードのテキストを作る」処理と「実際の値の文字列を作る」処理は出力モードが
根本的に違うため、無理に共通化すると抽象がかえって読みにくくなると判断されています
（これは ADR-0001「本体に実行時ランタイムが増えない」とも両立しません。生成物が
`render.tsx` を import する形になってしまうためです）。

## 値パネルとイベントログ

[`ValuePanel.tsx`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/ValuePanel.tsx) は文書中の bind を一覧し、型に応じた入力を出します
（boolean → チェックボックス、列挙 → セレクト、string → テキスト）。
[`values.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/values.ts) の `reconcileValues()` が初期値を決めます
（boolean は `false`、列挙は最初の値、string は bind 名そのもの）。ファイルを
開き直して bind の顔ぶれが変わっても、既に触っていた bind 名はその値を引き継ぎ、
型が変わっていれば既定値に戻します。

[`EventLog.tsx`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/EventLog.tsx) はボタンを押すと発火した event 名を時刻付きで並べるだけの、状態を
持たない一覧表示です。

## PreviewApp.tsx: 画面の組み立てと、検証エラー時の振る舞い

[`PreviewApp.tsx`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/PreviewApp.tsx) が画面全体（上: 開く + パス、中央: プレビュー、右: 値パネル、
下: イベントログ）を組み立てます。

**検証エラーが出ても、プレビューを消しません。** `loaded`（最後に正しく読めた文書）
と `errors`（検証エラーの一覧）は別の state で持たれていて、新しく読んだ内容が
検証に失敗した場合は `errors` だけが更新され、`loaded` は上書きされません。画面には
最後に正しく読めた表示がそのまま残り、下に赤い帯でエラー（`path` と `message`）が
重ねて出ます。

プレビュー領域には `contain: layout` という CSS が付いています。生成される
`Canvas` は `fixed inset-0`（ウィンドウ全面を前提にしたクラス）なので、これが無いと
値パネルやイベントログの上まで覆ってしまうためです（CSS Containment の仕様により、
`contain` は `transform` と同様に `position: fixed` の基準をそのペイン自身に
閉じ込めます）。

## ファイルを開く・読む・監視する部分について

`PreviewApp.tsx` は、ファイルの選択・読み込み・変更検知を `FileHost` /
`OpenedFile` という2つのインターフェース（[`src/preview/host/FileHost.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/host/FileHost.ts)）
越しに行います。これにより、`PreviewApp.tsx` 自身は今動いているのが Windows・
Android・Web のどれかを知りません。

`FileHost` の実装（`src/preview/host/` の中身）と `src-tauri/src/watch.rs` の詳細は、
[「プラットフォーム」の章](./platforms.md)で扱います。

## まず読むファイル

- [`src/preview/PreviewApp.tsx`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/PreviewApp.tsx) — 組み立て役。ここから他のファイルを辿れる
- [`src/preview/render.tsx`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/render.tsx) — `generate.ts` と読み比べると理解が深まる
