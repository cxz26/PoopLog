#!/usr/bin/env node
// Regression test: schemaVersion 2 backups can be restored via in-memory
// payload upgrade (migratePayloadV2toV3). v1 and >v3 remain rejected.
// An alternative approach was to "run migrations during restore" — deliberately NOT
// done: migrations are SQL for the live database, never applied to backup JSON.
// Run with: npx tsx scripts/verify-schema-restore.mjs

import { webcrypto } from "node:crypto";
globalThis.window = { crypto: webcrypto };

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`✓ ${msg}`); }
  else { failed++; console.error(`✗ ${msg}`); }
}

import { migratePayloadV2toV3 } from "../src/core/backup/restoreService.ts";
import { validateBackupPayload, serializeBackupPayload } from "../src/core/backup/backupService.ts";
import { encryptPayload, decryptPayload } from "../src/core/backup/backupCrypto.ts";

function v2Payload() {
  // A realistic schema-v2 backup: v2 builtin tag set (19 tags), difficulty
  // values valid in v2 (a subset of v3), no v3-only tags.
  const tags = [
    ["symptom", "Bloating"], ["symptom", "Cramping"], ["symptom", "Fatigue"],
    ["food", "Dairy"], ["food", "Spicy"], ["medication", "Laxative"], ["exercise", "Walking"],
  ].map(([c, n]) => ({ category: c, name: n, is_builtin: 1, created_at: "2026-07-01T00:00:00.000Z", updated_at: "2026-07-01T00:00:00.000Z" }));
  return {
    schemaVersion: 2,
    appVersion: "0.1.0",
    exportedAt: "2026-07-15T10:00:00.000Z",
    counts: { daily_checkins: 2, bowel_records: 1, tags: tags.length, bowel_record_tags: 1, sleep_records: 0, water_records: 0, menstrual_records: 0 },
    data: {
      daily_checkins: [
        { date: "2026-07-14", completed: 1, has_bowel_movement: 1, recorded_at: null, created_at: "x", updated_at: "x" },
        { date: "2026-07-15", completed: 1, has_bowel_movement: 0, recorded_at: null, created_at: "x", updated_at: "x" },
      ],
      bowel_records: [
        { daily_checkin_date: "2026-07-14", occurred_at: "2026-07-14T08:00:00.000Z", time_type: "exact", approximate_time_label: null, bristol_type: 4, amount: "medium", difficulty: "strained", pain_level: null, color: null, notes: "v2 note", created_at: "x", updated_at: "x" },
      ],
      tags,
      bowel_record_tags: [{ bowel_record_index: 0, tag_index: 0 }],
      sleep_records: [], water_records: [], menstrual_records: [], settings: {},
    },
  };
}

console.log("=== A. v2 → v3 payload migration ===");
{
  const p = v2Payload();
  const before = validateBackupPayload(p);
  assert(before.valid, "v2 payload passes the shared validator as-is");

  const m = migratePayloadV2toV3(p);
  assert(m.schemaVersion === 3, "migrated schemaVersion is 3");
  assert(m.counts.tags === m.data.tags.length, "counts.tags matches migrated tag array length");
  const added = m.data.tags.length - p.data.tags.length;
  assert(added === 17, `17 v3 builtin seeds added (got ${added})`);
  const hasGym = m.data.tags.find((t) => t.name === "Gym" && t.category === "exercise");
  assert(!!hasGym && hasGym.is_builtin === 1, "v3 seed 'exercise:Gym' present as builtin");
  const blood = m.data.tags.find((t) => t.name === "Blood");
  assert(!!blood, "v3 seed 'symptom:Blood' present");
  // user data untouched
  assert(m.data.bowel_records.length === 1 && m.data.bowel_records[0].difficulty === "strained", "bowel records unchanged by migration");
  assert(m.data.daily_checkins.length === 2 && m.data.daily_checkins[1].has_bowel_movement === 0, "daily check-ins unchanged (no-BM day preserved)");
  assert(m.data.bowel_record_tags.length === 1, "tag relationships unchanged (indices still valid)");
  // migrated payload revalidates
  const after = validateBackupPayload(m);
  assert(after.valid, `migrated v3 payload passes validation${after.valid ? "" : ": " + JSON.stringify(after.errors.slice(0, 2))}`);
  // determinism / no mutation of input
  assert(p.schemaVersion === 2 && p.data.tags.length === 7, "original v2 payload object not mutated");
}

console.log("\n=== B. name collisions with v3 seeds ===");
{
  const p = v2Payload();
  // v2 user had a CUSTOM tag named Coffee (food) — must win over the builtin seed
  p.data.tags.push({ category: "food", name: "Coffee", is_builtin: 0, created_at: "2026-06-01T00:00:00.000Z", updated_at: "2026-06-01T00:00:00.000Z" });
  p.counts.tags = p.data.tags.length;
  const m = migratePayloadV2toV3(p);
  const coffees = m.data.tags.filter((t) => t.name === "Coffee");
  assert(coffees.length === 1, "exactly one Coffee tag after migration");
  assert(coffees[0].is_builtin === 0, "user's custom Coffee preserved (builtin seed skipped)");
  const valid = validateBackupPayload(m);
  assert(valid.valid, "collision case still validates (no duplicate tags)");
}

console.log("\n=== C. v2 backup encrypt→decrypt→migrate→validate round-trip ===");
{
  const p = v2Payload();
  const serialized = serializeBackupPayload(p);
  const bf = await encryptPayload(serialized, "test-password-12345", {
    createdAt: new Date().toISOString(), appVersion: "0.1.0", schemaVersion: 3,
    encryption: { algorithm: "AES-256-GCM", kdf: "PBKDF2-SHA-256", kdfParams: { iterations: 250000 } },
  });
  const decrypted = JSON.parse(await decryptPayload(bf, "test-password-12345"));
  const m = migratePayloadV2toV3(decrypted);
  assert(validateBackupPayload(m).valid, "full v2 restore pipeline (decrypt → migrate → validate) passes");
  assert(m.schemaVersion === 3, "final payload is v3");
}

console.log(`\n=== Result: ${passed} passed, ${failed} failed ===`);
if (failed > 0) { console.error("FAILED"); process.exit(1); }
console.log("PASS");
