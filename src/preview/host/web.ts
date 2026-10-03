// Web版のFileHost実装。P1-platforms.md「設計」の表のとおり2通りある:
// - `webFileSystemAccessHost`: File System Access API(`showOpenFilePicker`)が
//   あるブラウザ(Chrome/Edge)向け。変更検知はhost/poll.tsで`lastModified`/
//   `size`を1秒ごとに比べる
// - `webInputFallbackHost`: 無いブラウザ(Firefox/Safari)向け。`<input
//   type="file">`で開くだけで、変更検知はできない(`supportsAutoReload:
//   false`。PreviewApp.tsxがこれを見て注意書きを出す)
//
// どちらも@tauri-apps/*をimportしない(Web版のビルドにTauriの呼び出しを
// 持ち込まないため。P1-platforms.md「Tauriのimportを閉じ込める」)。
import type { FileHost, OpenedFile } from "./FileHost";
import { pollForChange } from "./poll";

/** FSAのFileSystemFileHandleから、変更検知に使う軽いスナップショットを取る。
 *  中身をまるごと比べるより軽い(P1-platforms.mdの表どおり)。 */
async function snapshotOf(handle: FileSystemFileHandle): Promise<{ size: number; lastModified: number }> {
  const file = await handle.getFile();
  return { size: file.size, lastModified: file.lastModified };
}

function sameSnapshot(
  a: { size: number; lastModified: number },
  b: { size: number; lastModified: number },
): boolean {
  return a.size === b.size && a.lastModified === b.lastModified;
}

/**
 * F2-3「初回に読み書きの許可を求める」。`showOpenFilePicker`が渡すハンドルは
 * 既定で読み取り権限しか無く、書き込むには`requestPermission({mode:
 * "readwrite"})`で読み書き権限への引き上げを別途求める必要がある
 * (ブラウザの確認ダイアログが出るのは実際にこれを呼んだときだけなので、
 * ファイルを開いた直後ではなく、実際に書き込もうとした最初の1回に遅延させる。
 * `requestPermission`自体はブラウザが既に許可済みなら即座にgrantedを返すので、
 * 2回目以降の`write()`では確認は出ない)。
 *
 * `requestPermission`はlib.dom.d.ts未収録の実験的APIなので無い場合もある
 * (file-system-access.d.ts参照)。無ければ権限確認自体をスキップし、
 * `createWritable()`に直接委ねる(それでも権限が無ければそちらが失敗する)。
 */
async function ensureWritePermission(handle: FileSystemFileHandle): Promise<void> {
  const state = await handle.requestPermission?.({ mode: "readwrite" });
  if (state !== undefined && state !== "granted") {
    throw new Error("このファイルへの書き込みが許可されませんでした");
  }
}

export const webFileSystemAccessHost: FileHost = {
  supportsAutoReload: true,

  async pick() {
    let handles: FileSystemFileHandle[];
    try {
      handles = await window.showOpenFilePicker!({
        multiple: false,
        types: [{ description: "ui-forge document", accept: { "application/json": [".ui"] } }],
      });
    } catch (e) {
      // ダイアログをキャンセルするとAbortErrorが投げられる(他のpick()実装の
      // 「キャンセルならnull」に合わせる)。
      if (e instanceof DOMException && e.name === "AbortError") return null;
      throw e;
    }
    const handle = handles[0];

    const file: OpenedFile = {
      displayName: handle.name,
      read: async () => (await handle.getFile()).text(),
      supportsWrite: true,
      async write(text) {
        await ensureWritePermission(handle);
        const writable = await handle.createWritable();
        await writable.write(text);
        await writable.close();
      },
      watch: (handler) => pollForChange(() => snapshotOf(handle), sameSnapshot, handler, handler),
    };
    return file;
  },
};

/**
 * `<input type="file">`でファイルを選ばせる。選んだ時点の内容を`File`として
 * もらうだけで、以後そのファイルを読み直す標準の手段は無い
 * (P1-platforms.md「Web版でFile System Access APIが無いブラウザ」)。
 *
 * キャンセル時にPromiseを解決するため`cancel`イベントを使うが、これは
 * 比較的新しいブラウザ(Chrome 113+等)にしかない。無いブラウザでキャンセルすると
 * このPromiseは解決されないまま残るが、「開く」をもう一度押せば新しい`input`を
 * 作り直すだけなので実害は小さいと判断した(退けた案: `window`の`focus`
 * イベントでキャンセルを推測する方法もあるが、ダイアログを閉じた後の
 * フォーカス移動のタイミングはブラウザ・OS依存で当てにできない)。
 */
function pickFileViaInput(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".ui";
    input.style.display = "none";
    document.body.appendChild(input);

    const cleanup = () => input.remove();

    input.addEventListener("change", () => {
      const file = input.files?.[0] ?? null;
      cleanup();
      resolve(file);
    });
    input.addEventListener("cancel", () => {
      cleanup();
      resolve(null);
    });

    input.click();
  });
}

export const webInputFallbackHost: FileHost = {
  // <input>で読み直す標準の手段が無いため、自動検知はできない。
  supportsAutoReload: false,

  async pick() {
    const file = await pickFileViaInput();
    if (file === null) return null;
    // この時点の中身を丸ごと覚えておく。read()は毎回同じ内容を返すだけで、
    // ディスク上の最新の中身を読み直すわけではない(そもそもそれができないのが
    // このホストの制約そのもの)。
    const content = await file.text();
    return {
      displayName: file.name,
      read: () => Promise.resolve(content),
      // <input type="file">には書き込む標準の手段が無い。エディタはこれを見て
      // 読み取り専用にする(F2-editor.md「設計3: 書き戻し」の表)。
      supportsWrite: false,
      write: () => Promise.reject(new Error("このブラウザではファイルに書き込めません(supportsWrite: false)")),
      // handlerは呼ばれない(変更検知はできない)。呼び出し側はunwatchできるよう
      // 空のunsubscribe関数だけ返す。
      watch: () => () => {},
    };
  },
};
