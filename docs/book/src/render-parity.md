# 2つの描画経路を揃える仕組み

[全体像](./overview.md#2つの経路)で見たとおり、`.ui` 文書は2つの別経路で使われます。

- `src/codegen/generate.ts` — ビルド時にコードを生成する経路
- `src/preview/render.tsx` — プレビューが実行時に解釈する経路

ADR-0001 はこの2経路について「**同じ入力に対して同じ HTML を出すことをテストで
保証する**」と決めています。経路が2つあること自体が、見た目のずれという新しい
不具合の種類を生むためです。

## テスト: renderToStaticMarkup の一致

[`src/preview/render.test.tsx`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/render.test.tsx) が、少なくとも3通りの値の組
（`surface` × `layerOpen` × `infoOpen` の組み合わせ）について、生成された `Dock`
コンポーネントと `renderDocument()` の出力を `react-dom/server` の
`renderToStaticMarkup()` で文字列として比較します（受け入れ基準5）。

```ts
const fromGenerated = renderToStaticMarkup(<Dock {...props} />);
const fromPreview = renderToStaticMarkup(renderDocument(doc, values, handlers));
expect(fromPreview).toBe(fromGenerated);
```

これが通るのは、`generate.ts` の `widgetOwnClasses()` と `render.tsx` の
`widgetClassName()` が、[src/preview の章](./preview.md#rendertsx-実行時の解釈)で見たとおり**わざと同じ順番**で
クラス片を組み立てているからです。

## 見つかった不具合: surface: none のときの余分な空白

`Panel.surface` を bind したとき、`generate.ts` は最初、分かれ道の外側に区切りの
空白を固定で置いていました。これだと `surface` が `"none"` に解決されたとき
（`SURFACE_CLASS.none` は空文字）、クラス文字列の末尾に意味のない空白だけが
残ってしまいます。

F1-4 でこの HTML 一致テストを書いたときにこの不一致が見つかり（`render.tsx` 側は
素直に `parts.join(" ")` するだけなので空白が残らず、`generate.ts` 側だけが
ずれていました）、`fix(F1-3)` のコミットで直されています。直し方は、区切りの
空白を三項演算子の**各枝の中**に埋め込む形です。

```ts
// 各枝の中に区切りの空白を入れる。"none" の枝は空文字のまま。
const dynamicExpr =
  `${p} === "glass" ? " ${SURFACE_CLASS.glass}" : ` +
  `${p} === "opaque" ? " ${SURFACE_CLASS.opaque}" : ""`;
```

こうしておけば、外側で単純に文字列を連結するだけでよく、`"none"` に解決されても
余分な末尾スペースが残りません。`Button.active` のクラス（どちらの枝も空文字には
ならない）にも、同じ理由で揃えて同じ形が使われています。

この経緯は、**2経路をテストで比較する仕組み自体が、片方だけの修正では気づけない
種類のずれを検出した**という実例です。

## クラス名がリテラルであることの確認

同じ受け入れ基準の一環として、`src/core/styles.ts` と生成物の両方に `${` を含む
クラス文字列が無いことも、文字列検査でテストされています
（[`src/core/styles.test.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/core/styles.test.ts)、
[`src/codegen/generate.test.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/codegen/generate.test.ts)）。テンプレート文字列でクラス名を
動的に組み立てると Tailwind が検出できなくなる、という ADR-0001 の制約がここでも
機械的に守られています。

## まず読むファイル

- [`src/preview/render.test.tsx`](https://github.com/dOtOb9/ui-forge/blob/main/src/preview/render.test.tsx) — 一致を確かめるテストそのもの
- [`src/codegen/generate.ts`](https://github.com/dOtOb9/ui-forge/blob/main/src/codegen/generate.ts) の `widgetOwnClasses()` — 不具合が起きた場所
