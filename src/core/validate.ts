// F1-foundation.md: 「スキーマ検証 + 意味検証」。
//
// 役割分担(schema/ui.schema.jsonの$commentにも書いた):
// - スキーマ(ajv): 1個のWidget単体として形が正しいか。type・propsの形・列挙値・
//   bind/eventの名前の書式。
// - ここ(意味検証): 複数のWidgetにまたがる関係。id の重複・slotは親がCanvasの
//   ときだけ・コンテナでない部品にchildren・Panelの子は1つまで・同じbind名を
//   型の違うプロパティで使っていないか。
//
// 例外は投げない。見つかった問題を{ path, message }の配列として返す
// (F1-foundation.mdの指定どおり)。pathはJSON Pointer形式。
// schema/ui.schema.jsonは$schemaにdraft 2020-12を指定している(if/thenを使うため)。
// ajvの既定exportはdraft-07相当のメタスキーマしか知らないので、2020-12を
// 解決できる"ajv/dist/2020"から取る。
import Ajv2020 from "ajv/dist/2020";
import type { ErrorObject } from "ajv";
import schema from "../../schema/ui.schema.json";
import { BINDABLE_PROPS, CONTAINER_TYPES, type BindKind, type Widget } from "./model";

export interface ValidationError {
  path: string;
  message: string;
}

// ajvのインスタンス化はモジュール読み込み時に1回だけ行う(呼び出しごとに
// スキーマをコンパイルし直すのは無駄なため)。schemaはJSONをそのままimportして
// いるので、Node(CLI)でもブラウザ(プレビュー)でも同じモジュールとして使える
// (fsでの読み出しをしない。ADR-0001の「プレビューと生成物を食い違わせない」とは
// 別の話だが、同じ理由でcore/はランタイム環境を選ばないようにしてある)。
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateSchema = ajv.compile(schema);

/**
 * ajvのエラー1件を{ path, message }に変換する。
 * instancePathはそのままJSON Pointer形式("/root/children/0/props/gap")なので
 * pathはそれを使う。messageはキーワードごとに読みやすい日本語に言い換える
 * (ajvの既定メッセージは英語で、"must be equal to one of the allowed values"のような
 * 機械的な文になるため)。
 */
function describeAjvError(error: ErrorObject): ValidationError {
  const path = error.instancePath || "/";
  switch (error.keyword) {
    case "enum": {
      const allowed = (error.params.allowedValues as unknown[]).map((v) => JSON.stringify(v)).join(", ");
      return { path, message: `許可されていない値です(使える値: ${allowed})` };
    }
    case "const":
      return { path, message: `値は${JSON.stringify(error.params.allowedValue)}である必要があります` };
    case "additionalProperties":
      return { path, message: `未知のプロパティです: ${error.params.additionalProperty}` };
    case "required":
      return { path, message: `必須のプロパティがありません: ${error.params.missingProperty}` };
    case "pattern":
      if (path.endsWith("/bind")) return { path, message: "bind名はcamelCaseで指定してください" };
      if (path.endsWith("/event")) return { path, message: 'eventの名前は"on"で始まる必要があります' };
      if (path.endsWith("/id")) return { path, message: "idはsnake_caseで指定してください" };
      if (path.endsWith("/component")) return { path, message: "componentはPascalCaseで指定してください" };
      return { path, message: "書式が正しくありません" };
    case "type":
      return { path, message: `型が正しくありません(期待する型: ${error.params.type})` };
    default:
      return { path, message: error.message ?? "不正な値です" };
  }
}

/** JSON Pointerのパス片を組み立てる小さなヘルパー。 */
function childPath(base: string, ...segments: (string | number)[]): string {
  return base + segments.map((s) => `/${s}`).join("");
}

function isContainer(type: string): boolean {
  return (CONTAINER_TYPES as readonly string[]).includes(type);
}

/** 意味検証で使う、bindの出現1件(どのpathで・どういう種類の値として使われたか)。 */
interface BindUse {
  path: string;
  kind: BindKind;
}

/**
 * 木を再帰的にたどり、意味検証のエラーを集める。
 *
 * スキーマ検証が通らなかった(壊れた形の)部分があっても、意味検証はできる範囲で
 * 続ける。欠けているフィールドはoptional chainingで素通りさせ、想定外の形の
 * ノードについては単にそのノードに対するチェックをスキップする(例外を投げない
 * という方針を、この関数の中でも徹底する)。
 */
function walk(
  widget: unknown,
  path: string,
  parentType: string | undefined,
  seenIds: Map<string, string>,
  bindUses: Map<string, BindUse[]>,
  errors: ValidationError[],
): void {
  if (typeof widget !== "object" || widget === null) return;
  const w = widget as Partial<Widget> & Record<string, unknown>;

  // id の重複。
  if (typeof w.id === "string") {
    const firstPath = seenIds.get(w.id);
    if (firstPath !== undefined) {
      errors.push({ path: childPath(path, "id"), message: `idが重複しています: "${w.id}"(最初の使用: ${firstPath})` });
    } else {
      seenIds.set(w.id, path);
    }
  }

  // slotは親がCanvasのときだけ(ルート自身には親が無いので、ルートでのslotも不可)。
  if (w.slot !== undefined && parentType !== "Canvas") {
    errors.push({ path: childPath(path, "slot"), message: "slotは親がCanvasの部品のときだけ指定できます" });
  }

  const type = typeof w.type === "string" ? w.type : undefined;

  // コンテナでない部品にchildren / Panelの子は1つまで。
  const children = Array.isArray(w.children) ? w.children : undefined;
  if (children !== undefined && children.length > 0) {
    if (type !== undefined && !isContainer(type)) {
      errors.push({ path: childPath(path, "children"), message: `"${type}"はコンテナではないのでchildrenを持てません` });
    } else if (type === "Panel" && children.length > 1) {
      errors.push({ path: childPath(path, "children"), message: "Panelの子は1つまでです" });
    }
  }

  // 同じbind名を、型の違うプロパティで使っていないか。
  const props = typeof w.props === "object" && w.props !== null ? (w.props as Record<string, unknown>) : undefined;
  if (props !== undefined && type !== undefined) {
    const bindable = BINDABLE_PROPS[type];
    if (bindable !== undefined) {
      for (const [propName, kind] of Object.entries(bindable)) {
        const value = props[propName];
        if (typeof value === "object" && value !== null && "bind" in value) {
          const bindName = (value as { bind: unknown }).bind;
          if (typeof bindName === "string") {
            const usePath = childPath(path, "props", propName);
            const uses = bindUses.get(bindName) ?? [];
            uses.push({ path: usePath, kind });
            bindUses.set(bindName, uses);
          }
        }
      }
    }
  }

  // 子を再帰的にたどる。
  if (children !== undefined) {
    children.forEach((child, index) => {
      walk(child, childPath(path, "children", index), type, seenIds, bindUses, errors);
    });
  }
}

function checkBindConsistency(bindUses: Map<string, BindUse[]>, errors: ValidationError[]): void {
  for (const [bindName, uses] of bindUses) {
    const firstKind = uses[0].kind;
    for (const use of uses.slice(1)) {
      if (use.kind !== firstKind) {
        errors.push({
          path: use.path,
          message: `bind名"${bindName}"は既に${firstKind}として使われています(ここでは${use.kind})`,
        });
      }
    }
  }
}

/**
 * `.ui`文書を検証する。スキーマ検証と意味検証の両方のエラーをまとめて返す
 * (どちらか一方が失敗しても、もう一方のチェックは独立して実行する)。
 */
export function validate(doc: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  const schemaOk = validateSchema(doc);
  if (!schemaOk && validateSchema.errors) {
    for (const error of validateSchema.errors) {
      errors.push(describeAjvError(error));
    }
  }

  // 意味検証は、文書がobjectでrootを持っている限り(スキーマ的に多少壊れていても)
  // できる範囲で実行する。
  if (typeof doc === "object" && doc !== null && "root" in doc) {
    const seenIds = new Map<string, string>();
    const bindUses = new Map<string, BindUse[]>();
    walk((doc as { root: unknown }).root, "/root", undefined, seenIds, bindUses, errors);
    checkBindConsistency(bindUses, errors);
  }

  return errors;
}
