// AndroidとWebの共通の変更検知。P1-platforms.md「設計」の表が理由を説明している:
// - Androidの`content://` URIはファイルシステム上のパスではないので、Rustの
//   `notify`(watch.rs)では監視できない
// - ブラウザにはファイル監視の標準APIが無い(`FileSystemObserver`はChromiumの
//   一部の版にしか無く、当てにしない)
// `.ui`は数KBなので、1秒ごとの読み直しは負荷として無視できる。実装はここ1つに
// まとめ、host/tauri-android.tsとhost/web.tsの両方から呼ぶ。

/**
 * `getSnapshot()`が返す値を一定間隔で取り直し、前回と変わっていたら`onChange`を
 * 呼ぶ。呼び出し直後に一度基準値を取る(待たずにすぐ基準を持つことで、
 * 「変わったのに気づくまでの時間」を最初の1回分だけ短くできる)。
 *
 * `T`はAndroid版ではファイルの中身の文字列そのもの、Web版では
 * `{ size, lastModified }`(P1-platforms.mdの表どおり。中身をまるごと
 * 比べるより軽い)。同じ値かどうかの判定は`equals`に委ねる。
 *
 * 返り値の関数を呼ぶと止まる。止めた後に進行中だった取得が後から戻ってきても
 * `onChange`は呼ばれない(受け入れ基準1)。
 *
 * F2-editor.md「設計 6: P1からの持ち越し」: `getSnapshot()`はファイルの削除や
 * Androidのアクセス権切れで失敗することがある。元の実装(P1)は`await`の失敗を
 * 捕まえておらず、ハンドルされないPromiseの拒否が1秒ごとに繰り返されていた
 * (platforms.mdの「既知の弱点」参照)。ここで失敗を捕まえ、**成功するまで
 * 1回だけ**`onError`を呼ぶ(受け入れ基準5)。次に成功したら、また1回だけ
 * 通知できる状態に戻る。
 */
export function pollForChange<T>(
  getSnapshot: () => Promise<T>,
  equals: (a: T, b: T) => boolean,
  onChange: () => void,
  onError: (error: unknown) => void,
  intervalMs = 1000,
): () => void {
  let stopped = false;
  let last: T | undefined;
  let hasLast = false;
  // 失敗を既に通知済みか。成功するまでtrueのままにして、同じ失敗を毎秒
  // 通知し続けないようにする(次に成功したらfalseに戻し、また1回だけ通知できる)。
  let errorNotified = false;

  const checkOnce = async () => {
    let snapshot: T;
    try {
      snapshot = await getSnapshot();
    } catch (e) {
      if (stopped) return;
      if (!errorNotified) {
        errorNotified = true;
        onError(e);
      }
      return;
    }
    if (stopped) return;
    errorNotified = false;
    if (hasLast && !equals(last as T, snapshot)) {
      onChange();
    }
    last = snapshot;
    hasLast = true;
  };

  void checkOnce();
  const timer = setInterval(() => void checkOnce(), intervalMs);

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
