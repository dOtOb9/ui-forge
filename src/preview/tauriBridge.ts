// Tauri呼び出しをこの1ファイルに閉じ込める。PreviewApp.tsxは「ファイルを選ぶ/
// 読む/監視する」という意味だけを知っていればよく、@tauri-apps/*のAPIの形
// (invokeの引数名やイベント名の文字列など)はここだけが知っていればよい。
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";

/** ファイルダイアログで`.ui`ファイルを選ばせる。選ばなかった場合はnull。 */
export async function pickUiFile(): Promise<string | null> {
  const path = await open({
    multiple: false,
    filters: [{ name: "ui-forge document", extensions: ["ui"] }],
  });
  return typeof path === "string" ? path : null;
}

/** 指定したパスのファイルをテキストとして読む(src-tauri/src/watch.rsのread_ui_file)。 */
export async function readUiFile(path: string): Promise<string> {
  return invoke<string>("read_ui_file", { path });
}

/** 指定したパスの変更監視を開始する(src-tauri/src/watch.rsのwatch_ui_file)。
 * 新しいパスを渡すたびに、前の監視はRust側で置き換えられる。 */
export async function watchUiFile(path: string): Promise<void> {
  await invoke("watch_ui_file", { path });
}

/** ファイルが変わるたびにhandlerを呼ぶ。返り値を呼ぶと購読を止める。 */
export function onUiFileChanged(handler: (path: string) => void): () => void {
  let unlisten: (() => void) | undefined;
  let cancelled = false;

  listen<{ path: string }>("ui-file-changed", (event) => handler(event.payload.path)).then((fn) => {
    if (cancelled) {
      fn();
    } else {
      unlisten = fn;
    }
  });

  return () => {
    cancelled = true;
    unlisten?.();
  };
}
