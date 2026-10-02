// F1-1: 雛形の時点では何もコマンドを持たない、空のウィンドウを開くだけのTauriアプリ。
// ファイル監視(notify)・ファイルの読み出しは、プレビュー機能そのものと一緒に
// F1-4で足す(F1-foundation.mdの「F1-4: プレビュー」参照)。
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
