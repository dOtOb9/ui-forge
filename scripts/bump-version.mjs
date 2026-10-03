#!/usr/bin/env node
// D1-delivery.md D1-3。リリースの版を上げるとき、package.json・
// src-tauri/tauri.conf.json・src-tauri/Cargo.tomlの3か所を手で揃えるのは
// 間違えやすい(打ち間違いがあるとrelease.ymlのcheck-versionジョブが
// タグpush時に初めて気付く)。この3ファイルの`version`を1回で書き換える。
//
// 使い方: node scripts/bump-version.mjs <版>  (例: node scripts/bump-version.mjs 0.1.0)
//
// JSON.parse→再シリアライズではなく、各ファイルの`"version": "..."`/
// `version = "..."`の行だけを正規表現で置き換える。JSONを丸ごと書き直すと
// インデントやキーの並び順が変わってしまい、版の変更以外の差分が
// コミットに混ざる(読みやすさを損なう)ため。同じ版を指定して2回実行しても
// 差分が出ない(受け入れ基準2)のは、この行単位の置き換えが入力に依存せず
// 同じ出力になるため。
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// semver相当(x.y.z)だけを受け付ける。タグ(`v0.1.0`)の`v`を含めるミスを
// ここで止める(check-versionジョブはタグから`v`を剥がした上でこの版と
// 比較するため、`v`付きで揃えてしまうと必ず不一致になる)。
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

function replaceOnce(text, pattern, replacement, filePath) {
  const matches = text.match(pattern);
  if (!matches) {
    throw new Error(`${filePath}: versionの行が見つかりませんでした(パターン: ${pattern})`);
  }
  if (matches.length > 1) {
    throw new Error(
      `${filePath}: versionの行が${matches.length}箇所に一致しました。1箇所だけに一致するはずです。`,
    );
  }
  return text.replace(pattern, replacement);
}

function bumpJsonVersion(relPath, version) {
  const filePath = join(REPO_ROOT, relPath);
  const text = readFileSync(filePath, "utf-8");
  // package.json/tauri.conf.jsonはどちらもトップレベルに1つだけ
  // `"version": "x.y.z"`を持つ(package.jsonのdependenciesの版表記は
  // `"^1.2.3"`のようにキー名が"version"にならないため、このパターンに
  // 他が引っかかることはない)。
  const pattern = /"version":\s*"\d+\.\d+\.\d+"/;
  const updated = replaceOnce(text, pattern, `"version": "${version}"`, relPath);
  writeFileSync(filePath, updated);
}

function bumpCargoVersion(relPath, version) {
  const filePath = join(REPO_ROOT, relPath);
  const text = readFileSync(filePath, "utf-8");
  // Cargo.tomlの[package]直下のversionは行頭(`^`)から始まる
  // `version = "x.y.z"`になる(依存先の`version = "..."`はキーの前に
  // インデントや`tauri = { version = ...`のように同じ行に他のキーが
  // 並ぶため、行頭一致には引っかからない)。
  const pattern = /^version = "\d+\.\d+\.\d+"$/m;
  const updated = replaceOnce(text, pattern, `version = "${version}"`, relPath);
  writeFileSync(filePath, updated);
}

function main() {
  const version = process.argv[2];
  if (!version) {
    console.error("使い方: node scripts/bump-version.mjs <版>  (例: 0.1.0)");
    process.exit(1);
  }
  if (!VERSION_PATTERN.test(version)) {
    console.error(`版はx.y.z形式で指定してください(先頭に'v'を付けない)。受け取った値: ${version}`);
    process.exit(1);
  }

  bumpJsonVersion("package.json", version);
  bumpJsonVersion("src-tauri/tauri.conf.json", version);
  bumpCargoVersion("src-tauri/Cargo.toml", version);

  console.log(`OK: package.json / src-tauri/tauri.conf.json / src-tauri/Cargo.toml を version ${version} にしました。`);
}

main();
