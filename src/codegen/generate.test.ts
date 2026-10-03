import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generate } from "./generate";
import { parseDocument } from "../core/format";

const DOCK_UI_PATH = join(__dirname, "../../examples/Dock.ui");
const DOCK_TSX_PATH = join(__dirname, "../../examples/generated/Dock.tsx");

describe("generate", () => {
  it("受け入れ基準4: examples/Dock.uiから生成した文字列がexamples/generated/Dock.tsxと一致する", () => {
    const doc = parseDocument(readFileSync(DOCK_UI_PATH, "utf-8"));
    const generated = generate(doc, "examples/Dock.ui");
    const committed = readFileSync(DOCK_TSX_PATH, "utf-8");
    expect(generated).toBe(committed);
  });

  it("受け入れ基準6: 生成物のクラス文字列(ダブルクォートの中身)に${を含むものが無い", () => {
    const text = readFileSync(DOCK_TSX_PATH, "utf-8");
    const quoted = text.match(/"[^"]*"/g) ?? [];
    expect(quoted.length).toBeGreaterThan(0);
    for (const q of quoted) {
      expect(q).not.toContain("${");
    }
  });
});
