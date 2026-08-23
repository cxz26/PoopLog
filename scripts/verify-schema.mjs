#!/usr/bin/env node
/**
 * Phase 2 static schema verification — no DB required, no extra deps.
 * Parses src/core/database/migrations.ts and checks for required artefacts.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsPath = resolve(__dirname, "../src/core/database/migrations.ts");
const sql = readFileSync(migrationsPath, "utf8");

// helpers
function mustContain(substr, label) {
  if (!sql.includes(substr)) {
    console.error(`✗ missing: ${label} — expected substring "${substr}"`);
    process.exitCode = 1;
    return false;
  }
  console.log(`✓ ${label}`);
  return true;
}
function mustMatch(regex, label) {
  if (!regex.test(sql)) {
    console.error(`✗ missing: ${label} — regex ${regex}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`✓ ${label}`);
  return true;
}

console.log("=== Phase 4 Schema Static Verification (v1+v2+v3) ===");
console.log(`Source: ${migrationsPath}\n`);

let ok = true;
// tables
ok = mustContain("CREATE TABLE IF NOT EXISTS daily_checkins", "table daily_checkins") && ok;
ok = mustContain("CREATE TABLE IF NOT EXISTS bowel_records", "table bowel_records") && ok;
ok = mustContain("CREATE TABLE IF NOT EXISTS tags", "table tags") && ok;
ok = mustContain("CREATE TABLE IF NOT EXISTS bowel_record_tags", "table bowel_record_tags") && ok;
ok = mustContain("CREATE TABLE IF NOT EXISTS sleep_records", "table sleep_records") && ok;
ok = mustContain("CREATE TABLE IF NOT EXISTS water_records", "table water_records") && ok;
ok = mustContain("CREATE TABLE IF NOT EXISTS menstrual_records", "table menstrual_records") && ok;

// constraints / fields
ok = mustMatch(/daily_checkins[\s\S]*date TEXT NOT NULL UNIQUE/, "daily_checkins.date UNIQUE") && ok;
ok = mustMatch(/daily_checkins[\s\S]*completed INTEGER NOT NULL/, "daily_checkins.completed") && ok;
ok = mustMatch(/daily_checkins[\s\S]*has_bowel_movement/, "daily_checkins.has_bowel_movement") && ok;
ok = mustMatch(/bowel_records[\s\S]*daily_checkin_id INTEGER NOT NULL REFERENCES daily_checkins\(id\) ON DELETE CASCADE/, "bowel_records FK CASCADE") && ok;
ok = mustMatch(/bristol_type INTEGER CHECK \(bristol_type IS NULL OR bristol_type BETWEEN 1 AND 7\)/, "bristol 1-7") && ok;
ok = mustMatch(/pain_level INTEGER CHECK \(pain_level IS NULL OR pain_level BETWEEN 0 AND 10\)/, "pain_level 0-10") && ok;
ok = mustMatch(/time_type TEXT NOT NULL CHECK \(time_type IN \('exact', 'approximate'\)\)/, "time_type") && ok;
ok = mustMatch(/difficulty TEXT CHECK \(difficulty IS NULL OR difficulty IN \('very_easy','easy','normal','strained','very_strained'\)\)/, "difficulty very_easy…very_strained (v3)") && ok;
ok = mustContain("'Early Morning'", "approximate_time_label Early Morning") && ok;
ok = mustContain("'Late Night'", "approximate_time_label Late Night") && ok;
ok = mustMatch(/UNIQUE\(category, name\)/, "tags UNIQUE(category,name)") && ok;
ok = mustMatch(/category TEXT NOT NULL CHECK \(category IN \('symptom','food','medication','exercise'\)\)/, "tags category check") && ok;
ok = mustMatch(/PRIMARY KEY \(bowel_record_id, tag_id\)/, "bowel_record_tags PK") && ok;
ok = mustMatch(/sleep_records[\s\S]*total_minutes INTEGER NOT NULL CHECK \(total_minutes >= 0\)/, "sleep total_minutes") && ok;
ok = mustMatch(/quality TEXT CHECK \(quality IS NULL OR quality IN \('poor','average','good','excellent'\)\)/, "sleep quality") && ok;
ok = mustMatch(/water_records[\s\S]*total_ml INTEGER NOT NULL CHECK \(total_ml >= 0\)/, "water total_ml") && ok;
ok = mustMatch(/menstrual_records[\s\S]*has_period/, "menstrual has_period") && ok;

// indexes §11
ok = mustContain("idx_daily_checkins_date", "index daily_checkins.date") && ok;
ok = mustContain("idx_bowel_records_daily_checkin_id", "index bowel_records.daily_checkin_id") && ok;
ok = mustContain("idx_bowel_records_occurred_at", "index bowel_records.occurred_at") && ok;
ok = mustContain("idx_tags_category", "index tags.category") && ok;
ok = mustContain("idx_bowel_record_tags_record", "index bowel_record_tags.bowel_record_id") && ok;
ok = mustContain("idx_bowel_record_tags_tag", "index bowel_record_tags.tag_id") && ok;

// migrations
ok = mustMatch(/version:\s*1,\s*\n\s*name:\s*"001_init/, "migration v1 preserved") && ok;
ok = mustMatch(/version:\s*2,\s*\n\s*name:\s*"002_pooplog_core_schema"/, "migration v2") && ok;
ok = mustMatch(/version:\s*3,\s*\n\s*name:\s*"003_difficulty_very_easy_and_complete_tags"/, "migration v3 (difficulty + tags)") && ok;
ok = mustContain("very_easy", "difficulty very_easy (v3)") && ok;
ok = mustContain("'Blood'", "seed Blood (v3)") && ok;
ok = mustContain("'Milk'", "seed Milk (v3)") && ok;
ok = mustContain("'Gym'", "seed Gym (v3)") && ok;
ok = mustContain("INSERT OR IGNORE INTO tags", "seed builtin tags") && ok;

console.log("\n=== Result ===");
if (process.exitCode === 1) {
  console.error("FAILED — some checks missing");
} else {
  console.log("PASS — all schema artefacts present");
}
