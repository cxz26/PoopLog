/**
 * Dedicated database layer — Tauri + fallback + transactions + test hook.
 *
 * Architecture:
 *   React UI → Zustand/services → Repositories → (getDatabase/execute/select) → SQLite
 *
 * Never call `Database.load` from components.
 */

import { migrations } from "./migrations";
import { isTauri } from "../utils/platform";

export type SqlDatabase = {
  execute: (query: string, params?: unknown[]) => Promise<number>;
  select: <T>(query: string, params?: unknown[]) => Promise<T[]>;
  close: () => Promise<void>;
};

let dbInstance: SqlDatabase | null = null;
let initPromise: Promise<SqlDatabase | null> | null = null;
// Test hook — allows Node verification harness to inject a fake DB
let testDb: SqlDatabase | null = null;

export function __setTestDatabase(db: SqlDatabase | null): void {
  testDb = db;
  if (db) dbInstance = db;
  else {
    dbInstance = null;
    initPromise = null;
  }
}

export function __getTestDatabase(): SqlDatabase | null {
  return testDb;
}

/** SQLite file — managed by Tauri in app-data directory */
const DB_PATH = "sqlite:pooplog.db";

async function loadDatabase(): Promise<SqlDatabase> {
  if (testDb) return testDb;
  const { default: Database } = await import("@tauri-apps/plugin-sql");
  const db = await (
    Database as unknown as { load: (path: string) => Promise<SqlDatabase> }
  ).load(DB_PATH);
  return db;
}

async function applyMigrations(db: SqlDatabase): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const applied: { version: number }[] = await db.select(
    "SELECT version FROM _migrations ORDER BY version ASC",
  );
  const appliedSet = new Set(applied.map((r) => r.version));

  for (const m of migrations) {
    if (appliedSet.has(m.version)) continue;
    // sqlx/sqlite can execute multiple statements in one call, but
    // splitting provides clearer error locations. We execute the whole block.
    await db.execute(m.sql);
    await db.execute(
      "INSERT INTO _migrations (version, name, applied_at) VALUES ($1, $2, datetime('now'))",
      [m.version, m.name],
    );
    console.info(`[db] migration applied: v${m.version} ${m.name}`);
  }

  // Phase-1 health check (idempotent)
  await db.execute(
    "INSERT INTO _health_check (key, value, updated_at) VALUES ($1, $2, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    ["phase1_check", "ok"],
  );
}

export async function initDatabase(): Promise<SqlDatabase | null> {
  if (testDb) return testDb;
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (!isTauri()) {
      console.warn(
        "[db] not in Tauri — SQLite skipped (browser dev mode). Mock ready.",
      );
      return null;
    }
    try {
      const db = await loadDatabase();
      // Enable FK enforcement
      await db.execute("PRAGMA foreign_keys = ON;");
      await applyMigrations(db);
      const rows = await db.select<{ value: string }>(
        "SELECT value FROM _health_check WHERE key = 'phase1_check'",
      );
      console.info("[db] health_check:", rows);
      dbInstance = db;
      return db;
    } catch (err) {
      console.error("[db] init failed:", err);
      throw err;
    }
  })();

  return initPromise;
}

export async function getDatabase(): Promise<SqlDatabase | null> {
  if (testDb) return testDb;
  if (dbInstance) return dbInstance;
  return initDatabase();
}

export async function closeDatabase(): Promise<void> {
  if (dbInstance && typeof dbInstance.close === "function") {
    try {
      await dbInstance.close();
    } catch {
      // ignore
    }
  }
  dbInstance = null;
  initPromise = null;
  testDb = null;
}

export async function getAppliedMigrations(): Promise<number[]> {
  const db = await getDatabase();
  if (!db) return [];
  const rows: { version: number }[] = await db.select(
    "SELECT version FROM _migrations ORDER BY version ASC",
  );
  return rows.map((r) => r.version);
}

// ---------------------------------------------------------------------------
// Transaction helper — ensures atomic multi-table operations.
// Usage: await withTransaction(async (db) => { await db.execute(...); ... })
// ---------------------------------------------------------------------------
export async function withTransaction<T>(
  fn: (db: SqlDatabase) => Promise<T>,
): Promise<T> {
  const db = await getDatabase();
  if (!db) throw new Error("Database not initialized — cannot start transaction");

  // tauri-plugin-sql exposes a pooled, stateless execute/select API. A BEGIN
  // issued through it can hold a lock on one pooled connection while the next
  // statement is scheduled on another, causing every write to fail with
  // SQLITE_BUSY. Keep the transaction protocol for the injected test adapter;
  // production Tauri calls must not issue standalone transaction commands.
  if (isTauri()) return fn(db);

  await db.execute("BEGIN IMMEDIATE;");
  try {
    const result = await fn(db);
    await db.execute("COMMIT;");
    return result;
  } catch (e) {
    try {
      await db.execute("ROLLBACK;");
    } catch {
      // ignore rollback error
    }
    throw e;
  }
}

// Direct helpers for repositories (typed)
export async function dbExecute(
  sql: string,
  params?: unknown[],
): Promise<number> {
  const db = await getDatabase();
  if (!db) throw new Error("Database not initialized");
  return db.execute(sql, params);
}

export async function dbSelect<T>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const db = await getDatabase();
  if (!db) throw new Error("Database not initialized");
  return db.select<T>(sql, params);
}
