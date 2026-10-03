// F1-foundation.md「F1-4: プレビュー」のアプリ画面構成そのもの。
// 上: 開く + パス / 中央: プレビュー / 右: 値パネル / 下: イベントログ。
import { useCallback, useEffect, useMemo, useState } from "react";
import { validate, type ValidationError } from "../core/validate";
import { collectPropsMembers, type PropsMember } from "../core/bindings";
import type { UiDocument } from "../core/model";
import { renderDocument, type BindValues, type EventHandlers } from "./render";
import { reconcileValues } from "./values";
import { ValuePanel } from "./ValuePanel";
import { EventLog, type EventLogEntry } from "./EventLog";
import { onUiFileChanged, pickUiFile, readUiFile, watchUiFile } from "./tauriBridge";

interface LoadedDoc {
  doc: UiDocument;
  members: PropsMember[];
}

export function PreviewApp() {
  const [filePath, setFilePath] = useState<string | null>(null);
  // 検証エラー時も「最後に正しく読めた状態」を表示し続ける(F1-foundation.md指定)
  // ため、loadedはエラーが出ても上書きしない。
  const [loaded, setLoaded] = useState<LoadedDoc | null>(null);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [values, setValues] = useState<BindValues>({});
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const reload = useCallback(async (path: string) => {
    let raw: string;
    try {
      raw = await readUiFile(path);
    } catch (e) {
      setErrors([{ path: "/", message: `ファイルを読み込めません: ${String(e)}` }]);
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      setErrors([{ path: "/", message: `JSONとして読めません: ${String(e)}` }]);
      return;
    }

    const validationErrors = validate(parsed);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    const doc = parsed as UiDocument;
    const members = collectPropsMembers(doc);
    setLoaded({ doc, members });
    setValues((prev) => reconcileValues(members, prev));
  }, []);

  const handleOpen = useCallback(() => {
    void (async () => {
      const path = await pickUiFile();
      if (path === null) return;
      setFilePath(path);
      await watchUiFile(path);
      await reload(path);
    })();
  }, [reload]);

  // 外部エディタでの保存を検知して読み直す(F1-foundation.md「ファイル監視」)。
  useEffect(() => {
    if (filePath === null) return undefined;
    return onUiFileChanged((changedPath) => {
      if (changedPath === filePath) void reload(changedPath);
    });
  }, [filePath, reload]);

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

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100">
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-slate-900 p-2 text-sm">
        <button
          type="button"
          onClick={handleOpen}
          className="rounded bg-slate-700 px-3 py-1 hover:bg-slate-600"
        >
          開く
        </button>
        <span className="truncate text-slate-400">{filePath ?? "ファイルが開かれていません"}</span>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* 中央: プレビュー。
            生成されるCanvasは`fixed inset-0`(ウィンドウ全面を前提にしたクラス、
            F1-foundation.mdのクラス対応表参照)なので、このペイン自身に
            `contain: layout`を付けてposition:fixedの基準をこのペインに
            閉じ込める(CSS Containmentの仕様どおり、transform同様に新しい
            containing blockを作る)。無いと、プレビュー中のCanvasが値パネルや
            イベントログの上まで覆ってしまう。 */}
        <div
          className="preview-backdrop relative flex-1 overflow-hidden"
          style={{ contain: "layout" }}
        >
          <button
            type="button"
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            className="absolute right-2 top-2 z-10 rounded bg-black/40 px-2 py-1 text-xs text-white hover:bg-black/60"
          >
            {theme === "light" ? "ライト" : "ダーク"}
          </button>

          {loaded !== null && (
            <div data-theme={theme} className="h-full w-full">
              {renderDocument(loaded.doc, values, handlers)}
            </div>
          )}

          {errors.length > 0 && (
            <div className="absolute inset-x-0 bottom-0 z-20 max-h-40 overflow-y-auto bg-red-900/90 p-2 text-xs text-red-100">
              {errors.map((e) => (
                <div key={`${e.path}:${e.message}`}>
                  <span className="font-mono">{e.path}</span>: {e.message}
                </div>
              ))}
            </div>
          )}
        </div>

        {loaded !== null && (
          <ValuePanel
            members={loaded.members}
            values={values}
            onChange={(name, value) => setValues((prev) => ({ ...prev, [name]: value }))}
          />
        )}
      </div>

      <EventLog entries={events} />
    </div>
  );
}
