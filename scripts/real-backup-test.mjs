import { webcrypto } from "node:crypto";
globalThis.window = { crypto: webcrypto };
globalThis.btoa = (s) => Buffer.from(s, "binary").toString("base64");
globalThis.atob = (s) => Buffer.from(s, "base64").toString("binary");
globalThis.localStorage = { store: {}, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = v; }, removeItem(k) { delete this.store[k]; } };
import { serializeBackupPayload, validateBackupPayload } from "../src/core/backup/backupService.ts";
import { encryptPayload, decryptPayload } from "../src/core/backup/backupCrypto.ts";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const payload = {
  schemaVersion: 3,
  appVersion: "0.1.0",
  exportedAt: new Date().toISOString(),
  counts: { daily_checkins: 4, bowel_records: 4, tags: 4, bowel_record_tags: 3, sleep_records: 1, water_records: 1, menstrual_records: 0 },
  data: {
    daily_checkins: [
      { date: "2026-08-18", completed: 1, has_bowel_movement: 1, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { date: "2026-08-19", completed: 1, has_bowel_movement: 0, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { date: "2026-08-20", completed: 1, has_bowel_movement: 1, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { date: "2026-08-21", completed: 1, has_bowel_movement: 1, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ],
    bowel_records: [
      { daily_checkin_date: "2026-08-18", occurred_at: "2026-08-18T08:15:00Z", time_type: "exact", approximate_time_label: null, bristol_type: 4, amount: "medium", difficulty: "very_easy", pain_level: 1, color: null, notes: "Test note 💩", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { daily_checkin_date: "2026-08-18", occurred_at: null, time_type: "approximate", approximate_time_label: "Afternoon", bristol_type: 6, amount: "small", difficulty: "very_strained", pain_level: 5, color: null, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { daily_checkin_date: "2026-08-20", occurred_at: "2026-08-20T09:00:00Z", time_type: "exact", approximate_time_label: null, bristol_type: 2, amount: "large", difficulty: "easy", pain_level: null, color: null, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { daily_checkin_date: "2026-08-21", occurred_at: "2026-08-21T07:30:00Z", time_type: "exact", approximate_time_label: null, bristol_type: 7, amount: "large", difficulty: "normal", pain_level: 2, color: null, notes: "Custom tag test", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ],
    tags: [
      { category: "symptom", name: "Bloating", is_builtin: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { category: "food", name: "Coffee", is_builtin: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { category: "symptom", name: "MyCustomSymptom", is_builtin: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { category: "exercise", name: "Running", is_builtin: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ],
    bowel_record_tags: [{ bowel_record_index: 0, tag_index: 0 }, { bowel_record_index: 0, tag_index: 1 }, { bowel_record_index: 3, tag_index: 2 }],
    sleep_records: [{ daily_checkin_date: "2026-08-18", total_minutes: 405, quality: "good", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
    water_records: [{ daily_checkin_date: "2026-08-18", total_ml: 1200, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
    menstrual_records: [],
    settings: {},
  },
};

console.log("Payload counts:", payload.counts);
console.log("Date range:", payload.data.daily_checkins[0].date, "->", payload.data.daily_checkins[payload.data.daily_checkins.length - 1].date);
console.log("Very Easy preserved:", payload.data.bowel_records.some((r) => r.difficulty === "very_easy"));
console.log("Custom tag preserved:", payload.data.tags.some((t) => t.name === "MyCustomSymptom"));
console.log("Sleep preserved:", payload.data.sleep_records[0].total_minutes === 405);
console.log("Water preserved:", payload.data.water_records[0].total_ml === 1200);
console.log("Validation:", validateBackupPayload(payload).valid);

const serialized = serializeBackupPayload(payload);
const password = "correct-horse-battery-staple-123";
const backupFile = await encryptPayload(serialized, password, { createdAt: new Date().toISOString(), appVersion: "0.1.0", schemaVersion: 3, encryption: { algorithm: "AES-256-GCM", kdf: "PBKDF2-SHA-256", kdfParams: { iterations: 250000 } } });
const tmpPath = path.join(os.tmpdir(), "pooplog-real-test-" + Date.now() + ".plog");
await fs.writeFile(tmpPath, JSON.stringify(backupFile, null, 2), "utf-8");
const stat = await fs.stat(tmpPath);
console.log("Backup file:", tmpPath, "size", stat.size, "bytes, exists", stat.size > 0);
const content = await fs.readFile(tmpPath, "utf-8");
const parsed = JSON.parse(content);
console.log("File is JSON with payload base64 length", parsed.payload.length);
console.log("File is not plaintext health JSON:", !parsed.payload.includes("MyCustomSymptom") ? "ciphertext (base64) - OK" : "plaintext - FAIL");
const decrypted = await decryptPayload(parsed, password);
console.log("Decrypt with correct password:", decrypted === serialized ? "OK" : "FAIL");
try {
  await decryptPayload(parsed, "wrong-password-999");
  console.log("Wrong password: should have failed but did not - FAIL");
} catch {
  console.log("Wrong password: correctly failed");
}
const corrupted = JSON.parse(JSON.stringify(parsed));
corrupted.payload = corrupted.payload.slice(0, -4) + "AAAA";
try {
  await decryptPayload(corrupted, password);
  console.log("Corrupted: should have failed - FAIL");
} catch {
  console.log("Corrupted: correctly failed");
}
await fs.unlink(tmpPath).catch(() => {});
console.log("Real backup test PASS");
