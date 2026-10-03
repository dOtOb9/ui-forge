// F2-editor.md「画面構成」の左側パネル。木構造の一覧と、部品を足す/消す/
// 並べ替えるボタン。
import { useState } from "react";
import { isContainerType, type UiDocument, type Widget, type WidgetType } from "../../core/model";
import { findWidget } from "../../core/edit";

const WIDGET_TYPES: readonly WidgetType[] = ["Canvas", "HBox", "VBox", "Panel", "Text", "Button"];

const BUTTON_CLASS = "rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40";

function HierarchyRow({
  widget,
  depth,
  selectedId,
  onSelect,
}: {
  widget: Widget;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const selected = widget.id === selectedId;
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(widget.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onSelect(widget.id);
        }}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        className={`cursor-pointer truncate rounded py-0.5 pr-1 ${selected ? "bg-slate-700" : "hover:bg-slate-800"}`}
      >
        <span className="text-slate-500">{widget.type}</span> {widget.id}
      </div>
      {(widget.children ?? []).map((child) => (
        <HierarchyRow key={child.id} widget={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </>
  );
}

interface Props {
  doc: UiDocument;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (parentId: string, type: WidgetType) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, delta: -1 | 1) => void;
  disabled: boolean;
}

export function Hierarchy({ doc, selectedId, onSelect, onAdd, onRemove, onMove, disabled }: Props) {
  const [addType, setAddType] = useState<WidgetType>("Text");

  const selected = selectedId !== null ? findWidget(doc.root, selectedId) : undefined;
  // 追加先: 選択中の部品がコンテナならその中、そうでなければroot
  // (何も選んでいない・コンテナでない部品を選んでいるときの既定の置き場所。
  // 「選んだ部品の親に足す」ほうが直感的な場合もあるが、親を遡る分
  // 実装と説明が増えるため、まずは単純な規則を採った)。
  const addTargetId = selected !== undefined && isContainerType(selected.type) ? selected.id : doc.root.id;
  const canDeleteOrMove = selectedId !== null && selectedId !== doc.root.id;

  return (
    <div className="flex h-full w-64 shrink-0 flex-col gap-2 border-r border-white/10 bg-slate-900 p-3 text-sm text-slate-100">
      <h2 className="font-semibold text-slate-300">Hierarchy</h2>
      <div className="flex-1 overflow-y-auto">
        <HierarchyRow widget={doc.root} depth={0} selectedId={selectedId} onSelect={onSelect} />
      </div>
      <div className="flex flex-wrap items-center gap-1 border-t border-white/10 pt-2">
        <select
          value={addType}
          disabled={disabled}
          onChange={(e) => setAddType(e.target.value as WidgetType)}
          className="rounded border border-white/10 bg-slate-800 px-1 py-1 text-xs disabled:opacity-40"
        >
          {WIDGET_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <button type="button" disabled={disabled} onClick={() => onAdd(addTargetId, addType)} className={BUTTON_CLASS}>
          +部品
        </button>
        <button
          type="button"
          disabled={disabled || !canDeleteOrMove}
          onClick={() => selectedId !== null && onRemove(selectedId)}
          className={BUTTON_CLASS}
        >
          削除
        </button>
        <button
          type="button"
          disabled={disabled || !canDeleteOrMove}
          onClick={() => selectedId !== null && onMove(selectedId, -1)}
          className={BUTTON_CLASS}
          title="前に動かす"
        >
          ↑
        </button>
        <button
          type="button"
          disabled={disabled || !canDeleteOrMove}
          onClick={() => selectedId !== null && onMove(selectedId, 1)}
          className={BUTTON_CLASS}
          title="後に動かす"
        >
          ↓
        </button>
      </div>
    </div>
  );
}
