import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { addChild, moveWidget, removeWidget, renameWidget, setProp, setSlot, type EditResult } from "./edit";
import { parseDocument } from "./format";
import { validate } from "./validate";
import type { UiDocument } from "./model";

const DOCK_UI_PATH = join(__dirname, "../../examples/Dock.ui");
const DOCK: UiDocument = parseDocument(readFileSync(DOCK_UI_PATH, "utf-8"));

/** 受け入れ基準1前半: 成功した結果がvalidateを通ることを確認する小さなヘルパー。 */
function expectValidOk(result: EditResult): UiDocument {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("unreachable");
  expect(validate(result.doc)).toEqual([]);
  return result.doc;
}

// 受け入れ基準1後半: 元の文書が変わっていないことを、JSON文字列の比較で確認する
// (元のdoc参照そのものをfreezeするのではなく、「内容が変わっていない」を見る)。
const DOCK_JSON_BEFORE = JSON.stringify(DOCK);
function expectDockUnchanged(): void {
  expect(JSON.stringify(DOCK)).toBe(DOCK_JSON_BEFORE);
}

describe("setProp", () => {
  it("成功: プロパティを設定する(validateを通り、元の文書は変わらない)", () => {
    const result = setProp(DOCK, "layer_button", "label", "レイヤー2");
    const doc = expectValidOk(result);
    expect(doc.root.children?.[0].children?.[0].children?.[0].props).toMatchObject({ label: "レイヤー2" });
    expectDockUnchanged();
  });

  it("成功: valueがundefinedならプロパティを削除する", () => {
    const result = setProp(DOCK, "dock", "shadow", undefined);
    const doc = expectValidOk(result);
    const dock = doc.root.children?.[0];
    expect(dock?.props).not.toHaveProperty("shadow");
    expectDockUnchanged();
  });

  it("不正: 存在しないidはok:falseと理由を返す", () => {
    const result = setProp(DOCK, "no_such_id", "label", "x");
    expect(result).toEqual({ ok: false, reason: expect.stringContaining("no_such_id") });
    expectDockUnchanged();
  });
});

describe("setSlot", () => {
  it("成功: slotを設定する", () => {
    const result = setSlot(DOCK, "dock", { anchor: "top-left" });
    const doc = expectValidOk(result);
    expect(doc.root.children?.[0].slot).toEqual({ anchor: "top-left" });
    expectDockUnchanged();
  });

  it("成功: undefinedでslotを削除する", () => {
    const result = setSlot(DOCK, "dock", undefined);
    const doc = expectValidOk(result);
    expect(doc.root.children?.[0].slot).toBeUndefined();
    expectDockUnchanged();
  });

  it("不正: 親がCanvasでない部品にslotを設定できない", () => {
    const result = setSlot(DOCK, "layer_button", { anchor: "center" });
    expect(result).toEqual({ ok: false, reason: expect.stringContaining("layer_button") });
    expectDockUnchanged();
  });
});

describe("renameWidget", () => {
  it("成功: idを変える", () => {
    const result = renameWidget(DOCK, "layer_button", "layer_btn");
    const doc = expectValidOk(result);
    expect(doc.root.children?.[0].children?.[0].children?.[0].id).toBe("layer_btn");
    expectDockUnchanged();
  });

  it("不正: 既存のidに改名できない", () => {
    const result = renameWidget(DOCK, "layer_button", "info_button");
    expect(result).toEqual({ ok: false, reason: expect.stringContaining("info_button") });
    expectDockUnchanged();
  });

  it("不正: snake_caseでないidには改名できない", () => {
    const result = renameWidget(DOCK, "layer_button", "LayerButton");
    expect(result.ok).toBe(false);
    expectDockUnchanged();
  });
});

describe("addChild", () => {
  it("成功: コンテナの末尾に新しい部品を足す", () => {
    const result = addChild(DOCK, "dock_buttons", "Text");
    const doc = expectValidOk(result);
    const buttons = doc.root.children?.[0].children?.[0].children ?? [];
    expect(buttons.at(-1)).toMatchObject({ id: "text_1", type: "Text" });
    expectDockUnchanged();
  });

  it("成功: 親がCanvasなら既定のslotを付ける", () => {
    const result = addChild(DOCK, "root", "Text");
    const doc = expectValidOk(result);
    expect(doc.root.children?.at(-1)).toMatchObject({ type: "Text", slot: { anchor: "center" } });
    expectDockUnchanged();
  });

  it("受け入れ基準2: 同じ型を3回足すと、idが文書内で一意になる", () => {
    let doc = DOCK;
    const addedIds: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const result = addChild(doc, "dock_buttons", "Text");
      doc = expectValidOk(result);
      const buttons = doc.root.children?.[0].children?.[0].children ?? [];
      addedIds.push(buttons.at(-1)!.id);
    }
    expect(addedIds).toEqual(["text_1", "text_2", "text_3"]);
    expect(new Set(addedIds).size).toBe(3);
    expectDockUnchanged();
  });

  it("不正: コンテナでない部品には追加できない", () => {
    const result = addChild(DOCK, "layer_button", "Text");
    expect(result.ok).toBe(false);
    expectDockUnchanged();
  });

  it("不正: 子を持つPanelへの2つ目の追加はできない", () => {
    const result = addChild(DOCK, "dock", "Text");
    expect(result.ok).toBe(false);
    expectDockUnchanged();
  });
});

describe("removeWidget", () => {
  it("成功: 部品を子ごと消す", () => {
    const result = removeWidget(DOCK, "dock");
    const doc = expectValidOk(result);
    expect(doc.root.children).toEqual([]);
    expectDockUnchanged();
  });

  it("不正: rootは消せない", () => {
    const result = removeWidget(DOCK, "root");
    expect(result).toEqual({ ok: false, reason: expect.stringContaining("root") });
    expectDockUnchanged();
  });
});

describe("moveWidget", () => {
  it("成功: 同じ親の中で前後に動かす", () => {
    const result = moveWidget(DOCK, "info_button", -1);
    const doc = expectValidOk(result);
    const ids = (doc.root.children?.[0].children?.[0].children ?? []).map((w) => w.id);
    expect(ids).toEqual(["info_button", "layer_button", "settings_button"]);
    expectDockUnchanged();
  });

  it("端なら何もしない", () => {
    const result = moveWidget(DOCK, "layer_button", -1);
    const doc = expectValidOk(result);
    const ids = (doc.root.children?.[0].children?.[0].children ?? []).map((w) => w.id);
    expect(ids).toEqual(["layer_button", "info_button", "settings_button"]);
    expectDockUnchanged();
  });

  it("不正: 存在しないidは動かせない", () => {
    const result = moveWidget(DOCK, "no_such_id", 1);
    expect(result.ok).toBe(false);
    expectDockUnchanged();
  });
});
