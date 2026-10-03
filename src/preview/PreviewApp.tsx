// F1-foundation.md「F1-4: プレビュー」のアプリ画面構成そのもの。
// 上: 開く + パス / 中央: プレビュー / 右: 値パネル / 下: イベントログ。
//
// P1: ファイルの選択・読み込み・監視はhost/index.tsが選んだFileHost経由に
// なった(F1まではtauriBridge.tsを直接呼んでいた)。このファイルはFileHost /
// OpenedFileインターフェースだけを見て、動いているのがWindows・Android・Web
// のどれかを知らない(P1-platforms.md「設計」)。
import { useCallback, useEffect, useMemo, useState } from "react";
import { validate, type ValidationError } from "../core/validate";
import { collectPropsMembers, type PropsMember } from "../core/bindings";
import type { UiDocument } from "../core/model";
import { renderDocument, type BindValues, type EventHandlers } from "./render";
import { reconcileValues } from "./values";
import { ValuePanel } from "./ValuePanel";
import { EventLog, type EventLogEntry } from "./EventLog";
import { resolveFileHost } from "./host";
import type { FileHost, OpenedFile } from "./host/FileHost";

interface LoadedDoc {
  doc: UiDocument;
  members: PropsMember[];
}

export function PreviewApp() {
  // どのFileHostを使うかの解決自体が非同期(AndroidかどうかはRustに問い合わせて
  // 初めて分かるため。host/index.ts参照)なので、マウント時に一度だけ解決して
  // 保持する。
  const [host, setHost] = useState<FileHost | null>(null);
  const [openedFile, setOpenedFile] = useState<OpenedFile | null>(null);
  // 検証エラー時も「最後に正しく読めた状態」を表示し続ける(F1-foundation.md指定)
  // ため、loadedはエラーが出ても上書きしない。
  const [loaded, setLoaded] = useState<LoadedDoc | null>(null);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [values, setValues] = useState<BindValues>({});
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    void resolveFileHost().then(setHost);
  }, []);

  const reload = useCallback(async (file: OpenedFile) => {
    let raw: string;
    try {
      raw = await file.read();
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

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100">
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-slate-900 p-2 text-sm">
        <button
          type="button"
          onClick={handleOpen}
          disabled={host === null}
          className="rounded bg-slate-700 px-3 py-1 hover:bg-slate-600 disabled:opacity-50"
        >
          開く
        </button>
        <span className="truncate text-slate-400">
          {openedFile?.displayName ?? "ファイルが開かれていません"}
        </span>
        {/* P1-platforms.md「Web版でFile System Access APIが無いブラウザ」の注意書き。
            ファイルを開く前から出す(host解決後は常に分かる情報であり、開いてから
            気づくのでは手遅れになりうるため)。 */}
        {host !== null && !host.supportsAutoReload && (
          <span className="text-amber-400">
            このブラウザではファイルの変更を自動で読み直せません(Chrome / Edge を推奨)
          </span>
        )}
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
