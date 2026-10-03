// F1-foundation.md「右: 値パネル」。文書中のbindを一覧し、型に応じた入力
// (boolean→チェックボックス、列挙→セレクト、string→テキスト)で値を変えられる。
import type { BindValues } from "./render";
import type { PropsMember } from "../core/bindings";

interface Props {
  members: PropsMember[];
  values: BindValues;
  onChange: (name: string, value: boolean | string) => void;
}

export function ValuePanel({ members, values, onChange }: Props) {
  const binds = members.filter((m) => m.kind === "bind");

  // F2: 幅・外枠は、親(PreviewApp.tsx)がDetailsとまとめて置く枠側(w-72)で
  // 決める(画面構成の図どおり、Detailsと値パネルは右側の1つの枠に縦に並ぶ)。
  // ここではその内側に積むコンテンツだけを持つ。
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto bg-slate-900 p-3 text-sm text-slate-100">
      <h2 className="font-semibold text-slate-300">値パネル</h2>
      {binds.length === 0 && <p className="text-slate-500">bindがありません</p>}
      {binds.map((member) => (
        <label key={member.name} className="flex flex-col gap-1">
          <span className="text-slate-400">{member.name}</span>
          {member.valueKind === "boolean" && (
            <input
              type="checkbox"
              checked={values[member.name] === true}
              onChange={(e) => onChange(member.name, e.target.checked)}
            />
          )}
          {member.valueKind === "surface" && (
            <select
              value={typeof values[member.name] === "string" ? (values[member.name] as string) : "glass"}
              onChange={(e) => onChange(member.name, e.target.value)}
              className="rounded border border-white/10 bg-slate-800 px-2 py-1"
            >
              <option value="glass">glass</option>
              <option value="opaque">opaque</option>
              <option value="none">none</option>
            </select>
          )}
          {member.valueKind === "string" && (
            <input
              type="text"
              value={typeof values[member.name] === "string" ? (values[member.name] as string) : ""}
              onChange={(e) => onChange(member.name, e.target.value)}
              className="rounded border border-white/10 bg-slate-800 px-2 py-1"
            />
          )}
        </label>
      ))}
    </div>
  );
}
