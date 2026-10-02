// point-cloud-viewer(C:\rust\point-cloud-viewer\vite.config.ts)と同じ理由で、
// `test`フィールド(vitestの設定)の型を効かせるため、defineConfigは
// "vitest/config"から取る(vite本体のUserConfigに`test`を足した上位互換の型)。
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import process from "node:process";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  test: {
    // F1-1(雛形)の時点ではまだテストファイルが無い。vitestは既定で
    // テストが1件も無いと失敗扱いにする(コミットのたびに`npm test`が
    // 通ることを求めているため、ここだけ許容する)。F1-2以降でsrc/core配下に
    // 実テストが増える。
    passWithNoTests: true,
  },
}));
