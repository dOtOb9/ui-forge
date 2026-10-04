# U1: CLI のメッセージを、ui-forge の外から使う前提で直す

- 状態: 未着手
- 前提: [I-0](./I0-viewer-readiness.md)（CLI をリポジトリの外から呼べるようにした）

## 背景

point-cloud-viewer で `npx ui-forge check` を使い始めて（point-cloud-viewer の I-1）、
2 つの不親切が見つかった。

1. **案内のコマンドが ui-forge の中でしか通じない。** `check` が失敗すると
   「`npm run ui -- fmt src/ui/shell/Dock.ui` を実行してください」と出る。
   `npm run ui` は ui-forge 自身の `package.json` のスクリプトで、point-cloud-viewer には無い
2. **改行コードの違いを言わない。** Windows で `core.autocrlf=true` だと `.ui` が CRLF で
   checkout され、中身は同じなのに「正規化されていません」とだけ出る。原因にたどり着くまでに
   バイト単位の比較が必要だった（point-cloud-viewer の I-1 の追記を参照）

## やること

- 案内は **`ui-forge <サブコマンド> <パス>`** の形にする（`npx ui-forge fmt ...` ではなく、
  コマンド名だけ。npm の scripts からも `npx` からも、同じ名前で呼べるため）。
  CLI の usage 表示も同じ形に揃える
- `check` と `gen` で、`.ui` の中身が正規化の結果と**改行コードだけ違う**場合は、専用のメッセージを出す:
  「改行コードが CRLF です。ui-forge の `.ui` は LF に正規化されます。Git の `core.autocrlf` が
  原因なら、`.gitattributes` に `*.ui text eol=lf` を足してください」
  （生成物の比較でも同じ判定をする）
- `fmt` は CRLF のファイルを LF に直して書き戻す（今もそうなっているはず。テストで確かめる）
- README と本（`codegen` 章の CLI の節）に、他のリポジトリで使うときの注意として
  `.gitattributes` の 1 行を書く

## 受け入れ基準

1. `npm run typecheck` / `lint` / `test` / `build` が通る
2. テスト: CRLF にした `Dock.ui` を `check` にかけると、終了コード 1 で、メッセージに `CRLF` と
   `.gitattributes` が含まれる。内容まで違う場合は従来のメッセージのまま
3. テスト: 失敗時の案内に `npm run ui` が含まれない
4. `mdbook build docs/book` と `node scripts/check-book-links.mjs` が通る

## 実装記録

（実装者が記入する）
