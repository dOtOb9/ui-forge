// 受け入れ基準1: host/poll.tsは、中身(またはlastModified/size)が変わったときだけ
// handlerを呼び、変わっていなければ呼ばない。止める関数を呼んだ後は二度と
// 呼ばない。フェイクタイマーで確認する。
// 受け入れ基準5(F2-editor.md): getSnapshot()が失敗したときonErrorを1回だけ呼び、
// 成功に戻ったら再び通知できる状態になる。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pollForChange } from "./poll";

describe("pollForChange", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("スナップショットが変わったときだけhandlerを呼ぶ", async () => {
    // index 0 は呼び出し直後の基準値。以後1秒おきに取る値。
    const snapshots = ["a", "a", "b", "b", "c"];
    let i = 0;
    const getSnapshot = vi.fn(async () => snapshots[i++]);
    const onChange = vi.fn();
    const onError = vi.fn();

    pollForChange(getSnapshot, (a, b) => a === b, onChange, onError, 1000);

    // 呼び出し直後に基準値("a")を取る(まだhandlerは呼ばれない)。
    await vi.advanceTimersByTimeAsync(0);
    expect(onChange).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000); // "a" → 変化なし
    expect(onChange).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000); // "b" → 変化あり
    expect(onChange).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000); // "b" → 変化なし
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("止める関数を呼んだ後は二度とhandlerを呼ばない", async () => {
    const snapshots = ["a", "a", "b", "c", "d"];
    let i = 0;
    const getSnapshot = vi.fn(async () => snapshots[i++]);
    const onChange = vi.fn();
    const onError = vi.fn();

    const stop = pollForChange(getSnapshot, (a, b) => a === b, onChange, onError, 1000);
    await vi.advanceTimersByTimeAsync(0); // 基準値"a"
    await vi.advanceTimersByTimeAsync(1000); // "a"→変化なし

    stop();

    // 止めた後は、タイマーが進んでも(本来なら"b""c""d"と変化が続くはずでも)
    // handlerは呼ばれない。
    await vi.advanceTimersByTimeAsync(5000);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("受け入れ基準5: getSnapshot()が失敗したらonErrorを1回だけ呼び、成功したら再び通知できる", async () => {
    // index: 0=基準値(成功) 1=失敗 2=失敗 3=成功(ここでerrorNotifiedが
    // リセットされる) 4=失敗(再び1回だけ通知される)
    const results: (string | Error)[] = ["a", new Error("読めない"), new Error("読めない"), "a", new Error("読めない")];
    let i = 0;
    const getSnapshot = vi.fn(async () => {
      const r = results[i++];
      if (r instanceof Error) throw r;
      return r;
    });
    const onChange = vi.fn();
    const onError = vi.fn();

    pollForChange(getSnapshot, (a, b) => a === b, onChange, onError, 1000);
    await vi.advanceTimersByTimeAsync(0); // 基準値"a"(成功)
    expect(onError).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000); // 1回目の失敗 → 通知
    expect(onError).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000); // 2回目の失敗 → 成功するまで再通知しない
    expect(onError).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000); // 成功("a") → 再び通知できる状態に戻る
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled(); // 値自体は基準値と同じ"a"なので変化なし

    await vi.advanceTimersByTimeAsync(1000); // 再び失敗 → もう1回通知される
    expect(onError).toHaveBeenCalledTimes(2);
  });
});
