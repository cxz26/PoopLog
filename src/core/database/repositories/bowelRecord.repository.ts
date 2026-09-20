/**
 * BowelRecordRepository — typed CRUD + tag junction + transactions.
 */

import { dbExecute, dbSelect } from "../connection";
import { sqlLit, executeScript } from "../sqlScript";
import {
  assertBristol,
  assertPain,
  assertApproximateLabel,
} from "../../validators";
import type { BowelRecord, Tag } from "../../types/entities";

function nowIso(): string {
  return new Date().toISOString();
}

export async function getById(id: number): Promise<BowelRecord | null> {
  const rows = await dbSelect<BowelRecord>(
    "SELECT * FROM bowel_records WHERE id = $1 LIMIT 1",
    [id],
  );
  return rows[0] ?? null;
}

export async function getByDailyCheckin(
  dailyCheckinId: number,
): Promise<BowelRecord[]> {
  return dbSelect<BowelRecord>(
    "SELECT * FROM bowel_records WHERE daily_checkin_id = $1 ORDER BY occurred_at ASC, id ASC",
    [dailyCheckinId],
  );
}

export async function create(input: {
  daily_checkin_id: number;
  occurred_at?: string | null;
  time_type: "exact" | "approximate";
  approximate_time_label?: string | null;
  bristol_type?: number | null;
  amount?: string | null;
  difficulty?: string | null;
  pain_level?: number | null;
  color?: string | null;
  notes?: string | null;
}): Promise<BowelRecord> {
  assertBristol(input.bristol_type ?? null);
  assertPain(input.pain_level ?? null);
  assertApproximateLabel(input.approximate_time_label ?? null);
  if (input.time_type !== "exact" && input.time_type !== "approximate")
    throw new Error("time_type must be 'exact' or 'approximate'");
  if (input.time_type === "approximate" && !input.approximate_time_label) {
    // allow null label? spec says labels such as — we allow but warn via validation?
    // Keep nullable for flexibility; no hard error if missing label.
  }
  const ts = nowIso();
  await dbExecute(
    `INSERT INTO bowel_records
      (daily_checkin_id, occurred_at, time_type, approximate_time_label, bristol_type, amount, difficulty, pain_level, color, notes, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)`,
    [
      input.daily_checkin_id,
      input.occurred_at ?? null,
      input.time_type,
      input.approximate_time_label ?? null,
      input.bristol_type ?? null,
      input.amount ?? null,
      input.difficulty ?? null,
      input.pain_level ?? null,
      input.color ?? null,
      input.notes ?? null,
      ts,
    ],
  );
  // Return last inserted for that checkin (max id)
  const rows = await dbSelect<{ id: number }>(
    "SELECT id FROM bowel_records WHERE daily_checkin_id = $1 ORDER BY id DESC LIMIT 1",
    [input.daily_checkin_id],
  );
  if (!rows[0]) throw new Error("Failed to create bowel_record");
  return (await getById(rows[0].id))!;
}

export async function update(
  id: number,
  patch: Partial<{
    occurred_at: string | null;
    time_type: "exact" | "approximate";
    approximate_time_label: string | null;
    bristol_type: number | null;
    amount: string | null;
    difficulty: string | null;
    pain_level: number | null;
    color: string | null;
    notes: string | null;
  }>,
): Promise<BowelRecord> {
  const existing = await getById(id);
  if (!existing) throw new Error(`bowel_record ${id} not found`);
  if (patch.bristol_type !== undefined) assertBristol(patch.bristol_type);
  if (patch.pain_level !== undefined) assertPain(patch.pain_level);
  if (patch.approximate_time_label !== undefined)
    assertApproximateLabel(patch.approximate_time_label);

  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  for (const [k, v] of Object.entries(patch)) {
    sets.push(`${k} = $${idx++}`);
    params.push(v);
  }
  if (sets.length === 0) return existing;
  const ts = nowIso();
  sets.push(`updated_at = $${idx++}`);
  params.push(ts);
  params.push(id);
  await dbExecute(
    `UPDATE bowel_records SET ${sets.join(", ")} WHERE id = $${idx}`,
    params,
  );
  return (await getById(id))!;
}

export async function remove(id: number): Promise<void> {
  // bowel_record_tags cascade deletes via FK, but explicit delete is safe.
  // One script → atomic (a pooled standalone transaction is not safe, see sqlScript.ts).
  await executeScript([
    `DELETE FROM bowel_record_tags WHERE bowel_record_id = ${sqlLit(id)}`,
    `DELETE FROM bowel_records WHERE id = ${sqlLit(id)}`,
  ]);
}

// ---------------------------------------------------------------------------
// Tags junction helpers
// ---------------------------------------------------------------------------
export async function getTags(bowelRecordId: number): Promise<Tag[]> {
  return dbSelect<Tag>(
    `SELECT t.* FROM tags t
     INNER JOIN bowel_record_tags j ON j.tag_id = t.id
     WHERE j.bowel_record_id = $1
     ORDER BY t.category, t.name`,
    [bowelRecordId],
  );
}

export async function setTags(
  bowelRecordId: number,
  tagIds: number[],
): Promise<void> {
  const br = await getById(bowelRecordId);
  if (!br) throw new Error(`bowel_record ${bowelRecordId} not found`);
  await assertTagsExist(tagIds);
  await executeScript([
    `DELETE FROM bowel_record_tags WHERE bowel_record_id = ${sqlLit(bowelRecordId)}`,
    ...tagIds.map(
      (tagId) =>
        `INSERT OR IGNORE INTO bowel_record_tags (bowel_record_id, tag_id) VALUES (${sqlLit(bowelRecordId)}, ${sqlLit(tagId)})`,
    ),
  ]);
}

export async function addTag(bowelRecordId: number, tagId: number): Promise<void> {
  await dbExecute(
    "INSERT OR IGNORE INTO bowel_record_tags (bowel_record_id, tag_id) VALUES ($1,$2)",
    [bowelRecordId, tagId],
  );
}

export async function removeTag(bowelRecordId: number, tagId: number): Promise<void> {
  await dbExecute(
    "DELETE FROM bowel_record_tags WHERE bowel_record_id = $1 AND tag_id = $2",
    [bowelRecordId, tagId],
  );
}

/**
 * Pre-validate tag ids against the tags table so a foreign-key violation can
 * never fire mid-script (a mid-script failure leaves an open transaction on
 * the pooled connection that must be rolled back — avoidable, so avoid it).
 */
async function assertTagsExist(tagIds: number[]): Promise<void> {
  if (tagIds.length === 0) return;
  const unique = [...new Set(tagIds)];
  const placeholders = unique.map((_, i) => `$${i + 1}`).join(",");
  const rows = await dbSelect<{ id: number }>(
    `SELECT id FROM tags WHERE id IN (${placeholders})`,
    unique,
  );
  const found = new Set(rows.map((r) => r.id));
  const missing = unique.filter((id) => !found.has(id));
  if (missing.length > 0) throw new Error(`Unknown tag id(s): ${missing.join(", ")}`);
}

/**
 * Create a bowel record + attach tags atomically (single-script execute).
 */
export async function createWithTags(
  input: Parameters<typeof create>[0],
  tagIds: number[] = [],
): Promise<BowelRecord> {
  assertBristol(input.bristol_type ?? null);
  assertPain(input.pain_level ?? null);
  assertApproximateLabel(input.approximate_time_label ?? null);
  if (input.time_type !== "exact" && input.time_type !== "approximate")
    throw new Error("time_type must be 'exact' or 'approximate'");
  await assertTagsExist(tagIds);
  const ts = nowIso();
  await executeScript([
    `INSERT INTO bowel_records
       (daily_checkin_id, occurred_at, time_type, approximate_time_label, bristol_type, amount, difficulty, pain_level, color, notes, created_at, updated_at)
      VALUES (${sqlLit(input.daily_checkin_id)}, ${sqlLit(input.occurred_at ?? null)}, ${sqlLit(input.time_type)}, ${sqlLit(input.approximate_time_label ?? null)}, ${sqlLit(input.bristol_type ?? null)}, ${sqlLit(input.amount ?? null)}, ${sqlLit(input.difficulty ?? null)}, ${sqlLit(input.pain_level ?? null)}, ${sqlLit(input.color ?? null)}, ${sqlLit(input.notes ?? null)}, ${sqlLit(ts)}, ${sqlLit(ts)})`,
    // Reference the just-inserted row via subquery — last_insert_rowid() is
    // overwritten by every INSERT (including junction rows), so it cannot be
    // used for the second and later tag statements.
    ...tagIds.map(
      (tagId) =>
        `INSERT OR IGNORE INTO bowel_record_tags (bowel_record_id, tag_id) SELECT (SELECT id FROM bowel_records WHERE daily_checkin_id = ${sqlLit(input.daily_checkin_id)} ORDER BY id DESC LIMIT 1), ${sqlLit(tagId)}`,
    ),
  ]);
  const rows = await dbSelect<BowelRecord>(
    "SELECT * FROM bowel_records WHERE daily_checkin_id = $1 ORDER BY id DESC LIMIT 1",
    [input.daily_checkin_id],
  );
  if (!rows[0]) throw new Error("createWithTags: failed to get inserted id");
  return rows[0];
}
