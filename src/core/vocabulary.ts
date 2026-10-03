// F2-editor.md「設計 2: Detailsパネルの入力欄はスキーマから導く」。
//
// 語彙(部品ごとにどんなプロパティが書けるか)は、すでに schema/ui.schema.json・
// model.ts・styles.ts・BINDABLE_PROPS の4箇所に分かれている。Details用に
// もう1つ手書きの表を作ると、語彙を足すたびに直す場所が増える。そこでここでは
// **schema/ui.schema.json を読んで**、Detailsパネルが欲しい情報
// (部品の型ごとのプロパティ一覧と、それぞれの種類)を導く。
//
// この設計の検証: 並行して進んでいるI-0がCanvas.layer / Panel.textSizeを
// スキーマに足す。合流後、このファイルを1行も変えずにDetailsへ新しい項目が
// 自動で出てくることが、「スキーマから導く」という設計が本当に機能している
// ことの証明になる。
import schema from "../../schema/ui.schema.json";
import type { WidgetType } from "./model";

/** JSON Schemaの1ノード(このファイルが扱う範囲だけの、ゆるい型)。 */
type SchemaNode = Record<string, unknown>;

const DEFS = (schema as SchemaNode).$defs as Record<string, SchemaNode>;

/** `{"$ref": "#/$defs/xxx"}` をこのスキーマ内で解決する。ui.schema.jsonは
 * 外部ファイルを参照しない(1ファイルで閉じている)ので、このファイルの範囲では
 * これで十分。 */
function resolveRef(node: SchemaNode): SchemaNode {
  const ref = node.$ref;
  if (typeof ref !== "string") return node;
  const prefix = "#/$defs/";
  if (!ref.startsWith(prefix)) throw new Error(`未対応の$ref: ${ref}`);
  const resolved = DEFS[ref.slice(prefix.length)];
  if (resolved === undefined) throw new Error(`$refの先が見つかりません: ${ref}`);
  return resolved;
}

/** Detailsパネルが1つのプロパティについて必要とする情報。 */
export interface FieldSpec {
  name: string;
  kind: "enum" | "boolean" | "string" | "event";
  /** kindが"enum"のときの選択肢。 */
  options?: string[];
  /** bindで値を渡せるか(F1-foundation.mdの部品表で「bind可」のもの)。 */
  bindable: boolean;
}

/** bindを含まない「値そのもの」のノードから、種類と(enumなら)選択肢を読む。 */
function describeValueNode(node: SchemaNode): Pick<FieldSpec, "kind" | "options"> {
  if (Array.isArray(node.enum)) {
    return { kind: "enum", options: node.enum as string[] };
  }
  if (node.type === "boolean") {
    return { kind: "boolean" };
  }
  const eventProps = node.properties as SchemaNode | undefined;
  if (eventProps !== undefined && "event" in eventProps) {
    return { kind: "event" };
  }
  // v1の語彙では到達しない(gap/padding/align/radius/textSize/shadow/eventの
  // いずれかで必ず上の分岐に入る)。将来、直接の"string"型プロパティが
  // 増えた場合の既定の読み方として置いておく。
  return { kind: "string" };
}

/** `XxxOrBind`のような「bindかもしれない」ノード(oneOf)かどうかを見て、
 * 種類・選択肢・bind可否をまとめて決める。 */
function describeField(name: string, rawNode: SchemaNode): FieldSpec {
  const node = resolveRef(rawNode);

  if (Array.isArray(node.oneOf)) {
    const branches = (node.oneOf as SchemaNode[]).map(resolveRef);
    const bindBranch = branches.find((b) => "bind" in ((b.properties as SchemaNode | undefined) ?? {}));
    const valueBranch = branches.find((b) => b !== bindBranch);
    if (bindBranch === undefined || valueBranch === undefined) {
      throw new Error(`プロパティ"${name}"のoneOfを解釈できません`);
    }
    return { name, bindable: true, ...describeValueNode(valueBranch) };
  }

  return { name, bindable: false, ...describeValueNode(node) };
}

/** widget定義のallOfから、指定した部品型のprops.propertiesを探す
 * (HBox/VBoxのように複数の型が同じ分岐を共有することがあるので、
 * if.properties.type.const と .enum の両方を見る)。 */
function propsSchemaFor(type: WidgetType): Record<string, SchemaNode> {
  const allOf = (DEFS.widget.allOf ?? []) as SchemaNode[];
  for (const branch of allOf) {
    const typeCond = (((branch.if as SchemaNode).properties as SchemaNode).type as SchemaNode) as {
      const?: string;
      enum?: string[];
    };
    const matches = typeCond.const === type || (typeCond.enum?.includes(type) ?? false);
    if (!matches) continue;
    const thenProps = ((branch.then as SchemaNode).properties as SchemaNode).props as SchemaNode;
    return (thenProps.properties as Record<string, SchemaNode> | undefined) ?? {};
  }
  return {};
}

/** 部品の型ごとのプロパティ一覧(名前のアルファベット順)。Detailsパネルは
 * これだけを見て入力欄を作る。 */
export function fieldsFor(type: WidgetType): FieldSpec[] {
  const propsSchema = propsSchemaFor(type);
  return Object.entries(propsSchema)
    .map(([name, node]) => describeField(name, node))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** slotのプロパティ一覧(anchor/margin)。親がCanvasの部品にだけ出す
 * (F2-editor.md「slotは親がCanvasのときだけ出す」)。型によらず一定なので
 * fieldsForとは別の関数にしてある。 */
export function slotFields(): FieldSpec[] {
  const props = (DEFS.slot.properties as Record<string, SchemaNode>) ?? {};
  return Object.entries(props).map(([name, node]) => describeField(name, node));
}
