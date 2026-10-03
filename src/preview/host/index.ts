// どのFileHost実装を使うかを決める1箇所(P1-platforms.md「プラットフォームの
// 判定」)。PreviewApp.tsxはresolveFileHost()の返り値(FileHostインターフェース)
// だけを見て、どのプラットフォームかを知らない。
import type { FileHost } from "./FileHost";
import { hasFileSystemAccessApi, isTauriEnvironment } from "./environment";
import { tauriDesktopHost } from "./tauri-desktop";
import { webFileSystemAccessHost, webInputFallbackHost } from "./web";

/**
 * P1-2時点ではTauriの中はまだデスクトップのみ対応する。AndroidかどうかをRust側へ
 * 問い合わせる分岐はP1-3で足す。
 */
export async function resolveFileHost(): Promise<FileHost> {
  if (isTauriEnvironment()) {
    return tauriDesktopHost;
  }
  return hasFileSystemAccessApi() ? webFileSystemAccessHost : webInputFallbackHost;
}
