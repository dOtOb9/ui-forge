// F1-foundation.md「F1-4: プレビュー」のファイル監視。
//
// 「開く」ボタン自体はフロント側が@tauri-apps/plugin-dialogを直接呼ぶ(Rust側に
// コマンドを持たない)。ここが持つのは、開いた後の2つの仕事だけ:
// - read_ui_file: パスからテキストを読む
// - watch_ui_file: そのファイルの変更を監視し、変わったらイベントで知らせる
//
// 監視対象はファイルそのものではなく親ディレクトリにしている。VS Codeを含む
// 多くのエディタは保存時に「一時ファイルに書いてから元のファイルに
// rename/置き換え」という安全な保存をすることがあり、ファイル自体を直接
// 監視しているとこの置き換えでwatch対象のinodeごと差し替わってしまい、
// 以後の変更を検知できなくなることがある。親ディレクトリを監視して
// イベントのパスがファイル名と一致するかで絞り込めば、この保存方式でも
// 取りこぼさない。
//
// 同じイベントが1回の保存で複数回飛んでくることがあるが、デバウンスは
// 入れていない。フロント側の再読み込みは「読んで検証して表示し直す」だけの
// 冪等な処理なので、何度呼ばれても実害が無い(タスクシートが求める
// 「1秒以内に反映される」はこの単純さのままで十分満たせる)。
use std::path::PathBuf;
use std::sync::Mutex;

use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter, State};

/// 直前に開始したwatcherを保持する。新しいファイルを開いたら前のwatcherを
/// ここで置き換える(Dropで監視が止まる)。1つのウィンドウで同時に開く
/// ファイルは常に1つという、F1時点のプレビューの仕様に合わせた作り。
#[derive(Default)]
pub struct WatchState(Mutex<Option<RecommendedWatcher>>);

#[derive(Clone, serde::Serialize)]
struct FileChangedPayload {
    path: String,
}

#[tauri::command]
pub fn read_ui_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("{path} の読み込みに失敗しました: {e}"))
}

/// F2-3: 編集のたびに正規化済みテキストを即座に書き込む(保存ボタンは作らない。
/// F2-editor.md「設計3: 書き戻し」)。この書き込み自体がwatch_ui_fileの監視に
/// 引っかかって`ui-file-changed`イベントが飛ぶが、それはフロント側
/// (useUiDocument.ts)が「読み直した中身が今の文書の正規化結果と同じなら
/// 何もしない」で吸収する(このコマンド自身は普通に書き込むだけでよい)。
#[tauri::command]
pub fn write_ui_file(path: String, text: String) -> Result<(), String> {
    std::fs::write(&path, text).map_err(|e| format!("{path} への書き込みに失敗しました: {e}"))
}

#[tauri::command]
pub fn watch_ui_file(app: AppHandle, state: State<WatchState>, path: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    let parent = target
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .ok_or_else(|| format!("{path} の親ディレクトリが見つかりません"))?
        .to_path_buf();
    let file_name = target
        .file_name()
        .ok_or_else(|| format!("{path} はファイル名を持ちません"))?
        .to_os_string();

    let emit_path = path.clone();
    let mut watcher = notify::recommended_watcher(move |result: notify::Result<Event>| {
        let Ok(event) = result else { return };
        if !matches!(event.kind, EventKind::Modify(_) | EventKind::Create(_)) {
            return;
        }
        let touched = event.paths.iter().any(|p| p.file_name() == Some(file_name.as_os_str()));
        if touched {
            // フロントが居なくなっていた場合のemit失敗は無視してよい
            // (次にwatch_ui_fileが呼ばれたときにwatcherごと作り直される)。
            let _ = app.emit("ui-file-changed", FileChangedPayload { path: emit_path.clone() });
        }
    })
    .map_err(|e| e.to_string())?;

    watcher.watch(&parent, RecursiveMode::NonRecursive).map_err(|e| e.to_string())?;

    *state.0.lock().map_err(|_| "watch状態のロックに失敗しました".to_string())? = Some(watcher);
    Ok(())
}
