// F1-foundation.md「F1-4: プレビュー」+ F2-editor.md「画面構成」のアプリ画面
// 構成そのもの。上: ツールバー(F2) / 左: Hierarchy(F2) / 中央: プレビュー+
// 選択枠(F2) / 右: Details(F2、選択時のみ)と値パネル(F1、常時)を縦に並べる /
// 下: イベントログ(F1)。
//
// ファイルの選択・読み込み・監視はP1のFileHost経由(変わっていない)。
// 編集・Undo/Redo・書き戻しの状態と手続きはsrc/preview/editor/useUiDocument.ts
// にまとめてあり、このファイル自身は「hookの値を各パネルに配る」組み立て役に
// 留めている(肥大化を避けるため。本をたどるときもここから各ファイルへ辿れる)。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addChild, findParent, findWidget, moveWidget, removeWidget, renameWidget, setProp, setSlot } from "../core/edit";
import type { Slot, WidgetType } from "../core/model";
import { renderDocument, type EventHandlers } from "./render";
import { ValuePanel } from "./ValuePanel";
import { EventLog, type EventLogEntry } from "./EventLog";
import { resolveFileHost } from "./host";
import type { FileHost, OpenedFile } from "./host/FileHost";
import { useUiDocument } from "./editor/useUiDocument";
import { Toolbar } from "./editor/Toolbar";
import { Hierarchy } from "./editor/Hierarchy";
import { Details } from "./editor/Details";
import { SelectionOverlay } from "./editor/SelectionOverlay";

export function PreviewApp() {
  // どのFileHostを使うかの解決自体が非同期(AndroidかどうかはRustに問い合わせて
  // 初めて分かるため。host/index.ts参照)なので、マウント時に一度だけ解決して
  // 保持する。
  const [host, setHost] = useState<FileHost | null>(null);
  const [openedFile, setOpenedFile] = useState<OpenedFile | null>(null);
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const editor = useUiDocument(openedFile);
  const { loaded, reload, applyEdit } = editor;

  useEffect(() => {
    void resolveFileHost().then(setHost);
  }, []);

  const handleOpen = useCallback(() => {
    if (host === null) return;
    void (async () => {
      const file = await host.pick();
      if (file === null) return;
      setOpenedFile(file);
      await reload(file);
    })();
  }, [host, reload]);

  // 外部での変更を検知して読み直す(F1-foundation.md「ファイル監視」)。
  // 検知の仕組みはホストごとに違う(notify / ポーリング)が、ここはOpenedFile.watch
  // だけを呼ぶのでその違いを知らない。
  useEffect(() => {
    if (openedFile === null) return undefined;
    return openedFile.watch(() => void reload(openedFile));
  }, [openedFile, reload]);

  const handlers = useMemo<EventHandlers>(() => {
    const map: EventHandlers = {};
    if (loaded === null) return map;
    for (const member of loaded.members) {
      if (member.kind !== "event") continue;
      const name = member.name;
      map[name] = () => setEvents((prev) => [...prev, { name, at: new Date() }]);
    }
    return map;
  }, [loaded]);

  // F2-editor.md「画面構成」: 編集モードでは、プレビュー上のクリックは
  // 部品の選択になり、ボタンのイベントは発火しない。capture段階でここで
  // 止めることで、ボタン自身(bubble段階)のonClickまで到達させない
  // (render.tsxの出力自体は一切変更していない。受け入れ基準6)。
  // 操作モードではF1と同じ(何もしない、イベントはそのまま発火する)。
  const handlePreviewClickCapture = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (editor.mode !== "edit") return;
      const target = e.target as Element;
      const hit = target.closest("[data-ui-id]");
      if (hit === null) return;
      e.preventDefault();
      e.stopPropagation();
      editor.setSelectedId(hit.getAttribute("data-ui-id"));
    },
    [editor],
  );

  const selectedWidget =
    loaded !== null && editor.selectedId !== null ? findWidget(loaded.doc.root, editor.selectedId) : undefined;

  const disabledReason = editor.readOnly
    ? "このファイルには書き込めません(読み取り専用)"
    : editor.errors.length > 0
      ? "ファイルの内容が正しく読めていません(上の帯を確認してください)"
      : null;

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100">
      <Toolbar
        displayName={openedFile?.displayName ?? null}
        onOpen={handleOpen}
        openDisabled={host === null}
        autoReloadWarning={host !== null && !host.supportsAutoReload}
        mode={editor.mode}
        onModeChange={editor.setMode}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onUndo={editor.undo}
        onRedo={editor.redo}
        statusText={editor.actionError === null ? (openedFile !== null ? "保存済み" : "") : "エラー"}
      />

      {/* 設計3: 書き込み/編集操作の失敗は画面上部に赤い帯で出す(F1の検証エラーの
          帯とは別。あちらは「ファイルの内容」についての帯、こちらは
          「直前の操作」についての帯)。 */}
      {editor.actionError !== null && (
        <div className="shrink-0 bg-red-900/90 p-2 text-xs text-red-100">{editor.actionError}</div>
      )}

      <div className="flex min-h-0 flex-1">
        {loaded !== null && (
          <Hierarchy
            doc={loaded.doc}
            selectedId={editor.selectedId}
            onSelect={editor.setSelectedId}
            onAdd={(parentId, type: WidgetType) => applyEdit(addChild(loaded.doc, parentId, type))}
            onRemove={(id) => applyEdit(removeWidget(loaded.doc, id))}
            onMove={(id, delta) => applyEdit(moveWidget(loaded.doc, id, delta))}
            disabled={!editor.canEdit}
          />
        )}

        {/* 中央: プレビュー。
            生成されるCanvasは`fixed inset-0`(ウィンドウ全面を前提にしたクラス、
            F1-foundation.mdのクラス対応表参照)なので、このペイン自身に
            `contain: layout`を付けてposition:fixedの基準をこのペインに
            閉じ込める(CSS Containmentの仕様どおり、transform同様に新しい
            containing blockを作る)。無いと、プレビュー中のCanvasが値パネルや
            イベントログの上まで覆ってしまう。 */}
        <div className="preview-backdrop relative flex-1 overflow-hidden" style={{ contain: "layout" }}>
          <button
            type="button"
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            className="absolute right-2 top-2 z-20 rounded bg-black/40 px-2 py-1 text-xs text-white hover:bg-black/60"
          >
            {theme === "light" ? "ライト" : "ダーク"}
          </button>

          {loaded !== null && (
            <div
              ref={previewContainerRef}
              data-theme={theme}
              className="relative h-full w-full"
              onClickCapture={handlePreviewClickCapture}
            >
              {/* renderDocument()の結果はそのまま、何も混ぜない(受け入れ基準6)。
                  選択枠はこの隣に重ねた別の要素(SelectionOverlay)で描く。 */}
              {renderDocument(loaded.doc, editor.values, handlers)}
              <SelectionOverlay containerRef={previewContainerRef} selectedId={editor.selectedId} />
            </div>
          )}

          {editor.errors.length > 0 && (
            <div className="absolute inset-x-0 bottom-0 z-20 max-h-40 overflow-y-auto bg-red-900/90 p-2 text-xs text-red-100">
              {editor.errors.map((e) => (
                <div key={`${e.path}:${e.message}`}>
                  <span className="font-mono">{e.path}</span>: {e.message}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 画面構成の右側: Details(選んだ部品、F2)と値パネル(F1)を縦に並べる
            (設計の画面図どおり。どちらか一方だけを出すのではない)。 */}
        {loaded !== null && (
          <div className="flex h-full w-72 shrink-0 flex-col border-l border-white/10">
            {selectedWidget !== undefined && (
              <div className="max-h-[50%] shrink-0 overflow-y-auto border-b border-white/10">
                <Details
                  widget={selectedWidget}
                  parentType={findParent(loaded.doc.root, selectedWidget.id)?.type}
                  onSetProp={(key, value) => applyEdit(setProp(loaded.doc, selectedWidget.id, key, value))}
                  onSetSlot={(slot: Slot | undefined) => applyEdit(setSlot(loaded.doc, selectedWidget.id, slot))}
                  onRename={(newId) => applyEdit(renameWidget(loaded.doc, selectedWidget.id, newId))}
                  disabled={!editor.canEdit}
                  disabledReason={disabledReason}
                />
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ValuePanel members={loaded.members} values={editor.values} onChange={editor.setValue} />
            </div>
          </div>
        )}
      </div>

      <EventLog entries={events} />
    </div>
  );
}
