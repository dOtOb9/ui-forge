// F1-foundation.md「F1-3: 生成器とCLI」。`ui-forge <gen|fmt|check> ...`として動く
// (このリポジトリの中では`npm run ui -- ...`、外からは`npx ui-forge ...`。どちらも
// tsx経由でこのファイルを呼ぶだけで、コマンド名は同じ。package.jsonの"ui"スクリプトと
// bin/ui-forge.mjs参照)。
//
// U1-cli-messages.md: 利用者への案内(usage表示・失敗時のメッセージ)は、ui-forgeの
// リポジトリの外からでも通じる`ui-forge <サブコマンド> <パス>`の形に揃える。
// `npm run ui`はこのリポジトリ自身のpackage.jsonのスクリプト名なので、案内には使わない。
//
// 3つのサブコマンドはいずれも「検証してから」何かをする、という順序を守る:
// - gen:   検証 → 生成 → 書き込み。検証エラーがあれば書き込まずに終了コード1。
// - fmt:   検証はしない(壊れた文書でも、直すためにまず整形したいことがある)。
//          正規化して上書きするだけ。CRLFのファイルもLFに直して上書きされる
//          (formatDocumentが常にLFで書き出すため。cli.test.tsで確認)。
// - check: 検証 → 正規化済みか → 生成物が最新か、の3点を順に確認する。
//          どれかが崩れていれば理由を出して終了コード1(F1-foundation.md指定)。
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import process from "node:process";
import { differsOnlyByLineEndings, formatDocument, parseDocument } from "../core/format";
import { validate, type ValidationError } from "../core/validate";
import { generate } from "./generate";

/**
 * U1-cli-messages.md。`.gitattributes`に足すべき行のglobを、ファイル名の最初の
 * "."より後ろから作る(例: "Dock.ui" → "*.ui"、"Dock.generated.tsx" →
 * "*.generated.tsx")。point-cloud-viewerのI-1の`.gitattributes`が実際に
 * この2行の形で書いている(I1-ui-forge-dock.mdの追記参照)。
 */
function gitattributesGlob(filePath: string): string {
  const base = basename(filePath);
  const dot = base.indexOf(".");
  return dot === -1 ? `*.${base}` : `*${base.slice(dot)}`;
}

/**
 * U1-cli-messages.md。改行コードだけが正規化結果と違う場合の案内。
 * 原因はたいていWindowsの`core.autocrlf=true`で、`.gitattributes`に`eol=lf`を
 * 足せば直る(内容そのものは壊れていないので、`fmt`を勧める通常のメッセージとは
 * 分ける。point-cloud-viewerのI-1で実際に踏んだ問題)。
 */
function crlfGuidance(filePath: string, subject: string): string {
  const glob = gitattributesGlob(filePath);
  return `${filePath} の改行コードが CRLF です。ui-forge の${subject}は LF に正規化されます。Git の \`core.autocrlf\` が原因なら、\`.gitattributes\` に \`${glob} text eol=lf\` を足してください。`;
}

function printErrors(filePath: string, errors: ValidationError[]): void {
  console.error(`検証エラー: ${filePath}`);
  for (const e of errors) {
    console.error(`  ${e.path}: ${e.message}`);
  }
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function cmdGen(inPath: string, outPath: string): number {
  const doc = readJson(inPath);
  const errors = validate(doc);
  if (errors.length > 0) {
    printErrors(inPath, errors);
    return 1;
  }
  writeFileSync(outPath, generate(parseDocument(JSON.stringify(doc)), inPath));
  return 0;
}

function cmdFmt(inPath: string): number {
  const raw = readFileSync(inPath, "utf-8");
  writeFileSync(inPath, formatDocument(parseDocument(raw)));
  return 0;
}

function cmdCheck(inPath: string, outPath: string): number {
  const raw = readFileSync(inPath, "utf-8");
  const doc = JSON.parse(raw);

  const errors = validate(doc);
  if (errors.length > 0) {
    printErrors(inPath, errors);
    return 1;
  }

  const normalized = formatDocument(parseDocument(raw));
  if (normalized !== raw) {
    if (differsOnlyByLineEndings(raw, normalized)) {
      console.error(crlfGuidance(inPath, "`.ui`"));
    } else {
      console.error(`${inPath} は正規化されていません。\`ui-forge fmt ${inPath}\` を実行してください。`);
    }
    return 1;
  }

  const expected = generate(doc, inPath);
  let actual: string;
  try {
    actual = readFileSync(outPath, "utf-8");
  } catch {
    console.error(`${outPath} が見つかりません。\`ui-forge gen ${inPath} ${outPath}\` を実行してください。`);
    return 1;
  }
  if (actual !== expected) {
    if (differsOnlyByLineEndings(actual, expected)) {
      console.error(crlfGuidance(outPath, "生成物"));
    } else {
      console.error(`${outPath} は ${inPath} から生成される内容と一致しません。\`ui-forge gen ${inPath} ${outPath}\` を実行してください。`);
    }
    return 1;
  }

  return 0;
}

function main(): void {
  const [command, ...args] = process.argv.slice(2);

  let code: number;
  switch (command) {
    case "gen":
      code = cmdGen(args[0], args[1]);
      break;
    case "fmt":
      code = cmdFmt(args[0]);
      break;
    case "check":
      code = cmdCheck(args[0], args[1]);
      break;
    default:
      console.error("使い方: ui-forge gen <in.ui> <out.tsx>");
      console.error("        ui-forge fmt <in.ui>");
      console.error("        ui-forge check <in.ui> <out.tsx>");
      code = 1;
  }
  process.exit(code);
}

main();
