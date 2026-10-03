// Tauri(Android)版のFileHost実装。P1-platforms.md「設計」の表のとおり:
// - 「開く」のダイアログはデスクトップと同じ@tauri-apps/plugin-dialog。Androidでは
//   `content://` URIが返る
// - 読み込みは自前のRustコマンドを経由せず、@tauri-apps/plugin-fsの
//   readTextFile()に`content://` URIをそのまま渡す(Rust側に`content://`を
//   扱うコードを増やさないため。capabilities/default.jsonのfs:read-files
//   permissionがこれを許可する)
// - `content://` URIはファイルシステム上のパスではなく、Rustのnotify(watch.rs)
//   では監視できないため、変更検知はhost/poll.tsの共通ポーリングで1秒ごとに
//   中身を読み直し、前回の中身(文字列そのもの)と比較する
//
// @tauri-apps/*のAPIを直接見てよいのはこのファイルとhost/tauri-desktop.ts・
// host/tauri-platform.tsだけ(P1-platforms.md「Tauriのimportを閉じ込める」)。
import { readTextFile } from "@tauri-apps/plugin-fs";
import { open } from "@tauri-apps/plugin-dialog";
import type { FileHost, OpenedFile } from "./FileHost";
import { pollForChange } from "./poll";

function openedFileFor(uri: string): OpenedFile {
  return {
    // content:// URIそのものを表示名にする。所有者にとっては素のパスより
    // 読みにくいが、ファイル名だけを取り出すAndroid独自の解析を増やすほどの
    // 利点が無いと判断した(退けた案: URIの末尾を file名として切り出す。
    // `content://`のパス構造はプロバイダ依存で、素朴な文字列処理では
    // 必ずしもファイル名にならない)。
    displayName: uri,
    read: () => readTextFile(uri),
    watch: (handler) => pollForChange(() => readTextFile(uri), (a, b) => a === b, handler),
  };
}

export const tauriAndroidHost: FileHost = {
  // ポーリングで検知するので自動で読み直せる(ただしdesktopのnotifyのような
  // 即時性はなく、最大1秒の遅れがある。P1-platforms.mdの設計表どおり)。
  supportsAutoReload: true,

  async pick() {
    const uri = await open({
      multiple: false,
      filters: [{ name: "ui-forge document", extensions: ["ui"] }],
    });
    return typeof uri === "string" ? openedFileFor(uri) : null;
  },
};
