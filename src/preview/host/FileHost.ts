// P1-platforms.md「設計」のファイルホスト抽象そのもの(point-cloud-viewerの
// DataSource、src/datasource/DataSource.tsと同じ考え方)。プレビューの画面
// (PreviewApp.tsx)はこのインターフェースだけを見て、いま動いているのが
// Windows・Android・Webのどれかを知らない。
//
// 実装はhost/tauri-desktop.ts(Windows)・host/tauri-android.ts(Android)・
// host/web.ts(Web、FSAの有無で2通り)の3ファイル4実装。どれを使うかを決めるのは
// host/index.tsの1箇所だけ。

export interface OpenedFile {
  /** 画面に出す名前(パスまたはファイル名)。 */
  displayName: string;
  /** 現在の中身を読む。 */
  read(): Promise<string>;
  /** 中身が変わるたびにhandlerを呼ぶ。返り値を呼ぶと止まる。 */
  watch(handler: () => void): () => void;
}

export interface FileHost {
  /** ファイルを選ばせる。キャンセルならnull。 */
  pick(): Promise<OpenedFile | null>;
  /**
   * falseなら、このホストで開いたファイルは変更を自動検知できない。
   * 設計上のインターフェースには無い項目だが、Web版でFile System Access APIが
   * 無いブラウザ(`<input type="file">`経由。P1-platforms.md「Web版でFile
   * System Access APIが無いブラウザ」参照)はPreviewApp.tsxが注意書きを出す
   * 必要があり、「どのホストか」をPreviewApp側に漏らさずにそれを伝える手段が
   * 要る。ホストの能力の一部なのでFileHost側に置いた(OpenedFile側ではない。
   * 同じホストが返すOpenedFileはどれも同じ能力を持つため)。
   */
  readonly supportsAutoReload: boolean;
}
