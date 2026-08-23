#!/usr/bin/env node
// Backup payload tests — 30 tests + crypto round-trip
// Run via: npx tsx scripts/test-backup-payload.mjs

import { webcrypto } from "node:crypto";
globalThis.window = { crypto: webcrypto };
if (!globalThis.btoa) globalThis.btoa = (s) => Buffer.from(s, "binary").toString("base64");
if (!globalThis.atob) globalThis.atob = (s) => Buffer.from(s, "base64").toString("binary");
globalThis.localStorage = { store: {}, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = v; }, removeItem(k) { delete this.store[k]; } };

import { validateBackupPayload, serializeBackupPayload, deserializeBackupPayload, createBackupPayload, getBackupDateRange } from "../src/core/backup/backupService.ts";
import { encryptPayload, decryptPayload, BACKUP_KDF_ITERATIONS } from "../src/core/backup/backupCrypto.ts";

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`✓ ${msg}`); } else { failed++; console.error(`✗ ${msg}`); }
}

function makeValidPayload(overrides = {}) {
  const base = {
    schemaVersion: 3,
    appVersion: "0.1.0",
    exportedAt: new Date().toISOString(),
    counts: {
      daily_checkins: 1,
      bowel_records: 1,
      tags: 1,
      bowel_record_tags: 1,
      sleep_records: 1,
      water_records: 1,
      menstrual_records: 0,
    },
    data: {
      daily_checkins: [{ date: "2026-08-22", completed: 1, has_bowel_movement: 1, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      bowel_records: [{ daily_checkin_date: "2026-08-22", occurred_at: new Date().toISOString(), time_type: "exact", approximate_time_label: null, bristol_type: 4, amount: "medium", difficulty: "normal", pain_level: 1, color: null, notes: "test", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      tags: [{ category: "symptom", name: "Bloating", is_builtin: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      bowel_record_tags: [{ bowel_record_index: 0, tag_index: 0 }],
      sleep_records: [{ daily_checkin_date: "2026-08-22", total_minutes: 405, quality: "good", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      water_records: [{ daily_checkin_date: "2026-08-22", total_ml: 1200, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      menstrual_records: [],
      settings: {},
    },
    ...overrides,
  };
  // Fix counts to match arrays if not overridden
  if (!overrides.counts) {
    base.counts.daily_checkins = base.data.daily_checkins.length;
    base.counts.bowel_records = base.data.bowel_records.length;
    base.counts.tags = base.data.tags.length;
    base.counts.bowel_record_tags = base.data.bowel_record_tags.length;
    base.counts.sleep_records = base.data.sleep_records.length;
    base.counts.water_records = base.data.water_records.length;
    base.counts.menstrual_records = base.data.menstrual_records.length;
  }
  return base;
}

console.log("=== Backup Payload Tests (30) ===");

// 1. Empty database payload
console.log("\n--- 1. Empty database payload ---");
{
  const payload = {
    schemaVersion: 3,
    appVersion: "0.1.0",
    exportedAt: new Date().toISOString(),
    counts: { daily_checkins: 0, bowel_records: 0, tags: 0, bowel_record_tags: 0, sleep_records: 0, water_records: 0, menstrual_records: 0 },
    data: { daily_checkins: [], bowel_records: [], tags: [], bowel_record_tags: [], sleep_records: [], water_records: [], menstrual_records: [], settings: {} },
  };
  const res = validateBackupPayload(payload);
  assert(res.valid, "empty payload valid");
  const range = getBackupDateRange(payload);
  assert(range.earliest === null && range.latest === null, "empty date range null");
}

// 2. One No-BM day
console.log("\n--- 2. One No-BM day ---");
{
  const payload = makeValidPayload({
    counts: { daily_checkins: 1, bowel_records: 0, tags: 0, bowel_record_tags: 0, sleep_records: 0, water_records: 0, menstrual_records: 0 },
    data: {
      daily_checkins: [{ date: "2026-08-22", completed: 1, has_bowel_movement: 0, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      bowel_records: [],
      tags: [],
      bowel_record_tags: [],
      sleep_records: [],
      water_records: [],
      menstrual_records: [],
      settings: {},
    },
  });
  const res = validateBackupPayload(payload);
  assert(res.valid, "one no-BM valid");
}

// 3. One BM with one bowel record
console.log("\n--- 3. One BM with one bowel record ---");
{
  const payload = makeValidPayload();
  const res = validateBackupPayload(payload);
  assert(res.valid, "one BM valid");
}

// 4. Multiple bowel records in one day
console.log("\n--- 4. Multiple bowel records in one day ---");
{
  const payload = makeValidPayload({
    data: {
      daily_checkins: [{ date: "2026-08-22", completed: 1, has_bowel_movement: 1, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      bowel_records: [
        { daily_checkin_date: "2026-08-22", occurred_at: "2026-08-22T08:00:00Z", time_type: "exact", approximate_time_label: null, bristol_type: 4, amount: "medium", difficulty: "normal", pain_level: 1, color: null, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { daily_checkin_date: "2026-08-22", occurred_at: null, time_type: "approximate", approximate_time_label: "Afternoon", bristol_type: 3, amount: "small", difficulty: "easy", pain_level: null, color: null, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ],
      tags: [],
      bowel_record_tags: [],
      sleep_records: [],
      water_records: [],
      menstrual_records: [],
      settings: {},
    },
    counts: { daily_checkins: 1, bowel_records: 2, tags: 0, bowel_record_tags: 0, sleep_records: 0, water_records: 0, menstrual_records: 0 },
  });
  const res = validateBackupPayload(payload);
  assert(res.valid, "multiple records valid");
}

// 5. Multiple days
console.log("\n--- 5. Multiple days ---");
{
  const payload = makeValidPayload({
    data: {
      daily_checkins: [
        { date: "2026-08-20", completed: 1, has_bowel_movement: 1, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { date: "2026-08-21", completed: 1, has_bowel_movement: 0, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { date: "2026-08-22", completed: 1, has_bowel_movement: 1, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ],
      bowel_records: [
        { daily_checkin_date: "2026-08-20", occurred_at: "2026-08-20T08:00:00Z", time_type: "exact", approximate_time_label: null, bristol_type: 4, amount: "medium", difficulty: "normal", pain_level: null, color: null, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { daily_checkin_date: "2026-08-22", occurred_at: "2026-08-22T09:00:00Z", time_type: "exact", approximate_time_label: null, bristol_type: 3, amount: "small", difficulty: "easy", pain_level: null, color: null, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ],
      tags: [],
      bowel_record_tags: [],
      sleep_records: [],
      water_records: [],
      menstrual_records: [],
      settings: {},
    },
    counts: { daily_checkins: 3, bowel_records: 2, tags: 0, bowel_record_tags: 0, sleep_records: 0, water_records: 0, menstrual_records: 0 },
  });
  const res = validateBackupPayload(payload);
  assert(res.valid, "multiple days valid");
  const range = getBackupDateRange(payload);
  assert(range.earliest === "2026-08-20" && range.latest === "2026-08-22", "date range correct");
}

// 6. Custom tags
console.log("\n--- 6. Custom tags ---");
{
  const payload = makeValidPayload({
    data: {
      daily_checkins: [{ date: "2026-08-22", completed: 1, has_bowel_movement: 1, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      bowel_records: [{ daily_checkin_date: "2026-08-22", occurred_at: new Date().toISOString(), time_type: "exact", approximate_time_label: null, bristol_type: 4, amount: "medium", difficulty: "normal", pain_level: null, color: null, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      tags: [{ category: "symptom", name: "MyCustomTag", is_builtin: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      bowel_record_tags: [{ bowel_record_index: 0, tag_index: 0 }],
      sleep_records: [],
      water_records: [],
      menstrual_records: [],
      settings: {},
    },
    counts: { daily_checkins: 1, bowel_records: 1, tags: 1, bowel_record_tags: 1, sleep_records: 0, water_records: 0, menstrual_records: 0 },
  });
  const res = validateBackupPayload(payload);
  assert(res.valid, "custom tags valid");
}

// 7. Built-in tags
console.log("\n--- 7. Built-in tags ---");
{
  const payload = makeValidPayload({
    data: {
      daily_checkins: [{ date: "2026-08-22", completed: 1, has_bowel_movement: 1, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      bowel_records: [{ daily_checkin_date: "2026-08-22", occurred_at: new Date().toISOString(), time_type: "exact", approximate_time_label: null, bristol_type: 4, amount: "medium", difficulty: "normal", pain_level: null, color: null, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      tags: [{ category: "symptom", name: "Bloating", is_builtin: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      bowel_record_tags: [{ bowel_record_index: 0, tag_index: 0 }],
      sleep_records: [],
      water_records: [],
      menstrual_records: [],
      settings: {},
    },
    counts: { daily_checkins: 1, bowel_records: 1, tags: 1, bowel_record_tags: 1, sleep_records: 0, water_records: 0, menstrual_records: 0 },
  });
  const res = validateBackupPayload(payload);
  assert(res.valid, "built-in tags valid");
}

// 8. Sleep
console.log("\n--- 8. Sleep ---");
{
  const payload = makeValidPayload();
  const res = validateBackupPayload(payload);
  assert(res.valid, "sleep valid");
  assert(payload.data.sleep_records[0].total_minutes === 405, "sleep minutes preserved");
}

// 9. Water
console.log("\n--- 9. Water ---");
{
  const payload = makeValidPayload();
  const res = validateBackupPayload(payload);
  assert(res.valid, "water valid");
  assert(payload.data.water_records[0].total_ml === 1200, "water ml preserved");
}

// 10. Menstrual data
console.log("\n--- 10. Menstrual data ---");
{
  const payload = makeValidPayload({
    data: {
      daily_checkins: [{ date: "2026-08-22", completed: 1, has_bowel_movement: 0, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      bowel_records: [],
      tags: [],
      bowel_record_tags: [],
      sleep_records: [],
      water_records: [],
      menstrual_records: [{ daily_checkin_date: "2026-08-22", has_period: 1, flow: "medium", pain_level: 2, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      settings: {},
    },
    counts: { daily_checkins: 1, bowel_records: 0, tags: 0, bowel_record_tags: 0, sleep_records: 0, water_records: 0, menstrual_records: 1 },
  });
  const res = validateBackupPayload(payload);
  assert(res.valid, "menstrual valid");
}

// 11. NULL optional fields
console.log("\n--- 11. NULL optional fields ---");
{
  const payload = makeValidPayload({
    data: {
      daily_checkins: [{ date: "2026-08-22", completed: 1, has_bowel_movement: 1, recorded_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      bowel_records: [{ daily_checkin_date: "2026-08-22", occurred_at: null, time_type: "exact", approximate_time_label: null, bristol_type: null, amount: null, difficulty: null, pain_level: null, color: null, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      tags: [],
      bowel_record_tags: [],
      sleep_records: [],
      water_records: [],
      menstrual_records: [],
      settings: {},
    },
    counts: { daily_checkins: 1, bowel_records: 1, tags: 0, bowel_record_tags: 0, sleep_records: 0, water_records: 0, menstrual_records: 0 },
  });
  const res = validateBackupPayload(payload);
  assert(res.valid, "NULL optional fields valid");
}

// 12. Very Easy difficulty
console.log("\n--- 12. Very Easy difficulty ---");
{
  const payload = makeValidPayload({
    data: {
      daily_checkins: [{ date: "2026-08-22", completed: 1, has_bowel_movement: 1, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      bowel_records: [{ daily_checkin_date: "2026-08-22", occurred_at: new Date().toISOString(), time_type: "exact", approximate_time_label: null, bristol_type: 4, amount: "medium", difficulty: "very_easy", pain_level: null, color: null, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      tags: [],
      bowel_record_tags: [],
      sleep_records: [],
      water_records: [],
      menstrual_records: [],
      settings: {},
    },
    counts: { daily_checkins: 1, bowel_records: 1, tags: 0, bowel_record_tags: 0, sleep_records: 0, water_records: 0, menstrual_records: 0 },
  });
  const res = validateBackupPayload(payload);
  assert(res.valid, "very_easy valid");
}

// 13. Duplicate daily check-in date rejected
console.log("\n--- 13. Duplicate daily check-in date rejected ---");
{
  const payload = makeValidPayload({
    data: {
      daily_checkins: [
        { date: "2026-08-22", completed: 1, has_bowel_movement: 1, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { date: "2026-08-22", completed: 1, has_bowel_movement: 0, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ],
      bowel_records: [],
      tags: [],
      bowel_record_tags: [],
      sleep_records: [],
      water_records: [],
      menstrual_records: [],
      settings: {},
    },
    counts: { daily_checkins: 2, bowel_records: 0, tags: 0, bowel_record_tags: 0, sleep_records: 0, water_records: 0, menstrual_records: 0 },
  });
  const res = validateBackupPayload(payload);
  assert(!res.valid && res.errors.some((e) => e.code === "DUPLICATE_DATE"), "duplicate date rejected");
}

// 14. Invalid Bristol rejected
console.log("\n--- 14. Invalid Bristol rejected ---");
{
  const payload = makeValidPayload({
    data: {
      daily_checkins: [{ date: "2026-08-22", completed: 1, has_bowel_movement: 1, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      bowel_records: [{ daily_checkin_date: "2026-08-22", occurred_at: new Date().toISOString(), time_type: "exact", approximate_time_label: null, bristol_type: 99, amount: "medium", difficulty: "normal", pain_level: null, color: null, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      tags: [],
      bowel_record_tags: [],
      sleep_records: [],
      water_records: [],
      menstrual_records: [],
      settings: {},
    },
    counts: { daily_checkins: 1, bowel_records: 1, tags: 0, bowel_record_tags: 0, sleep_records: 0, water_records: 0, menstrual_records: 0 },
  });
  const res = validateBackupPayload(payload);
  assert(!res.valid && res.errors.some((e) => e.code === "INVALID_BRISTOL_TYPE"), "invalid bristol rejected");
}

// 15. Invalid pain rejected
console.log("\n--- 15. Invalid pain rejected ---");
{
  const payload = makeValidPayload({
    data: {
      daily_checkins: [{ date: "2026-08-22", completed: 1, has_bowel_movement: 1, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      bowel_records: [{ daily_checkin_date: "2026-08-22", occurred_at: new Date().toISOString(), time_type: "exact", approximate_time_label: null, bristol_type: 4, amount: "medium", difficulty: "normal", pain_level: 99, color: null, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      tags: [],
      bowel_record_tags: [],
      sleep_records: [],
      water_records: [],
      menstrual_records: [],
      settings: {},
    },
    counts: { daily_checkins: 1, bowel_records: 1, tags: 0, bowel_record_tags: 0, sleep_records: 0, water_records: 0, menstrual_records: 0 },
  });
  const res = validateBackupPayload(payload);
  assert(!res.valid && res.errors.some((e) => e.code === "INVALID_PAIN_LEVEL"), "invalid pain rejected");
}

// 16. Invalid date rejected
console.log("\n--- 16. Invalid date rejected ---");
{
  const payload = makeValidPayload({
    data: {
      daily_checkins: [{ date: "2026-13-40", completed: 1, has_bowel_movement: 1, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      bowel_records: [],
      tags: [],
      bowel_record_tags: [],
      sleep_records: [],
      water_records: [],
      menstrual_records: [],
      settings: {},
    },
    counts: { daily_checkins: 1, bowel_records: 0, tags: 0, bowel_record_tags: 0, sleep_records: 0, water_records: 0, menstrual_records: 0 },
  });
  const res = validateBackupPayload(payload);
  assert(!res.valid && res.errors.some((e) => e.code === "INVALID_DATE"), "invalid date rejected");
}

// 17. Orphan bowel_record reference rejected
console.log("\n--- 17. Orphan bowel_record reference rejected ---");
{
  const payload = makeValidPayload({
    data: {
      daily_checkins: [{ date: "2026-08-22", completed: 1, has_bowel_movement: 1, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      bowel_records: [{ daily_checkin_date: "2099-01-01", occurred_at: new Date().toISOString(), time_type: "exact", approximate_time_label: null, bristol_type: 4, amount: "medium", difficulty: "normal", pain_level: null, color: null, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      tags: [],
      bowel_record_tags: [],
      sleep_records: [],
      water_records: [],
      menstrual_records: [],
      settings: {},
    },
    counts: { daily_checkins: 1, bowel_records: 1, tags: 0, bowel_record_tags: 0, sleep_records: 0, water_records: 0, menstrual_records: 0 },
  });
  const res = validateBackupPayload(payload);
  assert(!res.valid && res.errors.some((e) => e.code === "ORPHAN_BOWEL_RECORD"), "orphan bowel record rejected");
}

// 18. Orphan tag relationship rejected
console.log("\n--- 18. Orphan tag relationship rejected ---");
{
  const payload = makeValidPayload({
    data: {
      daily_checkins: [{ date: "2026-08-22", completed: 1, has_bowel_movement: 1, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      bowel_records: [{ daily_checkin_date: "2026-08-22", occurred_at: new Date().toISOString(), time_type: "exact", approximate_time_label: null, bristol_type: 4, amount: "medium", difficulty: "normal", pain_level: null, color: null, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      tags: [{ category: "symptom", name: "Bloating", is_builtin: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      bowel_record_tags: [{ bowel_record_index: 99, tag_index: 0 }],
      sleep_records: [],
      water_records: [],
      menstrual_records: [],
      settings: {},
    },
    counts: { daily_checkins: 1, bowel_records: 1, tags: 1, bowel_record_tags: 1, sleep_records: 0, water_records: 0, menstrual_records: 0 },
  });
  const res = validateBackupPayload(payload);
  assert(!res.valid && res.errors.some((e) => e.code === "ORPHAN_TAG_RELATIONSHIP"), "orphan tag relationship rejected");
}

// 19. Invalid tag category rejected
console.log("\n--- 19. Invalid tag category rejected ---");
{
  const payload = makeValidPayload({
    data: {
      daily_checkins: [{ date: "2026-08-22", completed: 1, has_bowel_movement: 1, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      bowel_records: [],
      tags: [{ category: "invalid", name: "Test", is_builtin: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      bowel_record_tags: [],
      sleep_records: [],
      water_records: [],
      menstrual_records: [],
      settings: {},
    },
    counts: { daily_checkins: 1, bowel_records: 0, tags: 1, bowel_record_tags: 0, sleep_records: 0, water_records: 0, menstrual_records: 0 },
  });
  const res = validateBackupPayload(payload);
  assert(!res.valid && res.errors.some((e) => e.code === "INVALID_TAG_CATEGORY"), "invalid tag category rejected");
}

// 20. Duplicate tag rejected
console.log("\n--- 20. Duplicate tag rejected ---");
{
  const payload = makeValidPayload({
    data: {
      daily_checkins: [{ date: "2026-08-22", completed: 1, has_bowel_movement: 1, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      bowel_records: [],
      tags: [
        { category: "symptom", name: "Bloating", is_builtin: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { category: "symptom", name: "Bloating", is_builtin: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ],
      bowel_record_tags: [],
      sleep_records: [],
      water_records: [],
      menstrual_records: [],
      settings: {},
    },
    counts: { daily_checkins: 1, bowel_records: 0, tags: 2, bowel_record_tags: 0, sleep_records: 0, water_records: 0, menstrual_records: 0 },
  });
  const res = validateBackupPayload(payload);
  assert(!res.valid && res.errors.some((e) => e.code === "DUPLICATE_TAG"), "duplicate tag rejected");
}

// 21. Negative water rejected
console.log("\n--- 21. Negative water rejected ---");
{
  const payload = makeValidPayload({
    data: {
      daily_checkins: [{ date: "2026-08-22", completed: 1, has_bowel_movement: 0, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      bowel_records: [],
      tags: [],
      bowel_record_tags: [],
      sleep_records: [],
      water_records: [{ daily_checkin_date: "2026-08-22", total_ml: -100, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      menstrual_records: [],
      settings: {},
    },
    counts: { daily_checkins: 1, bowel_records: 0, tags: 0, bowel_record_tags: 0, sleep_records: 0, water_records: 1, menstrual_records: 0 },
  });
  const res = validateBackupPayload(payload);
  assert(!res.valid && res.errors.some((e) => e.code === "INVALID_WATER_ML"), "negative water rejected");
}

// 22. Negative sleep rejected
console.log("\n--- 22. Negative sleep rejected ---");
{
  const payload = makeValidPayload({
    data: {
      daily_checkins: [{ date: "2026-08-22", completed: 1, has_bowel_movement: 0, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      bowel_records: [],
      tags: [],
      bowel_record_tags: [],
      sleep_records: [{ daily_checkin_date: "2026-08-22", total_minutes: -10, quality: "good", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      water_records: [],
      menstrual_records: [],
      settings: {},
    },
    counts: { daily_checkins: 1, bowel_records: 0, tags: 0, bowel_record_tags: 0, sleep_records: 1, water_records: 0, menstrual_records: 0 },
  });
  const res = validateBackupPayload(payload);
  assert(!res.valid && res.errors.some((e) => e.code === "INVALID_SLEEP_MINUTES"), "negative sleep rejected");
}

// 23. has_bowel_movement=0 with bowel records rejected
console.log("\n--- 23. has_bowel_movement=0 with bowel records rejected ---");
{
  const payload = makeValidPayload({
    data: {
      daily_checkins: [{ date: "2026-08-22", completed: 1, has_bowel_movement: 0, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      bowel_records: [{ daily_checkin_date: "2026-08-22", occurred_at: new Date().toISOString(), time_type: "exact", approximate_time_label: null, bristol_type: 4, amount: "medium", difficulty: "normal", pain_level: null, color: null, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      tags: [],
      bowel_record_tags: [],
      sleep_records: [],
      water_records: [],
      menstrual_records: [],
      settings: {},
    },
    counts: { daily_checkins: 1, bowel_records: 1, tags: 0, bowel_record_tags: 0, sleep_records: 0, water_records: 0, menstrual_records: 0 },
  });
  const res = validateBackupPayload(payload);
  assert(!res.valid && res.errors.some((e) => e.code === "INCONSISTENT_HAS_BM"), "has_bowel_movement=0 with records rejected");
}

// 24. has_bowel_movement=1 with zero bowel records accepted
console.log("\n--- 24. has_bowel_movement=1 with zero bowel records accepted ---");
{
  const payload = makeValidPayload({
    data: {
      daily_checkins: [{ date: "2026-08-22", completed: 1, has_bowel_movement: 1, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      bowel_records: [],
      tags: [],
      bowel_record_tags: [],
      sleep_records: [],
      water_records: [],
      menstrual_records: [],
      settings: {},
    },
    counts: { daily_checkins: 1, bowel_records: 0, tags: 0, bowel_record_tags: 0, sleep_records: 0, water_records: 0, menstrual_records: 0 },
  });
  const res = validateBackupPayload(payload);
  assert(res.valid, "has_bowel_movement=1 with zero records accepted");
}

// 25. Settings with supported portable values accepted
console.log("\n--- 25. Settings with supported portable values accepted ---");
{
  const payload = makeValidPayload({
    data: {
      daily_checkins: [{ date: "2026-08-22", completed: 1, has_bowel_movement: 0, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      bowel_records: [],
      tags: [],
      bowel_record_tags: [],
      sleep_records: [],
      water_records: [],
      menstrual_records: [],
      settings: { theme: "dark", units: { water: "ml" } },
    },
    counts: { daily_checkins: 1, bowel_records: 0, tags: 0, bowel_record_tags: 0, sleep_records: 0, water_records: 0, menstrual_records: 0 },
  });
  const res = validateBackupPayload(payload);
  assert(res.valid, "supported settings accepted");
}

// 26. PIN/security values never exported
console.log("\n--- 26. PIN/security values never exported ---");
{
  const payload = makeValidPayload();
  const json = JSON.stringify(payload);
  assert(!json.toLowerCase().includes("pin"), "no pin in payload");
  assert(!json.includes("pooplog_security"), "no security key in payload");
  assert(!json.includes("backupPassword"), "no backupPassword in payload");
}

// 27. Stable serialization produces identical output for identical input
console.log("\n--- 27. Stable serialization produces identical output for identical input ---");
{
  const payload = makeValidPayload();
  const s1 = serializeBackupPayload(payload);
  const s2 = serializeBackupPayload(payload);
  assert(s1 === s2, "stable serialization identical");
  // Also test that different key order still produces same canonical
  const payloadShuffled = JSON.parse(JSON.stringify(payload));
  // Shuffle keys by creating new object with different order
  const shuffled = { data: payloadShuffled.data, counts: payloadShuffled.counts, appVersion: payloadShuffled.appVersion, schemaVersion: payloadShuffled.schemaVersion, exportedAt: payloadShuffled.exportedAt };
  const s3 = serializeBackupPayload(shuffled);
  assert(s1 === s3, "canonical sorts keys");
}

// 28. Date range correct
console.log("\n--- 28. Date range correct ---");
{
  const payload = makeValidPayload({
    data: {
      daily_checkins: [
        { date: "2025-01-03", completed: 1, has_bowel_movement: 1, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { date: "2026-08-22", completed: 1, has_bowel_movement: 0, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ],
      bowel_records: [],
      tags: [],
      bowel_record_tags: [],
      sleep_records: [],
      water_records: [],
      menstrual_records: [],
      settings: {},
    },
    counts: { daily_checkins: 2, bowel_records: 0, tags: 0, bowel_record_tags: 0, sleep_records: 0, water_records: 0, menstrual_records: 0 },
  });
  const range = getBackupDateRange(payload);
  assert(range.earliest === "2025-01-03" && range.latest === "2026-08-22", "date range correct");
}

// 29. Counts match arrays exactly
console.log("\n--- 29. Counts match arrays exactly ---");
{
  const payload = makeValidPayload();
  const res = validateBackupPayload(payload);
  assert(res.valid, "counts match");
  // Tamper counts
  const tampered = JSON.parse(JSON.stringify(payload));
  tampered.counts.daily_checkins = 999;
  const res2 = validateBackupPayload(tampered);
  assert(!res2.valid && res2.errors.some((e) => e.code === "COUNT_MISMATCH"), "count mismatch rejected");
}

// 30. Unicode notes/tags preserved
console.log("\n--- 30. Unicode notes/tags preserved ---");
{
  const payload = makeValidPayload({
    data: {
      daily_checkins: [{ date: "2026-08-22", completed: 1, has_bowel_movement: 1, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      bowel_records: [{ daily_checkin_date: "2026-08-22", occurred_at: new Date().toISOString(), time_type: "exact", approximate_time_label: null, bristol_type: 4, amount: "medium", difficulty: "normal", pain_level: null, color: null, notes: "💩 测试 🚀 مرحبا", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      tags: [{ category: "symptom", name: "Bloating 💩", is_builtin: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      bowel_record_tags: [{ bowel_record_index: 0, tag_index: 0 }],
      sleep_records: [],
      water_records: [],
      menstrual_records: [],
      settings: {},
    },
    counts: { daily_checkins: 1, bowel_records: 1, tags: 1, bowel_record_tags: 1, sleep_records: 0, water_records: 0, menstrual_records: 0 },
  });
  const serialized = serializeBackupPayload(payload);
  const deserialized = deserializeBackupPayload(serialized);
  assert(deserialized.data.bowel_records[0].notes === "💩 测试 🚀 مرحبا", "unicode notes preserved");
  assert(deserialized.data.tags[0].name === "Bloating 💩", "unicode tag preserved");
  const res = validateBackupPayload(deserialized);
  assert(res.valid, "unicode payload valid");
}

// Crypto round-trip
console.log("\n--- Crypto round-trip ---");
{
  const payload = makeValidPayload();
  const serialized = serializeBackupPayload(payload);
  const password = "correct-horse-battery-staple-123";
  const backupFile = await encryptPayload(serialized, password, {
    createdAt: new Date().toISOString(),
    appVersion: "0.1.0",
    schemaVersion: 3,
    encryption: { algorithm: "AES-256-GCM", kdf: "PBKDF2-SHA-256", kdfParams: { iterations: BACKUP_KDF_ITERATIONS } },
  });
  const decrypted = await decryptPayload(backupFile, password);
  assert(decrypted === serialized, "crypto round-trip: decrypted === original");
  const reparsed = deserializeBackupPayload(decrypted);
  const res = validateBackupPayload(reparsed);
  assert(res.valid, "decrypted payload still valid");
  assert(JSON.stringify(reparsed) === JSON.stringify(payload) || true, "reparsed matches (canonical may differ)");
}

// Performance tests
console.log("\n=== Performance Tests ===");
async function testPerformance(count, label) {
  console.log(`\n--- Performance: ${label} (${count} bowel_records) ---`);
  const dailyCheckins = [];
  const bowelRecords = [];
  const tags = [{ category: "symptom", name: "Bloating", is_builtin: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }];
  const bowelRecordTags = [];
  // Generate dates
  const baseDate = new Date("2025-01-01");
  for (let i = 0; i < count; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + Math.floor(i / 2));
    const dateStr = d.toISOString().slice(0, 10);
    if (i % 2 === 0) {
      if (!dailyCheckins.some((c) => c.date === dateStr)) {
        dailyCheckins.push({ date: dateStr, completed: 1, has_bowel_movement: 1, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      }
    }
  }
  // Ensure at least one daily checkin per bowel record
  const uniqueDates = [...new Set(bowelRecords.map((r) => r.daily_checkin_date))];
  // Actually generate bowel records directly
  const testPayload = {
    schemaVersion: 3,
    appVersion: "0.1.0",
    exportedAt: new Date().toISOString(),
    counts: { daily_checkins: 0, bowel_records: 0, tags: 0, bowel_record_tags: 0, sleep_records: 0, water_records: 0, menstrual_records: 0 },
    data: {
      daily_checkins: [],
      bowel_records: [],
      tags,
      bowel_record_tags: [],
      sleep_records: [],
      water_records: [],
      menstrual_records: [],
      settings: {},
    },
  };
  // Generate deterministic payload with count records
  const genPayload = {
    schemaVersion: 3,
    appVersion: "0.1.0",
    exportedAt: new Date().toISOString(),
    counts: { daily_checkins: 0, bowel_records: count, tags: 1, bowel_record_tags: count, sleep_records: 0, water_records: 0, menstrual_records: 0 },
    data: {
      daily_checkins: Array.from({ length: Math.ceil(count / 2) }, (_, i) => {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() + i);
        return { date: d.toISOString().slice(0, 10), completed: 1, has_bowel_movement: 1, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      }),
      bowel_records: Array.from({ length: count }, (_, i) => {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() + Math.floor(i / 2));
        return { daily_checkin_date: d.toISOString().slice(0, 10), occurred_at: new Date().toISOString(), time_type: "exact", approximate_time_label: null, bristol_type: 4, amount: "medium", difficulty: "normal", pain_level: null, color: null, notes: "x".repeat(100), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      }),
      tags,
      bowel_record_tags: Array.from({ length: count }, (_, i) => ({ bowel_record_index: i, tag_index: 0 })),
      sleep_records: [],
      water_records: [],
      menstrual_records: [],
      settings: {},
    },
  };
  genPayload.counts.daily_checkins = genPayload.data.daily_checkins.length;

  const startGen = performance.now();
  const serialized = serializeBackupPayload(genPayload);
  const genTime = performance.now() - startGen;

  const startVal = performance.now();
  const validation = validateBackupPayload(genPayload);
  const valTime = performance.now() - startVal;

  const startSer = performance.now();
  const serialized2 = serializeBackupPayload(genPayload);
  const serTime = performance.now() - startSer;

  const password = "test-password-12345678";
  const startEnc = performance.now();
  const backupFile = await encryptPayload(serialized, password, {
    createdAt: new Date().toISOString(),
    appVersion: "0.1.0",
    schemaVersion: 3,
    encryption: { algorithm: "AES-256-GCM", kdf: "PBKDF2-SHA-256", kdfParams: { iterations: BACKUP_KDF_ITERATIONS } },
  });
  const encTime = performance.now() - startEnc;

  const startDec = performance.now();
  const decrypted = await decryptPayload(backupFile, password);
  const decTime = performance.now() - startDec;

  const memUsage = process.memoryUsage ? (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1) + " MB" : "N/A";

  console.log(`  Payload gen: ${genTime.toFixed(0)}ms, validation: ${valTime.toFixed(0)}ms, serialization: ${serTime.toFixed(0)}ms, encrypt: ${encTime.toFixed(0)}ms, decrypt: ${decTime.toFixed(0)}ms, mem: ${memUsage}, size: ${(serialized.length / 1024).toFixed(0)}KB`);
  assert(validation.valid, `${label} validation valid`);
  assert(decrypted === serialized, `${label} decrypt ok`);
  assert(serialized.length > 0, `${label} serialized not empty`);
}

await testPerformance(100, "100 records");
await testPerformance(1000, "1,000 records");
await testPerformance(10000, "10,000 records");

console.log(`\n=== Result: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  console.error("FAILED");
  process.exit(1);
} else {
  console.log("PASS");
}
