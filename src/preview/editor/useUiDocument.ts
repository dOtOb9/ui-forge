// F2-editor.md「作業の分け方 F2-4: 画面」の配線部分。F1/P1のPreviewApp.tsxが
// 持っていたloaded/errors/valuesの状態に、選択・モード・Undo/Redo・書き戻しを
// 足して1つのhookにまとめた(PreviewApp.tsx自体が肥大化しないように)。
//
// 「書き戻し」(設計3)と「Undo/Redo」(設計4)の要点:
// - 編集(Hierarchy/Detailsの操作)は即座にformatDocumentで正規化してファイルへ
//   書く。保存ボタンは無い
// - 自分の書き込みが監視で返ってきても、読み直した中身が「今の文書」の
//   正規化結果と同じなら何もしない(reload()参照)。これでUndo履歴が
//   自分の書き込みのエコーで汚れることと、無駄な再描画を防ぐ
// - 外部からの変更(AIやVS Codeの保存)は、内容が変わっていれば履歴に積む。
//   これでAIの編集もUndoで取り消せる
import { useCallback, useEffect, useRef, useState } from "react";
import { validate, type ValidationError } from "../../core/validate";
import { collectPropsMembers, type PropsMember } from "../../core/bindings";
import { formatDocument } from "../../core/format";
import { findWidget, type EditResult } from "../../core/edit";
import type { UiDocument } from "../../core/model";
import {
  canRedo as historyCanRedo,
  canUndo as historyCanUndo,
  currentText,
  initHistory,
  pushHistory,
  redo as historyRedo,
  undo as historyUndo,
  type HistoryState,
} from "../history";
import { reconcileValues } from "../values";
import type { BindValues } from "../render";
import type { OpenedFile } from "../host/FileHost";

export interface LoadedDoc {
  doc: UiDocument;
  members: PropsMember[];
}

export type EditorMode = "edit" | "operate";

export interface UiDocumentEditor {
  loaded: LoadedDoc | null;
  errors: ValidationError[];
  values: BindValues;
  setValue: (name: string, value: boolean | string) => void;
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  /** 直前の編集操作の失敗理由、または直前の書き込みの失敗。両方とも
   * 「赤い帯で出す、編集内容は画面に残す」という同じ扱いなので1つにまとめてある。 */
  actionError: string | null;
  /** このファイルに書き込めない(ブラウザの制約などで`supportsWrite`がfalse)。 */
  readOnly: boolean;
  /** 今、Hierarchy/Detailsでの編集を受け付けてよいか。readOnlyに加えて、
   * 文書がまだ(または今は)正しく読めていないときもfalseになる
   * (設計5「不正なファイルのときは編集を無効にする」)。 */
  canEdit: boolean;
  applyEdit: (result: EditResult) => void;
  reload: (file: OpenedFile) => Promise<void>;
}

export function useUiDocument(openedFile: OpenedFile | null): UiDocumentEditor {
  const [loaded, setLoaded] = useState<LoadedDoc | null>(null);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [values, setValues] = useState<BindValues>({});
  const [mode, setMode] = useState<EditorMode>("edit"); // 既定は編集モード(設計「画面構成」)。
  const [selectedIdRaw, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryState | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // 非同期処理やイベントハンドラの中から「今committされている値」を同期的に
  // 読むためのref。state(loaded/history)はクロージャ経由だと古い値のままに
  // なりうるので、effectでrefを追従させておく(「最新のrefを読む」という
  // よく使われる形)。
  const loadedRef = useRef(loaded);
  const historyRef = useRef(history);
  useEffect(() => {
    loadedRef.current = loaded;
  }, [loaded]);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  // 選択していた部品が、編集や外部からの変更で無くなっていたら選択を外す。
  // effectでsetState(react-hooks/set-state-in-effectに引っかかる)する代わりに、
  // 公開する値そのものを毎レンダーその場で導く(「無くなっていたらnull」を
  // 常に満たす派生値にする。内部のselectedIdRaw自体は古いidを持ち続けて
  // いてよい。次に本当に選択されたときに上書きされるだけの死んだ値になる)。
  const selectedId =
    selectedIdRaw !== null && loaded !== null && findWidget(loaded.doc.root, selectedIdRaw) !== undefined
      ? selectedIdRaw
      : null;

  const writeBack = useCallback(
    async (text: string) => {
      if (openedFile === null || !openedFile.supportsWrite) return;
      try {
        await openedFile.write(text);
        setActionError(null);
      } catch (e) {
        // 設計3「書き込みに失敗したら、画面上部に赤い帯で出す。編集内容は
        // 画面に残す」。loaded/historyはここでは変えない(すでに編集後の
        // 内容で更新済み)。
        setActionError(`書き込みに失敗しました: ${String(e)}`);
      }
    },
    [openedFile],
  );

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
    const canonical = formatDocument(doc);
    const prev = loadedRef.current;
    if (prev !== null && formatDocument(prev.doc) === canonical) {
      // 設計3: 自分の書き込みが監視で返ってきただけ、または内容が変わらない
      // 外部の保存。何もしない(履歴も汚さない)。
      return;
    }

    const members = collectPropsMembers(doc);
    setLoaded({ doc, members });
    setValues((v) => reconcileValues(members, v));
    const h = historyRef.current;
    setHistory(h === null ? initHistory(canonical) : pushHistory(h, canonical));
  }, []);

  const applyEdit = useCallback(
    (result: EditResult) => {
      if (!result.ok) {
        setActionError(result.reason);
        return;
      }
      setActionError(null);
      const canonical = formatDocument(result.doc);
      const members = collectPropsMembers(result.doc);
      setLoaded({ doc: result.doc, members });
      setValues((v) => reconcileValues(members, v));
      const h = historyRef.current;
      setHistory(h === null ? initHistory(canonical) : pushHistory(h, canonical));
      void writeBack(canonical);
    },
    [writeBack],
  );

  /** Undo/Redoで戻ったテキストを今の文書として反映する。履歴そのものの移動は
   * 呼び出し側(undo/redo)が先に済ませている。 */
  const applyHistoryText = useCallback(
    (text: string) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        return; // 履歴には正規化済みの有効な文書しか積まれないはずの防御的なガード。
      }
      if (validate(parsed).length > 0) return;
      const doc = parsed as UiDocument;
      const members = collectPropsMembers(doc);
      setLoaded({ doc, members });
      setValues((v) => reconcileValues(members, v));
      void writeBack(text);
    },
    [writeBack],
  );

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h === null) return;
    const next = historyUndo(h);
    if (next === h) return; // 先頭(これ以上戻れない)。
    setHistory(next);
    applyHistoryText(currentText(next));
  }, [applyHistoryText]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h === null) return;
    const next = historyRedo(h);
    if (next === h) return; // 末尾(これ以上進めない)。
    setHistory(next);
    applyHistoryText(currentText(next));
  }, [applyHistoryText]);

  // 設計4: Ctrl+Z / Ctrl+Shift+Z(とCtrl+Y)。テキスト入力欄にフォーカスが
  // あるときは何もしない(idの改名欄などでブラウザ標準の取り消しを邪魔
  // しないため。入力欄はCommitOnBlurInputがblur/Enterで確定する作りなので、
  // ここでの早期returnが「打鍵中のUndo」を誤って奪うことは無い)。
  useEffect(() => {
    function isEditableElementFocused(): boolean {
      const el = document.activeElement;
      if (el === null) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement).isContentEditable;
    }
    function onKeyDown(e: KeyboardEvent) {
      if (!e.ctrlKey || isEditableElementFocused()) return;
      const key = e.key.toLowerCase();
      if (key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (key === "z") {
        e.preventDefault();
        undo();
      } else if (key === "y") {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  const readOnly = openedFile !== null && !openedFile.supportsWrite;

  return {
    loaded,
    errors,
    values,
    setValue: (name, value) => setValues((v) => ({ ...v, [name]: value })),
    mode,
    setMode,
    selectedId,
    setSelectedId,
    canUndo: history !== null && historyCanUndo(history),
    canRedo: history !== null && historyCanRedo(history),
    undo,
    redo,
    actionError,
    readOnly,
    canEdit: !readOnly && errors.length === 0 && loaded !== null,
    applyEdit,
    reload,
  };
}

