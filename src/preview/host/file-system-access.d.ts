// TypeScript標準のlib.dom.d.tsには`FileSystemFileHandle`自体(getFile/name)は
// 定義済みだが、それを取得する入口の`window.showOpenFilePicker()`が無い
// (2026-10時点、TypeScript ~6.0.3で確認。Chromium系ブラウザ専用のAPIで、
// 標準化された安定仕様ではないため)。point-cloud-viewerの
// src/datasource/file-system-sync-access-handle.d.tsと同じやり方で、使う分だけ
// 最小限を宣言する。
// 出典: https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker
//
// `import`/`export`を書かないことで、このファイル全体がグローバルなアンビエント
// 宣言として扱われる(モジュールにならない)。

interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface OpenFilePickerOptions {
  multiple?: boolean;
  types?: FilePickerAcceptType[];
}

interface Window {
  showOpenFilePicker?(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
}

// F2-3: 書き込み用の`requestPermission()`。TypeScript標準のlib.dom.d.tsは
// `createWritable()`(FileSystemWritableFileStream経由の書き込み)までは
// 定義済みだが、読み書きの許可を明示的に求める`requestPermission()`は
// 定義していない(showOpenFilePicker同様、まだ標準化されていないAPIのため)。
// 既存の`FileSystemFileHandle`インターフェースにマージする形で追記する。
interface FileSystemHandlePermissionDescriptor {
  mode?: "read" | "readwrite";
}

interface FileSystemFileHandle {
  requestPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}
