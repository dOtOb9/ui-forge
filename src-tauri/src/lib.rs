// F1-4: ファイル監視・読み出しのコマンドはwatch.rsに置く(src-tauriは薄く保つ、
// F1-foundation.mdの技術スタックの方針と同じ考え方)。「開く」ボタンの
// ファイルダイアログ自体はフロントが@tauri-apps/plugin-dialogを直接呼ぶので、
// こちら側にはコマンドを置いていない。
mod watch;

use watch::WatchState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(WatchState::default())
        .invoke_handler(tauri::generate_handler![watch::read_ui_file, watch::watch_ui_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
