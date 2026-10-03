// F1-foundation.md「生成物の形(generate.ts)」。
//
// 呼び出し側(cli.ts)はvalidate()を通した文書だけをここに渡す前提。そのため
// このファイルは「入力が壊れていたらどうするか」を考えなくてよい(検証は
// cli.tsが先に済ませる。生成そのものに検証ロジックを混ぜないという役割分担)。
//
// ADR-0001「本体に実行時ランタイムが増えない」: 生成されるTSXはui-forgeの
// どのモジュールもimportしない。surface/activeのようにbindで変わるクラスは、
// src/core/styles.tsのクラス表から取った文字列をこのファイルがその場で
// 三項演算子の中にリテラルとして埋め込む(F1-foundation.mdが明記する形)。
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
import { collectPropsMembers, type PropsMember } from "../core/bindings";
import type { Align, BindKind, Gap, Margin, Padding, Radius, TextSize, UiDocument, Widget } from "../core/model";

function isBind(value: unknown): value is { bind: string } {
  return typeof value === "object" && value !== null && typeof (value as { bind?: unknown }).bind === "string";
}

function isEvent(value: unknown): value is { event: string } {
  return typeof value === "object" && value !== null && typeof (value as { event?: unknown }).event === "string";
}

/** JSXの子テキストとして安全な形にする(`{`/`}`/`<`/`>`/`&`はJSXで意味を持つ)。 */
function escapeJsxText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\{/g, "&#123;").replace(/\}/g, "&#125;");
}

function tsType(kind: BindKind): string {
  switch (kind) {
    case "boolean":
      return "boolean";
    case "string":
      return "string";
    case "surface":
      return '"glass" | "opaque" | "none"';
  }
}

function renderPropsInterface(component: string, members: PropsMember[]): string[] {
  const lines = [`export interface ${component}Props {`];
  for (const m of members) {
    lines.push(m.kind === "bind" ? `  ${m.name}: ${tsType(m.valueKind)};` : `  ${m.name}: () => void;`);
  }
  lines.push("}");
  return lines;
}

/** 列挙値のプロパティ(gap/padding/align/radius/size)は、文書が検証済みなら
 * 常にリテラルの文字列なので、素直に表引きして静的なクラス片を足す。 */
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

interface WidgetClasses {
  /** 常に適用される静的なクラス片。 */
  staticParts: string[];
  /** bindした値によって選ぶクラスの三項演算子式(JSの式のテキスト)。高々1個
   * (surfaceかactiveのどちらか一方だけがbind可能なクラス由来のプロパティなので)。 */
  dynamicExpr?: string;
}

function widgetOwnClasses(widget: Widget): WidgetClasses {
  const props = (widget.props ?? {}) as Record<string, unknown>;
  const staticParts: string[] = [];
  let dynamicExpr: string | undefined;

  switch (widget.type) {
    case "Canvas":
      staticParts.push(CANVAS_CLASS);
      break;
    case "HBox":
    case "VBox":
      staticParts.push(widget.type === "HBox" ? HBOX_BASE_CLASS : VBOX_BASE_CLASS);
      pushEnumClass<Gap>(staticParts, GAP_CLASS, props.gap, "none");
      pushEnumClass<Padding>(staticParts, PADDING_CLASS, props.padding, "none");
      pushEnumClass<Align>(staticParts, ALIGN_CLASS, props.align, "stretch");
      break;
    case "Panel": {
      pushEnumClass<Radius>(staticParts, RADIUS_CLASS, props.radius, "none");
      pushEnumClass<Padding>(staticParts, PADDING_CLASS, props.padding, "none");
      if (props.shadow === true) staticParts.push(SHADOW_CLASS);
      if (isBind(props.surface)) {
        // 分かれ道の各枝の中に区切りの空白を入れる("none"の枝は空文字のまま)。
        // こうしておけば、下のclassNameAttrはstaticTextと単純に連結するだけでよく、
        // surfaceが"none"に解決されたときに余分な末尾スペースが残らない
        // (render.tsxの対応する分岐と、同じ入力に対して同じHTMLになる必要がある。
        // 受け入れ基準5)。
        const p = `props.${props.surface.bind}`;
        dynamicExpr = `${p} === "glass" ? " ${SURFACE_CLASS.glass}" : ${p} === "opaque" ? " ${SURFACE_CLASS.opaque}" : ""`;
      } else {
        const value = typeof props.surface === "string" ? props.surface : "none";
        if (SURFACE_CLASS[value as keyof typeof SURFACE_CLASS].length > 0) {
          staticParts.push(SURFACE_CLASS[value as keyof typeof SURFACE_CLASS]);
        }
      }
      break;
    }
    case "Text":
      pushEnumClass<TextSize>(staticParts, TEXT_SIZE_CLASS, props.size, "md");
      break;
    case "Button": {
      staticParts.push(BUTTON_BASE_CLASS);
      if (isBind(props.active)) {
        // 同じ理由で、区切りの空白は分かれ道の枝の中に入れる(Buttonの場合は
        // どちらの枝も空文字にはならないが、Panel/surfaceと統一した形にしておく)。
        const p = `props.${props.active.bind}`;
        dynamicExpr = `${p} ? " ${BUTTON_ACTIVE_CLASS}" : " ${BUTTON_INACTIVE_CLASS}"`;
      } else {
        staticParts.push(props.active === true ? BUTTON_ACTIVE_CLASS : BUTTON_INACTIVE_CLASS);
      }
      break;
    }
  }

  // slotは親がCanvasのときだけ(validate.ts済み前提)。位置クラスは常にリテラルの
  // 組み合わせ(anchor/marginはbind不可)なので、常に静的クラスとして足す。
  if (widget.slot !== undefined) {
    staticParts.unshift(CANVAS_CHILD_BASE_CLASS, ANCHOR_CLASS[widget.slot.anchor][widget.slot.margin ?? "none" as Margin]);
  }

  return { staticParts, dynamicExpr };
}

function classNameAttr(widget: Widget): string {
  const { staticParts, dynamicExpr } = widgetOwnClasses(widget);
  const staticText = staticParts.join(" ");
  if (dynamicExpr === undefined) {
    return `className="${staticText}"`;
  }
  // 区切りの空白はdynamicExprの各枝の中に既に入っている(widgetOwnClasses参照)ので
  // ここでは単純に連結するだけでよい。
  return `className={\`${staticText}\${${dynamicExpr}}\`}`;
}

function textContent(value: unknown): string {
  if (isBind(value)) return `{props.${value.bind}}`;
  return escapeJsxText(typeof value === "string" ? value : "");
}

function renderWidget(widget: Widget, indent: number): string[] {
  const pad = "  ".repeat(indent);
  const childPad = "  ".repeat(indent + 1);
  const classAttr = classNameAttr(widget);

  if (widget.type === "Button") {
    const props = (widget.props ?? {}) as Record<string, unknown>;
    const onClickAttr = isEvent(props.onClick) ? ` onClick={props.${props.onClick.event}}` : "";
    return [
      `${pad}<button type="button" data-ui-id="${widget.id}" ${classAttr}${onClickAttr}>`,
      `${childPad}${textContent(props.label)}`,
      `${pad}</button>`,
    ];
  }

  if (widget.type === "Text") {
    const props = (widget.props ?? {}) as Record<string, unknown>;
    return [
      `${pad}<span data-ui-id="${widget.id}" ${classAttr}>`,
      `${childPad}${textContent(props.text)}`,
      `${pad}</span>`,
    ];
  }

  // コンテナ(Canvas/HBox/VBox/Panel)。
  const children = widget.children ?? [];
  if (children.length === 0) {
    return [`${pad}<div data-ui-id="${widget.id}" ${classAttr} />`];
  }
  const lines = [`${pad}<div data-ui-id="${widget.id}" ${classAttr}>`];
  for (const child of children) lines.push(...renderWidget(child, indent + 1));
  lines.push(`${pad}</div>`);
  return lines;
}

/**
 * `.ui`文書からTSXのソーステキストを生成する。
 * `sourcePath`は先頭の「編集禁止」コメントに埋め込む入力ファイルのパス
 * (cli.tsがコマンドライン引数に渡されたパスをそのまま渡す)。
 */
export function generate(doc: UiDocument, sourcePath: string): string {
  const members = collectPropsMembers(doc);
  const lines = [
    `// 生成物: ${sourcePath} から ui-forge が生成。手で編集しないこと。`,
    `// 変更は ${sourcePath} に対して行い、\`npm run ui -- gen\` で作り直す。`,
    "",
    ...renderPropsInterface(doc.component, members),
    "",
    `export function ${doc.component}(props: ${doc.component}Props) {`,
    "  return (",
    ...renderWidget(doc.root, 2),
    "  );",
    "}",
    "",
  ];
  return lines.join("\n");
}
