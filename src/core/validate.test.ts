import { describe, expect, it } from "vitest";
import { validate } from "./validate";

// 受け入れ基準3: 検証が拒否する8ケース、それぞれpathが正しいことも確認する。
describe("validate", () => {
  it("正しい文書はエラー0件", () => {
    const doc = {
      version: 1,
      component: "Dock",
      root: {
        id: "root",
        type: "Canvas",
        children: [
          {
            id: "dock",
            type: "Panel",
            slot: { anchor: "bottom-center", margin: "md" },
            props: { padding: "xs", radius: "full", shadow: true, surface: "glass" },
            children: [
              {
                id: "dock_buttons",
                type: "HBox",
                props: { gap: "xs" },
                children: [{ id: "layer_button", type: "Button", props: { label: "レイヤー" } }],
              },
            ],
          },
        ],
      },
    };
    expect(validate(doc)).toEqual([]);
  });

  it("idの重複", () => {
    const doc = {
      version: 1,
      component: "Dock",
      root: {
        id: "root",
        type: "HBox",
        children: [
          { id: "dup", type: "Text", props: { text: "a" } },
          { id: "dup", type: "Text", props: { text: "b" } },
        ],
      },
    };
    const errors = validate(doc);
    expect(errors).toContainEqual(
      expect.objectContaining({ path: "/root/children/1/id" }),
    );
  });

  it("未知のtype", () => {
    const doc = {
      version: 1,
      component: "Dock",
      root: { id: "root", type: "Grid" },
    };
    const errors = validate(doc);
    expect(errors).toContainEqual(expect.objectContaining({ path: "/root/type" }));
  });

  it("未知の列挙値", () => {
    const doc = {
      version: 1,
      component: "Dock",
      root: {
        id: "root",
        type: "Canvas",
        children: [
          {
            id: "dock",
            type: "Panel",
            children: [
              {
                id: "dock_buttons",
                type: "HBox",
                props: { gap: "huge" },
                children: [],
              },
            ],
          },
        ],
      },
    };
    const errors = validate(doc);
    // 受け入れ基準10で使われるのと同じpathで確認する。
    expect(errors).toContainEqual(
      expect.objectContaining({ path: "/root/children/0/children/0/props/gap" }),
    );
  });

  it("非コンテナにchildren", () => {
    const doc = {
      version: 1,
      component: "Dock",
      root: {
        id: "root",
        type: "Text",
        props: { text: "hi" },
        children: [{ id: "oops", type: "Text", props: { text: "oops" } }],
      },
    };
    const errors = validate(doc);
    expect(errors).toContainEqual(expect.objectContaining({ path: "/root/children" }));
  });

  it("Panelの子が2つ以上", () => {
    const doc = {
      version: 1,
      component: "Dock",
      root: {
        id: "root",
        type: "Panel",
        children: [
          { id: "a", type: "Text", props: { text: "a" } },
          { id: "b", type: "Text", props: { text: "b" } },
        ],
      },
    };
    const errors = validate(doc);
    expect(errors).toContainEqual(expect.objectContaining({ path: "/root/children" }));
  });

  it("親がCanvasでないのにslot", () => {
    const doc = {
      version: 1,
      component: "Dock",
      root: {
        id: "root",
        type: "HBox",
        children: [
          {
            id: "child",
            type: "Text",
            slot: { anchor: "center" },
            props: { text: "x" },
          },
        ],
      },
    };
    const errors = validate(doc);
    expect(errors).toContainEqual(expect.objectContaining({ path: "/root/children/0/slot" }));
  });

  it("同じbind名の型の不一致", () => {
    const doc = {
      version: 1,
      component: "Dock",
      root: {
        id: "root",
        type: "HBox",
        children: [
          { id: "a", type: "Button", props: { active: { bind: "x" }, label: "a" } },
          { id: "b", type: "Button", props: { label: { bind: "x" } } },
        ],
      },
    };
    const errors = validate(doc);
    expect(errors).toContainEqual(
      expect.objectContaining({ path: "/root/children/1/props/label" }),
    );
  });

  // I0-viewer-readiness.md 受け入れ基準4: 不正なlayer/textSizeが検証エラーになり、pathが正しい。
  it("不正なlayer", () => {
    const doc = {
      version: 1,
      component: "Dock",
      root: { id: "root", type: "Canvas", props: { layer: "top" } },
    };
    const errors = validate(doc);
    expect(errors).toContainEqual(expect.objectContaining({ path: "/root/props/layer" }));
  });

  it("不正なtextSize", () => {
    const doc = {
      version: 1,
      component: "Dock",
      root: { id: "root", type: "Panel", props: { textSize: "huge" } },
    };
    const errors = validate(doc);
    expect(errors).toContainEqual(expect.objectContaining({ path: "/root/props/textSize" }));
  });

  it('onで始まらないevent名', () => {
    const doc = {
      version: 1,
      component: "Dock",
      root: {
        id: "root",
        type: "Button",
        props: { label: "x", onClick: { event: "toggleLayer" } },
      },
    };
    const errors = validate(doc);
    expect(errors).toContainEqual(
      expect.objectContaining({ path: "/root/props/onClick/event" }),
    );
  });
});
