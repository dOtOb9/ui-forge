// F2-editor.md「設計 4: Undo / Redo」。
//
// 履歴は正規化済みテキストのスタック(文字列の配列)で持つ。文書のオブジェクトを
// 積まない理由: 比較が簡単(文字列同士の===で済む。「同じテキストを続けて
// 積まない」の判定もこれで済む)で、そのままファイルに書き戻せる。
//
// Reactから独立した純粋関数として置く(設計の指定どおり)ので、useState経由で
// 使うときはこの状態そのものをstateの値にする想定(src/preview/editor/
// useUiDocument.ts参照)。
export interface HistoryState {
  /** 正規化済みテキストのスタック。先頭が一番古い。 */
  readonly stack: readonly string[];
  /** 今どこを指しているか(stackへのインデックス)。 */
  readonly index: number;
}

/** 履歴の上限(設計「上限100」)。これを超えたら古い方から捨てる。 */
const MAX_HISTORY = 100;

/** 最初の1件で履歴を作る(ファイルを開いた直後に呼ぶ)。 */
export function initHistory(text: string): HistoryState {
  return { stack: [text], index: 0 };
}

/**
 * 新しい編集結果(または外部からの変更)を1つ積む。
 * - 今指している位置より後ろ(Redoで戻れたはずの未来)は消える
 * - 今指しているテキストと同じなら、何も積まない(「同じテキストを続けて
 *   積まない」。例えば値を変えずに保存しただけのケースで履歴が無駄に
 *   増えるのを防ぐ)
 * - 上限(100件)を超えたら古い方から捨てる
 */
export function pushHistory(state: HistoryState, text: string): HistoryState {
  if (state.stack[state.index] === text) return state;

  const upToCurrent = state.stack.slice(0, state.index + 1);
  const pushed = [...upToCurrent, text];
  const stack = pushed.length > MAX_HISTORY ? pushed.slice(pushed.length - MAX_HISTORY) : pushed;
  return { stack, index: stack.length - 1 };
}

export function canUndo(state: HistoryState): boolean {
  return state.index > 0;
}

export function canRedo(state: HistoryState): boolean {
  return state.index < state.stack.length - 1;
}

/** 1つ前に戻る。すでに先頭なら何もしない(同じstateを返す)。 */
export function undo(state: HistoryState): HistoryState {
  return canUndo(state) ? { stack: state.stack, index: state.index - 1 } : state;
}

/** 1つ先に進む。すでに末尾なら何もしない(同じstateを返す)。 */
export function redo(state: HistoryState): HistoryState {
  return canRedo(state) ? { stack: state.stack, index: state.index + 1 } : state;
}

/** 今指している位置の正規化済みテキスト。 */
export function currentText(state: HistoryState): string {
  return state.stack[state.index];
}
