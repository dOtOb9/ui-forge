#!/usr/bin/env node
// docs/book/src/ 以下の本文に出てくる GitHub リンク
// (https://github.com/dOtOb9/ui-forge/blob/main/<path>) が、実在するリポジトリ内の
// パスを指しているかを確認する。リポジトリはまだ GitHub 上には存在しないので、
// 「<repo prefix> を外した <path> が、このリポジトリのルートに実在するか」を
// ローカルのファイルシステムで確認する(B1-foundation.md 受け入れ基準3)。
//
// 使い方: node scripts/check-book-links.mjs
// 終了コード: 1つでも見つからないパスがあれば1、すべて実在すれば0。
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BOOK_SRC = join(REPO_ROOT, "docs", "book", "src");
const REPO_PREFIX = "https://github.com/dOtOb9/ui-forge/blob/main/";

function listMarkdownFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listMarkdownFiles(path);
    return entry.name.endsWith(".md") ? [path] : [];
  });
}

// Markdownのリンク [text](url) から、本スクリプトが見るべきurlだけを拾う。
// `#anchor` が付いていてもファイルパスの確認には関係ないので取り除く。
const LINK_PATTERN = /\]\((https:\/\/github\.com\/dOtOb9\/ui-forge\/blob\/main\/[^)#\s]+)(#[^)\s]*)?\)/g;

function extractLinks(text) {
  const links = [];
  for (const match of text.matchAll(LINK_PATTERN)) {
    links.push(match[1]);
  }
  return links;
}

function main() {
  const files = listMarkdownFiles(BOOK_SRC);
  const missing = [];
  let checkedCount = 0;

  for (const file of files) {
    const text = readFileSync(file, "utf-8");
    for (const url of extractLinks(text)) {
      checkedCount += 1;
      const relPath = url.slice(REPO_PREFIX.length);
      const absPath = join(REPO_ROOT, relPath);
      if (!existsSync(absPath)) {
        missing.push({ file: relative(REPO_ROOT, file), relPath, url });
      }
    }
  }

  if (missing.length > 0) {
    console.error(`実在しないパスを指すリンクが${missing.length}件見つかりました:\n`);
    for (const m of missing) {
      console.error(`  ${m.file}: ${m.relPath}`);
    }
    process.exit(1);
  }

  console.log(`OK: ${checkedCount}件のGitHubリンクすべてが実在するパスを指しています。`);
  process.exit(0);
}

main();
