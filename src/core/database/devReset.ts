/**
 * Development-only database reset helper.
 * NEVER exposed in production UI — only callable manually via dev console
 * when `import.meta.env.DEV` and explicit `window.__POOPLOG_DEV_RESET` .
 *
 * Usage (dev console):
 *   window.__POOPLOG_DEV_RESET()
 */

import { getDatabase } from "./connection";

export function installDevReset(): void {
  if (!import.meta.env.DEV) return;
  // @ts-expect-error global
  window.__POOPLOG_DEV_RESET = async () => {
    const ok = window.confirm("DEV ONLY: Reset database? This will delete all data. Continue?");
    if (!ok) return;
    const db = await getDatabase();
    if (!db) {
      alert("No database connection");
      return;
    }
    await db.execute("DROP TABLE IF EXISTS bowel_record_tags");
    await db.execute("DROP TABLE IF EXISTS bowel_records");
    await db.execute("DROP TABLE IF EXISTS tags");
    await db.execute("DROP TABLE IF EXISTS sleep_records");
    await db.execute("DROP TABLE IF EXISTS water_records");
    await db.execute("DROP TABLE IF EXISTS menstrual_records");
    await db.execute("DROP TABLE IF EXISTS daily_checkins");
    await db.execute("DROP TABLE IF EXISTS _health_check");
    await db.execute("DROP TABLE IF EXISTS _migrations");
    alert("Database reset — restart app to re-migrate");
    window.location.reload();
  };
  console.warn("[db] dev reset installed: call window.__POOPLOG_DEV_RESET() in console to reset (DEV only)");
}
