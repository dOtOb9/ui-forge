// 受け入れ基準4: Undo / Redo / 新しい編集でRedoが消える / 上限100 /
// 同じテキストを続けて積まない。
import { describe, expect, it } from "vitest";
import { canRedo, canUndo, currentText, initHistory, pushHistory, redo, undo } from "./history";

describe("history", () => {
  it("Undo / Redoで前後に移動する", () => {
    let h = initHistory("a");
    h = pushHistory(h, "b");
    h = pushHistory(h, "c");
    expect(currentText(h)).toBe("c");

    h = undo(h);
    expect(currentText(h)).toBe("b");
    h = undo(h);
    expect(currentText(h)).toBe("a");

    h = redo(h);
    expect(currentText(h)).toBe("b");
    h = redo(h);
    expect(currentText(h)).toBe("c");
  });

  it("先頭でUndo、末尾でRedoは何もしない", () => {
    let h = initHistory("a");
    h = pushHistory(h, "b");

    const atStart = undo(undo(h));
    expect(currentText(atStart)).toBe("a");
    expect(canUndo(atStart)).toBe(false);
    expect(undo(atStart)).toBe(atStart); // 参照が変わらない(何もしない)。

    const atEnd = redo(redo(h));
    expect(currentText(atEnd)).toBe("b");
    expect(canRedo(atEnd)).toBe(false);
    expect(redo(atEnd)).toBe(atEnd);
  });

  it("Undoした後に新しい編集を積むと、Redoが消える", () => {
    let h = initHistory("a");
    h = pushHistory(h, "b");
    h = pushHistory(h, "c");
    h = undo(h); // "b"に戻る。"c"はまだRedoできる。
    expect(canRedo(h)).toBe(true);

    h = pushHistory(h, "d"); // 新しい編集。"c"へのRedoは消える。
    expect(currentText(h)).toBe("d");
    expect(canRedo(h)).toBe(false);

    h = undo(h);
    expect(currentText(h)).toBe("b"); // "c"には戻れない。
  });

  it("同じテキストを続けて積まない", () => {
    let h = initHistory("a");
    h = pushHistory(h, "a"); // 変化なし。積まれない。
    expect(h.stack).toEqual(["a"]);
    expect(canUndo(h)).toBe(false);

    h = pushHistory(h, "b");
    const beforeNoop = h;
    h = pushHistory(h, "b"); // 直前と同じ。積まれない。
    expect(h).toBe(beforeNoop);
    expect(h.stack).toEqual(["a", "b"]);
  });

  it("上限100件を超えたら古い方から捨てる", () => {
    let h = initHistory("0");
    for (let i = 1; i <= 150; i += 1) {
      h = pushHistory(h, String(i));
    }
    expect(h.stack.length).toBe(100);
    expect(currentText(h)).toBe("150");
    expect(h.stack[0]).toBe("51"); // 0〜150の151件のうち、新しい100件だけ残る。

    // 上限に達していても、Undoでさかのぼれる範囲は正しく保たれている。
    h = undo(h);
    expect(currentText(h)).toBe("149");
  });
});
