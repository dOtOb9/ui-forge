// Tauri(デスクトップ=Windows)版のFileHost実装。F1のsrc/preview/tauriBridge.ts
// をこの構成に吸収したもので、挙動は変えていない(P1-1「この時点でWindows版の
// 振る舞いはF1と変わらないこと」)。読み込み・監視はRust側のsrc-tauri/src/watch.rs
// (read_ui_file/watch_ui_file)、「開く」のダイアログは@tauri-apps/plugin-dialog
// を直接呼ぶ(F1と同じ理由: ダイアログ自体を薄くラップするコマンドを増やす
// 理由が無い)。
//
// @tauri-apps/*のAPIを直接見てよいのはこのファイルとhost/tauri-android.ts・
// host/tauri-platform.tsだけ(P1-platforms.md「Tauriのimportを閉じ込める」。
// point-cloud-viewerの規約2と同じ)。
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type { FileHost, OpenedFile } from "./FileHost";

async function readUiFile(path: string): Promise<string> {
  return invoke<string>("read_ui_file", { path });
}

async function watchUiFile(path: string): Promise<void> {
  await invoke("watch_ui_file", { path });
}

// F2-3: 書き込みもRust側に足した`write_ui_file`コマンド経由(read_ui_fileと同じ
// 理由。パスを直接扱えるのはデスクトップだけなので、Rustのstd::fs::writeに
// そのまま任せられる)。
async function writeUiFile(path: string, text: string): Promise<void> {
  await invoke("write_ui_file", { path, text });
}

/**
 * pathのOpenedFileを作る。Rust側の監視(watch_ui_file)はwatch()が呼ばれた時点で
 * 開始する(pick()で選んだだけではまだ監視を始めない。「選ぶ」と「監視する」を
 * わざと分けているFileHostの設計に合わせた)。
 */
function openedFileFor(path: string): OpenedFile {
  return {
    displayName: path,
    read: () => readUiFile(path),
    supportsWrite: true,
    write: (text) => writeUiFile(path, text),
    watch(handler) {
      let unlisten: (() => void) | undefined;
      let cancelled = false;

      void watchUiFile(path);
      listen<{ path: string }>("ui-file-changed", (event) => {
        if (event.payload.path === path) handler();
      }).then((fn) => {
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
    },
  };
}

export const tauriDesktopHost: FileHost = {
  // notifyによるファイル監視(watch.rs)が使えるので自動で読み直せる。
  supportsAutoReload: true,

  async pick() {
    const path = await open({
      multiple: false,
      filters: [{ name: "ui-forge document", extensions: ["ui"] }],
    });
    return typeof path === "string" ? openedFileFor(path) : null;
  },
};
