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
 */
export function pollForChange<T>(
  getSnapshot: () => Promise<T>,
  equals: (a: T, b: T) => boolean,
  onChange: () => void,
  intervalMs = 1000,
): () => void {
  let stopped = false;
  let last: T | undefined;
  let hasLast = false;

  const checkOnce = async () => {
    const snapshot = await getSnapshot();
    if (stopped) return;
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
