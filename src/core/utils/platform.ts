/**
 * Platform helpers – detect if we run inside Tauri.
 *
 * Tauri 2 always injects `__TAURI_INTERNALS__`; `window.__TAURI__` only exists
 * when `app.withGlobalTauri` is enabled in tauri.conf.json (it is not), so
 * checking for `__TAURI_INTERNALS__` is the reliable runtime detection.
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
