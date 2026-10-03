# 全体像

## 一言でいうと

**UI のレイアウトをテキストファイル（`.ui`、中身は JSON）に書き、そこから React の
TSX を生成する。** 同じ `.ui` を実行時に解釈して描画する Tauri アプリ（プレビュー）も
持つ。[Unreal Engine の UMG](./glossary.md#umg) の Designer に相当するものを、
バイナリではなくテキストファイルで作ろうとしている、と捉えると分かりやすいです。

この構成を選んだ理由は [ADR-0001](https://github.com/dOtOb9/ui-forge/blob/main/TaskSheets/ADR-0001-design.md) にあります。要点だけ書くと、AI に UI を書かせると人間が
追えない形で膨らみやすい一方、UMG のようなエディタは保存形式がバイナリで差分が
取れません。**AI はテキストを編集し、人間はプレビューで見て確かめ、差分でレビューする**
という、三者それぞれが得意な表現で同じものを扱える形を目指しています。

## UMG との対応

| UMG | ui-forge |
|---|---|
| `.uasset`（バイナリ） | `.ui`（JSON テキスト）。これが唯一の正 |
| Designer | Tauri アプリのプレビュー |
| Canvas Panel のアンカー | `Canvas` の子の `slot.anchor` |
| Horizontal / Vertical Box | `HBox` / `VBox` |
| Graph（Blueprint） | 作らない。ロジックは手書きの TS に置く |

## 2つの経路

同じ `.ui` 文書が、2つの別経路で使われます。

```
                      .ui (JSON)
                         │
          検証 (core/validate.ts)
          正規化 (core/format.ts)
                         │
        ┌────────────────┴────────────────┐
        │                                  │
   コード生成(ビルド時)                実行時解釈(プレビュー)
   codegen/generate.ts                 preview/render.tsx
        │                                  │
        ▼                                  ▼
      TSX                            React要素
 (本体がimportする)                 (プレビューの中だけ)
```

生成された TSX は、ui-forge のどのモジュールも import しません（ADR-0001
「本体に実行時ランタイムが増えない」）。point-cloud-viewer のような本体側は、
この生成物を普通のコンポーネントとして import するだけです。

一方、プレビューアプリは `.ui` を保存のたびに読み直し、`render.tsx` で**実行時に**
解釈して描画します。生成物を使わないのは、エディタでの編集（将来の機能）のときに
ビルドを待たずに即座に見た目を確かめられるようにするためです。

この2経路は**同じ入力に対して同じ HTML を出す**ことがテストで保証されています。
詳しくは[「2つの描画経路を揃える仕組み」](./render-parity.md)の章を参照してください。

## ディレクトリ構成

| ディレクトリ | 内容 |
|---|---|
| `schema/` | `.ui` の構造を決める JSON Schema |
| `src/core/` | 純粋関数のみ。React も Tauri も import しない（[規約](./conventions.md)参照） |
| `src/codegen/` | `.ui` → TSX のコード生成器と CLI |
| `src/preview/` | プレビューアプリ（React + Tauri） |
| `src-tauri/` | ファイル監視だけを持つ薄い Rust 側 |
| `examples/` | 題材の `Dock.ui` と生成物 |

## まず読むファイル

- [`TaskSheets/ADR-0001-design.md`](https://github.com/dOtOb9/ui-forge/blob/main/TaskSheets/ADR-0001-design.md) — なぜこの構成なのか、すべての前提
- [`TaskSheets/F1-foundation.md`](https://github.com/dOtOb9/ui-forge/blob/main/TaskSheets/F1-foundation.md) — このマイルストーンで実際に作ったものの一覧
- [`examples/Dock.ui`](https://github.com/dOtOb9/ui-forge/blob/main/examples/Dock.ui) — 題材そのもの。次の章から読み解いていきます
