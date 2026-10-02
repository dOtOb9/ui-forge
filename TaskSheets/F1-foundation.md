# F1: 形式・生成器・プレビュー（編集なし）

- 状態: 未着手
- 前提: [ADR-0001](./ADR-0001-design.md)

## このマイルストーンの目的

**「AI か人間が `.ui` を書く → プレビューで見て確かめる → TSX を生成する」という
ループを、編集機能なしで成立させる。** エディタでの編集（Hierarchy / Details / ドラッグ）は
F2 以降。

題材は point-cloud-viewer の `src/ui/shell/Dock.tsx`（下中央のフローティングドック）。
F1 の完了時点で、これと同等のものを `examples/Dock.ui` から生成できる状態にする。
**point-cloud-viewer 本体はこのマイルストーンでは触らない。**

## 技術スタック

point-cloud-viewer と揃える。読む言語・道具を増やさないため。

- Tauri v2 / React 19 / TypeScript / Vite / Tailwind v4 / vitest / ESLint
- 設定ファイル（`vite.config.ts`、`tsconfig*.json`、`eslint.config.js`、`src-tauri/` の雛形）は
  point-cloud-viewer のものを手本にしてよい
- 追加してよい依存: `ajv`（JSON Schema 検証）、`tsx`（CLI 実行）、Rust 側の `notify`（ファイル監視）。
  これ以外を足す場合はタスクシートに理由を書く

## ディレクトリ構成

```
ui-forge/
  schema/ui.schema.json      JSON Schema（.ui の構造）
  src/core/                  純粋関数のみ。React も Tauri も import しない
    model.ts                 型定義（UiDocument, Widget, Binding ...）
    validate.ts              スキーマ検証 + 意味検証
    format.ts                正規化して書き出す
    styles.ts                列挙値 → Tailwind クラスの対応表（唯一の置き場）
    bindings.ts              文書から bind / event を集めて Props の一覧を作る
  src/codegen/
    generate.ts              UiDocument → TSX 文字列
    cli.ts                   CLI（gen / check / fmt）
  src/preview/               プレビューアプリ（React）
    render.tsx               UiDocument を実行時に解釈して描画する
    ...
  src-tauri/                 ファイル監視だけを持つ薄い Rust 側
  examples/Dock.ui
  examples/generated/Dock.tsx  examples/Dock.ui からの生成物（コミットする）
  TaskSheets/
```

`src/core/` → `src/codegen/` と `src/preview/` の向きにだけ依存する。逆向きは禁止。

---

## `.ui` 形式（v1）

### 文書

```json
{
  "$schema": "../schema/ui.schema.json",
  "version": 1,
  "component": "Dock",
  "root": { ...Widget... }
}
```

- `component`: 生成されるコンポーネント名。PascalCase
- `version`: 常に `1`

### Widget（すべての部品に共通）

| キー | 必須 | 内容 |
|---|---|---|
| `id` | 必須 | snake_case。文書内で一意 |
| `type` | 必須 | 下の部品表のいずれか |
| `props` | 任意 | 部品ごとのプロパティ |
| `slot` | 任意 | **親が `Canvas` のときだけ**書ける。`{"anchor": ..., "margin": ...}` |
| `children` | 任意 | **コンテナ部品だけ**持てる |

### 値の書き方

プロパティの値は、リテラルか bind のどちらか。

```json
"active": true                      リテラル
"active": { "bind": "layerOpen" }   Props から受け取る値
"onClick": { "event": "onToggleLayer" }   イベント（Props の関数になる）
```

- bind / event の名前は camelCase
- event の名前は `on` で始める
- **同じ bind 名を、型の違うプロパティで使ったら検証エラー**（例: 一方で boolean、他方で文字列）

### 部品表（v1 の語彙はこれだけ）

| type | コンテナ | props |
|---|---|---|
| `Canvas` | ○ | なし。子は `slot.anchor` で配置される |
| `HBox` | ○ | `gap`, `padding`, `align` |
| `VBox` | ○ | `gap`, `padding`, `align` |
| `Panel` | ○（子は 1 つまで） | `surface`, `radius`, `padding`, `shadow` |
| `Text` | × | `text`（string、bind 可）, `size` |
| `Button` | × | `label`（string、bind 可）, `active`（boolean、bind 可）, `onClick`（event） |

列挙値:

| プロパティ | 値 |
|---|---|
| `gap` / `padding` | `none` `xs` `sm` `md` `lg` |
| `align` | `start` `center` `end` `stretch` |
| `surface` | `glass` `opaque` `none`（bind 可。bind した場合の型は `"glass" \| "opaque" \| "none"`） |
| `radius` | `none` `md` `lg` `full` |
| `shadow` | boolean |
| `size` | `sm` `md` `lg` |
| `slot.anchor` | `top-left` `top-center` `top-right` `center-left` `center` `center-right` `bottom-left` `bottom-center` `bottom-right` |
| `slot.margin` | `none` `sm` `md` `lg` |

### クラスの対応表（`src/core/styles.ts`）

見た目は point-cloud-viewer に合わせる。少なくとも次は**この文字列のまま**使う
（point-cloud-viewer の `src/ui/shell/glass.ts` と `Dock.tsx` から取ったもの）。

```ts
surface.glass  = "backdrop-blur-md bg-white/65 text-slate-900 border border-black/10 dark:bg-slate-950/70 dark:text-slate-100 dark:border-white/10"
surface.opaque = "bg-white text-slate-900 border border-black/10 dark:bg-slate-950 dark:text-slate-100 dark:border-white/10"
button.active   = "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
button.inactive = "hover:bg-black/5 dark:hover:bg-white/10"
button.base     = "rounded-full px-3 py-1.5"
```

`Canvas` は `pointer-events-none fixed inset-0`、その子は `pointer-events-auto absolute` ＋
アンカーに応じた位置クラス（例: `bottom-center` → `bottom-4 left-1/2 -translate-x-1/2`、
4 の部分は `margin` で変わる）。

**クラス名は必ずリテラル文字列で表に書く。** テンプレート文字列で `` `p-${n}` `` のように
組み立ててはいけない（Tailwind が検出できない）。

### 正規化の規則（`format.ts`）

- インデント 2 スペース、末尾改行 1 つ、LF
- 文書のキー順: `$schema`, `version`, `component`, `root`
- Widget のキー順: `id`, `type`, `slot`, `props`, `children`
- `props` / `slot` の中のキーは**アルファベット順**
- 空の `props` / `children` は書き出さない

### 題材: `examples/Dock.ui`

この内容で作る（正規化済みの形）。

```json
{
  "$schema": "../schema/ui.schema.json",
  "version": 1,
  "component": "Dock",
  "root": {
    "id": "root",
    "type": "Canvas",
    "children": [
      {
        "id": "dock",
        "type": "Panel",
        "slot": {
          "anchor": "bottom-center",
          "margin": "md"
        },
        "props": {
          "padding": "xs",
          "radius": "full",
          "shadow": true,
          "surface": { "bind": "surface" }
        },
        "children": [
          {
            "id": "dock_buttons",
            "type": "HBox",
            "props": { "gap": "xs" },
            "children": [
              { "id": "layer_button", "type": "Button", "props": { "active": { "bind": "layerOpen" }, "label": "レイヤー", "onClick": { "event": "onToggleLayer" } } },
              { "id": "info_button", "type": "Button", "props": { "active": { "bind": "infoOpen" }, "label": "情報", "onClick": { "event": "onToggleInfo" } } },
              { "id": "settings_button", "type": "Button", "props": { "label": "設定", "onClick": { "event": "onOpenSettings" } } }
            ]
          }
        ]
      }
    ]
  }
}
```

（上はタスクシート上で読みやすくするため一部を 1 行に詰めている。実際のファイルは
`fmt` を通した正規化済みの形でコミットする。）

### 生成物の形（`generate.ts`）

```tsx
// 生成物: examples/Dock.ui から ui-forge が生成。手で編集しないこと。
// 変更は Dock.ui に対して行い、`npm run ui -- gen` で作り直す。

export interface DockProps {
  infoOpen: boolean;
  layerOpen: boolean;
  onOpenSettings: () => void;
  onToggleInfo: () => void;
  onToggleLayer: () => void;
  surface: "glass" | "opaque" | "none";
}

export function Dock(props: DockProps) {
  return (
    <div data-ui-id="root" className="pointer-events-none fixed inset-0">
      ...
    </div>
  );
}
```

- `Props` のメンバーはアルファベット順
- すべての要素に `data-ui-id` を付ける（F2 でプレビュー上の選択に使う）
- bind した `surface` / `active` のように値でクラスが変わる箇所は、対応表のリテラルを
  三項演算子で選ぶ形にする（例: `props.layerOpen ? "...active..." : "...inactive..."`）
- 生成物は Prettier 相当に整形しなくてよいが、**人間が読めるインデント**にすること
- `Button` は `<button type="button">`

---

## 作業の分け方とコミット

1 項目 = 1 コミット（以上）。各コミットで `npm run typecheck` / `lint` / `test` が通ること。

### F1-1: 雛形
- Vite + React + TS + Tailwind + vitest + ESLint の雛形と `src-tauri/`。
  `npm run tauri dev` で空のウィンドウが開くところまで
- `README.md`（ツールの一文説明と、ADR / タスクシートへのリンク）、`.gitignore`

### F1-2: core（形式・検証・正規化）
- `schema/ui.schema.json`、`src/core/model.ts`、`validate.ts`、`format.ts`、`styles.ts`、`bindings.ts`
- `validate` はエラーを `{ path: string, message: string }[]` で返す（例外を投げない）。
  `path` は JSON Pointer 形式（`/root/children/0/props/gap`）

### F1-3: 生成器と CLI
- `generate.ts`、`cli.ts`、`package.json` に `"ui": "tsx src/codegen/cli.ts"`
- `npm run ui -- gen <in.ui> <out.tsx>`: 検証してから生成。エラーがあれば一覧を出して終了コード 1
- `npm run ui -- fmt <in.ui>`: 正規化して上書き
- `npm run ui -- check <in.ui> <out.tsx>`: 検証・正規化済みか・生成物が最新か、の 3 点を確認。
  どれかが崩れていれば理由を出して終了コード 1
- `examples/Dock.ui` と `examples/generated/Dock.tsx` をコミット

### F1-4: プレビュー
- `src/preview/render.tsx`: `UiDocument` と値の組（bind 名 → 値、event 名 → 関数）から React 要素を作る
- アプリの画面構成:
  - 中央: プレビュー領域。**背景はガラスが確認できる柄**（暗いグラデーション＋細かい点の模様など）。
    ライト / ダーク切り替えボタン
  - 右: **値パネル**。文書中の bind を一覧し、型に応じた入力（boolean → チェックボックス、
    列挙 → セレクト、string → テキスト）で値を変えられる。初期値は boolean=false、
    列挙=最初の値、string=bind 名
  - 下: **イベントログ**。ボタンを押すと `onToggleLayer` のように発火したイベント名が時刻付きで並ぶ
  - 上: 「開く」ボタン（ファイルダイアログ）と、開いているファイルのパス
- **ファイル監視**: Rust 側で `notify` を使い、開いているファイルが変わったら
  イベントを送ってフロントが読み直す。外部エディタ（VS Code や AI）での保存が 1 秒以内に反映されること
- **検証エラー時**: プレビューを消さず、**最後に正しく読めた状態を表示し続ける**。
  エラー一覧（path と message）を赤い帯で重ねて出す

---

## 受け入れ基準

自動テスト（vitest）で確認するもの:

1. **正規化の冪等性**: `format(parse(format(doc)))` が `format(doc)` と一致する
2. **キー順に依存しない**: キー順をばらばらにした Dock.ui を正規化すると、`examples/Dock.ui` と
   バイト単位で一致する
3. **検証が拒否するもの**（各 1 ケース以上、path が正しいことも確認）:
   id の重複 / 未知の type / 未知の列挙値 / 非コンテナに children /
   `Panel` の子が 2 つ以上 / 親が Canvas でないのに slot / 同じ bind 名の型の不一致 /
   `on` で始まらない event 名
4. **生成物の一致**: `examples/Dock.ui` から生成した文字列が `examples/generated/Dock.tsx` と一致する
5. **プレビューと生成物の HTML 一致**: 少なくとも 3 通りの値の組について、
   生成した `Dock` と `render.tsx` の描画を `renderToStaticMarkup` した結果が一致する
6. **クラス名がリテラル**: `src/core/styles.ts` と生成物に、`${` を含むクラス文字列が無い
   （テストで文字列検査してよい）
7. **依存の向き**: `src/core/` 以下に `react` / `@tauri-apps` の import が無い（テストで検査してよい）

コマンドで確認するもの:

8. `npm run typecheck` / `npm run lint` / `npm test` / `npm run build` がすべて通る
9. `npm run ui -- check examples/Dock.ui examples/generated/Dock.tsx` が終了コード 0
10. `examples/Dock.ui` の `"gap": "xs"` を `"gap": "huge"` に変えると `check` が終了コード 1 で、
    エラーに `/root/children/0/children/0/props/gap` が含まれる（確認後に元へ戻す）

所有者の目視で確認するもの（実装者は手順だけ書けばよい）:

11. プレビューに Dock がガラスの見た目で表示され、値パネルで `layerOpen` を切り替えると
    レイヤーボタンのハイライトが変わる
12. VS Code で Dock.ui のラベルを書き換えて保存すると、プレビューに 1 秒以内に反映される
13. 不正な値で保存すると赤い帯が出て、直して保存すると消える

## 範囲外（F2 以降）

- プレビュー上での選択・Hierarchy / Details パネル・プロパティ編集と書き戻し
- ドラッグ配置・Undo
- AI 用のスクリーンショット出力
- point-cloud-viewer への組み込み（生成物を本体にコピーして `Dock.tsx` を置き換える作業）

## 実装記録

（実装者が記入する。各項目について: やったこと / その方法を選んだ理由と退けた案 /
触ったファイル / 所有者が動かして確かめる手順）
