# .ui 形式

`.ui` ファイルの中身は普通の JSON です。パーサの依存を増やさないための選択です
（[ADR-0001](https://github.com/dOtOb9/ui-forge/blob/main/TaskSheets/ADR-0001-design.md)「形式は JSON + JSON Schema」）。この章は
[`schema/ui.schema.json`](https://github.com/dOtOb9/ui-forge/blob/main/schema/ui.schema.json) と
[`src/core/model.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/core/model.ts) の型を、
題材の [`examples/Dock.ui`](https://github.com/dOtOb9/ui-forge/blob/main/examples/Dock.ui) で
確かめながら読みます。

## 文書

```json
{
  "$schema": "../schema/ui.schema.json",
  "version": 1,
  "component": "Dock",
  "root": { ...Widget... }
}
```

`component` が生成されるコンポーネント名（PascalCase）、`root` が部品の木のてっぺんです。
`version` は今のところ常に `1` です。

## Widget（すべての部品に共通のキー）

| キー | 必須 | 内容 |
|---|---|---|
| `id` | 必須 | snake_case。文書内で一意 |
| `type` | 必須 | 下の部品表のいずれか |
| `props` | 任意 | 部品ごとのプロパティ |
| `slot` | 任意 | **親が `Canvas` のときだけ**書ける。`{"anchor": ..., "margin": ...}` |
| `children` | 任意 | **コンテナ部品だけ**持てる |

これらのうち、1個の `Widget` 単体として形が正しいかは `schema/ui.schema.json` が見ます。
`id` の重複や「親が `Canvas` かどうか」のような、**複数の部品にまたがる**チェックは
スキーマではなく `src/core/validate.ts` の意味検証が担当します。この役割分担は
[src/core の章](./core.md#validatets-スキーマ検証--意味検証)で詳しく扱います。

## 値の書き方

プロパティの値は、リテラルか bind のどちらかです（型は
[`model.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/core/model.ts) の `BoolValue` / `StringValue` / `SurfaceValue`）。

```json
"active": true                      リテラル
"active": { "bind": "layerOpen" }    Props から受け取る値
"onClick": { "event": "onToggleLayer" }   イベント（Props の関数になる）
```

- bind / event の名前は camelCase
- event の名前は `on` で始める
- 同じ bind 名を型の違うプロパティで使うと検証エラーになります（例: 一方で
  boolean、他方で文字列）

どの部品のどのプロパティが bind 可能かは、`model.ts` の `BINDABLE_PROPS` という
1個の定数表にまとまっています。

```ts
export const BINDABLE_PROPS = {
  Panel: { surface: "surface" },
  Text: { text: "string" },
  Button: { label: "string", active: "boolean" },
};
```

bind 不可のプロパティ（`gap` / `padding` / `align` / `radius` / `shadow` / `size`）は
そもそもスキーマがリテラルの列挙値しか許さないので、この表には出てきません。

## 部品表（v1 の語彙はこれだけ）

| type | コンテナ | props |
|---|---|---|
| `Canvas` | ○ | なし。子は `slot.anchor` で配置される |
| `HBox` | ○ | `gap`, `padding`, `align` |
| `VBox` | ○ | `gap`, `padding`, `align` |
| `Panel` | ○（子は1つまで） | `surface`, `radius`, `padding`, `shadow` |
| `Text` | × | `text`（bind 可）, `size` |
| `Button` | × | `label`（bind 可）, `active`（bind 可）, `onClick`（event） |

コンテナかどうかの一覧は `model.ts` の `CONTAINER_TYPES` 配列（`Canvas` / `HBox` /
`VBox` / `Panel`）1箇所だけに置かれています。`validate.ts` の「コンテナでない
部品に children を持たせない」チェックと、生成器・プレビューの両方がここを見ます。

## 列挙値

| プロパティ | 値 |
|---|---|
| `gap` / `padding` | `none` `xs` `sm` `md` `lg` |
| `align` | `start` `center` `end` `stretch` |
| `surface` | `glass` `opaque` `none`（bind 可） |
| `radius` | `none` `md` `lg` `full` |
| `size` | `sm` `md` `lg` |
| `slot.anchor` | `top-left` `top-center` `top-right` `center-left` `center` `center-right` `bottom-left` `bottom-center` `bottom-right` |
| `slot.margin` | `none` `sm` `md` `lg` |

これらの列挙値が実際にどの Tailwind クラスへ対応するかは、1箇所（`src/core/styles.ts`）に
まとまっています。[src/core の章](./core.md#stylests-列挙値--tailwind-クラスの対応表)参照。

## 題材: Dock.ui を読む

`examples/Dock.ui` は、point-cloud-viewer の下部中央のフローティングドック
（レイヤー/情報パネルの開閉、設定を開くボタン）を表した文書です。木の形はこうです。

```
root (Canvas)
└─ dock (Panel, slot: bottom-center)
   └─ dock_buttons (HBox, gap: xs)
      ├─ layer_button (Button, active: bind layerOpen)
      ├─ info_button (Button, active: bind infoOpen)
      └─ settings_button (Button)
```

`dock` の `surface` が `{ "bind": "surface" }` になっているので、この文書を使う側は
`surface: "glass" | "opaque" | "none"` を渡す必要があります。この「文書がどんな値と
イベントを要求するか」の一覧を作る処理が `src/core/bindings.ts` です。

## まず読むファイル

- [`schema/ui.schema.json`](https://github.com/dOtOb9/ui-forge/blob/main/schema/ui.schema.json) — 部品ごとに何が書けるかの一覧
- [`src/core/model.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/core/model.ts) — 同じ内容を表した TypeScript の型
- [`examples/Dock.ui`](https://github.com/dOtOb9/ui-forge/blob/main/examples/Dock.ui) — 正規化済みの実例
