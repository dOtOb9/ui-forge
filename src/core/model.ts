// `.ui`形式(v1)の型定義。F1-foundation.mdの「`.ui`形式(v1)」の表をそのままTypeScriptの
// 型にしたもの。このファイルは値を持たない(型とごく小さな定数表のみ)。
//
// 依存の向き(ADR-0001 / F1-foundation.md): src/core/ はReactもTauriもimportしない。
// src/codegen/ と src/preview/ がこちらに依存する一方向のみ。

/** 列挙値。キーはタスクシートの表の見出しと対応させてある。 */
export type Gap = "none" | "xs" | "sm" | "md" | "lg";
export type Padding = Gap;
export type Align = "start" | "center" | "end" | "stretch";
export type Surface = "glass" | "opaque" | "none";
export type Radius = "none" | "md" | "lg" | "full";
export type TextSize = "sm" | "md" | "lg";
/** I-0(point-cloud-viewer組み込み準備): 3Dビューや他のパネルとの重なり順。
 * 数値のz-indexをAIに選ばせず、意味のある名前の列挙にする理由はADR-0005
 * (point-cloud-viewer側)と、I0-viewer-readiness.mdの表に書いてある。 */
export type Layer = "base" | "overlay" | "modal";
export type Anchor =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";
export type Margin = "none" | "sm" | "md" | "lg";

/** プロパティの値はリテラルかbindのどちらか(F1-foundation.md「値の書き方」)。 */
export interface Bind {
  bind: string;
}

/** イベントはProps側の関数になる(値ではなくeventという別キー)。 */
export interface EventRef {
  event: string;
}

export type BoolValue = boolean | Bind;
export type StringValue = string | Bind;
export type SurfaceValue = Surface | Bind;

export interface Slot {
  anchor: Anchor;
  margin?: Margin;
}

/** 部品ごとのprops。キーは部品表(F1-foundation.md、layer/textSizeはI0-viewer-readiness.md)
 * のとおり。 */
export interface CanvasProps {
  /** I-0: 3Dビューや左右パネルとの重なり順。省略時は何も付けない(後方互換)。 */
  layer?: Layer;
}

export interface BoxProps {
  gap?: Gap;
  padding?: Padding;
  align?: Align;
}

export interface PanelProps {
  surface?: SurfaceValue;
  radius?: Radius;
  padding?: Padding;
  shadow?: boolean;
  /** I-0: パネル内の文字の既定の大きさ。Text.sizeと同じ列挙・同じクラス対応表。
   * 省略時は何も付けない(後方互換)。 */
  textSize?: TextSize;
}

export interface TextProps {
  text?: StringValue;
  size?: TextSize;
}

export interface ButtonProps {
  label?: StringValue;
  active?: BoolValue;
  onClick?: EventRef;
}

export type WidgetProps = CanvasProps | BoxProps | PanelProps | TextProps | ButtonProps;

export type WidgetType = "Canvas" | "HBox" | "VBox" | "Panel" | "Text" | "Button";

/** WidgetTypeの全値。型(コンパイル時)と実行時の両方で一覧が要る場所
 * (src/core/vocabulary.test.ts、受け入れ基準3: 型の一覧をWidgetTypeと照合する)
 * のために置く。WidgetTypeに型が増えたらここにも追記する必要があるが、
 * 増やし忘れてもコンパイルエラーにはならない(TSの文字列リテラル型union自体に
 * 「全部列挙したか」を機械的に確かめる手段が無いため)。vocabulary.test.ts側で
 * この配列を使ってfieldsFor()を全型についてテストする形で、増やし忘れに
 * 気づける範囲をできるだけ広げている。 */
export const ALL_WIDGET_TYPES: readonly WidgetType[] = ["Canvas", "HBox", "VBox", "Panel", "Text", "Button"];

export interface Widget {
  id: string;
  type: WidgetType;
  /** 親がCanvasのときだけ書ける(意味検証。validate.ts参照)。 */
  slot?: Slot;
  props?: WidgetProps;
  /** コンテナ部品だけ持てる(意味検証。validate.ts参照)。 */
  children?: Widget[];
}

export interface UiDocument {
  $schema?: string;
  version: 1;
  component: string;
  root: Widget;
}

/** 子を持てる部品の一覧。validate.ts(children可否の判定)とgenerate.ts/render.tsx
 * (コンテナかどうかでレイアウトの組み方を変える)の両方から参照される、唯一の置き場。 */
export const CONTAINER_TYPES: readonly WidgetType[] = ["Canvas", "HBox", "VBox", "Panel"];

export function isContainerType(type: WidgetType): boolean {
  return (CONTAINER_TYPES as readonly string[]).includes(type);
}

/** bindした場合の値の種類。Propsの型生成(bindings.ts)と、同じbind名を型の違う
 * プロパティで使っていないかのチェック(validate.ts)の両方がこれで値の種類を比べる。 */
export type BindKind = "boolean" | "string" | "surface";

/** 部品の型ごとに、どのプロパティがbind可能で、bindした場合の値の種類は何か
 * (F1-foundation.mdの部品表で「bind可」と書かれているもの)。
 * bind不可のプロパティ(gap/padding/align/radius/shadow/size)はスキーマが
 * 元からリテラルしか許さないので、ここには出てこない。 */
export const BINDABLE_PROPS: Readonly<Record<string, Readonly<Record<string, BindKind>>>> = {
  Panel: { surface: "surface" },
  Text: { text: "string" },
  Button: { label: "string", active: "boolean" },
};
