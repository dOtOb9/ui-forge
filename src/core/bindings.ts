// F1-foundation.md: 「文書からbind/eventを集めてPropsの一覧を作る」。
//
// 生成されるPropsインターフェース(generate.ts)と、プレビューの値パネル・
// イベントログ(render.tsx / preview)の両方が、同じ「この文書はどんな値と
// イベントを要求するか」の一覧を必要とする。それをここ1箇所で作る。
//
// 呼び出し側はvalidate()で検証済みの文書だけを渡す前提(CLIのgen/checkは
// 検証に失敗したら先に進まない。cli.ts参照)。そのため、ここでは「同じbind名が
// 違う種類で使われていたらどうするか」のようなエラー処理はしない
// (検証済みなら起こらない前提で、起きていれば最初に見つけた種類を使う)。
import type { BindKind, UiDocument, Widget } from "./model";
import { BINDABLE_PROPS } from "./model";

export type PropsMember =
  | { kind: "bind"; name: string; valueKind: BindKind }
  | { kind: "event"; name: string };

function isBindValue(value: unknown): value is { bind: string } {
  return typeof value === "object" && value !== null && typeof (value as { bind?: unknown }).bind === "string";
}

function isEventValue(value: unknown): value is { event: string } {
  return typeof value === "object" && value !== null && typeof (value as { event?: unknown }).event === "string";
}

function walk(widget: Widget, binds: Map<string, BindKind>, events: Set<string>): void {
  const bindable = BINDABLE_PROPS[widget.type];
  const props = (widget.props ?? {}) as Record<string, unknown>;

  for (const [propName, value] of Object.entries(props)) {
    if (isBindValue(value)) {
      // bindable? propName について、型(BindKind)が分かっているものだけ記録する。
      // スキーマ上bind不可のプロパティにbindが付くことは無い(検証済み前提)ので、
      // bindable[propName]が無いケースは通常発生しない。
      const kind = bindable?.[propName];
      if (kind !== undefined && !binds.has(value.bind)) {
        binds.set(value.bind, kind);
      }
    } else if (isEventValue(value)) {
      events.add(value.event);
    }
  }

  for (const child of widget.children ?? []) {
    walk(child, binds, events);
  }
}

/**
 * 文書中のbind/eventを集め、Propsのメンバー一覧を作る。
 * 生成物の例(F1-foundation.md)のとおり、bindとeventを区別せず名前の
 * アルファベット順1本のリストにまとめて返す(`DockProps`のメンバー順と同じ)。
 */
export function collectPropsMembers(doc: UiDocument): PropsMember[] {
  const binds = new Map<string, BindKind>();
  const events = new Set<string>();
  walk(doc.root, binds, events);

  const members: PropsMember[] = [
    ...Array.from(binds, ([name, valueKind]) => ({ kind: "bind" as const, name, valueKind })),
    ...Array.from(events, (name) => ({ kind: "event" as const, name })),
  ];

  members.sort((a, b) => a.name.localeCompare(b.name));
  return members;
}
