// F2-editor.md「画面構成」: 「render.tsxの出力(=生成物と一致するHTML)に
// 選択用の要素を混ぜない。選択枠はプレビューの上に重ねた別の層に、選択中の
// 要素のgetBoundingClientRect()から描く」。
//
// この層はrender.tsx/generate.tsのどちらにも一切触れない。PreviewApp.tsxが
// renderDocument()の結果の**外側**(同じ親要素の中の、隣のきょうだい要素)に
// これを重ねるだけなので、受け入れ基準6(HTML一致テストが無改造で通る)が
// 構造的に保証される。
import { useEffect, useState, type RefObject } from "react";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function measure(container: Element, target: Element): Rect {
  const c = container.getBoundingClientRect();
  const t = target.getBoundingClientRect();
  return { top: t.top - c.top, left: t.left - c.left, width: t.width, height: t.height };
}

interface Props {
  /** 選択枠の基準にする、position:relativeな祖先(この要素の子として
   * renderDocument()の結果が描かれている)。 */
  containerRef: RefObject<HTMLDivElement | null>;
  selectedId: string | null;
}

export function SelectionOverlay({ containerRef, selectedId }: Props) {
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (selectedId === null || container === null) {
      setRect(null);
      return;
    }

    function recompute() {
      if (container === null) return;
      const target = container.querySelector(`[data-ui-id="${selectedId}"]`);
      setRect(target !== null ? measure(container, target) : null);
    }

    recompute();

    // レイアウトが変わりうるきっかけを広く拾う。「docが変わった」
    // 「値パネルで値を変えた」「テーマを切り替えた」のどれであっても、
    // 結局はcontainer配下のDOMが変わるかウィンドウがリサイズされるかの
    // どちらかなので、Reactの状態を1つずつ依存に挙げる代わりにDOM自体を
    // 観察する(ResizeObserver: 要素のサイズ変化、MutationObserver:
    // 属性・テキスト・子要素の変化、resizeイベント: ウィンドウ全体)。
    const resizeObserver = new ResizeObserver(recompute);
    resizeObserver.observe(container);
    const mutationObserver = new MutationObserver(recompute);
    mutationObserver.observe(container, { attributes: true, childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", recompute);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [containerRef, selectedId]);

  if (rect === null) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-10 rounded border-2 border-sky-400"
      style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
    />
  );
}
