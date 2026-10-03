// どのFileHost実装を使うかを決める1箇所(P1-platforms.md「プラットフォームの
// 判定」)。PreviewApp.tsxはresolveFileHost()の返り値(FileHostインターフェース)
// だけを見て、どのプラットフォームかを知らない。
import type { FileHost } from "./FileHost";
import { hasFileSystemAccessApi, isTauriEnvironment } from "./environment";
import { tauriDesktopHost } from "./tauri-desktop";
import { tauriAndroidHost } from "./tauri-android";
import { isAndroid } from "./tauri-platform";
import { webFileSystemAccessHost, webInputFallbackHost } from "./web";

/**
 * 4通りの環境を判定してFileHostを選ぶ(受け入れ基準2)。
 * - Tauriの中: さらにAndroidかどうかをRustに一度だけ問い合わせる
 *   (`__TAURI_INTERNALS__`の有無だけではAndroid/デスクトップを区別できない)
 * - ブラウザ: File System Access APIの有無で選ぶ
 */
export async function resolveFileHost(): Promise<FileHost> {
  if (isTauriEnvironment()) {
    return (await isAndroid()) ? tauriAndroidHost : tauriDesktopHost;
  }
  return hasFileSystemAccessApi() ? webFileSystemAccessHost : webInputFallbackHost;
}
