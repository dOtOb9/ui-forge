// F1-foundation.md「F1-3: 生成器とCLI」。`npm run ui -- <gen|fmt|check> ...`として
// tsx経由で実行する(package.jsonの"ui"スクリプト)。
//
// 3つのサブコマンドはいずれも「検証してから」何かをする、という順序を守る:
// - gen:   検証 → 生成 → 書き込み。検証エラーがあれば書き込まずに終了コード1。
// - fmt:   検証はしない(壊れた文書でも、直すためにまず整形したいことがある)。
//          正規化して上書きするだけ。
// - check: 検証 → 正規化済みか → 生成物が最新か、の3点を順に確認する。
//          どれかが崩れていれば理由を出して終了コード1(F1-foundation.md指定)。
import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import { formatDocument, parseDocument } from "../core/format";
import { validate, type ValidationError } from "../core/validate";
import { generate } from "./generate";

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
    console.error(`${inPath} は正規化されていません。\`npm run ui -- fmt ${inPath}\` を実行してください。`);
    return 1;
  }

  const expected = generate(doc, inPath);
  let actual: string;
  try {
    actual = readFileSync(outPath, "utf-8");
  } catch {
    console.error(`${outPath} が見つかりません。\`npm run ui -- gen ${inPath} ${outPath}\` を実行してください。`);
    return 1;
  }
  if (actual !== expected) {
    console.error(`${outPath} は ${inPath} から生成される内容と一致しません。\`npm run ui -- gen ${inPath} ${outPath}\` を実行してください。`);
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
      console.error("使い方: npm run ui -- gen <in.ui> <out.tsx>");
      console.error("       npm run ui -- fmt <in.ui>");
      console.error("       npm run ui -- check <in.ui> <out.tsx>");
      code = 1;
  }
  process.exit(code);
}

main();
