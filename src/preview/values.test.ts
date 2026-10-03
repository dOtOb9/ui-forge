import { describe, expect, it } from "vitest";
import { reconcileValues } from "./values";
import type { PropsMember } from "../core/bindings";

describe("reconcileValues", () => {
  it("F1-foundation.mdが指定する初期値(boolean=false, 列挙=最初の値, string=bind名)", () => {
    const members: PropsMember[] = [
      { kind: "bind", name: "layerOpen", valueKind: "boolean" },
      { kind: "bind", name: "surface", valueKind: "surface" },
      { kind: "bind", name: "title", valueKind: "string" },
    ];
    expect(reconcileValues(members, {})).toEqual({
      layerOpen: false,
      surface: "glass",
      title: "title",
    });
  });

  it("既存の値は(型が一致する限り)引き継ぐ", () => {
    const members: PropsMember[] = [{ kind: "bind", name: "layerOpen", valueKind: "boolean" }];
    expect(reconcileValues(members, { layerOpen: true })).toEqual({ layerOpen: true });
  });

  it("型が変わっていたら既定値に戻す", () => {
    const members: PropsMember[] = [{ kind: "bind", name: "layerOpen", valueKind: "boolean" }];
    // 直前まで文字列用のbindだった名前が、再読み込み後は真偽値用になったケース。
    expect(reconcileValues(members, { layerOpen: "layerOpen" })).toEqual({ layerOpen: false });
  });

  it("eventのメンバーは無視する", () => {
    const members: PropsMember[] = [{ kind: "event", name: "onToggleLayer" }];
    expect(reconcileValues(members, {})).toEqual({});
  });
});
