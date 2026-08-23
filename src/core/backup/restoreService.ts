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

const CURRENT_FORMAT_VERSION = 1;
const CURRENT_SCHEMA_VERSION = 3;

export interface RestoreResult {
  success: boolean;
  safetyBackupPath?: string;
  error?: string;
  code?: string;
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
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
    return { success: false, error: `Safety backup failed: ${(e as Error).message}`, code: "SAFETY_BACKUP_FAILED" };
  }

  // 7. Atomic replace transaction
  try {
    await atomicReplace(typedPayload);
  } catch (e) {
    // Rollback already happened via transaction, safety backup remains for recovery
    return { success: false, error: `Restore failed: ${(e as Error).message}`, code: "RESTORE_FAILED", safetyBackupPath: safetyPath };
  }

  // 8. On success, keep safety backup per retention (already cleaned to keep 1), return
  return { success: true, safetyBackupPath: safetyPath };
}

async function atomicReplace(payload: import("./backupTypes").BackupPayload): Promise<void> {
  const db = await getDatabase();
  if (!db) throw new Error("Database not initialized");

  // Use real SQLite transaction via withTransaction or direct BEGIN
  // We need to ensure foreign_keys handling and atomicity
  await db.execute("BEGIN IMMEDIATE;");

  try {
    // Disable foreign keys for deletion order, but will re-enable and check
    await db.execute("PRAGMA foreign_keys=off;");

    // Delete in dependency-safe order
    await db.execute("DELETE FROM bowel_record_tags;");
    await db.execute("DELETE FROM bowel_records;");
    await db.execute("DELETE FROM sleep_records;");
    await db.execute("DELETE FROM water_records;");
    await db.execute("DELETE FROM menstrual_records;");
    await db.execute("DELETE FROM daily_checkins;");
    await db.execute("DELETE FROM tags;");

    // Insert daily_checkins first (need to capture new ids)
    const dateToNewId = new Map<string, number>();
    for (const dc of payload.data.daily_checkins) {
      await db.execute(
        "INSERT INTO daily_checkins (date, completed, has_bowel_movement, recorded_at, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6)",
        [dc.date, dc.completed, dc.has_bowel_movement, dc.recorded_at, dc.created_at, dc.updated_at],
      );
      const row = await db.select<{ id: number }>("SELECT id FROM daily_checkins WHERE date = $1", [dc.date]);
      const newId = row[0]?.id;
      if (newId == null) throw new Error(`Failed to insert daily_checkin ${dc.date}`);
      dateToNewId.set(dc.date, newId);
    }

    // Insert tags
    const tagIndexToNewId = new Map<number, number>();
    for (let i = 0; i < payload.data.tags.length; i++) {
      const t = payload.data.tags[i];
      await db.execute(
        "INSERT INTO tags (category, name, is_builtin, created_at, updated_at) VALUES ($1,$2,$3,$4,$5)",
        [t.category, t.name, t.is_builtin, t.created_at, t.updated_at],
      );
      const row2 = await db.select<{ id: number }>("SELECT id FROM tags WHERE category = $1 AND name = $2", [t.category, t.name]);
      const newId2 = row2[0]?.id;
      if (newId2 == null) throw new Error(`Failed to insert tag ${t.category}:${t.name}`);
      tagIndexToNewId.set(i, newId2);
    }

    // Insert bowel_records
    const bowelIndexToNewId = new Map<number, number>();
    for (let i = 0; i < payload.data.bowel_records.length; i++) {
      const r = payload.data.bowel_records[i];
      const dailyCheckinId = dateToNewId.get(r.daily_checkin_date);
      if (dailyCheckinId == null) throw new Error(`Orphan bowel_record daily_checkin_date ${r.daily_checkin_date}`);
      await db.execute(
        "INSERT INTO bowel_records (daily_checkin_id, occurred_at, time_type, approximate_time_label, bristol_type, amount, difficulty, pain_level, color, notes, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
        [dailyCheckinId, r.occurred_at, r.time_type, r.approximate_time_label, r.bristol_type, r.amount, r.difficulty, r.pain_level, r.color, r.notes, r.created_at, r.updated_at],
      );
      // Get new id via last_insert_rowid
      const lastIdRow = await db.select<{ id: number }>("SELECT last_insert_rowid() as id");
      const actualNewId = lastIdRow[0]?.id;
      if (actualNewId == null) throw new Error(`Failed to insert bowel_record index ${i}`);
      bowelIndexToNewId.set(i, actualNewId);
    }

    // Insert bowel_record_tags
    for (const j of payload.data.bowel_record_tags) {
      const newBowelId = bowelIndexToNewId.get(j.bowel_record_index);
      const newTagId = tagIndexToNewId.get(j.tag_index);
      if (newBowelId == null || newTagId == null) throw new Error(`Invalid tag relationship indices ${j.bowel_record_index},${j.tag_index}`);
      await db.execute("INSERT INTO bowel_record_tags (bowel_record_id, tag_id) VALUES ($1,$2)", [newBowelId, newTagId]);
    }

    // Insert sleep
    for (const s of payload.data.sleep_records) {
      const dailyCheckinId = dateToNewId.get(s.daily_checkin_date);
      if (dailyCheckinId == null) throw new Error(`Orphan sleep daily_checkin_date ${s.daily_checkin_date}`);
      await db.execute("INSERT INTO sleep_records (daily_checkin_id, total_minutes, quality, created_at, updated_at) VALUES ($1,$2,$3,$4,$5)", [dailyCheckinId, s.total_minutes, s.quality, s.created_at, s.updated_at]);
    }

    // Insert water
    for (const w of payload.data.water_records) {
      const dailyCheckinId = dateToNewId.get(w.daily_checkin_date);
      if (dailyCheckinId == null) throw new Error(`Orphan water daily_checkin_date ${w.daily_checkin_date}`);
      await db.execute("INSERT INTO water_records (daily_checkin_id, total_ml, created_at, updated_at) VALUES ($1,$2,$3,$4)", [dailyCheckinId, w.total_ml, w.created_at, w.updated_at]);
    }

    // Insert menstrual
    for (const m of payload.data.menstrual_records) {
      const dailyCheckinId = dateToNewId.get(m.daily_checkin_date);
      if (dailyCheckinId == null) throw new Error(`Orphan menstrual daily_checkin_date ${m.daily_checkin_date}`);
      await db.execute("INSERT INTO menstrual_records (daily_checkin_id, has_period, flow, pain_level, notes, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7)", [dailyCheckinId, m.has_period, m.flow, m.pain_level, m.notes, m.created_at, m.updated_at]);
    }

    // Re-enable foreign keys and check
    await db.execute("PRAGMA foreign_keys=on;");
    // Verify no foreign key violation
    const fkCheck = await db.select<Record<string, unknown>>("PRAGMA foreign_key_check;");
    if (fkCheck.length > 0) throw new Error(`Foreign key check failed: ${JSON.stringify(fkCheck)}`);

    await db.execute("COMMIT;");
  } catch (e) {
    try {
      await db.execute("ROLLBACK;");
    } catch {}
    try {
      await db.execute("PRAGMA foreign_keys=on;");
    } catch {}
    throw e;
  }
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
