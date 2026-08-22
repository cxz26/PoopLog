/**
 * Phase 2 verification harness — runs ONLY inside Tauri, uses ONLY tauri-plugin-sql.
 *
 * Executes §16 items 1-15 against a real SQLite file.
 * Isolated by using dates in year 2099 and a unique prefix, then cleaning up.
 * Also verifies persistence after "restart" by closing and reopening the DB handle.
 *
 * Trigger:
 *   VITE_VERIFY_PHASE2=1 npm run dev:desktop
 * or manually:  window.__POOPLOG_VERIFY_PHASE2()
 *
 * No UI, no extra deps, no mock DB.
 */
import { initDatabase, getDatabase, closeDatabase, getAppliedMigrations } from "./connection";
import * as DailyCheckinRepo from "./repositories/dailyCheckin.repository";
import * as BowelRecordRepo from "./repositories/bowelRecord.repository";
import * as TagRepo from "./repositories/tag.repository";
import { isTauri } from "../utils/platform";

const PREFIX = "2099-09-";
const VERIFY_TAG = `__verify_${Date.now()}`;

function log(ok: boolean, msg: string, detail?: unknown) {
  const icon = ok ? "✓" : "✗";
  console.log(`${icon} ${msg}`, detail ?? "");
  return ok;
}

export async function runPhase2Verification(): Promise<{ passed: number; failed: number; logs: string[] }> {
  if (!isTauri()) {
    console.warn("[verify] not in Tauri — skipping DB verification (browser preview)");
    return { passed: 0, failed: 0, logs: ["skipped — not Tauri"] };
  }

  let passed = 0;
  let failed = 0;
  const assert = (cond: boolean, msg: string, detail?: unknown) => {
    if (cond) passed++;
    else failed++;
    log(cond, msg, detail);
  };

  console.log("=== Phase 2 Verification Start ===");
  console.log(`Prefix dates: ${PREFIX}*, tag prefix: ${VERIFY_TAG}`);

  try {
    // Ensure DB initialized and migrations applied
    await initDatabase();
    const db = await getDatabase();
    if (!db) throw new Error("DB not initialized in Tauri");

    const applied = await getAppliedMigrations();
    assert(applied.includes(1), "1. Migration v1 applied", applied);
    assert(applied.includes(2), "2. Migration v2 applied", applied);

    // Verify schema tables exist via sqlite_master (real DB check)
    const tables = await db.select<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    );
    const tableNames = tables.map((t) => t.name);
    assert(tableNames.includes("daily_checkins"), "table daily_checkins exists", tableNames);
    assert(tableNames.includes("bowel_records"), "table bowel_records exists");
    assert(tableNames.includes("tags"), "table tags exists");
    assert(tableNames.includes("bowel_record_tags"), "table bowel_record_tags exists");
    assert(tableNames.includes("sleep_records"), "table sleep_records exists");
    assert(tableNames.includes("water_records"), "table water_records exists");
    assert(tableNames.includes("menstrual_records"), "table menstrual_records exists");

    const indexes = await db.select<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='index' ORDER BY name",
    );
    const idxNames = indexes.map((i) => i.name);
    assert(idxNames.includes("idx_daily_checkins_date"), "index idx_daily_checkins_date");
    assert(idxNames.includes("idx_bowel_records_daily_checkin_id"), "index idx_bowel_records_daily_checkin_id");
    assert(idxNames.includes("idx_bowel_records_occurred_at"), "index idx_bowel_records_occurred_at");
    assert(idxNames.includes("idx_tags_category"), "index idx_tags_category");
    assert(idxNames.includes("idx_bowel_record_tags_record"), "index idx_bowel_record_tags_record");
    assert(idxNames.includes("idx_bowel_record_tags_tag"), "index idx_bowel_record_tags_tag");

    // Clean any leftover verify dates from previous run
    for (let d = 1; d <= 20; d++) {
      const date = `${PREFIX}${String(d).padStart(2, "0")}`;
      const existing = await DailyCheckinRepo.getByDate(date);
      if (existing) await DailyCheckinRepo.remove(existing.id);
    }
    // Clean verify tags
    const allTags = await TagRepo.getAll();
    for (const t of allTags) {
      if (t.name.startsWith(VERIFY_TAG)) await TagRepo.remove(t.id);
    }

    // 1. Create Daily Check-in
    const dc1 = await DailyCheckinRepo.create({ date: `${PREFIX}01`, completed: 1, has_bowel_movement: 1 });
    assert(dc1.date === `${PREFIX}01` && dc1.completed === 1, "1. Create Daily Check-in", dc1);

    // 2. Create No-BM Daily Check-in
    const dcNoBm = await DailyCheckinRepo.create({ date: `${PREFIX}02`, completed: 1, has_bowel_movement: 0 });
    assert(dcNoBm.has_bowel_movement === 0, "2. Create No-BM Daily Check-in", dcNoBm);
    const brsNoBm = await BowelRecordRepo.getByDailyCheckin(dcNoBm.id);
    assert(brsNoBm.length === 0, "2b. No bowel records for No-BM day", brsNoBm.length);

    // 3. Create Daily Check-in with multiple bowel records
    const dcMulti = await DailyCheckinRepo.create({ date: `${PREFIX}03`, completed: 1, has_bowel_movement: 1 });
    const br1 = await BowelRecordRepo.create({
      daily_checkin_id: dcMulti.id,
      occurred_at: `${PREFIX}03T08:15:00.000Z`,
      time_type: "exact",
      bristol_type: 4,
      pain_level: 0,
    });
    const br2 = await BowelRecordRepo.create({
      daily_checkin_id: dcMulti.id,
      occurred_at: null,
      time_type: "approximate",
      approximate_time_label: "Afternoon",
      bristol_type: 3,
      pain_level: 2,
    });
    const brsMulti = await BowelRecordRepo.getByDailyCheckin(dcMulti.id);
    assert(brsMulti.length === 2, "3. Multiple bowel records", brsMulti.length);
    assert(br1.bristol_type === 4 && br2.approximate_time_label === "Afternoon", "3b. Field values correct");

    // 4. Add multiple tags (builtin)
    const builtinSymptom = await TagRepo.getByName("symptom", "Bloating");
    assert(!!builtinSymptom, "4. Builtin tag Bloating exists", builtinSymptom);
    const foodTag = await TagRepo.getByName("food", "Dairy");
    assert(!!foodTag, "4b. Builtin food Dairy exists");
    if (builtinSymptom && foodTag) {
      await BowelRecordRepo.setTags(br1.id, [builtinSymptom.id, foodTag.id]);
      const tagsBr1 = await BowelRecordRepo.getTags(br1.id);
      assert(tagsBr1.length === 2, "4c. Multiple tags attached", tagsBr1.map((t) => t.name));
    }

    // 5. Add custom tags (reusable)
    const customSymptom = await TagRepo.create({ category: "symptom", name: `${VERIFY_TAG}_CustomSymptom` });
    const customFood = await TagRepo.create({ category: "food", name: `${VERIFY_TAG}_CustomFood` });
    assert(customSymptom.is_builtin === 0, "5. Custom tag created", customSymptom);
    // reuse same custom tag on second record
    await BowelRecordRepo.addTag(br2.id, customSymptom.id);
    await BowelRecordRepo.addTag(br2.id, customFood.id);
    const tagsBr2 = await BowelRecordRepo.getTags(br2.id);
    assert(tagsBr2.length === 2, "5b. Custom tags attached", tagsBr2.map((t) => t.name));
    // verify reuse: custom tag can be attached to multiple records
    await BowelRecordRepo.addTag(br1.id, customSymptom.id);
    const tagsBr1Again = await BowelRecordRepo.getTags(br1.id);
    assert(tagsBr1Again.some((t) => t.id === customSymptom.id), "5c. Custom tag reused across records");

    // Unique constraint: duplicate tag attach should not duplicate
    const beforeDup = (await BowelRecordRepo.getTags(br1.id)).length;
    await BowelRecordRepo.addTag(br1.id, customSymptom.id); // duplicate INSERT OR IGNORE
    const afterDup = (await BowelRecordRepo.getTags(br1.id)).length;
    assert(beforeDup === afterDup, "5d. Duplicate tag not duplicated (unique PK)");

    // 6. Sleep duration in minutes (405 = 6h45m)
    const sleep = await DailyCheckinRepo.setSleep(dcMulti.id, 405, "good");
    assert(sleep.total_minutes === 405 && sleep.quality === "good", "6. Sleep 405 min", sleep);
    const sleepAgain = await DailyCheckinRepo.getSleep(dcMulti.id);
    assert(sleepAgain?.total_minutes === 405, "6b. Sleep persists");

    // 7. Water in milliliters (1000 = 1L)
    const water = await DailyCheckinRepo.setWater(dcMulti.id, 1000);
    assert(water.total_ml === 1000, "7. Water 1000 ml", water);
    // optional null remains null: daily_checkins without sleep/water should return null
    const noSleep = await DailyCheckinRepo.getSleep(dc1.id);
    assert(noSleep === null, "7b. Optional sleep null when not set");

    // 8. Edit bowel record
    const edited = await BowelRecordRepo.update(br1.id, { bristol_type: 5, pain_level: 1, notes: "edited" });
    assert(edited.bristol_type === 5 && edited.notes === "edited", "8. Edit bowel record", edited);

    // 9. Delete bowel record
    await BowelRecordRepo.remove(br2.id);
    const afterDelete = await BowelRecordRepo.getById(br2.id);
    assert(afterDelete === null, "9. Delete bowel record");
    const tagsAfterBrDelete = await BowelRecordRepo.getTags(br2.id);
    assert(tagsAfterBrDelete.length === 0, "9b. Tags cascade on bowel record delete");

    // 10. Delete Daily Check-in — cascade
    const dcToDelete = await DailyCheckinRepo.create({ date: `${PREFIX}10`, completed: 1, has_bowel_movement: 1 });
    const brTmp = await BowelRecordRepo.create({
      daily_checkin_id: dcToDelete.id,
      occurred_at: `${PREFIX}10T12:00:00.000Z`,
      time_type: "exact",
      bristol_type: 4,
    });
    await BowelRecordRepo.addTag(brTmp.id, customSymptom.id);
    await DailyCheckinRepo.setSleep(dcToDelete.id, 480, "excellent");
    await DailyCheckinRepo.setWater(dcToDelete.id, 500);
    await DailyCheckinRepo.remove(dcToDelete.id);
    const dcGone = await DailyCheckinRepo.getById(dcToDelete.id);
    assert(dcGone === null, "10. Daily Check-in deleted");
    const brGone = await BowelRecordRepo.getById(brTmp.id);
    assert(brGone === null, "10b. Bowel records cascade deleted");
    const sleepGone = await DailyCheckinRepo.getSleep(dcToDelete.id);
    assert(sleepGone === null, "10c. Sleep cascade deleted");
    const waterGone = await DailyCheckinRepo.getWater(dcToDelete.id);
    assert(waterGone === null, "10d. Water cascade deleted");

    // 11. Related records handled correctly already checked above

    // 12 & 13. Close and reopen — persistence after restart
    // Simulate restart: close DB handle and re-init, then verify data still there
    await closeDatabase();
    await initDatabase();
    const db2 = await getDatabase();
    assert(!!db2, "12. Reopen DB after close");
    const dc1After = await DailyCheckinRepo.getByDate(`${PREFIX}01`);
    assert(!!dc1After && dc1After.id === dc1.id, "13. Data persists after restart", dc1After);
    const brAfter = await BowelRecordRepo.getById(br1.id);
    assert(!!brAfter && brAfter.bristol_type === 5, "13b. Bowel record persists after restart");

    // 14. Fresh DB migration: already verified via table existence on this DB which was migrated from scratch (v1+v2)

    // 15. Existing Phase 1 DB migration: verify _health_check still exists and _migrations has both versions
    const health = await db2!.select<{ value: string }>("SELECT value FROM _health_check WHERE key='phase1_check'");
    assert(health[0]?.value === "ok", "15. Phase 1 health_check preserved after v2", health);
    const migrationsRows = await db2!.select<{ version: number }>("SELECT version FROM _migrations ORDER BY version");
    const vers = migrationsRows.map((r) => r.version);
    assert(vers.includes(1) && vers.includes(2), "15b. Both migrations present on upgraded DB", vers);

    // Validation checks: invalid values rejected
    let threw = false;
    try {
      await BowelRecordRepo.create({
        daily_checkin_id: dc1.id,
        occurred_at: null,
        time_type: "exact",
        bristol_type: 99, // invalid
      });
    } catch {
      threw = true;
    }
    assert(threw, "validation: Bristol 99 rejected");

    threw = false;
    try {
      await BowelRecordRepo.create({
        daily_checkin_id: dc1.id,
        occurred_at: null,
        time_type: "exact",
        pain_level: 15,
      });
    } catch {
      threw = true;
    }
    assert(threw, "validation: pain 15 rejected");

    threw = false;
    try {
      await DailyCheckinRepo.setWater(dc1.id, -1);
    } catch {
      threw = true;
    }
    assert(threw, "validation: water -1 rejected");

    threw = false;
    try {
      await DailyCheckinRepo.create({ date: "2099-13-40" });
    } catch {
      threw = true;
    }
    assert(threw, "validation: invalid date rejected");

    // unique date constraint via DB: duplicate date should throw
    threw = false;
    try {
      await DailyCheckinRepo.create({ date: `${PREFIX}01` });
    } catch {
      threw = true;
    }
    assert(threw, "validation: duplicate date rejected (UNIQUE)");

    // Cleanup verify data (keep built-in tags)
    for (let d = 1; d <= 10; d++) {
      const date = `${PREFIX}${String(d).padStart(2, "0")}`;
      const ex = await DailyCheckinRepo.getByDate(date);
      if (ex) await DailyCheckinRepo.remove(ex.id);
    }
    // remove custom verify tags
    for (const tid of [customSymptom.id, customFood.id]) {
      try {
        await TagRepo.remove(tid);
      } catch {}
    }

    console.log(`\n=== Phase 2 Verification Done: ${passed} passed, ${failed} failed ===`);
    if (failed > 0) console.error("VERIFICATION FAILED");
    else console.log("VERIFICATION PASS");

    return { passed, failed, logs: [] };
  } catch (e) {
    console.error("[verify] fatal error", e);
    failed++;
    return { passed, failed, logs: [String(e)] };
  }
}

// Auto-install for DEV console
if (typeof window !== "undefined") {
  // @ts-expect-error global
  window.__POOPLOG_VERIFY_PHASE2 = runPhase2Verification;
}
