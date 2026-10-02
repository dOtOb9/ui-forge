import { describe, expect, it } from "vitest";
import * as styles from "./styles";

// 受け入れ基準6: クラス名がリテラルであること。
// `${`を含む文字列が無いことを、実際にモジュールからexportされた値(文字列・
// ネストしたRecord)を再帰的にたどって確認する。コメント中の説明文字列ではなく、
// 実際にクラスとして使われる値そのものを見るためにこの形にしている。
function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    out.push(value);
  } else if (value !== null && typeof value === "object") {
    for (const v of Object.values(value)) collectStrings(v, out);
  }
}

describe("styles", () => {
  it("すべてのクラス文字列がリテラルである(テンプレート構文を含まない)", () => {
    const all: string[] = [];
    collectStrings(styles, all);
    expect(all.length).toBeGreaterThan(0);
    for (const s of all) {
      expect(s).not.toContain("${");
    }
  });

  it("F1-foundation.mdが指定するsurface/buttonのクラス文字列と一致する", () => {
    expect(styles.SURFACE_CLASS.glass).toBe(
      "backdrop-blur-md bg-white/65 text-slate-900 border border-black/10 dark:bg-slate-950/70 dark:text-slate-100 dark:border-white/10",
    );
    expect(styles.SURFACE_CLASS.opaque).toBe(
      "bg-white text-slate-900 border border-black/10 dark:bg-slate-950 dark:text-slate-100 dark:border-white/10",
    );
    expect(styles.BUTTON_ACTIVE_CLASS).toBe("bg-slate-900 text-white dark:bg-white dark:text-slate-900");
    expect(styles.BUTTON_INACTIVE_CLASS).toBe("hover:bg-black/5 dark:hover:bg-white/10");
    expect(styles.BUTTON_BASE_CLASS).toBe("rounded-full px-3 py-1.5");
  });
});
