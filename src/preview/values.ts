// 値パネルの初期値・再読み込み時の引き継ぎ方。F1-foundation.mdの指定:
// 「初期値はboolean=false、列挙=最初の値、string=bind名」。
import type { BindValues } from "./render";
import type { PropsMember } from "../core/bindings";

type BindMember = Extract<PropsMember, { kind: "bind" }>;

function defaultValue(member: BindMember): boolean | string {
  switch (member.valueKind) {
    case "boolean":
      return false;
    case "string":
      return member.name;
    case "surface":
      // 列挙の「最初の値」= model.ts/schemaでのsurfaceの並び("glass"が先頭)。
      return "glass";
  }
}

/**
 * ファイルを開き直した(bindの顔ぶれが変わったかもしれない)ときに、
 * 値パネルの状態を作り直す。既に値パネルで触っていたbind名はその値を引き継ぎ、
 * 新しく出てきたbind名だけ既定値にする(型が変わっていたら既定値に戻す)。
 */
export function reconcileValues(members: PropsMember[], previous: BindValues): BindValues {
  const next: BindValues = {};
  for (const member of members) {
    if (member.kind !== "bind") continue;
    const prev = previous[member.name];
    const prevType = typeof prev;
    const expectedType = member.valueKind === "boolean" ? "boolean" : "string";
    next[member.name] = prevType === expectedType ? (prev as boolean | string) : defaultValue(member);
  }
  return next;
}
