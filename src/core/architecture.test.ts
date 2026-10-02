import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// 受け入れ基準7: src/core/ 以下に react / @tauri-apps の import が無いこと。
// ADR-0001「src/core/ → src/codegen/ とsrc/preview/ の向きにだけ依存する」の
// 機械的なチェック。このテストファイル自身もsrc/core/に置くが、node:fsしか
// importしていないので違反しない。
const CORE_DIR = dirname(fileURLToPath(import.meta.url));

function listTsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listTsFiles(path);
    return entry.name.endsWith(".ts") ? [path] : [];
  });
}

describe("src/core/ の依存の向き", () => {
  it("react / @tauri-apps をimportしていない", () => {
    for (const file of listTsFiles(CORE_DIR)) {
      const text = readFileSync(file, "utf-8");
      expect(text, `${file} react`).not.toMatch(/from\s+["']react/);
      expect(text, `${file} tauri`).not.toMatch(/from\s+["']@tauri-apps/);
    }
  });
});
