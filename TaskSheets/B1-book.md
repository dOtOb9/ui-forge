# B1: 設計読解ガイド（mdBook）

- 状態: 完了
- 前提: [ADR-0001](./ADR-0001-design.md)、[F1](./F1-foundation.md)

## 目的

point-cloud-viewer の `docs/book/` と同じく、**コードを読む前に読む本**を作る。
ADR やタスクシートの書き写しではなく、全体像をつかみ、どのファイルから読めばいいかを示す地図。
「なぜそうなったか」の一次資料は引き続き ADR とタスクシート。

手本: `C:\rust\point-cloud-viewer\docs\book\`（`book.toml`、`src/introduction.md` の書き方、
各章の構成）。**文体・章の構成・リンクの張り方をこれに揃える。**

## 範囲

**このブランチを作った時点の `main`（`86b62a3`）のコード**を対象にする。
プラットフォーム対応（P1）は並行して実装中なので、**ファイルを開く・読む・変更を検知する部分
（`src/preview/host/`、`src-tauri/src/watch.rs`）はこの本では扱わない。**
P1 が合流した後に、別の作業で「プラットフォーム」の章を足す。目次には章の枠だけを置き、
本文は「P1 の合流後に書く」とだけ書いておく。

## 章立て

```
はじめに            この本は何か / 読み方 / 正確さについて / 手元で開く
全体像              ui-forge が解く問題（UMG との対応表）、.ui → 生成 TSX / プレビュー の 2 経路の図
.ui 形式            文書・Widget・値（リテラル / bind / event）・部品表・列挙値。Dock.ui を題材に
src/core            model / validate（スキーマと意味検証の分担）/ format（正規化の規則と理由）/ styles / bindings
src/codegen         generate（Props の作り方、クラスの三項演算子）/ cli（gen / fmt / check）
src/preview         render（実行時の解釈）/ 値パネル / イベントログ / 検証エラー時に最後の正しい表示を残す仕組み
2 つの描画経路を揃える仕組み   HTML 一致テスト、F1 で実際に見つかった surface: none の空白の不具合
規約                依存の向き（core は React/Tauri を知らない）、クラス名はリテラル、語彙を足すときに直す 4 箇所
プラットフォーム    （枠のみ。P1 の合流後に書く）
設計判断の索引      ADR とタスクシートへのリンク
用語集              UMG、bind、event、正規化、ファイルホスト など
```

## 書き方の約束

- **実際のコードを読んで書く。** タスクシートとコードが食い違っていたら、コードの通りに書き、
  食い違いがあることを本文で明記する
- ソースへのリンクは `https://github.com/dOtOb9/ui-forge/blob/main/<パス>` の形にする。
  GitHub のリポジトリはまだ無いが、所有者がこの名前で作る前提。`introduction.md` にその旨を一言書く
- 各章の最後に「**まず読むファイル**」を 1〜3 個挙げる
- 画面で確認されていないことは「未確認」と書く
- 拡張（プリプロセッサ）は使わない。標準の mdBook だけでビルドできること

## 作業とコミット

- ソースは `docs/book/`。`book.toml` は手本に揃える（`title = "ui-forge 設計読解ガイド"`、`language = "ja"`）
- `docs/book/book/`（ビルド出力）は `.gitignore` に足す
- コミットは「骨格 + はじめに + 全体像」「.ui 形式 + core」「codegen + preview + 描画経路」「規約 + 索引 + 用語集 + 記録」のように
  章のまとまりごとに分ける
- `README.md` に本へのリンク（`mdbook serve docs/book`）を一行足す

## 受け入れ基準

1. `mdbook build docs/book` が警告・エラーなしで通る
2. 目次の全章にファイルがあり、空の章は「プラットフォーム」だけ
3. 本文中の **リポジトリ内のファイルへのリンクがすべて実在するパスを指す**
   （`https://github.com/dOtOb9/ui-forge/blob/main/` を外したパスが存在することをスクリプトで確認し、
   その確認方法を実装記録に書く）
4. 本文に出てくる関数名・型名・コマンドが、実際のコードに存在する（grep で確認）
5. 各章の最後に「まず読むファイル」がある

## 実装記録

**やったこと**: `docs/book/` に mdBook を作った（`book.toml`、`src/SUMMARY.md`、
全10章 + はじめに）。手本（`C:\rust\point-cloud-viewer\docs\book\`）の文体・章の
構成・「まず読むファイル」の置き方・GitHub リンクの形をそのまま踏襲している。
内容はタスクシートの書き写しではなく、`src/core`・`src/codegen`・`src/preview`・
`schema/`・`examples/` の実際のコードを読んで書いた。

**判断したこと**:
- **章の分け方**: タスクシートの章立て（はじめに〜用語集）をそのままファイル名に
  した（`introduction.md`・`overview.md`・`ui-format.md`・`core.md`・`codegen.md`・
  `preview.md`・`render-parity.md`・`conventions.md`・`platforms.md`・
  `adr-index.md`・`glossary.md`）。point-cloud-viewer の本は `frontend/`・`rust/` の
  サブフォルダを持つが、ui-forge は対象コードが小さいためフラットに置いた。
- **「まず読むファイル」の有無**: 手本では `introduction.md` と `glossary.md` だけが
  この節を持たない（確認済み）。他の全章は持つ。この本も同じ構成にした
  （`platforms.md` のような空に近い章にも置いている）。
- **スコープの境界**: タスクシートの指示どおり、`src/preview/host/` と
  `src-tauri/src/watch.rs` の実装詳細はどの章でも扱っていない。`preview.md` と
  `platforms.md` では「`FileHost`/`OpenedFile` インターフェース越しに行われる」
  という事実だけ書き、詳細は P1 合流後の別作業に委ねると明記した。
- **コードとタスクシートが食い違っていた箇所**: 見つからなかった。F1-foundation.md
  の記述（スキーマとvalidate.tsの役割分担、正規化規則、クラス対応表、生成物の形）は
  実際のコード（`model.ts`・`validate.ts`・`format.ts`・`styles.ts`・`generate.ts`）と
  一致していた。F1-3で見つかった「`surface: "none"` のときの余分な空白」の不具合
  （タスクシートの実装記録にある、分かれ道の外に空白を固定していたバグ）は
  「2つの描画経路を揃える仕組み」の章で、起きた経緯として明示的に書いた
  （不一致ではなく、タスクシート自身が記録済みの既知の修正履歴）。
- **用語集**: タスクシートが明示した「UMG、bind、event、正規化、ファイルホスト」に
  加えて、本文からリンクする先として `.ui`・JSON Pointer・slot/anchor・surface・ADR
  も足した（「など」の範囲として）。

**受け入れ基準の確認方法**:
1. `mdbook build docs/book` を実行し、警告・エラー無しで終わることを確認した
   （実行済み。出力は `INFO HTML book written to ...` のみ）。
2. `SUMMARY.md` の全11項目（はじめに含む）に対応するファイルが存在する。
   本文が「枠のみ」なのは `platforms.md` だけ（他はすべて実質的な内容を書いた）。
3. **チェックスクリプト** `scripts/check-book-links.mjs`（Node、追加の依存なし。
   Python はこの端末に無いため使わなかった）を書いた。`docs/book/src/*.md` を
   再帰的に読み、`https://github.com/dOtOb9/ui-forge/blob/main/<path>` 形式の
   リンクをすべて抜き出し、`<path>` を外した残りがリポジトリルートに実在するかを
   `fs.existsSync` で確認する。アンカー（`#...`）は無視する（ファイルの実在だけを
   見る。章内の見出しアンカーは別途、mdBook のビルド出力 `docs/book/book/*.html` の
   `id="..."` を手で突き合わせて確認した）。
   実行コマンド: `node scripts/check-book-links.mjs`。結果: 本文中の52件のリンクが
   すべて実在するパスを指すことを確認済み（実行済み。意図的にパスを壊して
   スクリプトが失敗を検出することも確認済み）。
4. 本文に出てくる関数名・型名・コマンド（`collectPropsMembers`・`widgetOwnClasses`・
   `widgetClassName`・`renderDocument`・`reconcileValues`・`formatDocument`・
   `parseDocument`・`CONTAINER_TYPES`・`BINDABLE_PROPS`・`FileHost`・`OpenedFile`・
   `resolveFileHost`・`supportsAutoReload`・`npm run ui -- gen/fmt/check` 等）を
   `grep` で実コードに存在することを確認した（実行済み）。
5. 各章の最後に「まず読むファイル」がある。手本に揃え、`introduction.md` と
   `glossary.md` だけは意図的に置いていない（手本も同様の構成）。

**触ったファイル**:
- `docs/book/book.toml`、`docs/book/src/SUMMARY.md`、`docs/book/src/*.md`（全11ファイル）
- `scripts/check-book-links.mjs`（新規）
- `.gitignore`（`docs/book/book/` を追加）
- `README.md`（本へのリンクを1行追加）
- このファイル（`TaskSheets/B1-book.md`）

**所有者が開いて確かめる手順**:
1. `mdbook serve docs/book` を実行し、`http://localhost:3000` を開く。左の目次から
   全章が開けること、特に「プラットフォーム」の章が枠だけになっていることを確認する。
2. 本文中の「まず読むファイル」や節のリンクを何カ所かクリックし、GitHub の URL の
   形（まだリポジトリが無いのでリンク先は開けないが、パスの綴りが正しいこと）を
   確認する。
3. `node scripts/check-book-links.mjs` を実行し、`OK: ...件のGitHubリンクすべてが
   実在するパスを指しています。` と出ることを確認する。
4. `mdbook build docs/book` を実行し、警告・エラーが出ないことを確認する。
