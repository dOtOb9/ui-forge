import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderDocument } from "./render";
import { parseDocument } from "../core/format";
import { Dock, type DockProps } from "../../examples/generated/Dock";

const DOCK_UI_PATH = join(__dirname, "../../examples/Dock.ui");
const doc = parseDocument(readFileSync(DOCK_UI_PATH, "utf-8"));

const noop = () => {};

const CASES: DockProps[] = [
  { surface: "glass", layerOpen: true, infoOpen: false, onOpenSettings: noop, onToggleInfo: noop, onToggleLayer: noop },
  { surface: "opaque", layerOpen: false, infoOpen: true, onOpenSettings: noop, onToggleInfo: noop, onToggleLayer: noop },
  { surface: "none", layerOpen: true, infoOpen: true, onOpenSettings: noop, onToggleInfo: noop, onToggleLayer: noop },
];

describe("renderDocument と生成されたコンポーネントのHTML一致(受け入れ基準5)", () => {
  it.each(CASES)("values=%o で一致する", (props) => {
    const fromGenerated = renderToStaticMarkup(<Dock {...props} />);

    const values = { surface: props.surface, layerOpen: props.layerOpen, infoOpen: props.infoOpen };
    const handlers = {
      onOpenSettings: props.onOpenSettings,
      onToggleInfo: props.onToggleInfo,
      onToggleLayer: props.onToggleLayer,
    };
    const fromPreview = renderToStaticMarkup(renderDocument(doc, values, handlers));

    expect(fromPreview).toBe(fromGenerated);
  });
});
