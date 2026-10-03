# I-0: point-cloud-viewer に組み込むための準備

- 状態: 未着手
- 前提: [ADR-0001](./ADR-0001-design.md)、[F1](./F1-foundation.md)

## 目的

point-cloud-viewer の `src/ui/shell/Dock.tsx` を、ui-forge が生成したコンポーネントで
**見た目を変えずに**置き換えられるようにする。そのために ui-forge 側で足りないものを足す。
本体の置き換え作業（I-1）は point-cloud-viewer 側の別タスク。

足りないものは 2 種類ある。

### 1. 語彙が 2 つ足りない

本体の `Dock.tsx` のドックのクラスと、F1 の生成物を比べると、差はこの 2 つだけ:

| 本体にあって生成物に無いクラス | 意味 | 足す語彙 |
|---|---|---|
| `z-20` | 3D ビューや左右のパネルとの重なり順 | `Canvas` の `layer` |
| `text-sm` | ドック内の文字サイズ | `Panel` の `textSize` |

- `Canvas.props.layer`: `"base" | "overlay" | "modal"` → `z-10` / `z-20` / `z-50`。
  クラスは `Canvas` の要素（`fixed inset-0` の層）に付ける。省略時は何も付けない
  （F1 の生成物と同じ出力のまま。後方互換）
  - 名前を z の数値にしない理由: point-cloud-viewer の画面は「3D ビューの上に浮かぶ層」
    「最前面のモーダル」という意味で重なりを決めており（ADR-0005）、数値を AI に選ばせると
    層の意味が崩れる。`modal` が `z-50` なのは本体の `GpuErrorBanner` などと揃えるため
- `Panel.props.textSize`: `"sm" | "md" | "lg"`（`Text.size` と同じ列挙・同じクラス対応表を使う）。
  パネル内の文字の既定の大きさ。省略時は何も付けない

語彙を足すときに直す場所（ADR-0001「払うもの」）: スキーマ・型（`model.ts`）・対応表（`styles.ts`）・
生成器（`generate.ts`）・解釈器（`render.tsx`）。**本の該当箇所（`.ui 形式` 章の部品表）も直す。**

`examples/Dock.ui` に `"layer": "overlay"` と `"textSize": "sm"` を足し、生成物を作り直す。

### 2. point-cloud-viewer から CLI を呼べない

いまの CLI は `npm run ui -- gen ...` で、ui-forge のリポジトリの中からしか呼べない。
point-cloud-viewer は ui-forge を **git の依存**として入れ、`npx ui-forge gen ...` で呼ぶ想定にする:

```json
// point-cloud-viewer/package.json（I-1 で足す。今回は足さない）
"devDependencies": { "ui-forge": "github:dOtOb9/ui-forge#v0.1.0" }
```

- `package.json` に `"bin": { "ui-forge": "bin/ui-forge.mjs" }` を足す
- `bin/ui-forge.mjs` は、`tsx` の API（`tsx/esm/api` の `register`）を使って `src/codegen/cli.ts` を
  そのまま読み込む薄い入口にする。**CLI を別途ビルドして JS を生成・コミットはしない**
  （生成物が二重になり、どちらが正か分からなくなるため）
- そのため `tsx` と、CLI が実行時に使う依存（`ajv` など）を `devDependencies` から
  `dependencies` へ移す。React や Vite など、プレビューアプリにしか要らないものは移さない
- `prepare` スクリプトは作らない（git 依存のインストール時に devDependencies まで入ってしまうため）
- `src/codegen/cli.ts` が、ui-forge のリポジトリの外のカレントディレクトリから呼ばれても
  動くこと（相対パスは呼び出し側のカレントディレクトリ基準で解決する。スキーマの場所は
  `cli.ts` 自身の場所から解決する）

## 受け入れ基準

1. `npm run typecheck` / `lint` / `test` / `build` が通る
2. 生成した `Dock` のドックの要素（`data-ui-id="dock"`）のクラスを空白で分けた集合に、本体の
   `Dock.tsx` のドックのクラス `pointer-events-auto fixed bottom-4 left-1/2 z-20 flex -translate-x-1/2
   gap-1 rounded-full p-1.5 text-sm shadow-lg` のうち、`fixed` `flex` `gap-1` `z-20` を除くすべてが
   含まれる。`z-20` は `data-ui-id="root"` の要素に、`flex` と `gap-1` は `data-ui-id="dock_buttons"` の
   要素にある（構造が 1 段深いのは F1 からの既知の差。`fixed` の代わりに `absolute` が付くのも同じ）。
   **これをテストにする**（期待するクラスはテストの中に直書きしてよい）
3. `layer` / `textSize` を省略した文書の生成物が、この変更の前と 1 文字も変わらない
   （F1 の受け入れ基準の 4・5 が引き続き通る。プレビューと生成物の HTML 一致の値の組に、
   `layer` / `textSize` ありの場合を足す）
4. 不正な `layer` / `textSize`（例: `"layer": "top"`）が検証エラーになり、path が正しい
5. **リポジトリの外から CLI が動く**: `npm pack` で作った tarball を、スクラッチの一時ディレクトリ
   （リポジトリの外）に `npm install` し、そこで `npx ui-forge check <Dock.ui のコピー> <生成物のコピー>` が
   終了コード 0、`npx ui-forge gen` が生成物を書き出すことを確認する。手順を実装記録に書く
6. `mdbook build docs/book` と `node scripts/check-book-links.mjs` が通る

## 範囲外

- point-cloud-viewer への変更（I-1）
- npm レジストリへの公開
- 語彙の追加はこの 2 つだけ。LayerPanel 用の部品（スライダーなど）は足さない

## 実装記録

（実装者が記入する: やったこと / 理由と退けた案 / 触ったファイル / 所有者が確かめる手順）
