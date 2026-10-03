# F1: 形式・生成器・プレビュー（編集なし）

- 状態: 完了(自動テスト・コマンドでの確認は済み。所有者の目視確認(受け入れ基準11-13)も2026-10-03に確認済み)
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

### F1-1: 雛形

**やったこと**: Vite + React 19 + TypeScript + Tailwind v4 + vitest + ESLintの雛形と
`src-tauri/`(Tauri v2)を用意した。設定ファイルはpoint-cloud-viewer
(`C:\rust\point-cloud-viewer`)のものを手本にした。README.md・.gitignore・
.gitattributes(`* text=auto eol=lf`)も追加。

**理由・退けた案**:
- 依存のバージョンはpoint-cloud-viewerに揃えた(「読む言語・道具を増やさない」という
  タスクシート冒頭の方針どおり)。
- **逸脱(要許可リスト外の依存)**: `@types/node`を追加した。point-cloud-viewerは
  `vite.config.ts`1箇所だけがNode APIを使うので`@ts-expect-error`で済ませているが、
  ui-forgeの`src/codegen/cli.ts`はファイル読み書きを行うCLIそのもので、同じ手法だと
  あちこちに`@ts-expect-error`が要ることになり可読性が落ちると判断した。型だけの
  devDependencyで実行時の依存は増えない。
- `tauri.conf.json`の`bundle.active`は`false`にした。F1は配布物(インストーラ)を
  作る段階ではないため。ただしWindows版のビルドではリソース生成(`tauri-build`)に
  `icon.ico`が最低1つ必要だったため、point-cloud-viewerの
  `src-tauri/icons/icon.ico`(Tauriの既定プレースホルダーアイコンで、
  point-cloud-viewer固有のブランドではない)をそのままコピーして使っている。
  ui-forge自身の見た目を持たせるときに差し替える。
- `vite.config.ts`の`test.passWithNoTests`を`true`にした。F1-1の時点ではまだ
  テストファイルが無く、vitestは既定で「テスト0件」を失敗扱いにするため
  (「毎コミットで`npm test`が通る」という要求を満たすための措置。F1-2以降は
  実テストがあるので実質働かない)。

**触ったファイル**: `package.json`, `package-lock.json`, `tsconfig.json`,
`tsconfig.node.json`, `vite.config.ts`, `eslint.config.js`, `index.html`,
`src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/vite-env.d.ts`,
`.gitignore`, `.gitattributes`, `README.md`, `src-tauri/`一式

**確認手順**: `npm install && npm run typecheck && npm run lint && npm test && npm run build`。
`npm run tauri dev`でウィンドウが開く(実装中に実行して確認済み。初回ビルドは
Rust依存のコンパイルで1分弱かかる)。

### F1-2: core(形式・検証・正規化)

**やったこと**: `schema/ui.schema.json`(ajv, JSON Schema draft 2020-12)、
`src/core/model.ts`(型定義)、`validate.ts`(スキーマ検証+意味検証)、
`format.ts`(正規化して書き出す)、`styles.ts`(列挙値→Tailwindクラスの対応表)、
`bindings.ts`(Propsメンバーの収集)。

**理由・退けた案**:
- **スキーマとvalidate.tsの役割分担**: schemaは「1個のWidget単体の形として正しいか」
  (type・propsの形・列挙値・bind/eventの書式)だけを見る。id重複・slotは親が
  Canvasのときだけ・コンテナでない部品へのchildren・Panelの子は1つまで・
  同じbind名の型一致、という複数のWidgetにまたがるチェックは全部
  `validate.ts`の手書きコードに寄せた。
  退けた案: JSON Schemaの`if`/`then`/`not`をネストしてこれらも表現する案も
  検討したが、`"not": {"required": [...]}`のような言い回しはajvの既定エラーが
  "must NOT be valid"のように読みにくく、pathも対象ノードそのものを指すだけで
  「どのキーが問題か」を特定しにくい。意味検証側に書けば、メッセージとpathを
  読みやすい形で自分で選べる。
- ajvの既定exportは2020-12の`if`/`then`を解決できず(実装中にテストで発覚)、
  `"ajv/dist/2020"`(`Ajv2020`)に切り替えた。
- gap/padding/radius等、タスクシートが具体的な値を指定していない列挙値の
  クラスは、point-cloud-viewerの`Dock.tsx`実物の値(`gap-1`, `p-1.5`,
  `rounded-full`, `bottom-4`)に一致するように選んだ(曖昧さの解消。
  生成結果が実物のDockと見た目で一致することを優先した)。
- `slot.anchor`×`slot.margin`の位置クラスは、Tailwindがソースを静的走査する
  ([ADR-0001](./ADR-0001-design.md)参照)ため、計36通り(9アンカー×4マージン)を
  すべてリテラル文字列で`styles.ts`に書き出した(テンプレート文字列で組み立てない)。

**触ったファイル**: `schema/ui.schema.json`,
`src/core/{model,validate,format,styles,bindings}.ts` と対応するテスト

**確認手順**: `npm test`(このコミットの時点で受け入れ基準1・3・6・7を確認)。

### F1-3: 生成器とCLI

**やったこと**: `src/codegen/generate.ts`(`UiDocument`→TSX文字列)、`cli.ts`
(`gen`/`fmt`/`check`の3コマンド)、`examples/Dock.ui`、`examples/generated/Dock.tsx`。

**理由・退けた案**:
- `examples/generated/Dock.tsx`は手で書き写さず、実際に`npm run ui -- gen`を
  実行して得た出力をそのままコミットした(手で書き写すと`generate.ts`の実装と
  ズレる恐れがあるため)。タスクシートのTSXサンプルは一部を1行に詰めた説明用の
  抜粋で、厳密な整形規則までは指定していなかったため、属性は1行にまとめる・
  常に2スペースインデントという素朴な規則に実装側で決めた(曖昧さの解消)。
- bindで変わるクラス(surface/active)は、三項演算子の各枝の文字列の中に
  区切りの空白を埋め込む形にした。
  退けた案/見つけた不具合: 最初は区切りの空白をテンプレートの外に固定で
  置いていたが、これだとsurfaceが`"none"`に解決されたとき
  (`SURFACE_CLASS.none`は空文字)、末尾に無意味な空白だけが残ってしまっていた。
  F1-4で`render.tsx`とのHTML一致テスト(受け入れ基準5)を書いたときにこの
  不一致が発覚し、`fix(F1-3)`のコミットで直した。
- `cli.ts`の`check`は「検証→正規化済みか→生成物が最新か」を順番に見て、
  最初に失敗した段階の理由だけを出す(検証に失敗した壊れた文書に対して
  `format`/`generate`をそのまま呼ぶと、無意味なエラーになりかねないため)。

**触ったファイル**: `src/codegen/{generate,cli}.ts`, `examples/Dock.ui`,
`examples/generated/Dock.tsx`, 関連テスト

**確認手順**:
- `npx tsx src/codegen/cli.ts gen examples/Dock.ui examples/generated/Dock.tsx` →
  終了コード0、`git diff`で変化が無いことを確認(既にコミット済みの生成物と
  一致する)。
- `npm run ui -- check examples/Dock.ui examples/generated/Dock.tsx` → 終了コード0
  (受け入れ基準9。実施確認済み)。
- `examples/Dock.ui`の`"gap": "xs"`を`"gap": "huge"`に変えて同じ`check`を実行 →
  終了コード1、エラーに`/root/children/0/children/0/props/gap`を含むことを確認
  (受け入れ基準10。実施確認済み。確認後に`"xs"`へ戻し、`check`が終了コード0に
  戻ることも確認した)。

### F1-4: プレビュー

**やったこと**: `src/preview/render.tsx`(実行時描画)、`values.ts`(値パネルの
初期値・ファイル再読み込み時の引き継ぎ)、`ValuePanel.tsx`、`EventLog.tsx`、
`PreviewApp.tsx`(画面全体の組み立て)、`tauriBridge.ts`(Tauri呼び出しの集約)、
`src-tauri/src/watch.rs`(`read_ui_file`/`watch_ui_file`の2コマンド)。

**理由・退けた案**:
- `render.tsx`は`generate.ts`の`widgetOwnClasses()`とわざと同じ構造・同じ順番で
  クラスを組み立てた(読み比べられるように、かつ実際に同じ出力になるように)。
  退けた案: 両方が共通のヘルパー関数を呼ぶ形も考えたが、`generate.ts`は
  「ソースコードのテキスト」を作り、`render.tsx`は「実際の値の文字列」を作るという
  根本的に出力モードが違う処理なので、無理に共通化すると抽象がかえって
  読みにくくなると判断した。これはADR-0001「本体に実行時ランタイムが増えない」
  (生成物がui-forgeのどのモジュールもimportしない)という制約とも両立しない。
- ファイル監視(`watch.rs`)はファイルそのものではなく親ディレクトリを対象にした。
  VS Code等の「一時ファイル経由の安全な保存」でも、ファイル名の一致で検知できる
  ようにするため(ファイル自体を監視すると、置き換え保存でinodeごと入れ替わり
  後続の変更を取りこぼすことがある)。
- 「開く」のファイルダイアログはRust側にコマンドを置かず、フロントから
  `@tauri-apps/plugin-dialog`を直接呼んでいる(読み出し・監視だけをRust側に
  置けば十分で、ダイアログ自体を薄くラップするコマンドを足す理由が無いため)。
- プレビューペインに`contain: layout`というCSSを付けた。生成される`Canvas`は
  `fixed inset-0`(ウィンドウ全面を前提にしたクラス。F1-foundation.mdのクラス
  対応表の記述どおり)なので、これが無いと値パネルやイベントログの上まで
  覆ってしまう(CSS Containmentの仕様で、`contain`は`transform`同様に
  `position: fixed`の基準[containing block]を自分自身に閉じ込める効果を持つ)。
- 値パネル・イベントログの背景は不透明(`bg-slate-900`)にした。半透明の
  ガラス面はプレビュー対象(`.ui`文書が表現する部品)の見た目であり、ツール
  自身の密な設定・ログ的なUIは不透明面にする、という使い分けにした。

**触ったファイル**: `src/preview/`一式、`src-tauri/src/{lib.rs,watch.rs}`,
`src/App.tsx`, `src/index.css`

**自動で確認したもの**: `npm test`で受け入れ基準5(生成したDockとrender.tsxの
HTMLがrenderToStaticMarkupで一致すること、surface/layerOpen/infoOpenを
変えた3通りの値の組)を確認済み。`npm run tauri dev`でビルド・起動まで確認済み
(ウィンドウのプロセスが起動し、クラッシュしないことをプロセス一覧で確認。
画面の見た目そのものは目視できないため下記は所有者による確認が必要)。

**所有者が動かして確かめる手順(受け入れ基準11-13)**:
1. `npm run tauri dev`でアプリを起動する。
2. 上部の「開く」ボタンで`examples/Dock.ui`を選ぶ。中央にガラス(半透明・ぼかし)の
   ドックが、背景のドット柄の上に表示されることを確認する(基準11前半)。
3. 右の値パネルで`layerOpen`のチェックボックスを切り替え、「レイヤー」ボタンの
   ハイライト(背景色反転)が変わることを確認する(基準11後半)。
4. VS Code等の外部エディタで`examples/Dock.ui`を開き、`"label": "レイヤー"`を
   別の文字列に書き換えて保存する。1秒以内にプレビューのボタンのラベルが
   変わることを確認する(基準12)。
5. `"gap": "xs"`を`"gap": "huge"`のような不正な値に書き換えて保存する。
   プレビューが消えず直前の表示のまま残り、画面下に赤い帯でエラー(pathと
   message)が出ることを確認する。`"xs"`に戻して保存すると赤い帯が消えることを
   確認する(基準13)。
