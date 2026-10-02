import { describe, expect, it } from "vitest";
import { collectPropsMembers } from "./bindings";
import type { UiDocument } from "./model";

const DOC: UiDocument = {
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
        props: { padding: "xs", radius: "full", shadow: true, surface: { bind: "surface" } },
        children: [
          {
            id: "dock_buttons",
            type: "HBox",
            props: { gap: "xs" },
            children: [
              {
                id: "layer_button",
                type: "Button",
                props: { active: { bind: "layerOpen" }, label: "レイヤー", onClick: { event: "onToggleLayer" } },
              },
              {
                id: "info_button",
                type: "Button",
                props: { active: { bind: "infoOpen" }, label: "情報", onClick: { event: "onToggleInfo" } },
              },
              {
                id: "settings_button",
                type: "Button",
                props: { label: "設定", onClick: { event: "onOpenSettings" } },
              },
            ],
          },
        ],
      },
    ],
  },
};

describe("collectPropsMembers", () => {
  it("F1-foundation.mdのDockの例と同じ、アルファベット順の1本のリストを作る", () => {
    expect(collectPropsMembers(DOC)).toEqual([
      { kind: "bind", name: "infoOpen", valueKind: "boolean" },
      { kind: "bind", name: "layerOpen", valueKind: "boolean" },
      { kind: "event", name: "onOpenSettings" },
      { kind: "event", name: "onToggleInfo" },
      { kind: "event", name: "onToggleLayer" },
      { kind: "bind", name: "surface", valueKind: "surface" },
    ]);
  });
});
