# F2: エディタ（選択・Hierarchy・Details・書き戻し・Undo）

- 状態: 実装完了(受け入れ基準1-9は自動テスト・コマンドで確認済み。基準10-14(所有者の目視)は未実施。
  Androidの`content://`への書き込みとWebのrequestPermission経路は実機/実ブラウザ未確認)
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

### F2-1: edit.ts と vocabulary.ts

**やったこと**: `src/core/edit.ts`(`setProp`/`setSlot`/`renameWidget`/`addChild`/
`removeWidget`/`moveWidget`の6つの純粋関数)と`src/core/vocabulary.ts`
(`fieldsFor`/`slotFields`、`schema/ui.schema.json`から導く)を追加した。
`model.ts`に`ALL_WIDGET_TYPES`を足した(vocabulary.test.tsが型の一覧を照合する
ため)。

**理由・退けた案**:
- `edit.ts`の各操作は、最初に文書全体を深く複製し、その複製だけを書き換える
  実装にした。「元の文書に触れない」ことが構造的に自明になる(複製元への参照を
  一切保持しない)。退けた案: 変更対象のノードへの経路だけを複製する(いわゆる
  structural sharing)方法も考えたが、Dock.ui程度の小さな文書では全体複製の
  コストは無視できる一方、経路だけの複製は実装も検証も複雑になる。小さな文書
  前提というこのツールの性質上、単純さを優先した。
- 不正な操作の判定は、`validate()`を呼ぶ汎用的なチェックに頼らず、各関数が
  個別に明示的なチェック(非コンテナへの追加、Panelの2個目の子、rootの削除、
  既存idへの改名、不正なid書式)を行う形にした。退けた案: 複製後に`validate()`
  を1回通して失敗ならreasonを組み立てる、という共通化も考えたが、
  `validate()`のエラーメッセージは「どの操作が悪いか」ではなく「結果の文書の
  どこが悪いか」を説明する文面なので、ユーザー向けのreasonとしては素直な
  日本語にならない。個別に書いたほうがUIへそのまま出せる理由になる。
- `renameWidget`はid の書式(snake_case)をこのファイル自身で正規表現チェックする
  (schemaのwidget.idパターンと同じもの)。設計に「不正なら理由を出して元に戻す」
  と明記されているため、validateに頼らず明示的に拒否する。
- `addChild`の自動id生成(`<typeのsnake_case>_<連番>`)は、「大文字の連続の末尾に
  小文字が続く箇所」を単語境界とみなす正規表現で実装した(`HBox`→`h_box`、
  `VBox`→`v_box`、`Canvas`→`canvas`)。タスクシートは snake_case の具体的な
  変換規則を指定していないため、曖昧さの解消として採った判断。
- `vocabulary.ts`はJSON Schemaの`$ref`/`oneOf`を素朴に解決する専用のミニ実装を
  持つ(外部ライブラリを増やさない。ADR-0001の「依存を増やさない」方針に従った)。
  bind可否は、値のノードが`oneOf`で`{"$ref":"#/$defs/bind"}`を含むか
  (= `XxxOrBind`の形)で機械的に判定しているので、将来のプロパティ追加(I-0の
  `Canvas.layer`/`Panel.textSize`含む)がこの命名規則に従えば、このファイルを
  変えずに正しく判定される。

**触ったファイル**: `src/core/{edit,edit.test,vocabulary,vocabulary.test}.ts`、
`src/core/model.ts`

**確認手順**: `npm test`(受け入れ基準1・2・3をこの時点で確認済み)。

### F2-2: history.ts

**やったこと**: `src/preview/history.ts`(`initHistory`/`pushHistory`/`undo`/
`redo`/`canUndo`/`canRedo`/`currentText`)を追加した。

**理由・退けた案**:
- 文書オブジェクトではなく正規化済み**テキスト**のスタックとして持つ(設計の
  指定どおり)。クラスではなく、F1/P1の既存コード(`format.ts`/`validate.ts`等)
  と同じ「値の型+純粋関数」の形にした(このリポジトリに既存のクラスが無く、
  読み手が新しいパラダイムを覚える必要が無いようにするため)。
- `undo`/`redo`は、動けない端で例外を投げず「同じstateを返す」形にした
  (`edit.ts`の`moveWidget`が端で「何もしない」のと同じ考え方で、呼び出し側の
  分岐を減らす)。

**触ったファイル**: `src/preview/{history,history.test}.ts`

**確認手順**: `npm test`(受け入れ基準4を確認済み)。

### F2-3: OpenedFile.write / supportsWrite、各ホスト、Rust、ポーリングのエラー処理

**やったこと**: `FileHost.ts`に`write`/`supportsWrite`を追加し、4ホストすべてに
実装した。Rustに`write_ui_file`(Windows)、`capabilities/default.json`に
`fs:write-files`(Android)、Web(FSA)には`requestPermission`+`createWritable`、
Web(`<input>`)は`supportsWrite:false`のまま。`poll.ts`の`pollForChange`に
`onError`を追加し、`getSnapshot()`の失敗を成功するまで1回だけ通知する形にした。

**理由・退けた案**:
- Androidの`write_ui_file`相当は、読み込みと対称に`plugin-fs`の
  `writeTextFile()`を直接呼ぶ形にした(Rust側に新しいコマンドを増やさない。
  読み込みと同じ判断)。**`content://` URIへの書き込みが`plugin-fs`で実際に
  できるかは未確認。** Android SDK/NDKがこの端末に無く、
  `cargo check --target aarch64-linux-android`が通ることと型が合っていることまで
  しか確認できていない。実機での確認が必要(受け入れ基準14のAndroid部分、
  またはD1でのAPK配布後)。
- Webの`requestPermission({mode:"readwrite"})`は、ファイルを開いた直後
  (`pick()`)ではなく**実際に書き込む最初の1回**(`write()`の中)に遅延させた。
  `showOpenFilePicker`は既定で読み取り権限しか渡さず、書き込みには別途
  昇格が要る。ファイルを開いただけでブラウザの確認ダイアログを出すと、
  見るだけの利用者にも許可を求めてしまうことになり、「編集するときに初めて
  聞く」方が自然だと判断した。`requestPermission`はTypeScript標準の
  lib.dom.d.tsに無い実験的APIなので`file-system-access.d.ts`にアンビエント
  宣言を追加した(`showOpenFilePicker`と同じ理由)。**実際のブラウザでの
  許可ダイアログの表示と書き込みそのものは未確認**(ヘッドレスブラウザの
  道具が無く、型・ロジックの検査までに留めた)。
- `poll.ts`の`onError`は、P1の実装記録(`platforms.md`「既知の弱点」)が
  指摘していた「ハンドルされないPromiseの拒否が1秒ごとに繰り返される」問題を
  直す形にした。`host/tauri-android.ts`/`host/web.ts`の`watch()`は、`onError`に
  **`handler`自身をそのまま渡す**。新しいエラー表示経路を作らず、「読み込みに
  失敗したら`reload()`が気づいて既存の赤い帯を出す」という既存の仕組みに
  素直に乗せられるため(退けた案: `OpenedFile.watch`のシグネチャに
  `onError`を増やしてPreviewApp側まで伝える案も考えたが、`FileHost`/
  `OpenedFile`の型を全実装で変える必要があり、「読み込みが失敗すればいつでも
  同じ帯が出る」という今の単純な仕組みで十分説明がつくため見送った)。

**触ったファイル**: `src/preview/host/{FileHost,poll,poll.test,tauri-desktop,
tauri-android,web,file-system-access.d}.ts`、`src-tauri/src/{lib.rs,watch.rs}`、
`src-tauri/capabilities/default.json`

**確認手順**: `npm test`(受け入れ基準5を確認済み)、`cargo check`・
`cargo check --target aarch64-linux-android`(両方通ることを確認済み)。

### F2-4: 画面(モード切り替え・選択・Hierarchy・Details・ツールバー・書き戻しの配線)

**やったこと**: `src/preview/editor/`に`useUiDocument.ts`(状態と手続きを
まとめたhook)、`Toolbar.tsx`・`Hierarchy.tsx`・`Details.tsx`・
`DetailsField.tsx`・`SelectionOverlay.tsx`・`CommitOnBlurInput.tsx`を追加し、
`PreviewApp.tsx`を書き換えてこれらを配線した。`ValuePanel.tsx`は幅/外枠の
指定を親に譲る小さな調整のみ行った(F1のロジック自体は変えていない)。

**理由・退けた案**:
- **選択枠とrender.tsxの分離**: `SelectionOverlay.tsx`は`renderDocument()`の
  結果の**隣**(同じ親の中のきょうだい要素)に重ねるだけで、`render.tsx`/
  `generate.ts`のどちらにも触れていない。これにより受け入れ基準6(HTML一致
  テストが無改造で通る)は構造的に保証される(実際に`render.test.tsx`は
  1行も変更せず、全テストが通ることを確認済み)。
  選択枠の再計算は、Reactの状態(文書・値パネル・テーマ)の変化を1つずつ
  `useEffect`の依存に挙げる代わりに、`ResizeObserver`+`MutationObserver`+
  `resize`イベントでDOM自体を直接観察する形にした。退けた案: 依存配列で
  追う方法も考えたが、「レイアウトに影響しうる状態」を網羅的に挙げ続けるのは
  将来の変更(例えば新しいプロパティの追加)のたびに見落としの余地が残り、
  DOMを直接見るほうが取りこぼしが無い。
- **編集モード/操作モードの実装**: `PreviewApp.tsx`の`onClickCapture`を
  capture段階で止める実装にした。ボタン自身の`onClick`はbubble段階で
  発火するため、capture段階で`stopPropagation()`すればボタンのハンドラへ
  到達する前に止められる。退けた案: `render.tsx`側にモードを渡して
  `onClick`自体を無効化する案も考えたが、これは「render.tsxの出力(=生成物と
  一致するHTML)に選択用の要素を混ぜない」という設計の精神(受け入れ基準6)に
  反する(render.tsxがモードという編集専用の概念を知ることになる)。
- **文字入力のCommitOnBlurInput**: Detailsの文字入力系の項目(id改名・
  string値・bind名・event名)は、1打鍵ごとにではなく、blur/Enterで初めて
  書き戻す。設計は特にこれを指定していないが、1打鍵ごとに書き戻すと入力途中の
  不完全な値(例: `onToggleLayer`を打ち終える前の`onT`)がそのままファイルに
  書かれ、監視がそれを読み直して検証エラーとなり、設計5「不正なファイルの
  ときは編集を無効にする」のルールでDetails自体(今まさに打っている入力欄)が
  ロックされてしまう。これは明確に悪い体験になるため、ambiguity解消として
  blur/Enterまで確定を遅らせる設計にした。選択肢(セレクト)・チェックボックスは
  値が原子的に切り替わるので即時反映のままにしている。
- **event名を空にしたら`undefined`**: `DetailsField.tsx`で、event名の入力を
  空にしたら`{event:""}`ではなくプロパティ自体を外す(`undefined`)ようにした。
  スキーマのevent名パターンは空文字を許さないため、空のまま書くと意図せず
  不正な文書になってしまう。設計には明記されていない細部の判断。
- **addChildの追加先の決め方**: Hierarchyの「+部品」ボタンは、選択中の部品が
  コンテナならその中に、そうでなければ(未選択・コンテナでない部品を選択中)
  rootに追加する。設計は「部品を足す」ボタンの挙動の細部を指定していないため、
  単純な規則を採った(退けた案: 選択中の部品の**親**に足す案も考えたが、
  親を遡るぶん説明も実装も増えるため見送った)。
- **Details/値パネルの配置**: 画面図はDetailsと値パネルを右側の同じ枠に
  縦に並べている(どちらか一方だけを出すのではない)。最初はどちらか一方だけを
  出す実装にしたが、タスクシートの画面図を読み直して気づき、1つのコミット内で
  修正した(Details: 選択時のみ上半分、値パネル: 常に下側)。
- **react-hooks/set-state-in-effect対応**: `eslint-plugin-react-hooks`7系が
  「effect内で直接setStateする」ことをエラーにするルールを持っていたため、
  (1) `CommitOnBlurInput`の「外部からvalueが変わったらdraftを追従させる」と
  (2) `useUiDocument.ts`の「選択していた部品が無くなったら選択を外す」の
  2箇所を、Reactが推奨する「レンダー中に直接比較して同期する」/「毎レンダー
  その場で導く派生値にする」パターンに書き換えた(どちらもuseEffectを使わない
  形)。

**触ったファイル**: `src/preview/editor/`一式(新規)、`src/preview/PreviewApp.tsx`、
`src/preview/ValuePanel.tsx`(幅/外枠の指定のみ)

**自動で確認したもの**: `npm run typecheck`/`lint`/`test`/`build`がすべて通ること
(受け入れ基準6・7を含む。`render.test.tsx`・`architecture.test.ts`は無改造で
通過)。`npm run dev`で起動し200応答を確認。

### F2-5: 記録

この節と、`docs/book/src/preview.md`(編集関連の節を追加)・
`docs/book/src/platforms.md`(write()/supportsWrite・pollForChangeの
onError・capabilityの追記、「既知の弱点」の解消を反映)・
`docs/book/src/glossary.md`(Hierarchy/Details・書き戻し・Undo/Redo履歴の項目)・
`README.md`(編集機能の説明、Androidの書き込み未確認の注記)を更新した。
`mdbook build docs/book`と`node scripts/check-book-links.mjs`で確認済み。

---

## 受け入れ基準の確認状況

1. **edit.tsの各操作**: `src/core/edit.test.ts`で、各操作の成功時に
   `validate()`を通ること・元の文書(`DOCK`)のJSON文字列表現が変わらないこと・
   不正な操作が`ok:false`と理由を返すことを確認済み(各操作1ケース以上)。
2. **addChildの自動id一意性**: 同じ型(`Text`)を3回足して`text_1`/`text_2`/
   `text_3`になることを確認済み。
3. **vocabulary.tsの完全性と追従性**: `src/core/vocabulary.test.ts`で、
   `ALL_WIDGET_TYPES`の全型についてスキーマの全プロパティ名が返ることを確認。
   スキーマのコピーに`extraTestProp`を追加し、再読み込みしたvocabulary.tsが
   自動でそれを返すことも確認済み。
4. **history.ts**: `src/preview/history.test.ts`でUndo/Redo/新しい編集での
   Redo消失/上限100件/連続同一テキストの非積載を確認済み。
5. **pollForChangeのonError**: `src/preview/host/poll.test.ts`で、失敗時に
   1回だけ呼ばれ、成功後は再び通知できる状態に戻ることを確認済み。
6. **選択用要素がHTML一致テストに混ざらない**: `render.test.tsx`を1行も変更
   せず、F1の受け入れ基準5(今回の基準6相当)がそのまま通ることを確認済み。
7. **依存の向き**: `architecture.test.ts`(無改造)がそのまま通ることを確認済み。
8. `npm run typecheck`/`lint`/`test`/`build`、`cargo check`(`src-tauri`)、
   `cargo check --target aarch64-linux-android`: すべて通ることを確認済み。
9. `mdbook build docs/book`・`node scripts/check-book-links.mjs`: 確認済み。

基準10-14(所有者の目視確認)は未実施。以下、所有者が確認する手順。

## 所有者が確認する手順(受け入れ基準10-14)

### Windows(基準10-12)

1. `npm run tauri dev`でアプリを起動し、`examples/Dock.ui`を開く。
2. 編集モード(既定)でプレビュー中のボタン(例: 「レイヤー」)をクリックし、
   選択枠が出ること、Hierarchyの該当行とDetailsがそれに追従することを
   確認する(基準10)。
3. Detailsで「レイヤー」ボタンの`label`を書き換えてEnterまたはフォーカスを
   外す。プレビューの表示が変わり、VS Codeで`examples/Dock.ui`を開くと
   正規化された形で反映されていることを確認する(基準11)。
4. Hierarchyの「+部品」で適当な型を足す、「削除」で消す、「↑」「↓」で
   並べ替える、を行い、`Ctrl+Z`を繰り返して操作前の状態まで順に戻ることを
   確認する(基準12)。

### 外部からの変更とUndo(基準13)

1. 上の状態のまま、VS Codeで`examples/Dock.ui`の`"label"`の値を書き換えて
   保存する。1秒以内にプレビューへ反映されることを確認する(P1と同じ)。
2. `Ctrl+Z`を押し、その外部の変更が取り消されて直前の内容に戻ることを
   確認する(基準13)。

### Web(基準14)

1. `npm run build && npm run preview`(または`npm run dev`)でChrome/Edgeを開き、
   「開く」で`examples/Dock.ui`を選ぶ。
2. Details等で何か編集し、初回に読み書きの許可を求めるダイアログが出ることを
   確認する(基準14前半、F2-3実装記録の「未確認」参照)。基準10-12と同じ操作
   (選択・Hierarchy・Details)がWeb上でも行えることを確認する。
3. Firefoxで同じページを開く。読み取り専用になり、Detailsに理由
   (「このファイルには書き込めません」)が表示されることを確認する(基準14後半)。

### Android(別タスク)

ui-forgeのGitHubリモートができ、D1でAPKが配布された後に、`content://`への
書き込みが実際にできるかを確認する(F2-3実装記録に記載のとおり、この時点では
未確認)。
