# I-0: point-cloud-viewer に組み込むための準備

- 状態: 完了(自動テスト・コマンドでの確認は済み)
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

### 1. 語彙: Canvas.layer / Panel.textSize

**やったこと**: `model.ts`に`Layer`型(`"base" | "overlay" | "modal"`)を足し、
`CanvasProps.layer`・`PanelProps.textSize`を追加。`schema/ui.schema.json`の
Canvas/Panelの`props`に対応する`$ref`を足した。`styles.ts`に`LAYER_CLASS`
(`base→z-10`, `overlay→z-20`, `modal→z-50`)を足した(`textSize`は既存の
`TEXT_SIZE_CLASS`をそのまま再利用。新しい対応表は増やしていない)。
`generate.ts`の`widgetOwnClasses()`と`render.tsx`の`widgetClassName()`の
両方に、同じ場所・同じ順番(Canvasはベースクラスの直後、Panelはshadowの直後・
surfaceの直前)で「`layer`/`textSize`が文字列なら対応するクラスを足す。
省略(undefined)なら何もしない」処理を足した。`examples/Dock.ui`の
root(Canvas)に`"layer": "overlay"`、dock(Panel)に`"textSize": "sm"`を足し、
`npx tsx src/codegen/cli.ts gen`で`examples/generated/Dock.tsx`を作り直した。
`docs/book/src/ui-format.md`(部品表・列挙値表)と`core.md`(`CanvasProps`の
説明。F1時点の「キーを持てないオブジェクト型」という説明が古くなったので
書き換えた)も直した。

**理由・退けた案**:
- `layer`/`textSize`を`pushEnumClass()`(既存の共通ヘルパー)に乗せる案は
  退けた。`pushEnumClass`は「値が無ければfallbackのキーを使う」という形で、
  `fallback`のクラス文字列が空であることを前提にしている(`gap`の`"none"`など)。
  `Layer`にはそのような「クラス無し」のメンバーが無く(`base`/`overlay`/`modal`
  いずれもz-indexを持つ)、fallbackを無理に作ると「省略時は何も付けない」という
  要求(後方互換)を表現できない。そのため`typeof props.layer === "string"`での
  素朴な分岐にした(`textSize`も同じ理由で揃えた)。
- `layer`の値を`z-10`/`z-20`/`z-50`という数値そのもののキーにする案は
  タスクシート自身が明確に却下している(ADR-0005が重なりを意味で決めているため)
  ので採らなかった。
- `generate.test.ts`に、受け入れ基準2用の直書きテストを追加した(本体
  `Dock.tsx`の実クラス文字列をテスト内にリテラルで持つ)。`renderToStaticMarkup`
  した生成物のHTMLから`data-ui-id`ごとの`class`属性を正規表現で抜き、`fixed`/
  `flex`/`gap-1`/`z-20`を除いた本体のクラスが`dock`要素に全て含まれること、
  `z-20`が`root`、`flex`/`gap-1`が`dock_buttons`にあることを確認する形にした。
  このファイルは`.test.ts`(`.tsx`ではない)なのでJSXは使わず`react`の
  `createElement`で呼び出した。
- 受け入れ基準3(省略時に不変)は、`examples/Dock.ui`自体に`layer`/`textSize`を
  足してしまった以上、生成物同士の比較では検証できない。そこで
  `generate.test.ts`に「`layer`/`textSize`を一切書いていない旧構造の文書」を
  インラインで用意し、`generate()`の出力が、この変更より前に実際に
  コミットされていた`examples/generated/Dock.tsx`の内容(文字列として
  このテストに直書き)と1文字単位で一致することを確認するテストを足した。
- 受け入れ基準4(不正値の検証エラー)は、`layer`/`textSize`がどちらもスキーマの
  `enum`だけで表現できる(複数Widgetにまたがる意味検証は不要)ため、
  `validate.ts`自体の変更は無し。`schema/ui.schema.json`に`$ref`を足すだけで
  既存の`describeAjvError`の`"enum"`分岐がそのまま効く。`validate.test.ts`に
  不正な`layer`("top")・`textSize`("huge")の2ケースを足し、pathが
  `/root/props/layer`・`/root/props/textSize`になることを確認した。

**触ったファイル**: `src/core/model.ts`, `src/core/styles.ts`,
`schema/ui.schema.json`, `src/codegen/generate.ts`, `src/preview/render.tsx`,
`src/codegen/generate.test.ts`, `src/core/validate.test.ts`, `examples/Dock.ui`,
`examples/generated/Dock.tsx`, `docs/book/src/ui-format.md`, `docs/book/src/core.md`

**確認手順**:
1. `npm run typecheck && npm run lint && npm test && npm run build` が通る
   (受け入れ基準1。実施確認済み)
2. `npm test`の`src/codegen/generate.test.ts`「受け入れ基準2」のケースが通る
   ことを確認する(受け入れ基準2。実施確認済み)
3. 同じく「I0-viewer-readiness.md 受け入れ基準3」のケースが通ることを
   確認する(受け入れ基準3前半。実施確認済み)
4. `src/core/validate.test.ts`の「不正なlayer」「不正なtextSize」のケースが
   通ることを確認する(受け入れ基準4。実施確認済み)
5. `mdbook build docs/book && node scripts/check-book-links.mjs` が通る
   (受け入れ基準6。実施確認済み)

### 2. CLI: リポジトリの外から呼べるようにする

**やったこと**: `package.json`に`"bin": {"ui-forge": "bin/ui-forge.mjs"}`を
足した。`bin/ui-forge.mjs`は`tsx/esm/api`の`register()`でTypeScript用のESM
ローダーを登録したあと、`pathToFileURL`で`src/codegen/cli.ts`への絶対パスを
file URLに変換して`import()`する薄い入口にした。`tsx`を`devDependencies`から
`dependencies`へ移した(`ajv`は元から`dependencies`側にあったので変更不要)。

**理由・退けた案**:
- `cli.ts`をあらかじめ`esbuild`等でビルドしてJSをコミットする案は、
  タスクシートが明示的に退けている(ADR-0001の「生成物をリポジトリに入れると
  差分が二重になる」という考え方と同じ理由)ので採らなかった。
- `import(cliPath)`に素朴な絶対パス文字列を渡す案は試して失敗した: Windows
  では`C:\...`のような絶対パスはそのまま`import()`に渡せる有効なURLではない
  (`ERR_UNSUPPORTED_ESM_URL_SCHEME`のような失敗の仕方をする)。`node:url`の
  `pathToFileURL().href`を経由する形に直した。
- `cli.ts`・`validate.ts`自体への変更は不要だった: `.ui`/生成物のパスは
  `cli.ts`が`process.argv`をそのまま`readFileSync`/`writeFileSync`に渡して
  いるだけなので、Node標準の動作としてプロセスのカレントディレクトリ基準に
  自然に解決される。スキーマの場所(`validate.ts`の
  `import schema from "../../schema/ui.schema.json"`)はES Modulesの相対
  importなので、常にモジュール自身の場所(`src/core/validate.ts`)基準で
  解決され、呼び出し側のカレントディレクトリには影響されない。どちらも
  タスクシートが要求する「相対パスは呼び出し側のカレントディレクトリ基準、
  スキーマの場所はcli.ts自身の場所から解決する」を既に満たしていたので、
  変更する理由が無かった。
- `prepare`スクリプトは作っていない(タスクシートの指示どおり。git依存の
  インストール時に`devDependencies`まで入ってしまうため)。

**触ったファイル**: `package.json`, `package-lock.json`, `bin/ui-forge.mjs`(新規)

**確認手順(受け入れ基準5。実施確認済み)**:
1. リポジトリのルートで`npm pack --pack-destination <一時ディレクトリ>`を実行し、
   `ui-forge-0.1.0.tgz`を作る
2. リポジトリの外(`C:\Users\Masa1\AppData\Local\Temp`の下に新しい一時フォルダ、
   以下`<scratch>`)で`npm init -y && npm install <tgz のパス>`を実行する
   (`devDependencies`の`react`/`vite`等は入らず、`dependencies`の
   `tsx`/`ajv`等だけが入ることを確認した。15パッケージ)
3. `<scratch>/examples/Dock.ui`、`<scratch>/examples/generated/Dock.tsx`に
   リポジトリの`examples/Dock.ui`・`examples/generated/Dock.tsx`をそのまま
   コピーする(生成物のコメント1行目に埋め込まれたソースパスの文字列
   `examples/Dock.ui`と、`check`に渡す引数の文字列を一致させる必要がある
   ため、ディレクトリ構成も`examples/...`に合わせる)
4. `<scratch>`で`npx ui-forge check examples/Dock.ui examples/generated/Dock.tsx`
   → 終了コード0
5. 同じ場所に`npx ui-forge gen examples/Dock.ui examples/generated/Dock.tsx`を
   実行し、書き出された内容がリポジトリの`examples/generated/Dock.tsx`と
   バイト単位で一致することを確認した
6. 確認後、`<scratch>`ディレクトリと生成した`.tgz`を削除した(リポジトリの
   外にのみ作業用ファイルを置き、後片付けまで行った)
