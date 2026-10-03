// 受け入れ基準1: host/poll.tsは、中身(またはlastModified/size)が変わったときだけ
// handlerを呼び、変わっていなければ呼ばない。止める関数を呼んだ後は二度と
// 呼ばない。フェイクタイマーで確認する。
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

    pollForChange(getSnapshot, (a, b) => a === b, onChange, 1000);

    // 呼び出し直後に基準値("a")を取る(まだhandlerは呼ばれない)。
    await vi.advanceTimersByTimeAsync(0);
    expect(onChange).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000); // "a" → 変化なし
    expect(onChange).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000); // "b" → 変化あり
    expect(onChange).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000); // "b" → 変化なし
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("止める関数を呼んだ後は二度とhandlerを呼ばない", async () => {
    const snapshots = ["a", "a", "b", "c", "d"];
    let i = 0;
    const getSnapshot = vi.fn(async () => snapshots[i++]);
    const onChange = vi.fn();

    const stop = pollForChange(getSnapshot, (a, b) => a === b, onChange, 1000);
    await vi.advanceTimersByTimeAsync(0); // 基準値"a"
    await vi.advanceTimersByTimeAsync(1000); // "a"→変化なし

    stop();

    // 止めた後は、タイマーが進んでも(本来なら"b""c""d"と変化が続くはずでも)
    // handlerは呼ばれない。
    await vi.advanceTimersByTimeAsync(5000);
    expect(onChange).not.toHaveBeenCalled();
  });
});
