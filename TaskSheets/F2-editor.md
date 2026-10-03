# F2: エディタ（選択・Hierarchy・Details・書き戻し・Undo）

- 状態: 未着手
- 前提: [ADR-0001](./ADR-0001-design.md)、[F1](./F1-foundation.md)、[P1](./P1-platforms.md)

## 目的

**プレビューアプリを、見るだけの道具から、UMG の Designer のように触って直せる道具にする。**
部品を選び、プロパティを変えると、その場で `.ui` ファイルに正規化して書き戻される。
AI がテキストで編集しても、人間がエディタで編集しても、行き着く先は同じ 1 つのファイル。

キャンバス上のドラッグ配置は F3。今回は「選ぶ・値を変える・部品を足す / 消す / 並べ替える」まで。

## 画面構成

```
┌──────────────────────────────────────────────────────────────┐
│ [開く] path/to/Dock.ui   [編集 | 操作]  [↶][↷]   保存済み     │
├────────────┬───────────────────────────────┬─────────────────┤
│ Hierarchy  │                               │ Details         │
│ ▾ root     │        プレビュー              │ (選んだ部品)     │
│  ▾ dock    │     （選択中の部品に枠）        │ id / type       │
│   ▾ dock_… │                               │ slot / props    │
│     layer… │                               ├─────────────────┤
│ [+部品][削除]│                               │ 値パネル(F1)     │
│ [↑][↓]     ├───────────────────────────────┴─────────────────┤
│            │ イベントログ(F1)                                  │
└────────────┴─────────────────────────────────────────────────┘
```

- **編集モード / 操作モード**の切り替え。編集モードでは、プレビュー上のクリックは部品の選択になり、
  ボタンのイベントは発火しない。操作モードは F1 と同じ（ボタンを押すとイベントログに出る）。
  既定は編集モード
- 選択は `data-ui-id` で行う。クリックされた要素から祖先へたどり、最初に見つかった `data-ui-id` の部品を選ぶ。
  **`render.tsx` の出力（＝生成物と一致する HTML）に選択用の要素を混ぜない。** 選択枠はプレビューの上に
  重ねた別の層に、選択中の要素の `getBoundingClientRect()` から描く（HTML 一致テストを壊さないため）
- Hierarchy と プレビューの選択は常に同期する

## 設計

### 1. 編集操作は core の純粋関数にする

`src/core/edit.ts` に置く。どれも `(doc, ...) => UiDocument` で、**元の文書を変更しない**（新しい文書を返す）。

| 関数 | 内容 |
|---|---|
| `setProp(doc, id, key, value)` | プロパティを設定する。`value` が `undefined` なら削除 |
| `setSlot(doc, id, slot)` | slot を設定する（`undefined` で削除） |
| `renameWidget(doc, id, newId)` | id を変える |
| `addChild(doc, parentId, type)` | コンテナの末尾に新しい部品を足す。id は `<type の snake_case>_<連番>` で文書内一意に自動で付ける。親が Canvas なら slot に `{"anchor": "center"}` を付ける |
| `removeWidget(doc, id)` | 部品を子ごと消す。root は消せない |
| `moveWidget(doc, id, delta)` | 同じ親の中で前後に動かす（`-1` / `+1`）。端なら何もしない |

- 不正になる操作（非コンテナへの追加、子を持つ `Panel` への 2 つ目の追加、root の削除、既存 id への改名など）は
  **例外を投げず、`{ ok: false, reason }` を返す**。成功時は `{ ok: true, doc }`。UI は `reason` を出す
- **どの操作の結果も `validate` を通る**ことをテストで保証する（Dock.ui に対して全操作を一通りかける）

### 2. Details パネルの入力欄はスキーマから導く

`src/core/vocabulary.ts` に、**`schema/ui.schema.json` を読んで**「部品の型ごとのプロパティ一覧と、
それぞれの種類（列挙なら選択肢 / boolean / string / event、bind 可かどうか）」を返す関数を作る。
Details パネルはこれだけを見て入力欄を作る。

- 理由: 語彙はすでにスキーマ・型・対応表・`BINDABLE_PROPS` に分かれている。Details 用にもう 1 つ
  手書きの表を作ると、語彙を足すたびに直す場所が増える。スキーマから導けば、**語彙を足したときに
  Details は自動で追従する**（並行して進んでいる I-0 で `Canvas.layer` と `Panel.textSize` が足される。
  合流後に Details に何も足さずに出てくることが、この設計の検証になる）
- 入力欄: 列挙 → セレクト（先頭に「（未設定）」）、boolean → チェックボックス＋「未設定に戻す」、
  string → テキスト、bind 可のもの → 「値 / bind」の切り替え＋bind 名の入力、event → event 名の入力
- slot は親が Canvas のときだけ出す。id は改名できる（不正なら理由を出して元に戻す）

### 3. 書き戻し

- 編集のたびに `formatDocument` で正規化して、**即座に**ファイルへ書く（保存ボタンは作らない）。
  未保存の状態を持たないので、外部（AI や VS Code）の編集とぶつかる「どちらが新しいか」の問題が起きにくい
- `OpenedFile` に `write(text): Promise<void>` と `readonly supportsWrite: boolean` を足す

| ホスト | 書き込み |
|---|---|
| Windows | Rust に `write_ui_file` コマンドを足す |
| Android | `plugin-fs` の `writeTextFile` で `content://` に書く。capability に書き込み権限を足す。**`content://` への書き込みが plugin-fs で実際にできるかは未確認。** コンパイルが通っても実機で確かめるまでは分からないので、実装記録に「未確認」と書く |
| Web（File System Access API） | `handle.createWritable()`。初回に読み書きの許可を求める（`requestPermission({ mode: "readwrite" })`） |
| Web（`<input>`） | 書けない。`supportsWrite: false` で、エディタは読み取り専用（Details を無効化し、理由を出す） |

- **自分の書き込みで監視が反応しても、読み直した中身が今の文書の正規化結果と同じなら何もしない。**
  これで「書く → 監視が検知 → 読み直す → 再描画」の無駄な往復と、Undo 履歴の汚れを防ぐ
- 書き込みに失敗したら、画面上部に赤い帯で出す（F1 の検証エラーの帯と同じ見た目）。編集内容は画面に残す

### 4. Undo / Redo

- 履歴は**正規化済みテキストのスタック**で持つ（文書のオブジェクトではなく文字列。比較が簡単で、
  そのままファイルに書ける）。上限 100
- `Ctrl+Z` / `Ctrl+Shift+Z`（と `Ctrl+Y`）、ツールバーの ↶ ↷
- Undo / Redo もファイルに書き戻す
- **外部からの変更**（AI や VS Code による保存）を読み込んだときは、それも履歴に 1 つ積む（Redo は消える）。
  これで AI の編集を Undo で取り消せる
- 履歴のロジックは `src/preview/history.ts` に React から独立した形で置き、単体テストする

### 5. 不正なファイルのとき

F1 と同じく、最後に正しく読めた表示を残し、赤い帯でエラーを出す。**このあいだ編集は無効**にする
（不正なテキストの上に、古い正しい文書から作った編集を書くと、外部での修正を上書きしてしまうため）。
ファイルが正しく直されたら編集できるようになる。

### 6. P1 からの持ち越し: ポーリングのエラー処理

`host/poll.ts` の `pollForChange` は、`getSnapshot()` が失敗（ファイルの削除、Android のアクセス権切れ）
すると、1 秒ごとに処理されないエラーを出し続ける。`onError` を受け取れるようにし、失敗したら
**1 回だけ**通知して、成功するまで再通知しない。画面には「ファイルを読めません」の帯を出す。

## 作業の分け方とコミット

1 項目 = 1 コミット以上。各コミットで `typecheck` / `lint` / `test` が通ること。

- F2-1: `edit.ts` と `vocabulary.ts`（core、純粋関数、テスト付き）
- F2-2: `history.ts`（Undo / Redo、テスト付き）
- F2-3: `OpenedFile.write` / `supportsWrite` と各ホストの実装、Rust の `write_ui_file`、capability、
  ポーリングのエラー処理
- F2-4: 画面（モード切り替え、選択と枠、Hierarchy、Details、ツールバー、書き戻しの配線）
- F2-5: 実装記録、本（`preview` 章とプラットフォーム章、用語集）の更新、README

## 受け入れ基準

自動テスト:

1. `edit.ts` の各操作: 成功時に `validate` を通る文書を返す / 元の文書が変わっていない / 不正な操作は
   `ok: false` と理由を返す（各操作について 1 ケース以上）
2. `addChild` の自動 id が文書内で一意（同じ型を 3 回足して確認）
3. `vocabulary.ts` が、スキーマのすべての部品の型について、スキーマに書かれたすべてのプロパティを返す
   （型の一覧は `model.ts` の `WidgetType` と照合する。スキーマにプロパティを 1 つ足したら自動で出てくることを、
   テスト内でスキーマのコピーを加工して確認する）
4. `history.ts`: Undo / Redo / 新しい編集で Redo が消える / 上限 100 / 同じテキストを続けて積まない
5. `pollForChange` が失敗時に `onError` を 1 回だけ呼び、成功に戻ったら再び通知できる状態になる
6. **選択用の要素が HTML 一致テストに混ざらない**（F1 の基準 5 が変更なしで通る）
7. `src/core/` に React / Tauri の import が無い、Tauri の import は `host/tauri-*.ts` だけ（既存のテストが通る）

コマンド:

8. `npm run typecheck` / `lint` / `test` / `build`、`cargo check`（`src-tauri`）、
   `cargo check --target aarch64-linux-android` が通る
9. `mdbook build docs/book` と `node scripts/check-book-links.mjs` が通る

所有者の目視（実装者は手順だけ書く）:

10. Windows で Dock.ui を開き、プレビュー上でボタンをクリックすると選択枠が出て、Hierarchy と Details が追従する
11. Details でラベルを変えると、プレビューが変わり、VS Code で開いた Dock.ui にも反映されている（正規化された形で）
12. Hierarchy で部品を足す・消す・並べ替える、を行い、Ctrl+Z で順に元に戻る
13. VS Code で Dock.ui を書き換えて保存すると反映され、Ctrl+Z でその外部の変更を取り消せる
14. Chrome でも 10〜12 ができる（初回に書き込みの許可を求められる）。Firefox では読み取り専用になり、理由が出る

## 範囲外

- キャンバス上のドラッグ配置（F3）
- 複数選択、コピー＆ペースト
- 新しいファイルの作成（既存の `.ui` を開いて編集するところまで）
- 語彙の追加（I-0 が並行して行う。この作業では `Canvas.layer` / `Panel.textSize` を足さない）

## 実装記録

（実装者が記入する: やったこと / 理由と退けた案 / 触ったファイル / 所有者が確かめる手順）
