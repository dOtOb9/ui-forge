# 用語集

本書で前提知識なしに読めるよう、頻出する用語をまとめます。初出の章にもリンクを
置いていますが、迷ったらここに戻ってきてください。

## UMG（Unreal Motion Graphics）

Unreal Engine の UI フレームワーク。Designer というビジュアルエディタで画面を
組み立て、バイナリの `.uasset` として保存します。ui-forge はこれの「テキストで
差分が取れる版」を目指しています。→ [全体像](./overview.md#umg-との対応)

## `.ui`

ui-forge が扱うレイアウトのファイル形式。拡張子は `.ui` ですが、中身は普通の JSON
です。これが唯一の正で、生成される TSX は人間が読めるようにコミットしますが
手では編集しません。→ [.ui 形式](./ui-format.md)

## bind

プロパティの値を、文書そのものには書かず「外から渡してもらう値の名前」として
宣言する書き方（`{ "bind": "layerOpen" }`）。生成される `Props` 型のメンバーになり、
プレビューでは値パネルから値を変えられます。→ [.ui 形式](./ui-format.md#値の書き方)

## event

ボタンなどの操作を、文書の外（呼び出し側）に名前で伝える書き方
（`{ "event": "onToggleLayer" }`）。生成される `Props` では関数になります。名前は
必ず `on` で始まります。UMG の Graph（Blueprint）に相当するものは ui-forge には
無く、ロジックは手書きの TS に置く約束です。→ [.ui 形式](./ui-format.md#値の書き方)

## 正規化（normalization）

同じ内容の `.ui` 文書を、常に同じバイト列のテキストとして書き出すこと。キー順や
インデントがそのつど変わると、Git の差分が読めなくなるため、ADR-0001 はこれを
「生命線」と呼んでいます。→ [src/core](./core.md#formatts-正規化の規則と理由)

## ファイルホスト（FileHost）

ファイルの選択・読み込み・変更検知を、プラットフォームごとの違いを隠して扱う
インターフェース。point-cloud-viewer の `DataSource` と同じ考え方です。
Windows・Android・Web でそれぞれ別の実装（`OpenedFile` を返す）を持ちます。
→ [プラットフォーム](./platforms.md)

## ポーリング（polling）

ファイルの変更を、OS やブラウザからの通知を待つのではなく、一定間隔で自分から
取りに行って前回と比べることで検知する方法。ui-forge では Android と Web の
File System Access API 実装がこれを使います（`content://` URI やブラウザには
`notify` のようなファイル監視の標準手段が無いため）。→ [プラットフォーム](./platforms.md#変更検知が2種類ある理由と-pollts)

## JSON Pointer

JSON 文書内の1箇所を指す記法（`/root/children/0/props/gap` のような形）。
`src/core/validate.ts` が返す検証エラーの `path` はこの形式です。
→ [src/core](./core.md#validatets-スキーマ検証--意味検証)

## slot / anchor

`Canvas` の直接の子だけが持てるプロパティ。UMG の Canvas Panel のアンカーに相当し、
9方向（`top-left` 〜 `bottom-right` と `center`）のどこに置くかを決めます。
→ [.ui 形式](./ui-format.md#列挙値)

## surface

`Panel` の見た目の質感を選ぶ列挙値（`glass` / `opaque` / `none`）。`glass` は
半透明でぼかしの入ったガラス面で、point-cloud-viewer の UI シェルと同じ見た目です。
→ [src/core](./core.md#stylests-列挙値--tailwind-クラスの対応表)

## ADR（Architecture Decision Record）

設計判断とその理由を記録する文書形式。このリポジトリでは `TaskSheets/ADR-0001` が
これに当たります。→ [設計判断の索引](./adr-index.md)
