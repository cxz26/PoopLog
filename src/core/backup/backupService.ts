/**
 * Backup Service — Phase 7.3: structured export + validation + deterministic serialization.
 * Reads via repositories, never raw SQL, payload only in memory.
 */

import type { BackupPayload } from "./backupTypes";
import * as DailyCheckinRepo from "../database/repositories/dailyCheckin.repository";
import * as BowelRecordRepo from "../database/repositories/bowelRecord.repository";
import * as TagRepo from "../database/repositories/tag.repository";

// Re-export validation error type
export interface BackupValidationError {
  code: string;
  path: string;
  message: string;
}

// Deterministic JSON serialization for payload (sorted keys, stable arrays)
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    const keys = Object.keys(value as Record<string, unknown>).sort();
    for (const k of keys) out[k] = sortKeys((value as Record<string, unknown>)[k]);
    return out;
  }
  return value;
}

export function serializeBackupPayload(payload: BackupPayload): string {
  const sorted = sortKeys(payload);
  return JSON.stringify(sorted);
}

export function deserializeBackupPayload(json: string): BackupPayload {
  return JSON.parse(json) as BackupPayload;
}

// Export payload generation (in-memory only)
export async function createBackupPayload(): Promise<BackupPayload> {
  const allCheckins = await DailyCheckinRepo.getAll();
  // Sort checkins by date for deterministic export
  allCheckins.sort((a, b) => (a.date < b.date ? -1 : 1));

  const daily_checkins: BackupPayload["data"]["daily_checkins"] = allCheckins.map((c) => ({
    date: c.date,
    completed: c.completed,
    has_bowel_movement: c.has_bowel_movement,
    recorded_at: c.recorded_at,
    created_at: c.created_at,
    updated_at: c.updated_at,
  }));

  // Bowel records: need daily_checkin_date stable reference, not id
  const bowel_records: BackupPayload["data"]["bowel_records"] = [];
  const idToDate = new Map(allCheckins.map((c) => [c.id, c.date]));
  // For deterministic ordering, sort by daily_checkin_date then occurred_at then created_at
  const allBowelRecords: import("../types/entities").BowelRecord[] = [];
  for (const c of allCheckins) {
    const recs = await BowelRecordRepo.getByDailyCheckin(c.id);
    allBowelRecords.push(...recs);
  }
  allBowelRecords.sort((a, b) => {
    const da = idToDate.get(a.daily_checkin_id) ?? "";
    const db = idToDate.get(b.daily_checkin_id) ?? "";
    if (da !== db) return da < db ? -1 : 1;
    const ta = a.occurred_at ?? a.created_at;
    const tb = b.occurred_at ?? b.created_at;
    return ta < tb ? -1 : 1;
  });
  for (const r of allBowelRecords) {
    const date = idToDate.get(r.daily_checkin_id);
    if (!date) continue; // should not happen, but skip orphan
    bowel_records.push({
      daily_checkin_date: date,
      occurred_at: r.occurred_at,
      time_type: r.time_type,
      approximate_time_label: r.approximate_time_label,
      bristol_type: r.bristol_type,
      amount: r.amount,
      difficulty: r.difficulty,
      pain_level: r.pain_level,
      color: r.color,
      notes: r.notes,
      created_at: r.created_at,
      updated_at: r.updated_at,
    });
  }

  // Tags: include all, sorted by category+name for determinism
  const allTags = await TagRepo.getAll();
  allTags.sort((a, b) => (a.category < b.category ? -1 : a.category > b.category ? 1 : a.name < b.name ? -1 : 1));
  const tags: BackupPayload["data"]["tags"] = allTags.map((t) => ({
    category: t.category,
    name: t.name,
    is_builtin: t.is_builtin,
    created_at: t.created_at,
    updated_at: t.updated_at,
  }));
  // Map tag id -> index in exported tags array
  const tagIdToIndex = new Map(allTags.map((t, idx) => [t.id, idx] as const));

  // Bowel_record_tags: via indices
  const bowel_record_tags: BackupPayload["data"]["bowel_record_tags"] = [];
  // Need to map bowel_record id -> index in exported bowel_records array
  const bowelIdToIndex = new Map(allBowelRecords.map((r, idx) => [r.id, idx] as const));
  for (const r of allBowelRecords) {
    const tagsForRecord = await BowelRecordRepo.getTags(r.id);
    for (const t of tagsForRecord) {
      const bIdx = bowelIdToIndex.get(r.id);
      const tIdx = tagIdToIndex.get(t.id);
      if (bIdx !== undefined && tIdx !== undefined) {
        bowel_record_tags.push({ bowel_record_index: bIdx, tag_index: tIdx });
      }
    }
  }
  bowel_record_tags.sort((a, b) => (a.bowel_record_index !== b.bowel_record_index ? a.bowel_record_index - b.bowel_record_index : a.tag_index - b.tag_index));

  // Sleep, water, menstrual: per daily_checkin_date
  const sleep_records: BackupPayload["data"]["sleep_records"] = [];
  const water_records: BackupPayload["data"]["water_records"] = [];
  const menstrual_records: BackupPayload["data"]["menstrual_records"] = [];
  for (const c of allCheckins) {
    const s = await DailyCheckinRepo.getSleep(c.id);
    if (s) {
      sleep_records.push({
        daily_checkin_date: c.date,
        total_minutes: s.total_minutes,
        quality: s.quality,
        created_at: s.created_at,
        updated_at: s.updated_at,
      });
    }
    const w = await DailyCheckinRepo.getWater(c.id);
    if (w) {
      water_records.push({
        daily_checkin_date: c.date,
        total_ml: w.total_ml,
        created_at: w.created_at,
        updated_at: w.updated_at,
      });
    }
    const m = await DailyCheckinRepo.getMenstrual(c.id);
    if (m) {
      menstrual_records.push({
        daily_checkin_date: c.date,
        has_period: m.has_period,
        flow: m.flow,
        pain_level: m.pain_level,
        notes: m.notes,
        created_at: m.created_at,
        updated_at: m.updated_at,
      });
    }
  }

  // Settings: only safe portable prefs (theme, units) — not PIN/security
  // For now, export empty/minimal settings; future can add from a settings store
  const settings: BackupPayload["data"]["settings"] = {};

  // Counts derived from actual arrays
  const counts: BackupPayload["counts"] = {
    daily_checkins: daily_checkins.length,
    bowel_records: bowel_records.length,
    tags: tags.length,
    bowel_record_tags: bowel_record_tags.length,
    sleep_records: sleep_records.length,
    water_records: water_records.length,
    menstrual_records: menstrual_records.length,
  };

  // Use current app/schema versions (hardcoded for now, could import from package.json/tauri.conf)
  const appVersion = "0.1.0";
  const schemaVersion = 3;

  const payload: BackupPayload = {
    schemaVersion,
    appVersion,
    exportedAt: new Date().toISOString(),
    counts,
    data: {
      daily_checkins,
      bowel_records,
      tags,
      bowel_record_tags,
      sleep_records,
      water_records,
      menstrual_records,
      settings,
    },
  };

  // Validate before returning (defensive)
  const validation = validateBackupPayload(payload);
  if (!validation.valid) {
    throw new Error(`Backup payload validation failed: ${validation.errors.map((e) => `${e.path}: ${e.message}`).join("; ")}`);
  }

  return payload;
}

// Validation
export function validateBackupPayload(payload: unknown): { valid: boolean; errors: BackupValidationError[] } {
  const errors: BackupValidationError[] = [];

  if (!payload || typeof payload !== "object") {
    errors.push({ code: "INVALID_PAYLOAD", path: "", message: "Payload must be an object" });
    return { valid: false, errors };
  }

  const p = payload as Record<string, unknown>;

  // General
  if (typeof p.schemaVersion !== "number") errors.push({ code: "INVALID_SCHEMA_VERSION", path: "schemaVersion", message: "schemaVersion must be a number" });
  if (typeof p.appVersion !== "string") errors.push({ code: "INVALID_APP_VERSION", path: "appVersion", message: "appVersion must be a string" });
  if (typeof p.exportedAt !== "string" || isNaN(Date.parse(p.exportedAt as string))) errors.push({ code: "INVALID_EXPORTED_AT", path: "exportedAt", message: "exportedAt must be a valid ISO date" });
  if (!p.counts || typeof p.counts !== "object") errors.push({ code: "MISSING_COUNTS", path: "counts", message: "counts is required" });
  if (!p.data || typeof p.data !== "object") {
    errors.push({ code: "MISSING_DATA", path: "data", message: "data is required" });
    return { valid: errors.length === 0, errors };
  }

  const data = p.data as Record<string, unknown>;
  const counts = (p.counts as Record<string, unknown>) ?? {};

  // Helper to check counts match arrays
  function checkCount(key: string, arr: unknown) {
    if (!Array.isArray(arr)) {
      errors.push({ code: "INVALID_TYPE", path: `data.${key}`, message: `${key} must be an array` });
      return;
    }
    const expected = counts[key];
    if (typeof expected === "number" && arr.length !== expected) {
      errors.push({ code: "COUNT_MISMATCH", path: `counts.${key}`, message: `${key} count mismatch: expected ${expected}, got ${arr.length}` });
    }
  }

  // Daily Check-ins
  const dailyCheckins = data.daily_checkins as unknown[] | undefined;
  if (!Array.isArray(dailyCheckins)) {
    errors.push({ code: "MISSING_DAILY_CHECKINS", path: "data.daily_checkins", message: "daily_checkins is required" });
  } else {
    checkCount("daily_checkins", dailyCheckins);
    const seenDates = new Set<string>();
    dailyCheckins.forEach((item, idx) => {
      const path = `data.daily_checkins[${idx}]`;
      if (!item || typeof item !== "object") {
        errors.push({ code: "INVALID_TYPE", path, message: "must be an object" });
        return;
      }
      const c = item as Record<string, unknown>;
      const date = c.date as string;
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) {
        errors.push({ code: "INVALID_DATE", path: `${path}.date`, message: "date must be YYYY-MM-DD" });
      } else {
        if (seenDates.has(date)) errors.push({ code: "DUPLICATE_DATE", path: `${path}.date`, message: `Duplicate daily check-in date: ${date}` });
        else seenDates.add(date);
      }
      if (c.completed !== 0 && c.completed !== 1) errors.push({ code: "INVALID_COMPLETED", path: `${path}.completed`, message: "completed must be 0 or 1" });
      if (c.has_bowel_movement !== null && c.has_bowel_movement !== 0 && c.has_bowel_movement !== 1) errors.push({ code: "INVALID_HAS_BOWEL_MOVEMENT", path: `${path}.has_bowel_movement`, message: "has_bowel_movement must be null, 0, or 1" });
      if (c.recorded_at != null && typeof c.recorded_at !== "string") errors.push({ code: "INVALID_RECORDED_AT", path: `${path}.recorded_at`, message: "recorded_at must be string or null" });
    });
  }

  // Bowel Records
  const bowelRecords = data.bowel_records as unknown[] | undefined;
  const dailyCheckinDates = new Set<string>(
    Array.isArray(dailyCheckins) ? (dailyCheckins as Array<Record<string, unknown>>).map((c) => c.date as string) : [],
  );
  if (!Array.isArray(bowelRecords)) {
    errors.push({ code: "MISSING_BOWEL_RECORDS", path: "data.bowel_records", message: "bowel_records is required" });
  } else {
    checkCount("bowel_records", bowelRecords);
    bowelRecords.forEach((item, idx) => {
      const path = `data.bowel_records[${idx}]`;
      if (!item || typeof item !== "object") {
        errors.push({ code: "INVALID_TYPE", path, message: "must be an object" });
        return;
      }
      const r = item as Record<string, unknown>;
      const dcd = r.daily_checkin_date as string;
      if (typeof dcd !== "string" || !dailyCheckinDates.has(dcd)) {
        errors.push({ code: "ORPHAN_BOWEL_RECORD", path: `${path}.daily_checkin_date`, message: `Referenced daily_checkin_date does not exist: ${dcd}` });
      }
      if (r.time_type !== "exact" && r.time_type !== "approximate") errors.push({ code: "INVALID_TIME_TYPE", path: `${path}.time_type`, message: "time_type must be exact or approximate" });
      if (r.approximate_time_label != null && !["Early Morning", "Morning", "Late Morning", "Afternoon", "Evening", "Night", "Late Night"].includes(r.approximate_time_label as string)) {
        errors.push({ code: "INVALID_APPROXIMATE_LABEL", path: `${path}.approximate_time_label`, message: "Invalid approximate_time_label" });
      }
      if (r.bristol_type != null && (typeof r.bristol_type !== "number" || r.bristol_type < 1 || r.bristol_type > 7 || !Number.isInteger(r.bristol_type))) {
        errors.push({ code: "INVALID_BRISTOL_TYPE", path: `${path}.bristol_type`, message: "Bristol type must be between 1 and 7" });
      }
      if (r.pain_level != null && (typeof r.pain_level !== "number" || r.pain_level < 0 || r.pain_level > 10 || !Number.isInteger(r.pain_level))) {
        errors.push({ code: "INVALID_PAIN_LEVEL", path: `${path}.pain_level`, message: "Pain level must be between 0 and 10" });
      }
      const validDifficulties = ["very_easy", "easy", "normal", "strained", "very_strained"];
      if (r.difficulty != null && !validDifficulties.includes(r.difficulty as string)) {
        errors.push({ code: "INVALID_DIFFICULTY", path: `${path}.difficulty`, message: `Invalid difficulty: ${r.difficulty}` });
      }
      const validAmounts = ["small", "medium", "large"];
      if (r.amount != null && !validAmounts.includes(r.amount as string)) {
        errors.push({ code: "INVALID_AMOUNT", path: `${path}.amount`, message: `Invalid amount: ${r.amount}` });
      }
      if (r.occurred_at != null && typeof r.occurred_at !== "string") errors.push({ code: "INVALID_OCCURRED_AT", path: `${path}.occurred_at`, message: "occurred_at must be string or null" });
    });
  }

  // Tags
  const tags = data.tags as unknown[] | undefined;
  if (!Array.isArray(tags)) {
    errors.push({ code: "MISSING_TAGS", path: "data.tags", message: "tags is required" });
  } else {
    checkCount("tags", tags);
    const seenTag = new Set<string>();
    tags.forEach((item, idx) => {
      const path = `data.tags[${idx}]`;
      if (!item || typeof item !== "object") {
        errors.push({ code: "INVALID_TYPE", path, message: "must be an object" });
        return;
      }
      const t = item as Record<string, unknown>;
      const cat = t.category as string;
      if (!["symptom", "food", "medication", "exercise"].includes(cat)) {
        errors.push({ code: "INVALID_TAG_CATEGORY", path: `${path}.category`, message: `Invalid tag category: ${cat}` });
      }
      const name = t.name as string;
      if (typeof name !== "string" || !name.trim()) errors.push({ code: "INVALID_TAG_NAME", path: `${path}.name`, message: "Tag name must be non-empty" });
      const key = `${cat}:${name}`;
      if (seenTag.has(key)) errors.push({ code: "DUPLICATE_TAG", path: `${path}`, message: `Duplicate tag category/name: ${key}` });
      else seenTag.add(key);
    });
  }

  // Tag relationships
  const bowelRecordTags = data.bowel_record_tags as unknown[] | undefined;
  if (!Array.isArray(bowelRecordTags)) {
    errors.push({ code: "MISSING_BOWEL_RECORD_TAGS", path: "data.bowel_record_tags", message: "bowel_record_tags is required" });
  } else {
    checkCount("bowel_record_tags", bowelRecordTags);
    const tagCount = Array.isArray(tags) ? tags.length : 0;
    const bowelCount = Array.isArray(bowelRecords) ? bowelRecords.length : 0;
    bowelRecordTags.forEach((item, idx) => {
      const path = `data.bowel_record_tags[${idx}]`;
      if (!item || typeof item !== "object") {
        errors.push({ code: "INVALID_TYPE", path, message: "must be an object" });
        return;
      }
      const j = item as Record<string, unknown>;
      const bi = j.bowel_record_index as number;
      const ti = j.tag_index as number;
      if (typeof bi !== "number" || !Number.isInteger(bi) || bi < 0 || bi >= bowelCount) {
        errors.push({ code: "ORPHAN_TAG_RELATIONSHIP", path: `${path}.bowel_record_index`, message: `Invalid bowel_record_index: ${bi}` });
      }
      if (typeof ti !== "number" || !Number.isInteger(ti) || ti < 0 || ti >= tagCount) {
        errors.push({ code: "ORPHAN_TAG_RELATIONSHIP", path: `${path}.tag_index`, message: `Invalid tag_index: ${ti}` });
      }
    });
  }

  // Sleep
  const sleepRecords = data.sleep_records as unknown[] | undefined;
  if (!Array.isArray(sleepRecords)) {
    errors.push({ code: "MISSING_SLEEP_RECORDS", path: "data.sleep_records", message: "sleep_records is required" });
  } else {
    checkCount("sleep_records", sleepRecords);
    sleepRecords.forEach((item, idx) => {
      const path = `data.sleep_records[${idx}]`;
      if (!item || typeof item !== "object") {
        errors.push({ code: "INVALID_TYPE", path, message: "must be an object" });
        return;
      }
      const s = item as Record<string, unknown>;
      const dcd = s.daily_checkin_date as string;
      if (typeof dcd !== "string" || !dailyCheckinDates.has(dcd)) {
        errors.push({ code: "ORPHAN_SLEEP_RECORD", path: `${path}.daily_checkin_date`, message: `Invalid daily_checkin_date: ${dcd}` });
      }
      if (typeof s.total_minutes !== "number" || !Number.isInteger(s.total_minutes) || s.total_minutes < 0) {
        errors.push({ code: "INVALID_SLEEP_MINUTES", path: `${path}.total_minutes`, message: "total_minutes must be integer >=0" });
      }
      if (s.quality != null && !["poor", "average", "good", "excellent"].includes(s.quality as string)) {
        errors.push({ code: "INVALID_SLEEP_QUALITY", path: `${path}.quality`, message: `Invalid quality: ${s.quality}` });
      }
    });
  }

  // Water
  const waterRecords = data.water_records as unknown[] | undefined;
  if (!Array.isArray(waterRecords)) {
    errors.push({ code: "MISSING_WATER_RECORDS", path: "data.water_records", message: "water_records is required" });
  } else {
    checkCount("water_records", waterRecords);
    waterRecords.forEach((item, idx) => {
      const path = `data.water_records[${idx}]`;
      if (!item || typeof item !== "object") {
        errors.push({ code: "INVALID_TYPE", path, message: "must be an object" });
        return;
      }
      const w = item as Record<string, unknown>;
      const dcd = w.daily_checkin_date as string;
      if (typeof dcd !== "string" || !dailyCheckinDates.has(dcd)) {
        errors.push({ code: "ORPHAN_WATER_RECORD", path: `${path}.daily_checkin_date`, message: `Invalid daily_checkin_date: ${dcd}` });
      }
      if (typeof w.total_ml !== "number" || !Number.isInteger(w.total_ml) || w.total_ml < 0) {
        errors.push({ code: "INVALID_WATER_ML", path: `${path}.total_ml`, message: "total_ml must be integer >=0" });
      }
    });
  }

  // Menstrual
  const menstrualRecords = data.menstrual_records as unknown[] | undefined;
  if (Array.isArray(menstrualRecords)) {
    checkCount("menstrual_records", menstrualRecords);
    menstrualRecords.forEach((item, idx) => {
      const path = `data.menstrual_records[${idx}]`;
      if (!item || typeof item !== "object") {
        errors.push({ code: "INVALID_TYPE", path, message: "must be an object" });
        return;
      }
      const m = item as Record<string, unknown>;
      const dcd = m.daily_checkin_date as string;
      if (typeof dcd !== "string" || !dailyCheckinDates.has(dcd)) {
        errors.push({ code: "ORPHAN_MENSTRUAL_RECORD", path: `${path}.daily_checkin_date`, message: `Invalid daily_checkin_date: ${dcd}` });
      }
      if (m.has_period !== null && m.has_period !== 0 && m.has_period !== 1) errors.push({ code: "INVALID_HAS_PERIOD", path: `${path}.has_period`, message: "has_period must be null, 0, or 1" });
      if (m.flow != null && !["light", "medium", "heavy", "spotting"].includes(m.flow as string)) {
        errors.push({ code: "INVALID_FLOW", path: `${path}.flow`, message: `Invalid flow: ${m.flow}` });
      }
      if (m.pain_level != null && (typeof m.pain_level !== "number" || m.pain_level < 0 || m.pain_level > 10 || !Number.isInteger(m.pain_level))) {
        errors.push({ code: "INVALID_MENSTRUAL_PAIN", path: `${path}.pain_level`, message: "pain_level must be 0-10 or null" });
      }
    });
  }

  // Settings: only allow safe portable settings
  const settings = data.settings as Record<string, unknown> | undefined;
  if (settings && typeof settings === "object") {
    const allowed = new Set(["theme", "units", "locale", "defaultTimeRange"]);
    for (const key of Object.keys(settings)) {
      if (!allowed.has(key)) {
        errors.push({ code: "INVALID_SETTING", path: `data.settings.${key}`, message: `Unsupported setting: ${key}` });
      }
    }
    // Check for forbidden security fields
    const forbidden = ["pin", "pinHash", "pinSalt", "security", "backupPassword", "attempts", "session"];
    for (const key of Object.keys(settings)) {
      if (forbidden.some((f) => key.toLowerCase().includes(f))) {
        errors.push({ code: "FORBIDDEN_SETTING", path: `data.settings.${key}`, message: `Forbidden setting: ${key}` });
      }
    }
  }

  // Data consistency: has_bowel_movement=0 with bowel records -> reject
  if (Array.isArray(dailyCheckins) && Array.isArray(bowelRecords)) {
    const dateToHasBm = new Map<string, number | null>(
      (dailyCheckins as Array<Record<string, unknown>>).map((c) => [c.date as string, c.has_bowel_movement as number | null]),
    );
    const dateToBowelCount = new Map<string, number>();
    for (const r of bowelRecords as Array<Record<string, unknown>>) {
      const d = r.daily_checkin_date as string;
      dateToBowelCount.set(d, (dateToBowelCount.get(d) || 0) + 1);
    }
    for (const [date, hasBm] of dateToHasBm.entries()) {
      const count = dateToBowelCount.get(date) || 0;
      if (hasBm === 0 && count > 0) {
        errors.push({ code: "INCONSISTENT_HAS_BM", path: `data.daily_checkins[${date}]`, message: `Daily check-in ${date} has_bowel_movement=0 but has ${count} bowel records` });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// Helper to get date range for preview
export function getBackupDateRange(payload: BackupPayload): { earliest: string | null; latest: string | null } {
  if (payload.data.daily_checkins.length === 0) return { earliest: null, latest: null };
  const dates = payload.data.daily_checkins.map((c) => c.date).sort();
  return { earliest: dates[0], latest: dates[dates.length - 1] };
}

// Canonical serialization for payload (same sorted logic as header)
export function canonicalSerializePayload(payload: BackupPayload): Uint8Array {
  const sorted = sortKeys(payload);
  return new TextEncoder().encode(JSON.stringify(sorted));
}
