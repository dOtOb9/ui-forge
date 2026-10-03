#!/usr/bin/env node
// I0-viewer-readiness.md「2. point-cloud-viewerからCLIを呼べない」。
//
// point-cloud-viewer側はui-forgeをgit依存として入れ、`npx ui-forge gen ...`で
// 呼ぶ想定(bin解決はnpm/npxが行うので、この一行がリポジトリの外からの入口になる)。
//
// src/codegen/cli.tsをあらかじめJSにビルドしてコミットする、ということはしない。
// ADR-0001「払うもの」と同じ理由で、生成物が二重になり(ビルドしたJSと.uiから
// 生成するTSXの2種類)どちらが正か分からなくなるため。代わりにtsxの実行時API
// (`tsx/esm/api`のregister())でTypeScriptのESMローダーを登録し、cli.tsを
// そのままimportする薄い入口にする。そのためtsxはdevDependenciesではなく
// dependenciesに置く(package.json参照。実行時にこのファイルが使うため)。
import { register } from "tsx/esm/api";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const unregister = register();

// cli.ts自身の場所はこのファイル(bin/ui-forge.mjs)からの相対パスで解決する。
// 呼び出し側のカレントディレクトリには依存しない(I0-viewer-readiness.md
// 「スキーマの場所はcli.ts自身の場所から解決する」と同じ考え方。cli.tsが
// 読み書きする.ui/.tsxのパスの方は、cli.ts内でprocess.argvをそのまま
// readFileSync/writeFileSyncに渡しているので、自然にプロセスのカレント
// ディレクトリ基準になる)。
const cliPath = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "codegen", "cli.ts");

// cli.tsはトップレベルでmain()を呼び、検証/生成の結果に応じてprocess.exit()する
// (src/codegen/cli.ts参照)。そのため通常はimport()の中でプロセスが終了し、
// 以降の行には到達しない。
await import(pathToFileURL(cliPath).href);
await unregister();
