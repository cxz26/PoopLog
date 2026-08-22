/**
 * DailyCheckinRepository — typed data-access for daily_checkins.
 * Also manages optional sleep/water/menstrual per daily_checkin.
 */

import { dbExecute, dbSelect, withTransaction } from "../connection";
import {
  assertValidDate,
  assertNonNegativeInt,
  assertSleepQuality,
} from "../../validators";
import type {
  DailyCheckin,
  SleepRecord,
  WaterRecord,
  MenstrualRecord,
} from "../../types/entities";

function nowIso(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// DailyCheckin CRUD
// ---------------------------------------------------------------------------
export async function getByDate(date: string): Promise<DailyCheckin | null> {
  assertValidDate(date);
  const rows = await dbSelect<DailyCheckin>(
    "SELECT * FROM daily_checkins WHERE date = $1 LIMIT 1",
    [date],
  );
  return rows[0] ?? null;
}

export async function getById(id: number): Promise<DailyCheckin | null> {
  const rows = await dbSelect<DailyCheckin>(
    "SELECT * FROM daily_checkins WHERE id = $1 LIMIT 1",
    [id],
  );
  return rows[0] ?? null;
}

export async function getDateRange(
  start: string,
  end: string,
): Promise<DailyCheckin[]> {
  assertValidDate(start);
  assertValidDate(end);
  return dbSelect<DailyCheckin>(
    "SELECT * FROM daily_checkins WHERE date BETWEEN $1 AND $2 ORDER BY date ASC",
    [start, end],
  );
}

export async function getAll(): Promise<DailyCheckin[]> {
  return dbSelect<DailyCheckin>(
    "SELECT * FROM daily_checkins ORDER BY date ASC",
  );
}

export async function create(input: {
  date: string;
  completed?: 0 | 1;
  has_bowel_movement?: 0 | 1 | null;
  recorded_at?: string | null;
}): Promise<DailyCheckin> {
  assertValidDate(input.date);
  const completed = input.completed ?? 0;
  if (completed !== 0 && completed !== 1) throw new Error("completed must be 0 or 1");
  if (input.has_bowel_movement != null && input.has_bowel_movement !== 0 && input.has_bowel_movement !== 1)
    throw new Error("has_bowel_movement must be 0,1 or null");

  const ts = nowIso();
  await dbExecute(
    "INSERT INTO daily_checkins (date, completed, has_bowel_movement, recorded_at, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6)",
    [input.date, completed, input.has_bowel_movement ?? null, input.recorded_at ?? null, ts, ts],
  );
  const created = await getByDate(input.date);
  if (!created) throw new Error("Failed to create daily_checkin");
  return created;
}

export async function update(
  id: number,
  patch: Partial<{
    completed: 0 | 1;
    has_bowel_movement: 0 | 1 | null;
    recorded_at: string | null;
  }>,
): Promise<DailyCheckin> {
  const existing = await getById(id);
  if (!existing) throw new Error(`daily_checkin ${id} not found`);
  if (patch.completed != null && patch.completed !== 0 && patch.completed !== 1)
    throw new Error("completed must be 0 or 1");
  if (patch.has_bowel_movement !== undefined && patch.has_bowel_movement != null && patch.has_bowel_movement !== 0 && patch.has_bowel_movement !== 1)
    throw new Error("has_bowel_movement must be 0,1 or null");

  const ts = nowIso();
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (patch.completed !== undefined) { sets.push(`completed = $${idx++}`); params.push(patch.completed); }
  if (patch.has_bowel_movement !== undefined) { sets.push(`has_bowel_movement = $${idx++}`); params.push(patch.has_bowel_movement); }
  if (patch.recorded_at !== undefined) { sets.push(`recorded_at = $${idx++}`); params.push(patch.recorded_at); }
  sets.push(`updated_at = $${idx++}`); params.push(ts);
  params.push(id);
  await dbExecute(`UPDATE daily_checkins SET ${sets.join(", ")} WHERE id = $${idx}`, params);
  const updated = await getById(id);
  if (!updated) throw new Error("Update failed");
  return updated;
}

export async function markCompleted(
  date: string,
  has_bowel_movement: 0 | 1,
): Promise<DailyCheckin> {
  assertValidDate(date);
  if (has_bowel_movement !== 0 && has_bowel_movement !== 1) throw new Error("has_bowel_movement must be 0 or 1");
  const existing = await getByDate(date);
  const ts = nowIso();
  if (existing) {
    await dbExecute(
      "UPDATE daily_checkins SET completed = 1, has_bowel_movement = $1, recorded_at = $2, updated_at = $2 WHERE id = $3",
      [has_bowel_movement, ts, existing.id],
    );
    return (await getById(existing.id))!;
  }
  await dbExecute(
    "INSERT INTO daily_checkins (date, completed, has_bowel_movement, recorded_at, created_at, updated_at) VALUES ($1,1,$2,$3,$3,$3)",
    [date, has_bowel_movement, ts],
  );
  return (await getByDate(date))!;
}

export async function remove(id: number): Promise<void> {
  // ON DELETE CASCADE will remove bowel_records, bowel_record_tags, sleep/water/menstrual via FK
  await withTransaction(async (db) => {
    await db.execute("DELETE FROM daily_checkins WHERE id = $1", [id]);
  });
}

// ---------------------------------------------------------------------------
// Sleep / Water / Menstrual — optional, per daily_checkin, unique
// ---------------------------------------------------------------------------
export async function getSleep(dailyCheckinId: number): Promise<SleepRecord | null> {
  const rows = await dbSelect<SleepRecord>(
    "SELECT * FROM sleep_records WHERE daily_checkin_id = $1 LIMIT 1",
    [dailyCheckinId],
  );
  return rows[0] ?? null;
}

export async function setSleep(
  dailyCheckinId: number,
  total_minutes: number,
  quality: string | null = null,
): Promise<SleepRecord> {
  assertNonNegativeInt(total_minutes, "total_minutes");
  assertSleepQuality(quality);
  const dc = await getById(dailyCheckinId);
  if (!dc) throw new Error(`daily_checkin ${dailyCheckinId} not found`);
  const ts = nowIso();
  await dbExecute(
    `INSERT INTO sleep_records (daily_checkin_id, total_minutes, quality, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$4)
     ON CONFLICT(daily_checkin_id) DO UPDATE SET total_minutes=excluded.total_minutes, quality=excluded.quality, updated_at=excluded.updated_at`,
    [dailyCheckinId, total_minutes, quality, ts],
  );
  return (await getSleep(dailyCheckinId))!;
}

export async function clearSleep(dailyCheckinId: number): Promise<void> {
  await dbExecute("DELETE FROM sleep_records WHERE daily_checkin_id = $1", [dailyCheckinId]);
}

export async function getWater(dailyCheckinId: number): Promise<WaterRecord | null> {
  const rows = await dbSelect<WaterRecord>(
    "SELECT * FROM water_records WHERE daily_checkin_id = $1 LIMIT 1",
    [dailyCheckinId],
  );
  return rows[0] ?? null;
}

export async function setWater(
  dailyCheckinId: number,
  total_ml: number,
): Promise<WaterRecord> {
  assertNonNegativeInt(total_ml, "total_ml");
  const dc = await getById(dailyCheckinId);
  if (!dc) throw new Error(`daily_checkin ${dailyCheckinId} not found`);
  const ts = nowIso();
  await dbExecute(
    `INSERT INTO water_records (daily_checkin_id, total_ml, created_at, updated_at)
     VALUES ($1,$2,$3,$3)
     ON CONFLICT(daily_checkin_id) DO UPDATE SET total_ml=excluded.total_ml, updated_at=excluded.updated_at`,
    [dailyCheckinId, total_ml, ts],
  );
  return (await getWater(dailyCheckinId))!;
}

export async function clearWater(dailyCheckinId: number): Promise<void> {
  await dbExecute("DELETE FROM water_records WHERE daily_checkin_id = $1", [dailyCheckinId]);
}

export async function getMenstrual(dailyCheckinId: number): Promise<MenstrualRecord | null> {
  const rows = await dbSelect<MenstrualRecord>(
    "SELECT * FROM menstrual_records WHERE daily_checkin_id = $1 LIMIT 1",
    [dailyCheckinId],
  );
  return rows[0] ?? null;
}

export async function setMenstrual(
  dailyCheckinId: number,
  patch: { has_period?: 0 | 1 | null; flow?: string | null; pain_level?: number | null; notes?: string | null },
): Promise<MenstrualRecord> {
  const dc = await getById(dailyCheckinId);
  if (!dc) throw new Error(`daily_checkin ${dailyCheckinId} not found`);
  if (patch.pain_level != null) {
    if (!Number.isInteger(patch.pain_level) || patch.pain_level < 0 || patch.pain_level > 10)
      throw new Error("menstrual pain_level must be 0-10");
  }
  const ts = nowIso();
  // Upsert: build dynamic
  const existing = await getMenstrual(dailyCheckinId);
  if (!existing) {
    await dbExecute(
      "INSERT INTO menstrual_records (daily_checkin_id, has_period, flow, pain_level, notes, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$6)",
      [dailyCheckinId, patch.has_period ?? null, patch.flow ?? null, patch.pain_level ?? null, patch.notes ?? null, ts],
    );
  } else {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (patch.has_period !== undefined) { sets.push(`has_period = $${idx++}`); params.push(patch.has_period); }
    if (patch.flow !== undefined) { sets.push(`flow = $${idx++}`); params.push(patch.flow); }
    if (patch.pain_level !== undefined) { sets.push(`pain_level = $${idx++}`); params.push(patch.pain_level); }
    if (patch.notes !== undefined) { sets.push(`notes = $${idx++}`); params.push(patch.notes); }
    sets.push(`updated_at = $${idx++}`); params.push(ts);
    params.push(dailyCheckinId);
    await dbExecute(`UPDATE menstrual_records SET ${sets.join(", ")} WHERE daily_checkin_id = $${idx}`, params);
  }
  return (await getMenstrual(dailyCheckinId))!;
}
