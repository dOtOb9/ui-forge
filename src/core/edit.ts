// F2-editor.md「設計 1: 編集操作はcoreの純粋関数にする」。
//
// どの関数も (doc, ...) => EditResult の形で、**元の文書を一切変更しない**
// (常に新しい文書を作って返す)。実装方針: 最初に文書全体を複製してから、
// その複製(だけ)を書き換える。複製元(引数で渡されたdoc)にはどの操作も
// 触らないので、「元の文書が変わっていない」が自明に成り立つ。
//
// 不正になる操作は例外を投げず、{ ok: false, reason } を返す(呼び出し側の
// UI、F2-4のDetails/Hierarchyがreasonをそのまま表示する)。
import type { Slot, UiDocument, Widget, WidgetType } from "./model";
import { isContainerType } from "./model";

export type EditResult = { ok: true; doc: UiDocument } | { ok: false; reason: string };

function ok(doc: UiDocument): EditResult {
  return { ok: true, doc };
}

function fail(reason: string): EditResult {
  return { ok: false, reason };
}

/** idの書式(schema/ui.schema.jsonのwidget.idのpatternと同じ)。renameWidgetが
 * 改名後のidを受け入れる前にここでも確かめる(validateは「編集が終わった後」に
 * しか効かないので、理由を日本語で返すにはここで直接見るのが簡潔)。 */
const ID_PATTERN = /^[a-z][a-z0-9_]*$/;

/** idからWidgetを探す(自分自身も含む)。見つからなければundefined。
 * edit.tsの各操作とsrc/preview/editor/の表示側(Hierarchy/Details)の両方から
 * 使う、木をたどる小さな共通処理なのでここでexportする。 */
export function findWidget(root: Widget, id: string): Widget | undefined {
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const found = findWidget(child, id);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** idを持つWidgetの親を探す。rootそのものには親が無いのでundefined。 */
export function findParent(root: Widget, id: string): Widget | undefined {
  for (const child of root.children ?? []) {
    if (child.id === id) return root;
    const found = findParent(child, id);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** 文書内に実際に使われている全idの集合(addChildの自動id生成が使う)。 */
function collectIds(root: Widget, out: Set<string> = new Set()): Set<string> {
  out.add(root.id);
  for (const child of root.children ?? []) collectIds(child, out);
  return out;
}

function cloneWidget(widget: Widget): Widget {
  const clone: Widget = { id: widget.id, type: widget.type };
  if (widget.slot !== undefined) clone.slot = { ...widget.slot };
  if (widget.props !== undefined) clone.props = { ...widget.props };
  if (widget.children !== undefined) clone.children = widget.children.map(cloneWidget);
  return clone;
}

/** 文書全体を深く複製する。各操作はこの複製だけを書き換える。 */
function cloneDocument(doc: UiDocument): UiDocument {
  return { ...doc, root: cloneWidget(doc.root) };
}

/**
 * PascalCaseの部品型名をsnake_caseにする(addChildの自動id生成用)。
 * 「大文字の連続の最後に小文字が続く箇所」を単語の先頭とみなして区切る
 * (例: "HBox" → "H" + "Box" → "h_box"。"Canvas" のように単語境界が無い場合は
 * そのまま小文字化するだけになる)。
 */
function toSnakeCase(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z0-9]+)/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();
}

/** `<typeのsnake_case>_<連番>` の形で、文書内で一意なidを作る(設計「addChild」)。 */
function generateUniqueId(root: Widget, type: WidgetType): string {
  const used = collectIds(root);
  const base = toSnakeCase(type);
  let n = 1;
  while (used.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}

/** プロパティを設定する。valueがundefinedなら削除する。 */
export function setProp(doc: UiDocument, id: string, key: string, value: unknown): EditResult {
  const clone = cloneDocument(doc);
  const widget = findWidget(clone.root, id);
  if (widget === undefined) return fail(`部品が見つかりません: id="${id}"`);

  const props: Record<string, unknown> = { ...(widget.props as Record<string, unknown> | undefined) };
  if (value === undefined) {
    delete props[key];
  } else {
    props[key] = value;
  }
  widget.props = props as Widget["props"];
  return ok(clone);
}

/** slotを設定する(undefinedで削除)。slotは親がCanvasの部品にしか付けられない
 * (validate.tsの意味検証と同じ制約。設計「Detailsパネルはこれだけを見て…」で
 * slotは親がCanvasのときだけ出す前提なので、ここで食い違いを防ぐ)。 */
export function setSlot(doc: UiDocument, id: string, slot: Slot | undefined): EditResult {
  const clone = cloneDocument(doc);
  const widget = findWidget(clone.root, id);
  if (widget === undefined) return fail(`部品が見つかりません: id="${id}"`);

  if (slot !== undefined) {
    const parent = findParent(clone.root, id);
    if (parent === undefined || parent.type !== "Canvas") {
      return fail(`"${id}"の親はCanvasではないのでslotを設定できません`);
    }
  }
  widget.slot = slot;
  return ok(clone);
}

/** idを変える。書式(snake_case)と、文書内での一意性を確かめる。 */
export function renameWidget(doc: UiDocument, id: string, newId: string): EditResult {
  const clone = cloneDocument(doc);
  const widget = findWidget(clone.root, id);
  if (widget === undefined) return fail(`部品が見つかりません: id="${id}"`);
  if (newId === id) return ok(clone);

  if (!ID_PATTERN.test(newId)) {
    return fail(`idはsnake_caseで指定してください: "${newId}"`);
  }
  if (findWidget(clone.root, newId) !== undefined) {
    return fail(`idが重複しています: "${newId}"`);
  }

  widget.id = newId;
  return ok(clone);
}

/**
 * コンテナの末尾に新しい部品を足す。idは自動で一意に付ける。
 * 親がCanvasなら、設計の指定どおり既定のslot({"anchor":"center"})を付ける。
 */
export function addChild(doc: UiDocument, parentId: string, type: WidgetType): EditResult {
  const clone = cloneDocument(doc);
  const parent = findWidget(clone.root, parentId);
  if (parent === undefined) return fail(`親が見つかりません: id="${parentId}"`);
  if (!isContainerType(parent.type)) {
    return fail(`"${parent.type}"はコンテナではないので部品を追加できません`);
  }
  if (parent.type === "Panel" && (parent.children?.length ?? 0) >= 1) {
    return fail("Panelの子は1つまでです");
  }

  const newWidget: Widget = { id: generateUniqueId(clone.root, type), type };
  if (parent.type === "Canvas") {
    newWidget.slot = { anchor: "center" };
  }
  parent.children = [...(parent.children ?? []), newWidget];
  return ok(clone);
}

/** 部品を子ごと消す。rootは消せない。 */
export function removeWidget(doc: UiDocument, id: string): EditResult {
  if (doc.root.id === id) return fail("rootは消せません");

  const clone = cloneDocument(doc);
  const parent = findParent(clone.root, id);
  if (parent === undefined) return fail(`部品が見つかりません: id="${id}"`);

  parent.children = (parent.children ?? []).filter((child) => child.id !== id);
  return ok(clone);
}

/** 同じ親の中で前後に動かす。端なら何もしない(ok:trueのまま、文書は変わらない)。 */
export function moveWidget(doc: UiDocument, id: string, delta: -1 | 1): EditResult {
  const clone = cloneDocument(doc);
  const parent = findParent(clone.root, id);
  if (parent === undefined) return fail(`部品が見つかりません: id="${id}"`);

  const children = parent.children ?? [];
  const index = children.findIndex((child) => child.id === id);
  const newIndex = index + delta;
  if (newIndex < 0 || newIndex >= children.length) {
    return ok(clone); // 端なら何もしない。
  }

  const reordered = [...children];
  [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
  parent.children = reordered;
  return ok(clone);
}
