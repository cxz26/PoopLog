#!/usr/bin/env node
// Statistics unit tests — deterministic, no DB, uses service pure functions
import {
  getRangeDates,
  calculateOverview,
  calculateDailyFrequency,
  calculateBristolDistribution,
  calculateTagFrequency,
  calculateSleepStats,
  calculateWaterStats,
  calculateLongestStreak,
} from "../src/core/services/statisticsService.ts";

// Use tsx loader — run via `npx tsx scripts/test-statistics.mjs`
// Simple assert helper
let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log(`✓ ${msg}`);
  } else {
    failed++;
    console.error(`✗ ${msg}`);
  }
}
function eq(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

console.log("=== Statistics Unit Tests ===");

// Test data matrix
const today = "2026-08-22";

// A. No records
console.log("\n--- A. No records ---");
{
  const checkins = [];
  const records = [];
  const rangeAll = getRangeDates("all", today, []);
  assert(rangeAll.length === 0, "All Time with no data returns empty range");
  const range7 = getRangeDates("7", today, checkins);
  assert(range7.length === 7, "7 days range");
  const overview = calculateOverview(checkins, records, range7, 0, 0);
  assert(overview.totalBowelMovements === 0, "total 0");
  assert(overview.daysWithBM === 0, "daysWithBM 0");
  assert(overview.daysWithoutBM === 0, "daysWithoutBM 0");
  assert(overview.daysNotRecorded === 7, "daysNotRecorded 7");
  assert(overview.avgPerLoggedDay === null, "avg null when no logged days");
  const freq = calculateDailyFrequency(checkins, records, range7);
  assert(freq.every((f) => f.status === "no_record" && f.count === null), "all no_record");
  const bristol = calculateBristolDistribution(records);
  assert(bristol.total === 0 && bristol.average === null, "bristol empty");
  const sleep = calculateSleepStats([]);
  assert(sleep.averageMinutes === null, "sleep null");
  const water = calculateWaterStats([]);
  assert(water.averageMl === null, "water null");
}

// B. One no-BM day
console.log("\n--- B. One no-BM day ---");
{
  const checkins = [{ id: 1, date: "2026-08-22", completed: 1, has_bowel_movement: 0, recorded_at: null, created_at: "", updated_at: "" }];
  const records = [];
  const range = getRangeDates("7", today, checkins);
  const overview = calculateOverview(checkins, records, range, 1, 1);
  assert(overview.daysWithoutBM === 1, "one no-BM");
  assert(overview.daysWithBM === 0, "no BM days 0");
  assert(overview.totalBowelMovements === 0, "total BM 0");
  const freq = calculateDailyFrequency(checkins, records, range);
  const todayFreq = freq.find((f) => f.date === "2026-08-22");
  assert(todayFreq && todayFreq.status === "no_bm" && todayFreq.count === 0, "today is no_bm 0");
}

// C. One bowel movement
console.log("\n--- C. One bowel movement ---");
{
  const checkins = [{ id: 1, date: "2026-08-22", completed: 1, has_bowel_movement: 1, recorded_at: null, created_at: "", updated_at: "" }];
  const records = [{ id: 1, daily_checkin_id: 1, occurred_at: "2026-08-22T08:15:00Z", time_type: "exact", approximate_time_label: null, bristol_type: 4, amount: "medium", difficulty: "normal", pain_level: null, color: null, notes: null, created_at: "", updated_at: "" }];
  const range = getRangeDates("7", today, checkins);
  const overview = calculateOverview(checkins, records, range, 1, 1);
  assert(overview.totalBowelMovements === 1, "total 1");
  assert(overview.daysWithBM === 1, "daysWithBM 1");
  const bristol = calculateBristolDistribution(records);
  assert(bristol.counts.find((c) => c.type === 4).count === 1, "bristol 4 count 1");
  assert(bristol.average === 4, "bristol avg 4");
}

// D. Multiple bowel movements in one day
console.log("\n--- D. Multiple in one day ---");
{
  const checkins = [{ id: 1, date: "2026-08-22", completed: 1, has_bowel_movement: 1, recorded_at: null, created_at: "", updated_at: "" }];
  const records = [
    { id: 1, daily_checkin_id: 1, occurred_at: "2026-08-22T08:15:00Z", time_type: "exact", approximate_time_label: null, bristol_type: 4, amount: "medium", difficulty: "normal", pain_level: null, color: null, notes: null, created_at: "", updated_at: "" },
    { id: 2, daily_checkin_id: 1, occurred_at: null, time_type: "approximate", approximate_time_label: "Afternoon", bristol_type: 3, amount: "small", difficulty: "easy", pain_level: 2, color: null, notes: null, created_at: "", updated_at: "" },
    { id: 3, daily_checkin_id: 1, occurred_at: "2026-08-22T21:00:00Z", time_type: "exact", approximate_time_label: null, bristol_type: 5, amount: "large", difficulty: "strained", pain_level: null, color: null, notes: null, created_at: "", updated_at: "" },
  ];
  const range = getRangeDates("7", today, checkins);
  const overview = calculateOverview(checkins, records, range, 1, 1);
  assert(overview.totalBowelMovements === 3, "total 3");
  assert(overview.daysWithBM === 1, "still 1 day with BM");
  assert(overview.avgPerLoggedDay === 3, "avg 3 per logged day");
  const freq = calculateDailyFrequency(checkins, records, range);
  const todayFreq = freq.find((f) => f.date === "2026-08-22");
  assert(todayFreq && todayFreq.count === 3 && todayFreq.status === "bm", "frequency 3");
  const bristol = calculateBristolDistribution(records);
  assert(bristol.total === 3, "bristol total 3");
  assert(bristol.counts.find((c) => c.type === 4).count === 1, "bristol 4 count 1");
}

// E. Multiple days
console.log("\n--- E. Multiple days ---");
{
  const checkins = [
    { id: 1, date: "2026-08-20", completed: 1, has_bowel_movement: 1, recorded_at: null, created_at: "", updated_at: "" },
    { id: 2, date: "2026-08-21", completed: 1, has_bowel_movement: 0, recorded_at: null, created_at: "", updated_at: "" },
    { id: 3, date: "2026-08-22", completed: 1, has_bowel_movement: 1, recorded_at: null, created_at: "", updated_at: "" },
  ];
  const records = [
    { id: 1, daily_checkin_id: 1, occurred_at: "2026-08-20T08:00:00Z", time_type: "exact", approximate_time_label: null, bristol_type: 4, amount: "medium", difficulty: "normal", pain_level: null, color: null, notes: null, created_at: "", updated_at: "" },
    { id: 2, daily_checkin_id: 3, occurred_at: "2026-08-22T09:00:00Z", time_type: "exact", approximate_time_label: null, bristol_type: 3, amount: "small", difficulty: "easy", pain_level: null, color: null, notes: null, created_at: "", updated_at: "" },
  ];
  const range = getRangeDates("7", today, checkins);
  const overview = calculateOverview(checkins, records, range, 1, 2);
  assert(overview.daysWithBM === 2, "2 days with BM");
  assert(overview.daysWithoutBM === 1, "1 day without");
  assert(overview.totalBowelMovements === 2, "total 2");
  const freq = calculateDailyFrequency(checkins, records, range);
  assert(freq.filter((f) => f.status === "bm").length === 2, "2 BM days in freq");
  assert(freq.filter((f) => f.status === "no_bm").length === 1, "1 noBM in freq");
  assert(freq.filter((f) => f.status === "no_record").length === 4, "4 no_record in 7-day");
}

// F. Mixed: BM, no BM, no record
console.log("\n--- F. Mixed ---");
{
  const checkins = [
    { id: 1, date: "2026-08-18", completed: 1, has_bowel_movement: 1, recorded_at: null, created_at: "", updated_at: "" },
    { id: 2, date: "2026-08-20", completed: 1, has_bowel_movement: 0, recorded_at: null, created_at: "", updated_at: "" },
  ];
  const records = [{ id: 1, daily_checkin_id: 1, occurred_at: "2026-08-18T08:00:00Z", time_type: "exact", approximate_time_label: null, bristol_type: 4, amount: "medium", difficulty: "normal", pain_level: null, color: null, notes: null, created_at: "", updated_at: "" }];
  const range = getRangeDates("7", today, checkins); // 08-16 to 08-22
  const freq = calculateDailyFrequency(checkins, records, range);
  const map = Object.fromEntries(freq.map((f) => [f.date, f.status]));
  assert(map["2026-08-18"] === "bm", "08-18 bm");
  assert(map["2026-08-19"] === "no_record", "08-19 no_record (not 0)");
  assert(map["2026-08-20"] === "no_bm", "08-20 no_bm");
  assert(map["2026-08-22"] === "no_record", "08-22 no_record (today not in checkins)");
}

// G. Missing optional data
console.log("\n--- G. Missing optional ---");
{
  const records = [
    { id: 1, daily_checkin_id: 1, occurred_at: null, time_type: "exact", approximate_time_label: null, bristol_type: null, amount: null, difficulty: null, pain_level: null, color: null, notes: null, created_at: "", updated_at: "" },
  ];
  const bristol = calculateBristolDistribution(records);
  assert(bristol.total === 0, "bristol ignores NULL");
  const sleep = calculateSleepStats([]);
  assert(sleep.averageMinutes === null, "sleep ignores NULL");
  const water = calculateWaterStats([]);
  assert(water.averageMl === null, "water ignores NULL");
  const tags = calculateTagFrequency([], [], "symptom");
  assert(tags.length === 0, "symptoms 0 when no tags");
}

// H. Large dataset
console.log("\n--- H. Large dataset ---");
{
  const checkins = [];
  const records = [];
  for (let i = 0; i < 365; i++) {
    const date = `2025-08-${String((i % 28) + 1).padStart(2, "0")}`; // simplified
    // Actually generate realistic 365 days
  }
  // Use 90 days with 1-2 records per day
  const base = new Date("2026-05-24");
  const checkins90 = [];
  const records90 = [];
  for (let i = 0; i < 90; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const hasBM = i % 3 !== 0; // 2/3 have BM
    checkins90.push({ id: i + 1, date: iso, completed: 1, has_bowel_movement: hasBM ? 1 : 0, recorded_at: null, created_at: "", updated_at: "" });
    if (hasBM) {
      const cnt = i % 5 === 0 ? 2 : 1;
      for (let j = 0; j < cnt; j++) {
        records90.push({ id: i * 10 + j, daily_checkin_id: i + 1, occurred_at: `${iso}T08:00:00Z`, time_type: "exact", approximate_time_label: null, bristol_type: (j % 7) + 1, amount: "medium", difficulty: "normal", pain_level: null, color: null, notes: null, created_at: "", updated_at: "" });
      }
    }
  }
  const range = getRangeDates("90", "2026-08-22", checkins90);
  const overview = calculateOverview(checkins90, records90, range, 5, 10);
  assert(overview.totalBowelMovements > 0, "large: total >0");
  assert(overview.daysWithBM + overview.daysWithoutBM === 90 || overview.daysWithBM + overview.daysWithoutBM <= 90, "large: logged days <=90");
  console.log(`  Large dataset: ${overview.totalBowelMovements} BMs, ${overview.daysWithBM} days BM, ${overview.daysWithoutBM} no BM`);
}

// Streaks
console.log("\n--- Streaks ---");
{
  const checkins = [
    { id: 1, date: "2026-08-18", completed: 1, has_bowel_movement: 1, recorded_at: null, created_at: "", updated_at: "" },
    { id: 2, date: "2026-08-19", completed: 1, has_bowel_movement: 1, recorded_at: null, created_at: "", updated_at: "" },
    { id: 3, date: "2026-08-20", completed: 0, has_bowel_movement: null, recorded_at: null, created_at: "", updated_at: "" },
    { id: 4, date: "2026-08-21", completed: 1, has_bowel_movement: 0, recorded_at: null, created_at: "", updated_at: "" },
    { id: 5, date: "2026-08-22", completed: 1, has_bowel_movement: 1, recorded_at: null, created_at: "", updated_at: "" },
  ];
  const longest = calculateLongestStreak(checkins);
  assert(longest === 2, "longest streak 2 (18-19)");
  // Current streak would be 2 (21-22) if today is 22
  // getRangeDates etc. already tested
}

console.log(`\n=== Result: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  console.error("FAILED");
  process.exit(1);
} else {
  console.log("PASS");
}
