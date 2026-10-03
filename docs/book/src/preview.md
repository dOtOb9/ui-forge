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

## 編集(F2): 選択・Hierarchy・Details・書き戻し

F2（[`TaskSheets/F2-editor.md`](https://github.com/dOtOb9/ui-forge/blob/main/TaskSheets/F2-editor.md)）で、プレビューは見るだけの道具から、
部品を選んで触って直せる道具になりました。編集に関わるものは
`src/preview/editor/` にまとめてあります。

### 選択とSelectionOverlay: render.tsxの出力に手を入れない

選択は `data-ui-id` を使って行います(クリックされた要素から祖先へたどり、
最初に見つかった `data-ui-id` の部品を選びます)。**render.tsxの出力そのものには
選択用の要素を一切混ぜていません。** 選択枠は [`editor/SelectionOverlay.tsx`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/editor/SelectionOverlay.tsx) という
別のコンポーネントが、選択中の要素の `getBoundingClientRect()` を測って、
`renderDocument()` の結果の**隣**(同じ親の中のきょうだい要素)に重ねて描きます。
この構造のおかげで、[render-parityの章](./render-parity.md)のHTML一致テストは
F2での変更を一切受けずに通り続けます(受け入れ基準6)。

`SelectionOverlay` は `ResizeObserver`・`MutationObserver`・`resize`イベントの
3つでレイアウトの変化を拾い、選択枠を再計算します。Reactの状態(文書・値パネル・
テーマ)が変わったことを1つずつ依存に挙げる代わりに、結局はDOM自体が変わるか
ウィンドウがリサイズされるかのどちらかだという点に着目して、DOMを直接観察する
形にしています。

### 編集モード / 操作モード

ツールバー([`editor/Toolbar.tsx`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/editor/Toolbar.tsx))で「編集」「操作」を切り替えられます(既定は編集モード)。
編集モードでは、プレビュー上のクリックは部品の選択になります。
`PreviewApp.tsx` の `onClickCapture` が**capture段階**でクリックを捕まえ、
`data-ui-id` を持つ最も近い祖先を見つけて選択に変換し、`preventDefault`/
`stopPropagation` を呼びます。これにより、ボタン自身(bubble段階)の
`onClick` には到達せず、イベントは発火しません。操作モードでは何もしないので、
F1と同じようにボタンを押すとイベントログに記録されます。

### Hierarchy・Details: 編集操作とvocabulary.ts

[`editor/Hierarchy.tsx`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/editor/Hierarchy.tsx) は文書の木構造を一覧し、部品を足す・消す・並べ替えるボタンを持ちます。
[`editor/Details.tsx`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/editor/Details.tsx) は選んだ部品のid・type・slot・propsを編集します。
どちらも、実際の変更は [`src/core/edit.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/core/edit.ts) の純粋関数
(`setProp`/`setSlot`/`renameWidget`/`addChild`/`removeWidget`/`moveWidget`)を呼ぶだけです。
これらはどれも文書を複製してから複製だけを書き換え、元の文書には触れません。
不正な操作(存在しないid、rootの削除、既存idへの改名など)は例外を投げず
`{ ok: false, reason }` を返し、`reason` がそのまま画面に表示されます。

Detailsの入力欄は、手書きの対応表を持たず [`src/core/vocabulary.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/core/vocabulary.ts) の
`fieldsFor()`/`slotFields()` が `schema/ui.schema.json` を読んで導いた一覧だけを見て
組み立てます。語彙はすでにスキーマ・型・対応表・`BINDABLE_PROPS` に分かれているため、
Details用にもう1つ表を作ると、語彙を足すたびに直す場所が増えてしまいます。
並行して進んでいるI-0が `Canvas.layer`/`Panel.textSize` をスキーマに足しますが、
このファイルは1行も変えずにDetailsへ新しい項目が出てくる、という形でこの設計が
検証されています。

文字入力系の項目(id改名・string値・bind名・event名)は [`editor/CommitOnBlurInput.tsx`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/editor/CommitOnBlurInput.tsx)
を使い、フォーカスを外す(blur)かEnterを押すまで書き戻しを遅らせます。1打鍵
ごとに書き戻すと、入力途中の不完全な値(例: `onToggleLayer`と打ち終える前の
`onT`)がファイルに書かれ、監視が読み直した瞬間に検証エラーとなって編集全体が
ロックされてしまう(後述の「不正なファイルのときの編集無効化」)ため、この
一手間を置いています。

### 書き戻しとUndo/Redo: `editor/useUiDocument.ts`

編集のたびに、F1からある `formatDocument()` で正規化してから**即座に**
`OpenedFile.write()` でファイルへ書きます。保存ボタンはありません。この配線と、
Undo/Redoの状態は [`editor/useUiDocument.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/editor/useUiDocument.ts) という1つのhookにまとめてあり、
`PreviewApp.tsx` 自身が肥大化しないようにしています。

履歴(Undo/Redo)は [`src/preview/history.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/history.ts) が正規化済み**テキストのスタック**として持ちます
(文書のオブジェクトではありません。文字列同士の比較で「同じテキストを続けて
積まない」判定ができ、そのままファイルに書き戻せるためです)。上限は100件、
`Ctrl+Z`/`Ctrl+Shift+Z`/`Ctrl+Y`とツールバーの ↶↷ の両方から操作できます。
テキスト入力欄にフォーカスがあるときはこのショートカットを奪いません
(`CommitOnBlurInput` がblur/Enterで確定する作りなので、ブラウザ標準の取り消しと
衝突しないようにしています)。

**自分の書き込みで監視が反応しても、読み直した中身が今の文書の正規化結果と
同じなら何もしません。** `useUiDocument.ts` の `reload()` がこれを行います:
読み直した内容を `formatDocument()` で正規化し、今 `loaded` に持っている文書を
同じように正規化した文字列と比較して、一致していれば `loaded`/履歴のどちらも
更新せずに戻ります。これにより「書く→監視が検知→読み直す→再描画」という
無駄な往復と、Undo履歴が自分自身のエコーで汚れることの両方を防いでいます。
一方、内容が変わっていれば(AIやVS Codeなど外部からの変更であれば)履歴に
1件積みます。これにより、**外部からの編集もUndoで取り消せます。**

### 不正なファイルのときの編集無効化

F1の「検証エラーが出ても、プレビューを消さない」という振る舞いに加えて、F2では
**その間の編集を無効にします**(`useUiDocument.ts` の `canEdit`)。不正なテキストの
上に、古い正しい文書から作った編集を書くと、外部での修正を上書きしてしまうため
です。`canEdit` は、書き込みができない(`readOnly`)、または直前の読み込みが
検証に失敗している(`errors.length > 0`)のどちらかでfalseになり、`Hierarchy`/
`Details` の入力欄が無効化されて理由が表示されます。ファイルが正しく直されたら
また編集できるようになります。

## ファイルを開く・読む・監視する部分について

`PreviewApp.tsx` は、ファイルの選択・読み込み・変更検知を `FileHost` /
`OpenedFile` という2つのインターフェース([`src/preview/host/FileHost.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/host/FileHost.ts))
越しに行います。これにより、`PreviewApp.tsx` 自身は今動いているのが Windows・
Android・Web のどれかを知りません。F2で `OpenedFile` に `write()`/`supportsWrite`
が足されたことも含め、`FileHost` の実装(`src/preview/host/` の中身)と
`src-tauri/src/watch.rs` の詳細は、[「プラットフォーム」の章](./platforms.md)で扱います。

## まず読むファイル

- [`src/preview/PreviewApp.tsx`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/PreviewApp.tsx) — 組み立て役。ここから他のファイルを辿れる
- [`src/preview/render.tsx`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/render.tsx) — `generate.ts` と読み比べると理解が深まる
- [`src/preview/editor/useUiDocument.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/editor/useUiDocument.ts) — F2の編集・Undo/Redo・書き戻しの配線はここに集まっている
