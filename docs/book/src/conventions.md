# 規約

ここに挙げるのは、崩れても「普通のビルドは通ってしまう」種類の約束です。だからこそ
明文化し、できる範囲でテストにしています。

## 依存の向き: src/core は React/Tauri を知らない

`src/core/` は `src/codegen/` と `src/preview/` の両方から依存されますが、逆方向の
依存は禁止です（ADR-0001）。

**なぜ**: `src/core/` が React や Tauri を知らなければ、生成されたコードは
ui-forge のどのモジュールも import しない形のままでいられます（ADR-0001
「本体に実行時ランタイムが増えない」）。また、`src/core/` の関数はブラウザ（プレビュー）
でも Node（CLI）でも同じモジュールとして動く必要があり、どちらかの環境に依存した
import が混ざるとそれが崩れます。

**テストでの検査**: [`src/core/architecture.test.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/core/architecture.test.ts) の最初の `describe` が、
`src/core/` 以下の `.ts` ファイルすべてを読み、`from "react"` や
`from "@tauri-apps"` を含んでいないことを確認します（受け入れ基準7）。

同じファイルには、`@tauri-apps/*` の import を `src/preview/host/tauri-*.ts` だけに
閉じ込める、という2つめの `describe` もあります。これは point-cloud-viewer の
「規約2」と同じ考え方ですが、`src/preview/host/` の実装自体はこの本では扱いません
（[プラットフォーム](./platforms.md)の章を参照）。

## クラス名は必ずリテラル

Tailwind v4 はソースを静的に走査してクラスを検出するため、テンプレート文字列で
`` `p-${n}` `` のように動的に組み立てたクラス名は検出されません（ADR-0001
「語彙を限定する」）。`src/core/styles.ts` の対応表も、`src/codegen/generate.ts` が
作る三項演算子の各枝も、すべてリテラルの文字列です。

**テストでの検査**: [`src/core/styles.test.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/core/styles.test.ts) と
[`src/codegen/generate.test.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/codegen/generate.test.ts) が、それぞれのモジュールの文字列すべてを
再帰的に集めて `${` を含まないことを確認します（受け入れ基準6）。詳しい経緯は
[「2つの描画経路を揃える仕組み」の章](./render-parity.md)を参照してください。

## 語彙を足すときに直す4箇所

`.ui` に書ける部品やプロパティ（語彙）を増やしたくなったら、ADR-0001 はこの4箇所を
**同時に**変えると決めています。1箇所だけ直すと、検証は通るのに生成物とプレビューの
見た目がずれる、というバグの典型的な原因になります。

| 箇所 | 変えること |
|---|---|
| `schema/ui.schema.json` | 新しい type / プロパティ / 列挙値を許可する |
| `src/core/model.ts` | 対応する TypeScript の型を足す |
| `src/core/styles.ts` | 列挙値 → Tailwind クラスの対応表に行を足す |
| `src/codegen/generate.ts` と `src/preview/render.tsx` | 両方の描画経路にその部品・プロパティの扱いを足す |

`src/core/validate.ts` の意味検証（id 重複や親子関係のような、複数の Widget に
またがるチェック）は、新しい列挙値を足すだけなら触る必要がないことが多いです。
新しい**種類の関係**（例: 新しいコンテナ部品）を足すときだけ触ります。

## まず読むファイル

- [`src/core/architecture.test.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/core/architecture.test.ts) — 依存の向きを機械的に検査するテスト
- [`src/core/styles.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/core/styles.ts) — 語彙を足すときに必ず触る4箇所の1つ
