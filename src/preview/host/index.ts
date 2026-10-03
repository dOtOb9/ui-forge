// どのFileHost実装を使うかを決める1箇所(P1-platforms.md「プラットフォームの
// 判定」)。PreviewApp.tsxはresolveFileHost()の返り値(FileHostインターフェース)
// だけを見て、どのプラットフォームかを知らない。
import type { FileHost } from "./FileHost";
import { isTauriEnvironment } from "./environment";
import { tauriDesktopHost } from "./tauri-desktop";

/**
 * P1-1時点ではTauriの中はデスクトップのみ対応する。AndroidかどうかをRust側へ
 * 問い合わせる分岐はP1-3で足す。Web版の実装(P1-2)もまだ無いため、ブラウザで
 * 実行した場合はここで例外になる(F1までの対象はTauriデスクトップだけだった
 * ので、今はこれで十分)。
 */
export async function resolveFileHost(): Promise<FileHost> {
  if (isTauriEnvironment()) {
    return tauriDesktopHost;
  }
  throw new Error("Web版のFileHostはまだ実装されていません(P1-2で追加する予定)");
}
