// U1-cli-messages.md。
//
// cli.tsはトップレベルでmain()を呼び、検証/生成の結果に応じてprocess.exit()する
// (bin/ui-forge.mjsのコメント参照)。そのためこのファイルをvitestの中でそのまま
// importすると、importした瞬間にテストプロセスごと終了してしまい使えない。
// 代わりに、利用者が実際に`npx ui-forge ...`で叩くのと同じ入口(bin/ui-forge.mjs)を
// 子プロセスで起動し、終了コードとstderrを見る。cli.ts自身をテスト用の形に
// 作り直さずに、実際の挙動をそのまま確認できる。
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatDocument } from "../core/format";
import type { UiDocument } from "../core/model";
import { generate } from "./generate";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const BIN_PATH = join(REPO_ROOT, "bin", "ui-forge.mjs");

/** `ui-forge <args...>`を子プロセスで実行し、終了コードとstderrを返す。 */
function runCli(args: string[]): { code: number; stderr: string } {
  const result = spawnSync(process.execPath, [BIN_PATH, ...args], { encoding: "utf-8" });
  return { code: result.status ?? -1, stderr: result.stderr };
}

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "ui-forge-cli-"));
  mkdirSync(join(dir, "examples", "generated"), { recursive: true });
  return dir;
}

const SAMPLE_DOC: UiDocument = {
  version: 1,
  component: "Sample",
  root: { id: "root", type: "Canvas" },
};

describe("check: 改行コードだけの違いは専用のメッセージになる", () => {
  it("受け入れ基準2: .uiがCRLFだけ違う場合、終了コード1・メッセージにCRLFと.gitattributesを含む", () => {
    const dir = makeTempDir();
    const uiPath = join(dir, "Dock.ui");
    const outPath = join(dir, "Dock.tsx");

    const normalized = formatDocument(SAMPLE_DOC);
    writeFileSync(uiPath, normalized.replace(/\n/g, "\r\n")); // 内容は同じ、改行だけCRLF化
    writeFileSync(outPath, "stub"); // 正規化チェック(2段目)で止まるので内容は見られない

    const { code, stderr } = runCli(["check", uiPath, outPath]);
    expect(code).toBe(1);
    expect(stderr).toContain("CRLF");
    expect(stderr).toContain(".gitattributes");
    expect(stderr).toContain("*.ui text eol=lf");
  });

  it("内容そのものが違う場合は、CRLFとは言わず従来の「正規化されていません」のまま", () => {
    const dir = makeTempDir();
    const uiPath = join(dir, "Dock.ui");
    const outPath = join(dir, "Dock.tsx");

    writeFileSync(uiPath, JSON.stringify(SAMPLE_DOC)); // キー順が正規化と違う(改行の問題ではない)
    writeFileSync(outPath, "stub");

    const { code, stderr } = runCli(["check", uiPath, outPath]);
    expect(code).toBe(1);
    expect(stderr).not.toContain("CRLF");
    expect(stderr).toContain("は正規化されていません");
    expect(stderr).toContain("ui-forge fmt");
  });

  it("生成物の比較でも同じ判定をする(改行だけの違いならCRLF/.gitattributesの案内)", () => {
    const dir = makeTempDir();
    const uiPath = join(dir, "Dock.ui");
    const outPath = join(dir, "Dock.generated.tsx");

    writeFileSync(uiPath, formatDocument(SAMPLE_DOC)); // .ui側は正規化済み(LF)
    // generate()が実際に書く内容と同じだが、改行だけCRLF化した生成物を用意する
    // (cli.tsのcmdCheckもgenerate(doc, inPath)と同じ呼び方で期待値を作るので一致する)。
    const expected = generate(SAMPLE_DOC, uiPath);
    writeFileSync(outPath, expected.replace(/\n/g, "\r\n"));

    const { code, stderr } = runCli(["check", uiPath, outPath]);
    expect(code).toBe(1);
    expect(stderr).toContain("CRLF");
    expect(stderr).toContain(".gitattributes");
    expect(stderr).toContain("*.generated.tsx text eol=lf");
  });
});

describe("案内のコマンド名は ui-forge <サブコマンド> <パス> の形", () => {
  it("受け入れ基準3: checkの失敗案内に npm run ui が含まれない", () => {
    const dir = makeTempDir();
    const uiPath = join(dir, "Dock.ui");
    const outPath = join(dir, "Dock.tsx");
    writeFileSync(uiPath, JSON.stringify(SAMPLE_DOC));
    writeFileSync(outPath, "stub");

    const { stderr } = runCli(["check", uiPath, outPath]);
    expect(stderr).not.toContain("npm run ui");
    expect(stderr).toContain("ui-forge fmt");
  });

  it("outPathが見つからない場合の案内も ui-forge gen の形で、npm run ui を含まない", () => {
    const dir = makeTempDir();
    const uiPath = join(dir, "Dock.ui");
    const outPath = join(dir, "missing.tsx");
    writeFileSync(uiPath, formatDocument(SAMPLE_DOC));

    const { code, stderr } = runCli(["check", uiPath, outPath]);
    expect(code).toBe(1);
    expect(stderr).not.toContain("npm run ui");
    expect(stderr).toContain("ui-forge gen");
  });

  it("使い方(usage)の表示に npm run ui が含まれず、ui-forge <サブコマンド> の形になっている", () => {
    const { code, stderr } = runCli([]);
    expect(code).toBe(1);
    expect(stderr).not.toContain("npm run ui");
    expect(stderr).toContain("ui-forge gen");
    expect(stderr).toContain("ui-forge fmt");
    expect(stderr).toContain("ui-forge check");
  });
});

describe("fmt: CRLFのファイルをLFに直して書き戻す", () => {
  it("改行コードがCRLFの.uiをfmtすると、LFで正規化されて上書きされる", () => {
    const dir = makeTempDir();
    const uiPath = join(dir, "Dock.ui");
    const normalized = formatDocument(SAMPLE_DOC);
    writeFileSync(uiPath, normalized.replace(/\n/g, "\r\n"));

    const { code } = runCli(["fmt", uiPath]);
    expect(code).toBe(0);
    expect(readFileSync(uiPath, "utf-8")).toBe(normalized);
  });
});
