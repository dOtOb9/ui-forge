// F2-editor.md「画面構成」の上段のバー。開く+パス・編集/操作の切り替え・
// Undo/Redo・保存状態をまとめる(F1/P1のPreviewApp.tsx本体から分離した)。
import type { EditorMode } from "./useUiDocument";

interface Props {
  displayName: string | null;
  onOpen: () => void;
  openDisabled: boolean;
  autoReloadWarning: boolean;
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  statusText: string;
}

export function Toolbar({
  displayName,
  onOpen,
  openDisabled,
  autoReloadWarning,
  mode,
  onModeChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  statusText,
}: Props) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-slate-900 p-2 text-sm">
      <button
        type="button"
        onClick={onOpen}
        disabled={openDisabled}
        className="rounded bg-slate-700 px-3 py-1 hover:bg-slate-600 disabled:opacity-50"
      >
        開く
      </button>
      <span className="truncate text-slate-400">{displayName ?? "ファイルが開かれていません"}</span>

      <div className="flex shrink-0 overflow-hidden rounded border border-white/10 text-xs">
        <button
          type="button"
          onClick={() => onModeChange("edit")}
          className={`px-2 py-1 ${mode === "edit" ? "bg-slate-700" : "hover:bg-slate-800"}`}
        >
          編集
        </button>
        <button
          type="button"
          onClick={() => onModeChange("operate")}
          className={`px-2 py-1 ${mode === "operate" ? "bg-slate-700" : "hover:bg-slate-800"}`}
        >
          操作
        </button>
      </div>

      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="元に戻す(Ctrl+Z)"
          className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600 disabled:opacity-30"
        >
          ↶
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="やり直す(Ctrl+Shift+Z / Ctrl+Y)"
          className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600 disabled:opacity-30"
        >
          ↷
        </button>
      </div>

      <span className="shrink-0 text-xs text-slate-500">{statusText}</span>

      {autoReloadWarning && (
        <span className="text-amber-400">
          このブラウザではファイルの変更を自動で読み直せません(Chrome / Edge を推奨)
        </span>
      )}
    </div>
  );
}
