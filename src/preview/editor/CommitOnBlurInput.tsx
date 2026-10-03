// F2-editor.md「Detailsパネルの入力欄」。
//
// 文字入力を1打鍵ごとに書き戻すと、入力途中の不完全な値(例: event名を
// "onToggleLayer"と打ち終える前の"onT")がそのままファイルに書かれる。
// これが監視で読み直されると検証エラーになり、設計5「不正なファイルの
// ときは編集を無効にする」によってDetails自体が無効化されてしまう
// (打っている最中の入力欄がロックされるという悪い体験になる)。
//
// そのため文字入力系の項目(id改名・string値・bind名・event名)は、
// フォーカスを外す(blur)かEnterを押すまでは画面上だけの下書き(draft)として
// 持ち、確定したタイミングで初めてonCommitを呼ぶ。Escapeで編集前の値に戻せる。
import { useState } from "react";

interface Props {
  value: string;
  onCommit: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function CommitOnBlurInput({ value, onCommit, disabled, placeholder, className }: Props) {
  const [draft, setDraft] = useState(value);
  // 直近に下書きを同期した時点のvalue(Reactが推奨する「propsの変化に合わせて
  // stateをリセットする」パターン: useEffectでsetStateすると二重レンダーの
  // 原因になる"react-hooks/set-state-in-effect"に引っかかるため、effectを
  // 使わずレンダー中に直接比較して同期する)。
  const [syncedValue, setSyncedValue] = useState(value);

  // 選択し直した・Undo/Redoした等、外部から値が変わったときだけ下書きを
  // 追従させる(打っている最中のdraftを上書きしないよう、valueそのものの
  // 変化だけを見る)。
  if (value !== syncedValue) {
    setSyncedValue(value);
    setDraft(value);
  }

  return (
    <input
      type="text"
      value={draft}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          setDraft(value);
          e.currentTarget.blur();
        }
      }}
      className={className}
    />
  );
}
