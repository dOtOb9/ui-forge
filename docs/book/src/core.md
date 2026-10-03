# src/core

`src/core/` は純粋関数と型だけの層です。**React も Tauri も import しません**
（[規約](./conventions.md#依存の向き-src-core-は-reactTauri-を知らない)）。
`src/codegen/`（コード生成）と `src/preview/`（実行時解釈）の両方がここに依存する、
一方向の関係です。

## model.ts: 型定義

[`src/core/model.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/core/model.ts) は値を持たない、型とごく小さな定数表だけのファイルです。
[.ui 形式の章](./ui-format.md)の表はすべてここの型をそのまま書いたものです。

`Canvas` に `props` が無いことは、`CanvasProps` という「キーを持てないオブジェクト型」
(`[key: string]: never`) として表現されています。TypeScript では「空オブジェクト型」を
素直に書くと余計なプロパティも通ってしまうため、この書き方で「キーが1つもない」ことを
型チェッカに伝えています。

`CONTAINER_TYPES`（コンテナになれる部品の一覧）と `BINDABLE_PROPS`（部品ごとに
どのプロパティが bind 可能か）は、このファイルの定数としてここにだけ置かれています。
`validate.ts` と `generate.ts` / `render.tsx` の両方が、同じ判定をするためにここを参照します
（別々に同じ一覧を持つと、語彙を増やしたときに食い違う恐れがあるためです）。

## validate.ts: スキーマ検証 + 意味検証

[`src/core/validate.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/core/validate.ts) は検証の役割を2つに分けています（この分担は
`schema/ui.schema.json` の `$comment` にも明記されています）。

| 担当 | 見るもの |
|---|---|
| `schema/ui.schema.json`（ajv） | 1個の `Widget` 単体として形が正しいか。type・props の形・列挙値・bind/event の書式 |
| `validate.ts`（手書き） | 複数の `Widget` にまたがる関係。id の重複・slot は親が `Canvas` のときだけ・コンテナでない部品への children・`Panel` の子は1つまで・同じ bind 名の型一致 |

ajv の既定エクスポートは JSON Schema draft 2020-12 の `if`/`then` を解決できないため、
`"ajv/dist/2020"`（`Ajv2020`）から読み込んでいます。

検証は**例外を投げず**、見つかった問題を `{ path, message }[]` で返します。`path` は
JSON Pointer 形式（`/root/children/0/props/gap`）です。壊れた文書に対しても、
意味検証は optional chaining で欠けたフィールドを素通りさせ、できる範囲まで続けます
（スキーマ検証が1箇所失敗しても、他の意味エラーも一度に出せるようにするため）。

## format.ts: 正規化の規則と理由

[`src/core/format.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/core/format.ts) は、同じ内容の文書が**常に同じテキスト**になることを保証します。
ADR-0001 はこれを「生命線」と呼んでいます。エディタで保存するたびにキー順や書式が
変わると、Git の差分が読めなくなるためです。

- インデント2スペース、末尾改行1つ、LF
- 文書のキー順: `$schema`, `version`, `component`, `root`
- Widget のキー順: `id`, `type`, `slot`, `props`, `children`
- `props` / `slot` の中のキーはアルファベット順
- 空の `props` / `children` は書き出さない

入力側（`parseDocument`）は `JSON.parse` をするだけで、キー順には一切依存しません。
出力側（`formatDocument`）が毎回このファイル1箇所の規則どおりに組み立て直します。

## styles.ts: 列挙値 → Tailwind クラスの対応表

[`src/core/styles.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/core/styles.ts) は、見た目を調整したくなったら触る場所をここ1箇所にする、という
ADR-0001「語彙を限定する」の実体です。すべてのクラス文字列は**リテラルのまま**
書かれています。テンプレート文字列で `` `p-${n}` `` のように組み立てると、Tailwind v4
がソースを静的に走査してクラスを検出できなくなるためです（受け入れ基準6で、
`${` を含むクラス文字列が無いことをテストしています）。

`surface` / `button` 系の値は point-cloud-viewer の `src/ui/shell/glass.ts` と
`Dock.tsx` から取った文字列そのままです。`gap` / `padding` / `radius` のような、
タスクシートが具体的な値を決めていなかったものは、point-cloud-viewer の `Dock.tsx`
実物の値（`gap-1`、`p-1.5`、`rounded-full` など）に合わせて実装時に選ばれています。

`slot.anchor` × `slot.margin` の位置クラスは、9アンカー×4マージンの**全36通り**が
すべてリテラルで書き出されています（同じ理由で、テンプレート文字列による組み立てを
避けるため）。

## bindings.ts: Props の一覧を作る

[`src/core/bindings.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/core/bindings.ts) の `collectPropsMembers()` は、文書の木をたどって
bind / event を集め、「この文書が要求する値とイベントの一覧」を1本のリストで返します。
名前のアルファベット順（bind と event を区別せず1本に混ぜる）です。

この一覧は2箇所から同じ形で必要とされています。

- `src/codegen/generate.ts` — `Props` インターフェースを作るため
- `src/preview/` — 値パネル（どの bind を表示するか）とイベントログ（どの event を
  拾うか）を作るため

同じ一覧を作る処理が1箇所にまとまっているので、両者がずれることはありません。

## まず読むファイル

- [`src/core/model.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/core/model.ts) — 型と定数表。他のすべてのファイルがここを参照する
- [`src/core/validate.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/core/validate.ts) — スキーマ検証との役割分担がわかる
- [`src/core/styles.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/core/styles.ts) — 見た目を変えるときに触る唯一の場所
