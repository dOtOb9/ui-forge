import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// 受け入れ基準7: src/core/ 以下に react / @tauri-apps の import が無いこと。
// ADR-0001「src/core/ → src/codegen/ とsrc/preview/ の向きにだけ依存する」の
// 機械的なチェック。このテストファイル自身もsrc/core/に置くが、node:fsしか
// importしていないので違反しない。
const CORE_DIR = dirname(fileURLToPath(import.meta.url));

// 受け入れ基準3ではPreviewApp.tsxのような.tsxも対象にする必要があるため、
// .ts/.tsx両方を拾う(受け入れ基準7の対象であるsrc/core/には.tsxが無いので、
// 最初のdescribeの結果は変わらない)。
function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("src/core/ の依存の向き", () => {
  it("react / @tauri-apps をimportしていない", () => {
    for (const file of listSourceFiles(CORE_DIR)) {
      const text = readFileSync(file, "utf-8");
      expect(text, `${file} react`).not.toMatch(/from\s+["']react/);
      expect(text, `${file} tauri`).not.toMatch(/from\s+["']@tauri-apps/);
    }
  });
});

// P1-platforms.md 受け入れ基準3: @tauri-apps/ をimportしてよいのは
// src/preview/host/tauri-*.ts だけ(point-cloud-viewerの規約2と同じ考え方。
// Web版のビルドにTauriの呼び出しが紛れ込まないようにするため)。
// listSourceFilesはCORE_DIR(src/core)を起点に再帰するので、1つ上のsrc/に
// 上がって全体を対象にする。
const SRC_DIR = join(CORE_DIR, "..");
const TAURI_IMPORT_ALLOWED = /[/\\]host[/\\]tauri-[^/\\]+\.tsx?$/;

describe("Tauriのimportの閉じ込め(P1-platforms.md 受け入れ基準3)", () => {
  it("@tauri-apps/ をimportしているのはsrc/preview/host/tauri-*.tsだけ", () => {
    const offenders = listSourceFiles(SRC_DIR)
      .filter((file) => /from\s+["']@tauri-apps/.test(readFileSync(file, "utf-8")))
      .filter((file) => !TAURI_IMPORT_ALLOWED.test(file));
    expect(offenders).toEqual([]);
  });
});
