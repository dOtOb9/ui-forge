// ADR-0001「語彙を限定する」: 列挙値と実際のTailwindクラスの対応表は、このファイル
// 1箇所だけに置く。見た目を調整したくなったら、触るのは常にここだけでよい。
//
// すべてのクラス文字列はリテラルのまま書く(テンプレート文字列で組み立てない)。
// 理由はF1-foundation.mdに明記されている: Tailwind v4はソースを走査してクラスを
// 検出するので、`` `p-${n}` `` のように動的に組み立てた文字列は検出されない。
// このファイルとgenerate.tsの出力の両方について、`${`を含むクラス文字列が無いことを
// テストで確認する(受け入れ基準6)。
//
// surface/button関連の値はF1-foundation.mdが「少なくともこの文字列のまま使う」と
// 指定しているもの(point-cloud-viewerのsrc/ui/shell/glass.tsとDock.tsxから取った
// もの)。それ以外(gap/padding/align/radius/size/anchor位置)はタスクシートに
// 具体的な値の指定が無いため、実装記録に書いたとおりpoint-cloud-viewerの
// Dock.tsx実物の値(gap-1, p-1.5, rounded-full, bottom-4など)と一致するように
// 選んだ。
import type { Align, Anchor, Gap, Margin, Padding, Radius, Surface, TextSize } from "./model";

/** Canvas自身のクラス。F1-foundation.md「クラスの対応表」の記述そのまま。 */
export const CANVAS_CLASS = "pointer-events-none fixed inset-0";

/** Canvasの子(slotを持つ部品)に共通で付くクラス。位置そのものはANCHOR_CLASSが持つ。 */
export const CANVAS_CHILD_BASE_CLASS = "pointer-events-auto absolute";

export const SURFACE_CLASS: Readonly<Record<Surface, string>> = {
  glass:
    "backdrop-blur-md bg-white/65 text-slate-900 border border-black/10 dark:bg-slate-950/70 dark:text-slate-100 dark:border-white/10",
  opaque: "bg-white text-slate-900 border border-black/10 dark:bg-slate-950 dark:text-slate-100 dark:border-white/10",
  none: "",
};

export const BUTTON_ACTIVE_CLASS = "bg-slate-900 text-white dark:bg-white dark:text-slate-900";
export const BUTTON_INACTIVE_CLASS = "hover:bg-black/5 dark:hover:bg-white/10";
export const BUTTON_BASE_CLASS = "rounded-full px-3 py-1.5";

export const HBOX_BASE_CLASS = "flex";
export const VBOX_BASE_CLASS = "flex flex-col";

export const GAP_CLASS: Readonly<Record<Gap, string>> = {
  none: "",
  xs: "gap-1",
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
};

export const PADDING_CLASS: Readonly<Record<Padding, string>> = {
  none: "",
  xs: "p-1.5",
  sm: "p-2",
  md: "p-4",
  lg: "p-6",
};

export const ALIGN_CLASS: Readonly<Record<Align, string>> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
};

export const RADIUS_CLASS: Readonly<Record<Radius, string>> = {
  none: "",
  md: "rounded-md",
  lg: "rounded-lg",
  full: "rounded-full",
};

export const TEXT_SIZE_CLASS: Readonly<Record<TextSize, string>> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

export const SHADOW_CLASS = "shadow-lg";

/**
 * slot.anchor × slot.margin の組み合わせごとの位置クラス。
 * marginの0/2/4/6はTailwindの間隔スケール(none/sm/md/lg)にそのまま対応させている
 * (F1-foundation.mdの例「bottom-center→bottom-4 left-1/2 -translate-x-1/2、4の部分は
 * marginで変わる」のとおり、marginが"md"のとき4になる)。
 *
 * "center"だけは、どの辺からも距離を取らない配置なのでmarginの値によらず同じ
 * クラスになる(変える意味のある辺が無いため)。
 */
export const ANCHOR_CLASS: Readonly<Record<Anchor, Readonly<Record<Margin, string>>>> = {
  "top-left": {
    none: "top-0 left-0",
    sm: "top-2 left-2",
    md: "top-4 left-4",
    lg: "top-6 left-6",
  },
  "top-center": {
    none: "top-0 left-1/2 -translate-x-1/2",
    sm: "top-2 left-1/2 -translate-x-1/2",
    md: "top-4 left-1/2 -translate-x-1/2",
    lg: "top-6 left-1/2 -translate-x-1/2",
  },
  "top-right": {
    none: "top-0 right-0",
    sm: "top-2 right-2",
    md: "top-4 right-4",
    lg: "top-6 right-6",
  },
  "center-left": {
    none: "left-0 top-1/2 -translate-y-1/2",
    sm: "left-2 top-1/2 -translate-y-1/2",
    md: "left-4 top-1/2 -translate-y-1/2",
    lg: "left-6 top-1/2 -translate-y-1/2",
  },
  center: {
    none: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
    sm: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
    md: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
    lg: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
  },
  "center-right": {
    none: "right-0 top-1/2 -translate-y-1/2",
    sm: "right-2 top-1/2 -translate-y-1/2",
    md: "right-4 top-1/2 -translate-y-1/2",
    lg: "right-6 top-1/2 -translate-y-1/2",
  },
  "bottom-left": {
    none: "bottom-0 left-0",
    sm: "bottom-2 left-2",
    md: "bottom-4 left-4",
    lg: "bottom-6 left-6",
  },
  "bottom-center": {
    none: "bottom-0 left-1/2 -translate-x-1/2",
    sm: "bottom-2 left-1/2 -translate-x-1/2",
    md: "bottom-4 left-1/2 -translate-x-1/2",
    lg: "bottom-6 left-1/2 -translate-x-1/2",
  },
  "bottom-right": {
    none: "bottom-0 right-0",
    sm: "bottom-2 right-2",
    md: "bottom-4 right-4",
    lg: "bottom-6 right-6",
  },
};
