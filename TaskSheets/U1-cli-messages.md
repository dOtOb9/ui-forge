# U1: CLI のメッセージを、ui-forge の外から使う前提で直す

- 状態: 完了(自動テスト・コマンドでの確認は済み)
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

### やったこと

1. **案内のコマンド形**: `src/codegen/cli.ts`のusage表示(デフォルトcase)と、
   `check`の3つの失敗メッセージ(正規化されていない・生成物が見つからない・
   生成物が一致しない)から`npm run ui -- <command> ...`を除き、
   `ui-forge <サブコマンド> <パス>`の形に変えた。
2. **改行コードだけの違い**: `src/core/format.ts`に
   `differsOnlyByLineEndings(a, b)`を足した(両方のCRLFをLFに変えると一致する、
   かつ元は一致していない、の両方を見る純粋関数)。`cli.ts`の`cmdCheck`の
   2か所(`.ui`の正規化チェック、生成物の内容比較)で、通常の不一致メッセージを
   出す前にこれを使い、真なら専用メッセージ(`CRLF`と`.gitattributes`を含む)を
   出すようにした。`.gitattributes`に足すべき行は、ファイル名の最初の"."より
   後ろからglobを作る`gitattributesGlob()`で決める(`Dock.ui`→`*.ui`、
   `Dock.generated.tsx`→`*.generated.tsx`)。
3. **fmt**: 既存のまま(`formatDocument`が常にLFで書き出すため、CRLFの入力を
   `fmt`すればLFに直って上書きされる)。挙動が変わっていないことを
   `cli.test.ts`で確認した。
4. **README・本**: READMEに「他のリポジトリから使う（CLI）」の節を新設し、
   git依存としての入れ方・`npx ui-forge`での呼び方・`.gitattributes`に
   `*.ui text eol=lf`を足す理由を書いた。本(`docs/book/src/codegen.md`)の
   `cli.ts`の節にも、案内の形と改行コード専用メッセージについて追記した。

### 理由・退けた案

- **`gen`には改行コードの専用メッセージを足さなかった**: タスクシートの
  「やること」は「`check`と`gen`で」と書いているが、`cmdGen`は
  「検証→生成→書き込み」だけで、入力の`.ui`を正規化結果と比較する処理が
  そもそも無い(CRLFでもJSON.parseは問題なく通る)。比較する箇所が無い以上、
  「改行コードだけ違う場合の専用メッセージ」を出す分岐を新設する先が無く、
  受け入れ基準2・3のテストも`check`しか求めていない。そのため実装は
  `check`の2箇所(正規化チェック・生成物比較)に絞った。ここは判断が割れうる
  ところなので、所有者が「`gen`にも何か必要」と考える場合は指摘してほしい。
- **`src/codegen/generate.ts`が生成物の先頭に埋め込む`` `npm run ui -- gen` で
  作り直す。``というコメントは変更しなかった**: これも同じ「ui-forgeの外では
  通じない案内」の問題を抱えているが、今回のタスクの「関連コード」に
  `generate.ts`は含まれておらず、そこを直すと`generate.test.ts`の
  `DOCK_TSX_BEFORE_I0`(I-0より前の生成物を1文字単位で固定した回帰テスト)にも
  波及する。スコープ外と判断し、触れていない。別タスクとして切り出すのが
  良さそうだと所有者に報告する。
- **CLI単体のテスト方法**: `cli.ts`はトップレベルで`main()`を呼び、
  `process.exit()`する(`bin/ui-forge.mjs`のコメントに明記されている既存の
  設計)。そのため`cli.test.ts`から`cli.ts`を直接importするとテストプロセスが
  終了してしまい使えない。`cli.ts`をテスト用に輸出可能な形へ作り直す(例:
  `main()`の呼び出しを環境変数で止める)案も考えたが、`bin/ui-forge.mjs`
  経由の実際の呼び出し方(`import()`でモジュールを読み込むと即`main()`が走る)
  を変えずに済む方が既存の設計への変更を増やさず安全と判断し、実際に
  利用者が叩く入口である`bin/ui-forge.mjs`を`node:child_process`の
  `spawnSync`で子プロセス起動し、終了コードと`stderr`を見る形にした。
- **`.gitattributes`のglob導出**: 生成物側(例: `Dock.generated.tsx`)の
  メッセージで案内するglobを`*.tsx`のような拡張子だけにすると、プロジェクト内の
  他の`.tsx`ファイルにも意図せず`eol=lf`がかかってしまう。point-cloud-viewerの
  実際の`.gitattributes`(`*.ui text eol=lf` / `*.generated.tsx text eol=lf`)に
  合わせ、ファイル名の最初の"."より後ろ全体をglobにする方式にした。

### 触ったファイル

- `src/core/format.ts`(`differsOnlyByLineEndings`を追加)
- `src/core/format.test.ts`(上記のテストを追加)
- `src/codegen/cli.ts`(案内の形・CRLF専用メッセージ)
- `src/codegen/cli.test.ts`(新規。`bin/ui-forge.mjs`を子プロセスで起動する
  統合テスト)
- `README.md`(「他のリポジトリから使う（CLI）」の節を新設)
- `docs/book/src/codegen.md`(`cli.ts`の節に追記)

### 所有者が確かめる手順

1. `npm run typecheck && npm run lint && npm test && npm run build` が通る
   (受け入れ基準1。実施確認済み)
2. `npm test`の`src/codegen/cli.test.ts`の以下のケースで受け入れ基準2・3を
   確認した(実施確認済み):
   - 「.uiがCRLFだけ違う場合」→終了コード1、`CRLF`と`.gitattributes`を含む
   - 「内容そのものが違う場合」→`CRLF`は含まず、従来の「正規化されていません」
     のまま
   - 「生成物の比較でも同じ判定をする」→生成物がCRLFだけ違う場合も同様
   - 失敗時の案内・usage表示のいずれにも`npm run ui`が含まれない
3. `mdbook build docs/book && node scripts/check-book-links.mjs` が通る
   (受け入れ基準4。実施確認済み)
4. 手元で実際に`.ui`をCRLF化して確かめる場合:
   ```
   node -e "const fs=require('fs');const p='examples/Dock.ui';fs.writeFileSync(p,fs.readFileSync(p,'utf-8').replace(/\n/g,'\r\n'))"
   npx tsx src/codegen/cli.ts check examples/Dock.ui examples/generated/Dock.tsx
   # → 終了コード1、メッセージに CRLF と .gitattributes
   npx tsx src/codegen/cli.ts fmt examples/Dock.ui
   # → LFに戻る(git diffで改行コードの差だけ残っていないことを確認)
   ```
   確認後は`git checkout -- examples/Dock.ui`等で元に戻すこと。
