// 受け入れ基準2: host/index.tsが、Tauriデスクトップ / Tauri Android /
// File System Access APIありのブラウザ / 無いブラウザ の4通りで正しい実装を
// 選ぶ。環境はテスト内で差し替える(本物のTauriランタイムは要らない。
// isAndroid()が呼ぶinvokeだけモックする)。
import { afterEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn<(cmd: string) => Promise<unknown>>();

// host/tauri-desktop.ts・host/tauri-android.ts・host/tauri-platform.tsが
// importする@tauri-apps/*は、本物のTauriランタイムが無いと例外になる
// (window.__TAURI_INTERNALS__が無いため)。ここではモジュールの読み込み自体は
// 通す必要があるので、使う関数だけモックする(呼び出した時の挙動はテストが
// 制御する)。
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string) => invokeMock(cmd),
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({ readTextFile: vi.fn() }));

const { resolveFileHost } = await import("./index");
const { tauriDesktopHost } = await import("./tauri-desktop");
const { tauriAndroidHost } = await import("./tauri-android");
const { webFileSystemAccessHost, webInputFallbackHost } = await import("./web");

afterEach(() => {
  vi.unstubAllGlobals();
  invokeMock.mockReset();
});

describe("resolveFileHost(受け入れ基準2)", () => {
  it("Tauriデスクトップ: __TAURI_INTERNALS__があり、is_androidがfalse", async () => {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    invokeMock.mockResolvedValue(false);

    expect(await resolveFileHost()).toBe(tauriDesktopHost);
    expect(invokeMock).toHaveBeenCalledWith("is_android");
  });

  it("Tauri Android: __TAURI_INTERNALS__があり、is_androidがtrue", async () => {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    invokeMock.mockResolvedValue(true);

    expect(await resolveFileHost()).toBe(tauriAndroidHost);
  });

  it("File System Access APIがあるブラウザ(Chrome/Edge)", async () => {
    vi.stubGlobal("window", { showOpenFilePicker: () => {} });

    expect(await resolveFileHost()).toBe(webFileSystemAccessHost);
    // ブラウザなのでTauriへの問い合わせ(is_android)は起きない。
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("File System Access APIが無いブラウザ(Firefox/Safari)", async () => {
    vi.stubGlobal("window", {});

    expect(await resolveFileHost()).toBe(webInputFallbackHost);
  });
});
