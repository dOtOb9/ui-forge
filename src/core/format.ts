// F1-foundation.md「正規化の規則」。
//
// ADR-0001が「書き出しは正規化する」を生命線だと言っている理由そのままで、
// ここが崩れるとdiffが読めなくなる。formatDocumentは「文書のどのフィールドを
// どの順で書き出すか」を全てこのファイル1箇所で決め打ちする(入力のキー順には
// 一切依存しない。parseDocumentでJSON.parseした結果のキー順が何であっても、
// formatDocumentは常に同じ出力を作る)。
import type { UiDocument, Widget } from "./model";

/** 生のJSONテキストを`.ui`文書として読む。構造の妥当性はvalidate.tsの仕事なので、
 * ここではJSON.parseだけ行う(型アサーションであって検証ではない)。 */
export function parseDocument(text: string): UiDocument {
  return JSON.parse(text) as UiDocument;
}

/** objectのキーをアルファベット順に並べ替えた新しいobjectを返す。
 * undefinedの値を持つキーは書き出さない(「空のprops/childrenは書き出さない」と
 * 同じ考え方を、プロパティ1個単位にも適用する)。 */
function sortedObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    if (obj[key] !== undefined) result[key] = obj[key];
  }
  return result;
}

function formatWidget(widget: Widget): Record<string, unknown> {
  const ordered: Record<string, unknown> = {
    id: widget.id,
    type: widget.type,
  };
  if (widget.slot !== undefined) {
    ordered.slot = sortedObject(widget.slot as unknown as Record<string, unknown>);
  }
  if (widget.props !== undefined && Object.keys(widget.props).length > 0) {
    ordered.props = sortedObject(widget.props as unknown as Record<string, unknown>);
  }
  if (widget.children !== undefined && widget.children.length > 0) {
    ordered.children = widget.children.map(formatWidget);
  }
  return ordered;
}

/**
 * `.ui`文書を正規化したJSONテキストとして書き出す。
 * - インデント2スペース、末尾改行1つ、LF(改行コード自体はJSON.stringifyが"\n"しか
 *   使わないので自然にLFになる。CRLFへの変換はエディタ/Git側の仕事にしない
 *   ようにするため、リポジトリに`.gitattributes`でeol=lfを置いてある)
 * - 文書のキー順: $schema, version, component, root
 * - Widgetのキー順: id, type, slot, props, children
 * - props/slotの中のキーはアルファベット順
 * - 空のprops/childrenは書き出さない
 */
export function formatDocument(doc: UiDocument): string {
  const ordered: Record<string, unknown> = {};
  if (doc.$schema !== undefined) ordered.$schema = doc.$schema;
  ordered.version = doc.version;
  ordered.component = doc.component;
  ordered.root = formatWidget(doc.root);

  return JSON.stringify(ordered, null, 2) + "\n";
}
