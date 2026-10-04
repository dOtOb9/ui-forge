# src/codegen

`src/codegen/` は `.ui` 文書から TSX のソーステキストを作る層です。`src/core/` に
依存しますが、生成する TSX 自体は ui-forge のどのモジュールも import しません
（ADR-0001「本体に実行時ランタイムが増えない」）。

## generate.ts: Props の作り方

[`src/codegen/generate.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/codegen/generate.ts) の `generate()` は、`validate()` を通した文書だけを
受け取る前提で動きます（壊れた入力をどう扱うかを考える必要がない、という役割分担）。

`Props` インターフェースは `collectPropsMembers()`（[src/core の章](./core.md#bindingsts-props-の一覧を作る)参照）が返す一覧をそのまま
並べます。bind は値の型（`boolean` / `string` / `"glass" | "opaque" | "none"`）に、
event は `() => void` になります。

```tsx
export interface DockProps {
  infoOpen: boolean;
  layerOpen: boolean;
  onOpenSettings: () => void;
  onToggleInfo: () => void;
  onToggleLayer: () => void;
  surface: "glass" | "opaque" | "none";
}
```

## クラスの組み立て: 静的な部分と三項演算子

`widgetOwnClasses()` は、各部品のクラスを「常に適用される静的な部分
（`staticParts`）」と「bind した値によって選ぶ三項演算子の式（`dynamicExpr`、
高々1個）」に分けて組み立てます。bind 不可な列挙値（`gap` / `padding` / `radius` など）は
文書が検証済みなら常にリテラルの文字列なので、素直に `src/core/styles.ts` の対応表を
引くだけです。bind 可能なクラス（`Panel.surface` / `Button.active`）だけが実行時の
値で変わるため、生成物の中に三項演算子として残ります。

```tsx
className={`...${props.surface === "glass" ? " ...backdrop-blur-md..." : props.surface === "opaque" ? " ...bg-white..." : ""}`}
```

この式の中の空白の扱いには、見つかった不具合の経緯があります。
[「2つの描画経路を揃える仕組み」の章](./render-parity.md#見つかった不具合-surface-none-のときの余分な空白)で説明します。

## cli.ts: gen / fmt / check

[`src/codegen/cli.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/codegen/cli.ts) は3コマンドを持ち、このリポジトリの中では
`npm run ui -- <command>`、外から依存として使うときは `npx ui-forge <command>`
として動きます（どちらも `tsx` 経由で同じ `cli.ts` を呼ぶだけ）。いずれも
「検証してから」何かをする、という順序を守ります。

利用者への案内（usage 表示・失敗時のメッセージ）は、`npm run ui -- gen ...` ではなく
`ui-forge gen ...` のように**コマンド名だけ**の形に揃えています（U1-cli-messages.md）。
`npm run ui` はこのリポジトリ自身の `package.json` のスクリプト名で、依存として
使う側のリポジトリには無いためです。

| コマンド | すること | 失敗の条件 |
|---|---|---|
| `gen <in.ui> <out.tsx>` | 検証 → 生成 → 書き込み | 検証エラーがあれば書き込まず終了コード1 |
| `fmt <in.ui>` | 正規化して上書き | 検証はしない（壊れた文書を直すために、まず整形したいことがあるため） |
| `check <in.ui> <out.tsx>` | 検証 → 正規化済みか → 生成物が最新か、の3点を順に確認 | どれかが崩れていれば理由を出して終了コード1 |

`check` は3点を順番に見て、**最初に失敗した段階の理由だけ**を出します。検証に
失敗した壊れた文書に対してそのまま `format` や `generate` を呼ぶと、無意味な
エラーになりかねないためです。

### 他のリポジトリから使うときの注意: 改行コード

`check`/`gen` は、`.ui` や生成物の内容が正規化後の結果と**改行コードだけ**違う
場合、専用のメッセージ（`CRLF` と `.gitattributes` を含む）を出します
（`src/core/format.ts` の `differsOnlyByLineEndings()`）。Windows で Git の
`core.autocrlf=true` だと、`checkout` のたびに `.ui` が CRLF に書き直され、
中身は同じなのに `check` が失敗することがあるためです（point-cloud-viewer の
I-1 で実際に踏んだ問題）。依存として使うリポジトリの `.gitattributes` に
`*.ui text eol=lf` を足すと直ります（README の「他のリポジトリから使う」参照）。
内容そのものが違う場合は、この専用メッセージにはならず、`fmt`/`gen` を勧める
従来のメッセージのままです。

## まず読むファイル

- [`src/codegen/generate.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/codegen/generate.ts) — `widgetOwnClasses()` から読むと全体の組み立てが見える
- [`src/codegen/cli.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/codegen/cli.ts) — 3コマンドの順序
