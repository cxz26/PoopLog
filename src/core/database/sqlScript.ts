/**
 * Single-script SQL helpers.
 *
 * tauri-plugin-sql exposes a pooled, stateless execute/select API. A standalone
 * BEGIN/COMMIT issued as separate execute() calls can hold a lock on one
 * pooled connection while the next statement lands on another (SQLITE_BUSY
 * deadlock), so `withTransaction` cannot provide real atomicity on the Tauri
 * path.
 *
 * Instead, multi-statement operations are executed as ONE `db.execute()` call
 * wrapped in an explicit `BEGIN IMMEDIATE … COMMIT` transaction: the whole
 * script runs on a single pooled connection, and a failure anywhere leaves the
 * database untouched (only COMMIT persists). Empirically verified on the real
 * sqlx path: WITHOUT the explicit transaction wrapper, a mid-script failure
 * (e.g. a FOREIGN KEY violation) leaves earlier statements auto-committed.
 *
 * Scripts are built from SQL literals (`sqlLit`) — every dynamic value must go
 * through it; never interpolate raw user input. Do NOT rely on
 * `last_insert_rowid()` across statements: any INSERT (junction rows
 * included) overwrites it — reference earlier rows via scalar subqueries.
 */
import { dbExecute } from "./connection";

/** Escape a validated value into a SQL literal for use inside a script. */
export function sqlLit(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error("SQL literal: non-finite number");
    return String(v);
  }
  if (typeof v === "string") {
    if (v.includes("\u0000")) throw new Error("SQL literal: NUL character in string");
    return `'${v.replace(/'/g, "''")}'`;
  }
  throw new Error(`SQL literal: unsupported value type: ${typeof v}`);
}

/**
 * Execute multiple statements atomically as one explicitly-transacted script.
 * Empty/blank entries are skipped; a single statement is passed through as-is
 * (single statements are atomic by themselves). Callers pass statement BODIES
 * only — never BEGIN/COMMIT, which are added here.
 */
export async function executeScript(statements: Array<string | null | undefined>): Promise<number> {
  const stmts = statements.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
  if (stmts.length === 0) return 0;
  if (stmts.length === 1) return dbExecute(stmts[0]);
  const body = stmts.map((s) => s.replace(/[;\s]+$/, "")).join(";\n");
  // Never nest transaction wrappers: if the caller already opened one, pass
  // the statements through untouched (the caller owns COMMIT/ROLLBACK).
  const selfTransacting = stmts.some((s) => /^BEGIN\b/i.test(s.trim()));
  const script = selfTransacting ? `${body};` : `BEGIN IMMEDIATE;\n${body};\nCOMMIT;`;
  try {
    return await dbExecute(script);
  } catch (e) {
    const msg = typeof e === "string" ? e : ((e as Error)?.message ?? String(e));
    // A pooled connection can be stuck holding an open transaction (e.g. a
    // previously failed script). Roll it back and retry once — empirically
    // the ROLLBACK reaches the stuck connection and heals the pool.
    if (/cannot start a transaction within a transaction/i.test(msg)) {
      try {
        await dbExecute("ROLLBACK;");
      } catch {
        // ignore — no transaction active on this connection
      }
      return dbExecute(script);
    }
    // The failed transaction was never committed, so no data changed. The
    // connection may still hold the open transaction — clean it up so later
    // operations don't see phantom rows or fail to BEGIN.
    try {
      await dbExecute("ROLLBACK;");
    } catch {
      // ignore — no transaction active on this connection
    }
    throw e;
  }
}
