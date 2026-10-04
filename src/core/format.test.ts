import { describe, expect, it } from "vitest";
import { differsOnlyByLineEndings, formatDocument, parseDocument } from "./format";
import type { UiDocument } from "./model";

// キーをわざとバラバラの順番で書いた入力。正規化はこの入力のキー順に一切
// 依存せず、常に同じ出力を作ることを確認する(受け入れ基準1・2)。
const SAMPLE_DOC: UiDocument = {
  version: 1,
  component: "Sample",
  $schema: "../schema/ui.schema.json",
  root: {
    type: "Canvas",
    id: "root",
    children: [
      {
        props: { padding: "sm", surface: "glass", shadow: true, radius: "full" },
        slot: { margin: "md", anchor: "bottom-center" },
        id: "panel",
        type: "Panel",
        children: [
          {
            id: "label",
            type: "Text",
            props: { size: "sm", text: "hello" },
          },
        ],
      },
    ],
  },
};

describe("formatDocument", () => {
  it("書き出すキーの順序が、文書もWidgetも固定である", () => {
    const text = formatDocument(SAMPLE_DOC);
    const json = JSON.parse(text);

    expect(Object.keys(json)).toEqual(["$schema", "version", "component", "root"]);
    expect(Object.keys(json.root)).toEqual(["id", "type", "children"]);

    const panel = json.root.children[0];
    expect(Object.keys(panel)).toEqual(["id", "type", "slot", "props", "children"]);
    // props/slotの中はアルファベット順。
    expect(Object.keys(panel.slot)).toEqual(["anchor", "margin"]);
    expect(Object.keys(panel.props)).toEqual(["padding", "radius", "shadow", "surface"]);
  });

  it("インデント2スペース・末尾改行1つ・LF で書き出す", () => {
    const text = formatDocument(SAMPLE_DOC);
    expect(text.endsWith("\n")).toBe(true);
    expect(text.endsWith("\n\n")).toBe(false);
    expect(text.includes("\r")).toBe(false);
    expect(text).toContain('  "version": 1,');
  });

  it("空のpropsやchildrenは書き出さない", () => {
    const doc: UiDocument = {
      version: 1,
      component: "Empty",
      root: { id: "root", type: "Canvas", props: {}, children: [] },
    };
    const text = formatDocument(doc);
    const json = JSON.parse(text);
    expect(Object.keys(json.root)).toEqual(["id", "type"]);
  });

  it("受け入れ基準1: format(parse(format(doc))) は format(doc) と一致する", () => {
    const once = formatDocument(SAMPLE_DOC);
    const twice = formatDocument(parseDocument(once));
    expect(twice).toBe(once);
  });

  it("受け入れ基準2: キー順をばらばらにしても正規化結果は同じになる", () => {
    const shuffledText = JSON.stringify(SAMPLE_DOC); // キー順は上の記述順そのまま(バラバラ)
    const canonical = formatDocument(parseDocument(shuffledText));
    // 別の書き方(キーの出現順を変えただけの同内容のJSON)から始めても一致する。
    const reordered = {
      root: SAMPLE_DOC.root,
      component: SAMPLE_DOC.component,
      $schema: SAMPLE_DOC.$schema,
      version: SAMPLE_DOC.version,
    };
    const canonicalFromReordered = formatDocument(parseDocument(JSON.stringify(reordered)));
    expect(canonicalFromReordered).toBe(canonical);
  });
});

// U1-cli-messages.md。cli.tsのcheckが「内容そのものが壊れている」のか
// 「改行コードだけ」なのかを区別するための判定関数。
describe("differsOnlyByLineEndings", () => {
  it("CRLFにしただけ(内容は同じ)ならtrue", () => {
    const lf = formatDocument(SAMPLE_DOC);
    const crlf = lf.replace(/\n/g, "\r\n");
    expect(differsOnlyByLineEndings(crlf, lf)).toBe(true);
  });

  it("完全に同じ文字列ならfalse(違いが無い)", () => {
    const lf = formatDocument(SAMPLE_DOC);
    expect(differsOnlyByLineEndings(lf, lf)).toBe(false);
  });

  it("改行コード以外にも差がある場合はfalse", () => {
    const lf = formatDocument(SAMPLE_DOC);
    const crlfAndMore = lf.replace(/\n/g, "\r\n").replace("Sample", "Other");
    expect(differsOnlyByLineEndings(crlfAndMore, lf)).toBe(false);
  });
});
