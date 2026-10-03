// F2-editor.md「画面構成」の右側パネル。選んだ部品のid/type/slot/propsを
// 表示・編集する。入力欄はvocabulary.ts(fieldsFor/slotFields)だけを見て
// 組み立てる(手書きの対応表を増やさない。設計2参照)。
import type { Slot, Widget, WidgetType } from "../../core/model";
import { fieldsFor, slotFields } from "../../core/vocabulary";
import { CommitOnBlurInput } from "./CommitOnBlurInput";
import { DetailsField } from "./DetailsField";

const INPUT_CLASS = "w-full rounded border border-white/10 bg-slate-800 px-2 py-1";

interface Props {
  widget: Widget;
  /** 選んだ部品の親の型。親が無い(root)ならundefined。slotを出すかどうかの
   * 判断にだけ使う(設計2「slotは親がCanvasのときだけ出す」)。 */
  parentType: WidgetType | undefined;
  onSetProp: (key: string, value: unknown) => void;
  onSetSlot: (slot: Slot | undefined) => void;
  onRename: (newId: string) => void;
  disabled: boolean;
  disabledReason: string | null;
}

export function Details({ widget, parentType, onSetProp, onSetSlot, onRename, disabled, disabledReason }: Props) {
  const props = (widget.props ?? {}) as Record<string, unknown>;
  const fields = fieldsFor(widget.type);
  const showSlot = parentType === "Canvas";
  const slot = widget.slot as unknown as Record<string, unknown> | undefined;

  // 幅やボーダーは、親(PreviewApp.tsx)がDetails/値パネルをまとめて置く
  // 枠側(w-72)で決める。ここではその内側に積むコンテンツだけを持つ。
  return (
    <div className="flex flex-col gap-3 bg-slate-900 p-3 text-sm text-slate-100">
      <h2 className="font-semibold text-slate-300">Details</h2>

      <label className="flex flex-col gap-1">
        <span className="text-slate-400">id</span>
        <CommitOnBlurInput value={widget.id} onCommit={onRename} disabled={disabled} className={INPUT_CLASS} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-slate-400">type</span>
        <span className="text-slate-200">{widget.type}</span>
      </label>

      {showSlot && (
        <>
          <h3 className="mt-1 text-xs font-semibold text-slate-500">slot</h3>
          {slotFields().map((field) => (
            <label key={field.name} className="flex flex-col gap-1">
              <span className="text-slate-400">{field.name}</span>
              <DetailsField
                field={field}
                value={slot?.[field.name]}
                disabled={disabled}
                onChange={(value) => {
                  // anchorを「(未設定)」にしたらslot自体を外す(anchor無しの
                  // slotはschema上書けないので、この2つを連動させる)。
                  if (field.name === "anchor" && value === undefined) {
                    onSetSlot(undefined);
                    return;
                  }
                  const next = { ...(slot ?? {}), [field.name]: value };
                  onSetSlot(next.anchor === undefined ? undefined : (next as unknown as Slot));
                }}
              />
            </label>
          ))}
        </>
      )}

      {fields.length > 0 && <h3 className="mt-1 text-xs font-semibold text-slate-500">props</h3>}
      {fields.map((field) => (
        <label key={field.name} className="flex flex-col gap-1">
          <span className="text-slate-400">{field.name}</span>
          <DetailsField
            field={field}
            value={props[field.name]}
            disabled={disabled}
            onChange={(value) => onSetProp(field.name, value)}
          />
        </label>
      ))}

      {disabled && disabledReason !== null && <p className="text-xs text-amber-400">{disabledReason}</p>}
    </div>
  );
}
