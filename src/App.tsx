import { PreviewApp } from "./preview/PreviewApp";

/**
 * F1-4: 画面本体はsrc/preview/PreviewApp.tsxに全部入れてある。ここは
 * それを呼ぶだけ(point-cloud-viewer自身のApp.tsx/AppShell.tsxの分け方と同じ)。
 */
function App() {
  return <PreviewApp />;
}

export default App;
