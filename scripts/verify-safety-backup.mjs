#!/usr/bin/env node
// Regression test: safety-backup post-write decrypt verification + robust
// cleanup ordering (clock rollback, same-timestamp ties, invalid files).
// Run with: npx tsx scripts/verify-safety-backup.mjs

import { webcrypto } from "node:crypto";
globalThis.window = { crypto: webcrypto };
if (!globalThis.btoa) globalThis.btoa = (s) => Buffer.from(s, "binary").toString("base64");
if (!globalThis.atob) globalThis.atob = (s) => Buffer.from(s, "base64").toString("binary");

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`✓ ${msg}`); }
  else { failed++; console.error(`✗ ${msg}`); }
}

import { createSafetyBackup, listSafetyBackups, cleanupSafetyBackups, parseSafetyFilenameTimestamp, getSafetyDirPath } from "../src/core/backup/safetyBackup.ts";
import { decryptPayload } from "../src/core/backup/backupCrypto.ts";
import { validateBackupPayload } from "../src/core/backup/backupService.ts";
import { __setTestDatabase, closeDatabase } from "../src/core/database/connection.ts";
import fs from "node:fs/promises";
import path from "node:path";

// DB-level mock: answers the SELECT shapes used by the repositories that
// createBackupPayload reads through. (Module-namespace patching is not used —
// ESM namespaces are frozen under the current toolchain.)
const FIXTURE = {
  daily_checkins: [{ id: 1, date: "2026-09-19", completed: 1, has_bowel_movement: 1, recorded_at: null, created_at: "x", updated_at: "x" }],
  bowel_records: [{ id: 1, daily_checkin_id: 1, occurred_at: null, time_type: "exact", approximate_time_label: null, bristol_type: 4, amount: "medium", difficulty: "normal", pain_level: null, color: null, notes: "safety test", created_at: "x", updated_at: "x" }],
  tags: [],
  bowel_record_tags: [],
  sleep_records: [],
  water_records: [],
  menstrual_records: [],
};
__setTestDatabase({
  execute: async () => 0,
  select: async (sql, params = []) => {
    if (/FROM daily_checkins ORDER BY date/i.test(sql)) return FIXTURE.daily_checkins;
    if (/FROM bowel_records WHERE daily_checkin_id/i.test(sql)) return FIXTURE.bowel_records.filter((r) => r.daily_checkin_id === params[0]);
    if (/FROM tags t\s+INNER JOIN bowel_record_tags/i.test(sql)) return [];
    if (/FROM tags ORDER/i.test(sql) || /FROM tags$/i.test(sql.trim())) return FIXTURE.tags;
    if (/FROM sleep_records WHERE/i.test(sql)) return FIXTURE.sleep_records.filter((r) => r.daily_checkin_id === params[0]);
    if (/FROM water_records WHERE/i.test(sql)) return FIXTURE.water_records.filter((r) => r.daily_checkin_id === params[0]);
    if (/FROM menstrual_records WHERE/i.test(sql)) return FIXTURE.menstrual_records.filter((r) => r.daily_checkin_id === params[0]);
    return [];
  },
  close: async () => {},
});

const DIR = await getSafetyDirPath();
const PASSWORD = "safety-test-password-1";
async function resetDir() {
  await fs.rm(DIR, { recursive: true, force: true });
  await fs.mkdir(DIR, { recursive: true });
}
async function filesInDir() {
  return (await fs.readdir(DIR)).filter((f) => f.endsWith(".plog")).sort();
}
async function makeSafetyFile(name, { valid = true, mtime = null } = {}) {
  const fullPath = path.join(DIR, name);
  if (valid) {
    const payload = {
      schemaVersion: 3, appVersion: "0.1.0", exportedAt: "2026-09-19T00:00:00.000Z",
      counts: { daily_checkins: 0, bowel_records: 0, tags: 0, bowel_record_tags: 0, sleep_records: 0, water_records: 0, menstrual_records: 0 },
      data: { daily_checkins: [], bowel_records: [], tags: [], bowel_record_tags: [], sleep_records: [], water_records: [], menstrual_records: [], settings: {} },
    };
    const { encryptPayload } = await import("../src/core/backup/backupCrypto.ts");
    const { serializeBackupPayload } = await import("../src/core/backup/backupService.ts");
    const bf = await encryptPayload(serializeBackupPayload(payload), PASSWORD, {
      createdAt: new Date().toISOString(), appVersion: "0.1.0", schemaVersion: 3,
      encryption: { algorithm: "AES-256-GCM", kdf: "PBKDF2-SHA-256", kdfParams: { iterations: 250000 } },
    });
    await fs.writeFile(fullPath, JSON.stringify(bf, null, 2), "utf-8");
  } else {
    await fs.writeFile(fullPath, "garbage-not-json", "utf-8");
  }
  if (mtime !== null) await fs.utimes(fullPath, mtime, mtime);
  return fullPath;
}

console.log("=== A. parseSafetyFilenameTimestamp ===");
{
  const t = parseSafetyFilenameTimestamp("pooplog-safety-2026-09-02T13-38-52-380Z-ab12.plog");
  assert(t === Date.parse("2026-09-02T13:38:52.380Z"), "canonical filename parses to exact timestamp");
  assert(parseSafetyFilenameTimestamp("random.plog") === null, "unparseable name → null");
  assert(parseSafetyFilenameTimestamp("pooplog-safety-garbage.plog") === null, "garbage middle → null");
}

console.log("\n=== B. createSafetyBackup decrypt-verifies its output ===");
{
  await resetDir();
  const p = await createSafetyBackup(PASSWORD);
  const names = await filesInDir();
  assert(names.length === 1, "exactly one safety file created");
  const content = await fs.readFile(p, "utf-8");
  const parsed = JSON.parse(content);
  assert(!content.includes("safety test"), "file contains no plaintext health data");
  const decrypted = await decryptPayload(parsed, PASSWORD);
  const payload = JSON.parse(decrypted);
  assert(validateBackupPayload(payload).valid, "read-back decrypt yields a valid payload (round-trip verification)");
  assert(payload.data.bowel_records[0]?.notes === "safety test", "payload content matches source data");
}

console.log("\n=== C. cleanup: newest by mtime wins (clock rollback) ===");
{
  await resetDir();
  // Simulated clock rollback: a file WRITTEN LATER carries an OLDER filename
  // timestamp than a stale file written earlier.
  const staleNameTsNewer = "pooplog-safety-2026-09-10T10-00-00-000Z-aaaa.plog"; // name says newer
  const freshNameTsOlder = "pooplog-safety-2026-09-01T10-00-00-000Z-bbbb.plog"; // name says older
  const stale = await makeSafetyFile(staleNameTsNewer, { mtime: new Date("2026-09-05T00:00:00Z") }); // actually older
  const fresh = await makeSafetyFile(freshNameTsOlder, { mtime: new Date("2026-09-20T00:00:00Z") }); // actually newer

  const order = await listSafetyBackups();
  assert(order[0] === fresh, "listSafetyBackups newest-first by mtime despite misleading filenames");
  await cleanupSafetyBackups();
  const left = await filesInDir();
  assert(left.length === 1, "cleanup kept exactly one file");
  assert(left[0] === path.basename(fresh), "cleanup kept the ACTUALLY newest file (mtime), deleted the stale one");
}

console.log("\n=== D. cleanup: same filename timestamp, tie broken by mtime ===");
{
  await resetDir();
  const n1 = "pooplog-safety-2026-09-15T08-00-00-000Z-aaaa.plog";
  const n2 = "pooplog-safety-2026-09-15T08-00-00-000Z-zzzz.plog";
  const older = await makeSafetyFile(n1, { mtime: new Date("2026-09-15T07:00:00Z") });
  const newer = await makeSafetyFile(n2, { mtime: new Date("2026-09-15T09:00:00Z") });
  const order = await listSafetyBackups();
  assert(order[0] === newer && order[1] === older, "same name-ts: ordered by mtime (random suffix does not decide)");
  await cleanupSafetyBackups();
  const left = await filesInDir();
  assert(left.length === 1 && left[0] === path.basename(newer), "same name-ts: newer mtime kept");
  void older;
}

console.log("\n=== E. cleanup: invalid files are deleted, newest VALID kept ===");
{
  await resetDir();
  const garbageNewest = await makeSafetyFile("pooplog-safety-2026-09-18T00-00-00-000Z-junk.plog", { valid: false, mtime: new Date("2026-09-18T12:00:00Z") });
  const validOlder = await makeSafetyFile("pooplog-safety-2026-09-17T00-00-00-000Z-good.plog", { valid: true, mtime: new Date("2026-09-17T12:00:00Z") });
  await cleanupSafetyBackups();
  const left = await filesInDir();
  assert(left.length === 1 && left[0] === path.basename(validOlder), "newest VALID file kept even when a newer garbage file exists");
  void garbageNewest;
}

console.log("\n=== F. cleanup: keepPath always retained ===");
{
  await resetDir();
  const n1 = "pooplog-safety-2026-09-16T00-00-00-000Z-old.plog";
  const n2 = "pooplog-safety-2026-09-19T00-00-00-000Z-new.plog";
  const oldF = await makeSafetyFile(n1, { mtime: new Date("2026-09-16T00:00:00Z") });
  const newF = await makeSafetyFile(n2, { mtime: new Date("2026-09-19T00:00:00Z") });
  // Explicitly keep the OLDER file (what createSafetyBackup just wrote)
  await cleanupSafetyBackups(oldF);
  const left = await filesInDir();
  assert(left.length === 1 && left[0] === path.basename(oldF), "keepPath overrides recency (the just-verified file is never deleted)");
  void newF;
}

await closeDatabase().catch(() => {});
console.log(`\n=== Result: ${passed} passed, ${failed} failed ===`);
if (failed > 0) { console.error("FAILED"); process.exit(1); }
console.log("PASS");
