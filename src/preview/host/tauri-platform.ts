// Tauriの中でAndroidかデスクトップかを判定する。windowに生える目印
// (`__TAURI_INTERNALS__`)だけでは区別できない(Androidのwebviewにも同じ目印が
// 生えるため)ので、起動時に一度だけRustのis_androidコマンドに問い合わせる
// (point-cloud-viewerのsrc/state/useCopcViewer.ts 220行付近、
// src-tauri/src/lib.rsのcfg(target_os="android")と同じ方式。
// P1-platforms.md「プラットフォームの判定」)。
//
// host/tauri-desktop.ts・host/tauri-android.tsのどちらでもない、判定専用の
// ファイルにした(host/index.tsがデスクトップ/Androidどちらの実装を使うかを
// 決める*前*に呼ぶ関数であり、どちらか一方の実装ファイルに置くと役割が
// ねじれるため)。ファイル名をtauri-*.tsにしてあるのは、@tauri-apps/*の
// importを許すファイルの命名規則(architecture.test.ts参照)に合わせるため。
import { invoke } from "@tauri-apps/api/core";

export async function isAndroid(): Promise<boolean> {
  return invoke<boolean>("is_android");
}
