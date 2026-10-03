import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { generate } from "./generate";
import { parseDocument } from "../core/format";
import type { UiDocument } from "../core/model";
import { Dock } from "../../examples/generated/Dock";

const DOCK_UI_PATH = join(__dirname, "../../examples/Dock.ui");
const DOCK_TSX_PATH = join(__dirname, "../../examples/generated/Dock.tsx");

// I0-viewer-readiness.md 受け入れ基準3: layer/textSizeを省略した文書の生成物は、
// この変更(I-0)より前と1文字も変わらない。examples/Dock.ui自体はこの変更で
// layer/textSizeを足したので、ここでは「足す前のDock.ui」と同じ形(layer/textSize
// を一切書かない文書)を別に用意し、I-0より前にコミットされていた
// examples/generated/Dock.tsx(このテストを書いた時点のgit履歴)と1文字単位で
// 一致することを確認する。
const DOCK_WITHOUT_NEW_PROPS: UiDocument = {
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
              { id: "layer_button", type: "Button", props: { active: { bind: "layerOpen" }, label: "レイヤー", onClick: { event: "onToggleLayer" } } },
              { id: "info_button", type: "Button", props: { active: { bind: "infoOpen" }, label: "情報", onClick: { event: "onToggleInfo" } } },
              { id: "settings_button", type: "Button", props: { label: "設定", onClick: { event: "onOpenSettings" } } },
            ],
          },
        ],
      },
    ],
  },
};

const DOCK_TSX_BEFORE_I0 = `// 生成物: examples/Dock.ui から ui-forge が生成。手で編集しないこと。
// 変更は examples/Dock.ui に対して行い、\`npm run ui -- gen\` で作り直す。

export interface DockProps {
  infoOpen: boolean;
  layerOpen: boolean;
  onOpenSettings: () => void;
  onToggleInfo: () => void;
  onToggleLayer: () => void;
  surface: "glass" | "opaque" | "none";
}

export function Dock(props: DockProps) {
  return (
    <div data-ui-id="root" className="pointer-events-none fixed inset-0">
      <div data-ui-id="dock" className={\`pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full p-1.5 shadow-lg\${props.surface === "glass" ? " backdrop-blur-md bg-white/65 text-slate-900 border border-black/10 dark:bg-slate-950/70 dark:text-slate-100 dark:border-white/10" : props.surface === "opaque" ? " bg-white text-slate-900 border border-black/10 dark:bg-slate-950 dark:text-slate-100 dark:border-white/10" : ""}\`}>
        <div data-ui-id="dock_buttons" className="flex gap-1 items-stretch">
          <button type="button" data-ui-id="layer_button" className={\`rounded-full px-3 py-1.5\${props.layerOpen ? " bg-slate-900 text-white dark:bg-white dark:text-slate-900" : " hover:bg-black/5 dark:hover:bg-white/10"}\`} onClick={props.onToggleLayer}>
            レイヤー
          </button>
          <button type="button" data-ui-id="info_button" className={\`rounded-full px-3 py-1.5\${props.infoOpen ? " bg-slate-900 text-white dark:bg-white dark:text-slate-900" : " hover:bg-black/5 dark:hover:bg-white/10"}\`} onClick={props.onToggleInfo}>
            情報
          </button>
          <button type="button" data-ui-id="settings_button" className="rounded-full px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10" onClick={props.onOpenSettings}>
            設定
          </button>
        </div>
      </div>
    </div>
  );
}
`;

describe("generate", () => {
  it("受け入れ基準4: examples/Dock.uiから生成した文字列がexamples/generated/Dock.tsxと一致する", () => {
    const doc = parseDocument(readFileSync(DOCK_UI_PATH, "utf-8"));
    const generated = generate(doc, "examples/Dock.ui");
    const committed = readFileSync(DOCK_TSX_PATH, "utf-8");
    expect(generated).toBe(committed);
  });

  it("I0-viewer-readiness.md 受け入れ基準3: layer/textSizeを省略すると、I-0より前と1文字も変わらない出力になる", () => {
    const generated = generate(DOCK_WITHOUT_NEW_PROPS, "examples/Dock.ui");
    expect(generated).toBe(DOCK_TSX_BEFORE_I0);
  });

  it("受け入れ基準6: 生成物のクラス文字列(ダブルクォートの中身)に${を含むものが無い", () => {
    const text = readFileSync(DOCK_TSX_PATH, "utf-8");
    const quoted = text.match(/"[^"]*"/g) ?? [];
    expect(quoted.length).toBeGreaterThan(0);
    for (const q of quoted) {
      expect(q).not.toContain("${");
    }
  });

  // I0-viewer-readiness.md 受け入れ基準2: 本体(point-cloud-viewer)のDock.tsxの
  // ドックのクラスのうち、fixed/flex/gap-1/z-20を除くすべてが生成物のdockに
  // 含まれる。z-20はroot(構造が1段深いのでCanvas側)に、flex/gap-1はdock_buttons
  // (HBox側)に付く。期待するクラスは本体Dock.tsxから書き写した直書き。
  it("受け入れ基準2: 生成したDockのクラスが本体Dock.tsxのドックのクラスを(構造の差を踏まえて)含む", () => {
    const html = renderToStaticMarkup(
      createElement(Dock, {
        surface: "glass",
        layerOpen: false,
        infoOpen: false,
        onOpenSettings: () => {},
        onToggleInfo: () => {},
        onToggleLayer: () => {},
      }),
    );

    function classesOf(id: string): string[] {
      const m = html.match(new RegExp(`data-ui-id="${id}" class="([^"]*)"`));
      if (m === null) throw new Error(`data-ui-id="${id}" の要素が見つからない`);
      return m[1].split(" ").filter((c) => c.length > 0);
    }

    const BODY_DOCK_CLASS =
      "pointer-events-auto fixed bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-1 rounded-full p-1.5 text-sm shadow-lg";
    const EXCLUDED_FROM_DOCK = new Set(["fixed", "flex", "gap-1", "z-20"]);
    const expectedOnDock = BODY_DOCK_CLASS.split(" ").filter((c) => !EXCLUDED_FROM_DOCK.has(c));

    const dockClasses = classesOf("dock");
    for (const expected of expectedOnDock) {
      expect(dockClasses, `"dock"に"${expected}"が無い`).toContain(expected);
    }
    expect(classesOf("root")).toContain("z-20");
    expect(classesOf("dock_buttons")).toContain("flex");
    expect(classesOf("dock_buttons")).toContain("gap-1");
  });
});
