// F2-editor.md「設計2: Detailsパネルの入力欄はスキーマから導く」の入力欄
// そのもの。vocabulary.tsのFieldSpecだけを見て、1項目分の入力欄を作る
// (スキーマに項目が増えても、ここを直さずに対応する欄が出てくる)。
//
// 入力欄の対応(設計2の指定どおり):
// - enum   → セレクト(先頭に「(未設定)」)
// - boolean → チェックボックス + 「未設定に戻す」
// - string  → テキスト(打鍵の途中で書き戻さないよう CommitOnBlurInput を使う)
// - event   → event名の入力(同上)
// - bind可のもの → 「値 / bind」の切り替え + bind名の入力
import type { FieldSpec } from "../../core/vocabulary";
import { CommitOnBlurInput } from "./CommitOnBlurInput";

const INPUT_CLASS = "w-full rounded border border-white/10 bg-slate-800 px-2 py-1";

function isBindRef(value: unknown): value is { bind: string } {
  return typeof value === "object" && value !== null && typeof (value as { bind?: unknown }).bind === "string";
}

function isEventRef(value: unknown): value is { event: string } {
  return typeof value === "object" && value !== null && typeof (value as { event?: unknown }).event === "string";
}

/** bindをやめて「値」モードに戻すときの既定値。 */
function defaultLiteralFor(field: FieldSpec): unknown {
  switch (field.kind) {
    case "boolean":
      return false;
    case "enum":
      return field.options?.[0];
    case "string":
      return "";
    case "event":
      return undefined;
  }
}

interface ControlProps {
  field: FieldSpec;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled: boolean;
}

/** bindかどうかに関わらない、「値そのもの」を入力する部分。 */
function LiteralControl({ field, value, onChange, disabled }: ControlProps) {
  if (field.kind === "enum") {
    const current = typeof value === "string" ? value : "";
    return (
      <select
        value={current}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
        className={INPUT_CLASS}
      >
        <option value="">(未設定)</option>
        {(field.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (field.kind === "boolean") {
    return (
      <span className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={value === true}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(undefined)}
          className="text-[10px] text-slate-500 underline disabled:opacity-30"
        >
          未設定に戻す
        </button>
      </span>
    );
  }

  // string
  return (
    <CommitOnBlurInput
      value={typeof value === "string" ? value : ""}
      disabled={disabled}
      onCommit={(text) => onChange(text)}
      className={INPUT_CLASS}
    />
  );
}

export function DetailsField({ field, value, onChange, disabled }: ControlProps) {
  if (field.kind === "event") {
    const current = isEventRef(value) ? value.event : "";
    return (
      <CommitOnBlurInput
        value={current}
        disabled={disabled}
        placeholder="onXxx"
        // 空にしたら「イベントなし」としてプロパティ自体を外す(スキーマの
        // event名パターンは空文字を許さないので、空のまま{event:""}を書くと
        // 不正な文書になってしまう。設計には明記されていない細部だが、
        // この食い違いを避けるための判断)。
        onCommit={(text) => onChange(text === "" ? undefined : { event: text })}
        className={INPUT_CLASS}
      />
    );
  }

  if (!field.bindable) {
    return <LiteralControl field={field} value={value} onChange={onChange} disabled={disabled} />;
  }

  const bindRef = isBindRef(value) ? value : undefined;

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={disabled}
        title={bindRef !== undefined ? "値に戻す" : "bindにする"}
        onClick={() => onChange(bindRef !== undefined ? defaultLiteralFor(field) : { bind: field.name })}
        className="shrink-0 rounded border border-white/10 px-1 text-[10px] text-slate-400 hover:bg-slate-800 disabled:opacity-30"
      >
        {bindRef !== undefined ? "bind" : "値"}
      </button>
      {bindRef !== undefined ? (
        <CommitOnBlurInput
          value={bindRef.bind}
          disabled={disabled}
          onCommit={(text) => onChange({ bind: text })}
          className={INPUT_CLASS}
        />
      ) : (
        <LiteralControl field={field} value={value} onChange={onChange} disabled={disabled} />
      )}
    </div>
  );
}
