// F1-4: ファイル監視・読み出しのコマンドはwatch.rsに置く(src-tauriは薄く保つ、
// F1-foundation.mdの技術スタックの方針と同じ考え方)。「開く」ボタンの
// ファイルダイアログ自体はフロントが@tauri-apps/plugin-dialogを直接呼ぶので、
// こちら側にはコマンドを置いていない。
//
// P1-3: watchモジュール(notifyクレートを使う)はデスクトップだけで使う。
// `content://` URIはファイルシステム上のパスではなくnotifyで監視できないため、
// Androidでは読み込み自体をplugin-fsに、変更検知をフロント側のポーリング
// (src/preview/host/poll.ts)に任せる(P1-platforms.md「設計」)。モジュール
// ごと#[cfg(desktop)]で外すことで、Android向けビルドにnotifyを含めない。
#[cfg(desktop)]
mod watch;

#[cfg(desktop)]
use watch::WatchState;

/// どのOSで動いているかをフロントから直接判定できないため、起動時に一度だけ
/// 問い合わせる(point-cloud-viewerのsrc/state/useCopcViewer.ts 220行付近、
/// src-tauri/src/lib.rsのcfg(target_os="android")と同じ方式。
/// P1-platforms.md「プラットフォームの判定」)。host/tauri-platform.tsの
/// isAndroid()から呼ばれる。
#[tauri::command]
fn is_android() -> bool {
    cfg!(target_os = "android")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        // Androidの`content://` URIからファイルを読むために使う
        // (src/preview/host/tauri-android.ts参照)。デスクトップでは
        // plugin-dialogが返す普通のパスをwatch::read_ui_fileで読むので、
        // このプラグイン経由では読まない(挙動は変わらない)。
        .plugin(tauri_plugin_fs::init());

    // invoke_handlerは1回しか呼べないため、デスクトップ/モバイルで登録する
    // コマンドの一覧をここで分ける。is_androidはどちらでも要る
    // (host/index.tsがTauri内でAndroidかどうかをまず問い合わせるため)。
    #[cfg(desktop)]
    let builder = builder
        .manage(WatchState::default())
        .invoke_handler(tauri::generate_handler![
            is_android,
            watch::read_ui_file,
            watch::watch_ui_file
        ]);
    #[cfg(mobile)]
    let builder = builder.invoke_handler(tauri::generate_handler![is_android]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
