// 受け入れ基準3: vocabulary.tsが、スキーマの全部品の型についてスキーマに
// 書かれた全プロパティを返すこと(型の一覧はmodel.tsのWidgetTypeと照合する)。
// スキーマにプロパティを1つ足したら自動で出てくることを、テスト内でスキーマの
// コピーを加工して確認する。
import { describe, expect, it, vi } from "vitest";
import realSchema from "../../schema/ui.schema.json";
import { ALL_WIDGET_TYPES } from "./model";

// 今のF1-foundation.mdの部品表(語彙v1)どおりの、型ごとのプロパティ名の一覧。
// ALL_WIDGET_TYPESをすべて網羅しているので、model.tsのWidgetTypeに型が増えて
// この一覧を更新し忘れると、該当の型がexpectedに無くfieldsFor側だけ結果を返す
// ことになり、このテストの`for`ループが未定義アクセスで落ちて気づける。
const EXPECTED_PROP_NAMES: Record<string, string[]> = {
  Canvas: [],
  HBox: ["align", "gap", "padding"],
  VBox: ["align", "gap", "padding"],
  Panel: ["padding", "radius", "shadow", "surface"],
  Text: ["size", "text"],
  Button: ["active", "label", "onClick"],
};

describe("fieldsFor", () => {
  it("すべての部品の型について、スキーマに書かれた全プロパティを返す", async () => {
    const { fieldsFor } = await import("./vocabulary");
    for (const type of ALL_WIDGET_TYPES) {
      const names = fieldsFor(type)
        .map((f) => f.name)
        .sort();
      expect(names).toEqual([...EXPECTED_PROP_NAMES[type]].sort());
    }
  });

  it("bind可のプロパティはbindable:trueを返す", async () => {
    const { fieldsFor } = await import("./vocabulary");
    const button = fieldsFor("Button");
    expect(button.find((f) => f.name === "label")).toMatchObject({ kind: "string", bindable: true });
    expect(button.find((f) => f.name === "active")).toMatchObject({ kind: "boolean", bindable: true });
    expect(button.find((f) => f.name === "onClick")).toMatchObject({ kind: "event", bindable: false });

    const panel = fieldsFor("Panel");
    expect(panel.find((f) => f.name === "surface")).toMatchObject({
      kind: "enum",
      options: ["glass", "opaque", "none"],
      bindable: true,
    });
    expect(panel.find((f) => f.name === "shadow")).toMatchObject({ kind: "boolean", bindable: false });
  });

  // 受け入れ基準3後半: スキーマにプロパティを1つ足すと、再読み込みしたvocabulary.ts
  // が自動でそれを返すこと。並行して進んでいるI-0がCanvas.layer/Panel.textSizeを
  // 本当に足したときにDetailsへ無改造で出てくることの、事前の検証になる。
  it("スキーマにプロパティを1つ足すと、fieldsForが自動でそれを返す", async () => {
    const patched = structuredClone(realSchema) as typeof realSchema & {
      $defs: { widget: { allOf: { if: { properties: { type: { const?: string } } } }[] } };
    };
    const buttonBranch = patched.$defs.widget.allOf.find(
      (branch) => branch.if.properties.type.const === "Button",
    ) as unknown as { then: { properties: { props: { properties: Record<string, unknown> } } } };
    buttonBranch.then.properties.props.properties.extraTestProp = { type: "boolean" };

    vi.resetModules();
    vi.doMock("../../schema/ui.schema.json", () => ({ default: patched }));
    try {
      const { fieldsFor } = await import("./vocabulary");
      const names = fieldsFor("Button").map((f) => f.name);
      expect(names).toContain("extraTestProp");
    } finally {
      vi.doUnmock("../../schema/ui.schema.json");
      vi.resetModules();
    }
  });
});

describe("slotFields", () => {
  it("anchor/marginを返す", async () => {
    const { slotFields } = await import("./vocabulary");
    const names = slotFields()
      .map((f) => f.name)
      .sort();
    expect(names).toEqual(["anchor", "margin"]);
  });
});
