// @ts-nocheck
/**
 * Restore Service — Phase 7.4: decrypt + validate + atomic replace + rollback + safety.
 * Uses same Backup Password for safety backup (new salt/nonce), never plaintext on disk.
 */

import { decryptPayload } from "./backupCrypto";
import { validateBackupPayload } from "./backupService";
import type { BackupFile } from "./backupTypes";
import { createSafetyBackup, listSafetyBackups } from "./safetyBackup";
import { getDatabase } from "../database/connection";
import { isTauri } from "../utils/platform";

const CURRENT_FORMAT_VERSION = 1;
const CURRENT_SCHEMA_VERSION = 3;

export interface RestoreResult {
  success: boolean;
  safetyBackupPath?: string;
  error?: string;
  code?: string;
}

export async function restoreBackupFile(backupFile: BackupFile, password: string): Promise<RestoreResult> {
  // 1. Validate header (magic, formatVersion, etc. is done in decryptPayload's validateHeader)
  // 2. Derive key + decrypt + AAD verification
  let plaintext: string;
  try {
    plaintext = await decryptPayload(backupFile, password);
  } catch (e) {
    return { success: false, error: (e as Error).message, code: "DECRYPT_FAILED" };
  }

  // 3. Parse payload
  let payload: unknown;
  try {
    payload = JSON.parse(plaintext);
  } catch {
    return { success: false, error: "Invalid backup payload JSON", code: "INVALID_JSON" };
  }

  // 4. Validate BackupPayload deeply
  const validation = validateBackupPayload(payload);
  if (!validation.valid) {
    const first = validation.errors[0];
    return { success: false, error: `${first.code}: ${first.path} ${first.message}`, code: first.code };
  }

  const typedPayload = payload as import("./backupTypes").BackupPayload;

  // 5. Check formatVersion
  if (typedPayload.schemaVersion !== undefined) {
    // payload has schemaVersion, but header also has formatVersion
  }
  // Header formatVersion already validated in decrypt, but double-check
  if ((backupFile as unknown as { formatVersion: number }).formatVersion > CURRENT_FORMAT_VERSION) {
    return { success: false, error: "Backup format too new, update PoopLog", code: "BACKUP_FORMAT_TOO_NEW" };
  }
  // Schema version checks
  if (typedPayload.schemaVersion > CURRENT_SCHEMA_VERSION) {
    return { success: false, error: "Backup schema too new, update PoopLog", code: "BACKUP_SCHEMA_TOO_NEW" };
  }
  if (typedPayload.schemaVersion < CURRENT_SCHEMA_VERSION) {
    // For MVP, reject too old unless migration exists; we have migrations 1-3, so if payload is 2 and current is 3, we could migrate, but spec says reject unless explicit migration exists
    // For now, reject if <3 and >0, but allow 3==3 only
    if (typedPayload.schemaVersion !== CURRENT_SCHEMA_VERSION) {
      return { success: false, error: "Backup schema too old, migration required", code: "BACKUP_SCHEMA_TOO_OLD" };
    }
  }

  // 6. Create encrypted safety backup BEFORE destructive transaction
  let safetyPath: string | undefined;
  try {
    safetyPath = await createSafetyBackup(password);
  } catch (e) {
    const safetyErrMsg = typeof e === "string" ? e : ((e as Error)?.message ?? String(e));
    return { success: false, error: `Safety backup failed: ${safetyErrMsg}`, code: "SAFETY_BACKUP_FAILED" };
  }

  // 7. Atomic replace transaction
  try {
    await atomicReplace(typedPayload);
  } catch (e) {
    // Rollback already happened via transaction, safety backup remains for recovery
    // Plugin errors can arrive as plain strings — extract a readable message.
    const errMsg = typeof e === "string" ? e : ((e as Error)?.message ?? String(e));
    return { success: false, error: `Restore failed: ${errMsg}`, code: "RESTORE_FAILED", safetyBackupPath: safetyPath };
  }

  // 8. On success, keep safety backup per retention (already cleaned to keep 1), return
  return { success: true, safetyBackupPath: safetyPath };
}

// SQL literal helper for the single-script atomic replace. Payload values are
// already deep-validated (types, ranges, uniqueness, orphans), so only string
// escaping and NUL detection are needed here.
function sqlLit(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error("Restore payload contains a non-finite number");
    return String(v);
  }
  if (typeof v === "string") {
    if (v.includes("\u0000")) throw new Error("Restore payload contains a NUL character");
    return `'${v.replace(/'/g, "''")}'`;
  }
  throw new Error(`Restore payload contains an unsupported value type: ${typeof v}`);
}

async function atomicReplace(payload: import("./backupTypes").BackupPayload): Promise<void> {
  const db = await getDatabase();
  if (!db) throw new Error("Database not initialized");

  // tauri-plugin-sql is pooled and stateless: a standalone BEGIN IMMEDIATE
  // takes a lock on one pooled connection while the next statement lands on
  // another, deadlocking with SQLITE_BUSY. Run the whole replace as ONE
  // multi-statement script instead — it executes on a single connection and is
  // genuinely atomic (failure anywhere before COMMIT leaves data untouched).
  // Deterministic ids (1..N per table) are assigned up front so junction rows
  // can reference them without inter-statement SELECTs.
  const stmts: string[] = [];

  // Delete in dependency-safe order (foreign keys stay enforced)
  stmts.push("BEGIN IMMEDIATE;");
  stmts.push("DELETE FROM bowel_record_tags;");
  stmts.push("DELETE FROM bowel_records;");
  stmts.push("DELETE FROM sleep_records;");
  stmts.push("DELETE FROM water_records;");
  stmts.push("DELETE FROM menstrual_records;");
  stmts.push("DELETE FROM daily_checkins;");
  stmts.push("DELETE FROM tags;");

  // Insert parents first, with explicit deterministic ids
  const dateToNewId = new Map<string, number>();
  payload.data.daily_checkins.forEach((dc, i) => {
    stmts.push(
      `INSERT INTO daily_checkins (id, date, completed, has_bowel_movement, recorded_at, created_at, updated_at) VALUES (${i + 1}, ${sqlLit(dc.date)}, ${sqlLit(dc.completed)}, ${sqlLit(dc.has_bowel_movement)}, ${sqlLit(dc.recorded_at)}, ${sqlLit(dc.created_at)}, ${sqlLit(dc.updated_at)})`,
    );
    dateToNewId.set(dc.date, i + 1);
  });

  const tagIndexToNewId = new Map<number, number>();
  payload.data.tags.forEach((t, i) => {
    stmts.push(
      `INSERT INTO tags (id, category, name, is_builtin, created_at, updated_at) VALUES (${i + 1}, ${sqlLit(t.category)}, ${sqlLit(t.name)}, ${sqlLit(t.is_builtin)}, ${sqlLit(t.created_at)}, ${sqlLit(t.updated_at)})`,
    );
    tagIndexToNewId.set(i, i + 1);
  });

  const bowelIndexToNewId = new Map<number, number>();
  payload.data.bowel_records.forEach((r, i) => {
    const dailyCheckinId = dateToNewId.get(r.daily_checkin_date);
    if (dailyCheckinId == null) throw new Error(`Orphan bowel_record daily_checkin_date ${r.daily_checkin_date}`);
    stmts.push(
      `INSERT INTO bowel_records (id, daily_checkin_id, occurred_at, time_type, approximate_time_label, bristol_type, amount, difficulty, pain_level, color, notes, created_at, updated_at) VALUES (${i + 1}, ${dailyCheckinId}, ${sqlLit(r.occurred_at)}, ${sqlLit(r.time_type)}, ${sqlLit(r.approximate_time_label)}, ${sqlLit(r.bristol_type)}, ${sqlLit(r.amount)}, ${sqlLit(r.difficulty)}, ${sqlLit(r.pain_level)}, ${sqlLit(r.color)}, ${sqlLit(r.notes)}, ${sqlLit(r.created_at)}, ${sqlLit(r.updated_at)})`,
    );
    bowelIndexToNewId.set(i, i + 1);
  });

  for (const j of payload.data.bowel_record_tags) {
    const newBowelId = bowelIndexToNewId.get(j.bowel_record_index);
    const newTagId = tagIndexToNewId.get(j.tag_index);
    if (newBowelId == null || newTagId == null) throw new Error(`Invalid tag relationship indices ${j.bowel_record_index},${j.tag_index}`);
    stmts.push(`INSERT INTO bowel_record_tags (bowel_record_id, tag_id) VALUES (${newBowelId}, ${newTagId})`);
  }

  for (const s of payload.data.sleep_records) {
    const dailyCheckinId = dateToNewId.get(s.daily_checkin_date);
    if (dailyCheckinId == null) throw new Error(`Orphan sleep daily_checkin_date ${s.daily_checkin_date}`);
    stmts.push(`INSERT INTO sleep_records (daily_checkin_id, total_minutes, quality, created_at, updated_at) VALUES (${dailyCheckinId}, ${sqlLit(s.total_minutes)}, ${sqlLit(s.quality)}, ${sqlLit(s.created_at)}, ${sqlLit(s.updated_at)})`);
  }

  for (const w of payload.data.water_records) {
    const dailyCheckinId = dateToNewId.get(w.daily_checkin_date);
    if (dailyCheckinId == null) throw new Error(`Orphan water daily_checkin_date ${w.daily_checkin_date}`);
    stmts.push(`INSERT INTO water_records (daily_checkin_id, total_ml, created_at, updated_at) VALUES (${dailyCheckinId}, ${sqlLit(w.total_ml)}, ${sqlLit(w.created_at)}, ${sqlLit(w.updated_at)})`);
  }

  for (const m of payload.data.menstrual_records) {
    const dailyCheckinId = dateToNewId.get(m.daily_checkin_date);
    if (dailyCheckinId == null) throw new Error(`Orphan menstrual daily_checkin_date ${m.daily_checkin_date}`);
    stmts.push(`INSERT INTO menstrual_records (daily_checkin_id, has_period, flow, pain_level, notes, created_at, updated_at) VALUES (${dailyCheckinId}, ${sqlLit(m.has_period)}, ${sqlLit(m.flow)}, ${sqlLit(m.pain_level)}, ${sqlLit(m.notes)}, ${sqlLit(m.created_at)}, ${sqlLit(m.updated_at)})`);
  }
  stmts.push("COMMIT;");

  // sqlLit() has already validated every value — nothing has executed yet, so
  // throwing here leaves the database untouched.
  const script = stmts.join(";\n") + ";";

  try {
    await db.execute(script);
  } catch (e) {
    // Best-effort rollback; if the script failed the transaction was never
    // committed, so the original data is still intact either way.
    try {
      await db.execute("ROLLBACK;");
    } catch {}
    throw e;
  }

  // Foreign keys stayed enforced throughout; belt-and-braces integrity check.
  const fkCheck = await db.select<Record<string, unknown>>("PRAGMA foreign_key_check;");
  if (fkCheck.length > 0) throw new Error(`Foreign key check failed: ${JSON.stringify(fkCheck)}`);
}

export async function restoreSafetyBackup(password: string): Promise<RestoreResult> {
  const safetyFiles = await listSafetyBackups();
  if (safetyFiles.length === 0) return { success: false, error: "No safety backup found", code: "NO_SAFETY_BACKUP" };
  const latest = safetyFiles[safetyFiles.length - 1];
  let content: string;
  if (isTauri()) {
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    content = await readTextFile(latest);
  } else {
    // @ts-ignore - node types
    const { readFile } = await import("node:fs/promises");
    content = await readFile(latest, "utf-8");
  }
  let backupFile: BackupFile;
  try {
    backupFile = JSON.parse(content) as BackupFile;
  } catch {
    return { success: false, error: "Invalid safety backup JSON", code: "INVALID_JSON" };
  }
  return restoreBackupFile(backupFile, password);
}
