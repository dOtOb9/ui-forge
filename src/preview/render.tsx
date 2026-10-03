// F1-foundation.md「F1-4: プレビュー」: UiDocumentと値の組(bind名→値、event名→
// 関数)からReact要素を作る。
//
// ADR-0001「プレビューと生成物を食い違わせない」: ここでの描画経路
// (実行時解釈)と、src/codegen/generate.tsが作るTSX(コード生成)は別経路なので、
// 同じ入力に対して同じHTMLを出すことをテストで保証する(受け入れ基準5。
// src/preview/render.test.tsx参照)。そのため、このファイルの
// widgetClassName()はgenerate.tsのwidgetOwnClasses()とわざと同じ順番で
// クラス片を組み立てている(読み比べられるように)。違うのは、generate.tsが
// 「bindならどちらを選ぶかの三項演算子のソースコード」を作るのに対し、
// ここは「実際の値を見てどちらかを選んだ結果の文字列」を作るという一点だけ。
import { cloneElement, type ReactElement } from "react";
import type { Align, Gap, Padding, Radius, Surface, TextSize, UiDocument, Widget } from "../core/model";
import {
  ALIGN_CLASS,
  ANCHOR_CLASS,
  BUTTON_ACTIVE_CLASS,
  BUTTON_BASE_CLASS,
  BUTTON_INACTIVE_CLASS,
  CANVAS_CHILD_BASE_CLASS,
  CANVAS_CLASS,
  GAP_CLASS,
  HBOX_BASE_CLASS,
  PADDING_CLASS,
  RADIUS_CLASS,
  SHADOW_CLASS,
  SURFACE_CLASS,
  TEXT_SIZE_CLASS,
  VBOX_BASE_CLASS,
} from "../core/styles";

/** bind名→実際の値。値パネル(F1-4)が持つ状態そのもの。 */
export type BindValues = Record<string, boolean | string>;
/** event名→発火したときに呼ぶ関数。イベントログ(F1-4)に記録する側が渡す。 */
export type EventHandlers = Record<string, () => void>;

function isBind(value: unknown): value is { bind: string } {
  return typeof value === "object" && value !== null && typeof (value as { bind?: unknown }).bind === "string";
}

function isEvent(value: unknown): value is { event: string } {
  return typeof value === "object" && value !== null && typeof (value as { event?: unknown }).event === "string";
}

function resolveString(value: unknown, values: BindValues): string {
  if (isBind(value)) {
    const v = values[value.bind];
    return typeof v === "string" ? v : "";
  }
  return typeof value === "string" ? value : "";
}

function resolveBool(value: unknown, values: BindValues): boolean {
  if (isBind(value)) return values[value.bind] === true;
  return value === true;
}

function resolveSurface(value: unknown, values: BindValues): Surface {
  const candidate = isBind(value) ? values[value.bind] : value;
  return candidate === "glass" || candidate === "opaque" || candidate === "none" ? candidate : "none";
}

function pushEnumClass<K extends string>(
  out: string[],
  table: Readonly<Record<K, string>>,
  value: unknown,
  fallback: K,
): void {
  const key = (typeof value === "string" ? value : fallback) as K;
  const cls = table[key];
  if (cls.length > 0) out.push(cls);
}

function widgetClassName(widget: Widget, values: BindValues): string {
  const props = (widget.props ?? {}) as Record<string, unknown>;
  const parts: string[] = [];

  switch (widget.type) {
    case "Canvas":
      parts.push(CANVAS_CLASS);
      break;
    case "HBox":
    case "VBox":
      parts.push(widget.type === "HBox" ? HBOX_BASE_CLASS : VBOX_BASE_CLASS);
      pushEnumClass<Gap>(parts, GAP_CLASS, props.gap, "none");
      pushEnumClass<Padding>(parts, PADDING_CLASS, props.padding, "none");
      pushEnumClass<Align>(parts, ALIGN_CLASS, props.align, "stretch");
      break;
    case "Panel": {
      pushEnumClass<Radius>(parts, RADIUS_CLASS, props.radius, "none");
      pushEnumClass<Padding>(parts, PADDING_CLASS, props.padding, "none");
      if (props.shadow === true) parts.push(SHADOW_CLASS);
      const surfaceClass = SURFACE_CLASS[resolveSurface(props.surface, values)];
      if (surfaceClass.length > 0) parts.push(surfaceClass);
      break;
    }
    case "Text":
      pushEnumClass<TextSize>(parts, TEXT_SIZE_CLASS, props.size, "md");
      break;
    case "Button":
      parts.push(BUTTON_BASE_CLASS);
      parts.push(resolveBool(props.active, values) ? BUTTON_ACTIVE_CLASS : BUTTON_INACTIVE_CLASS);
      break;
  }

  if (widget.slot !== undefined) {
    parts.unshift(CANVAS_CHILD_BASE_CLASS, ANCHOR_CLASS[widget.slot.anchor][widget.slot.margin ?? "none"]);
  }

  return parts.join(" ");
}

function renderWidget(widget: Widget, values: BindValues, handlers: EventHandlers): ReactElement {
  const className = widgetClassName(widget, values);
  const props = (widget.props ?? {}) as Record<string, unknown>;

  if (widget.type === "Button") {
    const onClick = isEvent(props.onClick) ? handlers[props.onClick.event] : undefined;
    return (
      <button type="button" data-ui-id={widget.id} className={className} onClick={onClick}>
        {resolveString(props.label, values)}
      </button>
    );
  }

  if (widget.type === "Text") {
    return (
      <span data-ui-id={widget.id} className={className}>
        {resolveString(props.text, values)}
      </span>
    );
  }

  // コンテナ(Canvas/HBox/VBox/Panel)。子の配列にはReactのkeyが要る。
  // renderWidget自体は「コンポーネント」ではなくただの関数として素直に再帰させたい
  // (react-refresh/only-export-componentsの対象を増やしたくない)ので、
  // 専用のラッパーコンポーネントを作る代わりにcloneElementでkeyだけ後から足す。
  const children = (widget.children ?? []).map((child) =>
    cloneElement(renderWidget(child, values, handlers), { key: child.id }),
  );
  return (
    <div data-ui-id={widget.id} className={className}>
      {children}
    </div>
  );
}

/** `UiDocument`を、与えられた値とイベントハンドラで実際に描画する。 */
export function renderDocument(doc: UiDocument, values: BindValues, handlers: EventHandlers): ReactElement {
  return renderWidget(doc.root, values, handlers);
}
