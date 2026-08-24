import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias:
      mode === "production"
        ? {
            "../qa/QaPage": path.resolve(__dirname, "src/qa/empty.ts"),
            "../../core/database/verifyPhase2": path.resolve(__dirname, "src/qa/empty.ts"),
          }
        : undefined,
  },

  // Tauri expects a fixed dev server port
  server: {
    port: 1420,
    strictPort: true,
    host: "0.0.0.0",
  },

  // Prevent vite from obscuring Rust errors
  clearScreen: false,

  // Env prefix for Tauri
  envPrefix: ["VITE_", "TAURI_"],

  build: {
    // Tauri uses Chromium on Windows, target modern
    target: process.env.TAURI_PLATFORM === "windows" ? "chrome105" : "esnext",
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
}));
