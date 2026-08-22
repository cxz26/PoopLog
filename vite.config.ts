import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

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
});
