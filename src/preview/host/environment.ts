// 実行環境の判定。point-cloud-viewerのsrc/datasource/environment.tsと同じ考え方・
// 同じ判定方法(P1-platforms.md「プラットフォームの判定」)。Tauriのnpmパッケージは
// importしない(判定だけなら、Tauriが起動時にwindowへ生やす目印
// `__TAURI_INTERNALS__`を見れば十分で、「@tauri-apps/*のimportはhost/tauri-*.ts
// だけ」という規約に触れない)。

/** TauriのWebView上で動いているか(Windows・Android共通)。 */
export function isTauriEnvironment(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * ブラウザがFile System Access API(`showOpenFilePicker`)を持っているか。
 * Chrome/Edge等の一部ブラウザのみで、Firefox/Safariには無い
 * (P1-platforms.md「Web版でFile System Access APIが無いブラウザ」)。
 */
export function hasFileSystemAccessApi(): boolean {
  return typeof window !== "undefined" && "showOpenFilePicker" in window;
}
