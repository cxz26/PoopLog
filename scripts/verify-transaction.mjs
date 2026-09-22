#!/usr/bin/env node
// Regression test: multi-statement repository operations are atomic single-script executes.
// Security review finding: withTransaction() is a no-op on the Tauri path, so
// createWithTags/setTags/remove ran as separate non-atomic statements.
// Fix: they now build ONE script executed via a single db.execute() call.
// Run with: npx tsx scripts/verify-transaction.mjs

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`✓ ${msg}`); }
  else { failed++; console.error(`✗ ${msg}`); }
}

import { __setTestDatabase, closeDatabase } from "../src/core/database/connection.ts";
import { sqlLit, executeScript } from "../src/core/database/sqlScript.ts";
import * as BowelRecordRepo from "../src/core/database/repositories/bowelRecord.repository.ts";

// ---------------------------------------------------------------------------
// In-memory fake DB that faithfully models the REAL SQLite behavior our fix
// relies on: a multi-statement script arrives as ONE execute() call and is
// applied all-or-nothing (any failing statement rolls the whole script back).
// ---------------------------------------------------------------------------
function splitScript(sql) {
  // quote-aware top-level split on ';'
  const parts = [];
  let cur = "", inStr = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'") {
      if (inStr && sql[i + 1] === "'") { cur += "''"; i++; continue; }
      inStr = !inStr;
      cur += c;
    } else if (c === ";" && !inStr) {
      if (cur.trim()) parts.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function parseValues(list) {
  // parse sqlLit output: NULL | number | 'string'
  const out = [];
  let i = 0;
  while (i < list.length) {
    const c = list[i];
    if (c === " ") { i++; continue; }
    if (c === ",") { i++; continue; }
    if (list.startsWith("NULL", i)) { out.push(null); i += 4; continue; }
    if (c === "'") {
      let j = i + 1, s = "";
      while (j < list.length) {
        if (list[j] === "'" && list[j + 1] === "'") { s += "'"; j += 2; continue; }
        if (list[j] === "'") break;
        s += list[j]; j++;
      }
      out.push(s); i = j + 1; continue;
    }
    const m = /^-?\d+(\.\d+)?/.exec(list.slice(i));
    if (m) { out.push(Number(m[0])); i += m[0].length; continue; }
    if (list.startsWith("last_insert_rowid()", i)) { out.push("__LASTROWID__"); i += 19; continue; }
    throw new Error(`unparseable literal at ${i}: ${list.slice(i, i + 20)}`);
  }
  return out;
}

class FakeDB {
  constructor() {
    this.tables = {
      daily_checkins: [], bowel_records: [], tags: [], bowel_record_tags: [],
      sleep_records: [], water_records: [], menstrual_records: [],
    };
    this.seq = { daily_checkins: 0, bowel_records: 0, tags: 0, sleep_records: 0, water_records: 0, menstrual_records: 0 };
    this.executeCalls = [];      // { sql, statementCount }
    this.lastRowId = 0;
    this.failOnStatement = null; // substring: any statement containing it throws
  }
  seedCheckin(date) {
    const id = ++this.seq.daily_checkins;
    this.tables.daily_checkins.push({ id, date, completed: 1, has_bowel_movement: 1, recorded_at: null, created_at: "x", updated_at: "x" });
    return id;
  }
  seedTag(cat, name) {
    const id = ++this.seq.tags;
    this.tables.tags.push({ id, category: cat, name, is_builtin: 1, created_at: "x", updated_at: "x" });
    return id;
  }
  async execute(script, _params = []) {
    const stmts = splitScript(script);
    this.executeCalls.push({ sql: script, statementCount: stmts.length });
    // Stage: apply to deep copies, commit only if every statement succeeds —
    // mirrors SQLite's implicit per-script transaction on one connection.
    const backup = JSON.parse(JSON.stringify(this.tables));
    const backupSeq = { ...this.seq };
    const backupLastRowId = this.lastRowId;
    try {
      for (const st of stmts) {
        if (this.failOnStatement && st.includes(this.failOnStatement)) throw new Error("INJECTED FAILURE");
        this.applyOne(st);
      }
      return 1;
    } catch (e) {
      this.tables = backup;
      this.seq = backupSeq;
      this.lastRowId = backupLastRowId;
      throw e;
    }
  }
  applyOne(st) {
    const noSemi = st.replace(/;$/, "");
    let m = /^INSERT (?:OR IGNORE )?INTO (\w+)\s*\(([^)]*)\)\s*VALUES\s*\((.*)\)$/is.exec(noSemi);
    if (m) {
      const table = m[1];
      const cols = m[2].split(",").map((c) => c.trim());
      let vals = parseValues(m[3]);
      vals = vals.map((v) => (v === "__LASTROWID__" ? this.lastRowId : v));
      const row = {};
      cols.forEach((c, i) => (row[c] = vals[i]));
      if (table !== "bowel_record_tags") {
        const id = ++this.seq[table];
        row.id = id;
        this.lastRowId = id;
      }
      this.tables[table].push(row);
      return;
    }
    // INSERT OR IGNORE INTO bowel_record_tags (bowel_record_id, tag_id)
    //   SELECT (SELECT id FROM bowel_records WHERE daily_checkin_id = N ORDER BY id DESC LIMIT 1), T
    m = /^INSERT (?:OR IGNORE )?INTO bowel_record_tags\s*\(bowel_record_id, tag_id\)\s*SELECT\s*\(SELECT id FROM bowel_records WHERE daily_checkin_id = (\d+) ORDER BY id DESC LIMIT 1\),\s*(\d+)$/is.exec(noSemi);
    if (m) {
      const dcId = Number(m[1]);
      const tagId = Number(m[2]);
      const rows = this.tables.bowel_records.filter((r) => r.daily_checkin_id === dcId);
      rows.sort((a, b) => b.id - a.id);
      if (!rows[0]) throw new Error("FakeDB: subquery matched no bowel_record");
      if (!this.tables.bowel_record_tags.some((j) => j.bowel_record_id === rows[0].id && j.tag_id === tagId)) {
        this.tables.bowel_record_tags.push({ bowel_record_id: rows[0].id, tag_id: tagId });
      }
      return;
    }
    m = /^DELETE FROM (\w+)(?:\s+WHERE\s+(.*))?$/is.exec(noSemi);
    if (m) {
      const table = m[1];
      const where = m[2];
      if (!where) { this.tables[table] = []; return; }
      const wm = /^(\w+)\s*=\s*(.+)$/.exec(where.trim());
      if (!wm) throw new Error(`unsupported WHERE: ${where}`);
      const col = wm[1];
      const val = parseValues(wm[2])[0];
      this.tables[table] = this.tables[table].filter((r) => r[col] !== val);
      return;
    }
    if (/^(PRAGMA|BEGIN|COMMIT|ROLLBACK)/i.test(noSemi)) return;
    throw new Error(`FakeDB: unsupported statement: ${noSemi.slice(0, 60)}`);
  }
  async select(sql, params = []) {
    if (/FROM bowel_records WHERE daily_checkin_id/i.test(sql)) {
      const rows = this.tables.bowel_records.filter((r) => r.daily_checkin_id === params[0]);
      rows.sort((a, b) => b.id - a.id);
      return rows.slice(0, 1);
    }
    if (/FROM bowel_records WHERE id/i.test(sql)) {
      return this.tables.bowel_records.filter((r) => r.id === params[0]);
    }
    if (/FROM tags t/i.test(sql)) {
      const ids = this.tables.bowel_record_tags.filter((j) => j.bowel_record_id === params[0]).map((j) => j.tag_id);
      return this.tables.tags.filter((t) => ids.includes(t.id));
    }
    if (/FROM tags WHERE id IN/i.test(sql)) {
      return this.tables.tags.filter((t) => params.includes(t.id));
    }
    if (/FROM tags WHERE id/i.test(sql)) {
      return this.tables.tags.filter((t) => t.id === params[0]);
    }
    if (/FROM daily_checkins WHERE date/i.test(sql)) {
      return this.tables.daily_checkins.filter((c) => c.date === params[0]);
    }
    return [];
  }
  async close() {}
}

// ---------------------------------------------------------------------------
console.log("=== A. sqlLit unit tests ===");
{
  assert(sqlLit(null) === "NULL", "sqlLit(null) → NULL");
  assert(sqlLit(undefined) === "NULL", "sqlLit(undefined) → NULL");
  assert(sqlLit(42) === "42" && sqlLit(-3.5) === "-3.5", "sqlLit numbers");
  assert(sqlLit("abc") === "'abc'", "sqlLit plain string");
  assert(sqlLit("it's") === "'it''s'", "sqlLit escapes single quotes");
  assert(sqlLit("semi;colon\n--comment") === "'semi;colon\n--comment'", "sqlLit keeps semicolons/newlines inside quotes");
  let threw = false;
  try { sqlLit("a\u0000b"); } catch { threw = true; }
  assert(threw, "sqlLit rejects NUL characters");
  threw = false;
  try { sqlLit(Infinity); } catch { threw = true; }
  assert(threw, "sqlLit rejects non-finite numbers");
  threw = false;
  try { sqlLit(true); } catch { threw = true; }
  assert(threw, "sqlLit rejects unsupported types");
}

console.log("\n=== B. executeScript formatting ===");
{
  const calls = [];
  const db = { execute: async (sql) => { calls.push(sql); return 1; }, select: async () => [], close: async () => {} };
  __setTestDatabase(db);
  await executeScript(["SELECT 1"]);
  assert(calls.length === 1 && calls[0] === "SELECT 1", "single statement passes through unchanged");
  await executeScript(["DELETE FROM tags;;", "", null, "DELETE FROM bowel_record_tags;"]);
  const joined = calls[1];
  assert(joined === "BEGIN IMMEDIATE;\nDELETE FROM tags;\nDELETE FROM bowel_record_tags;\nCOMMIT;", `multi-statement wrapped in explicit transaction: ${JSON.stringify(joined)}`);
  await executeScript(["BEGIN IMMEDIATE;", "DELETE FROM tags;", "COMMIT;"]);
  assert(calls[2] === "BEGIN IMMEDIATE;\nDELETE FROM tags;\nCOMMIT;", "caller-managed BEGIN/COMMIT is never nested");
  __setTestDatabase(null);
}

console.log("\n=== C0. tag pre-validation ===");
{
  const db0 = new FakeDB();
  __setTestDatabase(db0);
  const dcId0 = db0.seedCheckin("2026-09-20");
  db0.seedTag("symptom", "Bloating");
  let threw = false, msg = "";
  try {
    await BowelRecordRepo.createWithTags({ daily_checkin_id: dcId0, occurred_at: null, time_type: "exact", approximate_time_label: null, bristol_type: 4, amount: null, difficulty: null, pain_level: null, color: null, notes: null }, [999999]);
  } catch (e) { threw = true; msg = String(e.message ?? e); }
  assert(threw && /Unknown tag id/i.test(msg), `unknown tag id rejected before any SQL ("${msg}")`);
  assert(db0.executeCalls.length === 0, "zero SQL executed for pre-validation failure");
  assert(db0.tables.bowel_records.length === 0, "no record created");
  __setTestDatabase(null);
}

console.log("\n=== C. createWithTags atomicity ===");
{
  const db = new FakeDB();
  __setTestDatabase(db);
  const dcId = db.seedCheckin("2026-09-20");
  const t1 = db.seedTag("symptom", "Bloating");
  const t2 = db.seedTag("food", "Coffee");

  const created = await BowelRecordRepo.createWithTags(
    { daily_checkin_id: dcId, occurred_at: "2026-09-20T08:00:00.000Z", time_type: "exact", approximate_time_label: null, bristol_type: 4, amount: "medium", difficulty: "normal", pain_level: 2, color: null, notes: "it's a test; with 'quotes'" },
    [t1, t2],
  );
  assert(created && created.id > 0, "createWithTags returns created row");
  assert(db.tables.bowel_records.length === 1, "exactly one bowel record inserted");
  assert(db.tables.bowel_record_tags.length === 2, "both tags attached");
  const rels = db.tables.bowel_record_tags.map((r) => r.bowel_record_id);
  assert(rels.every((r) => r === created.id), "tag rows reference the new record id");
  assert(created.notes === "it's a test; with 'quotes'", "notes with quotes/semicolons round-trip through sqlLit");
  const insertScriptCalls = db.executeCalls.filter((c) => /INSERT INTO bowel_records/i.test(c.sql));
  assert(insertScriptCalls.length === 1 && insertScriptCalls[0].statementCount === 5, "createWithTags: BEGIN + INSERT + 2 tag INSERTs + COMMIT as ONE script call");
  assert(db.executeCalls.length === 1, `createWithTags performs exactly one db.execute (got ${db.executeCalls.length})`);

  // Failure mid-script → NOTHING persists (all-or-nothing)
  const db2 = new FakeDB();
  __setTestDatabase(db2);
  const dcId2 = db2.seedCheckin("2026-09-20");
  const tag = db2.seedTag("symptom", "Gas");
  db2.failOnStatement = "INSERT OR IGNORE INTO bowel_record_tags";
  let threw = false;
  try {
    await BowelRecordRepo.createWithTags({ daily_checkin_id: dcId2, occurred_at: null, time_type: "approximate", approximate_time_label: "Morning", bristol_type: 3, amount: null, difficulty: null, pain_level: null, color: null, notes: null }, [tag]);
  } catch { threw = true; }
  assert(threw, "tag-insert failure propagates");
  assert(db2.tables.bowel_records.length === 0, "NO partial bowel record after failed script (atomicity)");
  assert(db2.tables.bowel_record_tags.length === 0, "NO partial tag rows after failed script");
  __setTestDatabase(null);
}

console.log("\n=== D. setTags / remove atomicity ===");
{
  const db = new FakeDB();
  __setTestDatabase(db);
  const dcId = db.seedCheckin("2026-09-20");
  const rec = await BowelRecordRepo.createWithTags({ daily_checkin_id: dcId, occurred_at: null, time_type: "exact", approximate_time_label: null, bristol_type: 4, amount: "medium", difficulty: "normal", pain_level: null, color: null, notes: null }, []);
  const t1 = db.seedTag("food", "Milk");

  db.executeCalls.length = 0;
  await BowelRecordRepo.setTags(rec.id, [t1]);
  assert(db.executeCalls.length === 1 && db.executeCalls[0].statementCount === 4, "setTags: BEGIN + DELETE + INSERT + COMMIT in one script");
  assert(db.tables.bowel_record_tags.length === 1, "setTags applied");

  db.failOnStatement = "INSERT OR IGNORE INTO bowel_record_tags";
  db.executeCalls.length = 0;
  let threw = false;
  try { await BowelRecordRepo.setTags(rec.id, [t1]); } catch { threw = true; }
  assert(threw && db.tables.bowel_record_tags.length === 1, "failed setTags leaves existing tags untouched (atomic)");

  db.failOnStatement = null;
  db.executeCalls.length = 0;
  await BowelRecordRepo.remove(rec.id);
  assert(db.executeCalls.length === 1 && db.executeCalls[0].statementCount === 4, "remove: BEGIN + 2 DELETEs + COMMIT in one script");
  assert(db.tables.bowel_records.length === 0 && db.tables.bowel_record_tags.length === 0, "remove deleted record and tag rows");

  db.failOnStatement = "DELETE FROM bowel_records";
  const rec2 = await BowelRecordRepo.createWithTags({ daily_checkin_id: dcId, occurred_at: null, time_type: "exact", approximate_time_label: null, bristol_type: 2, amount: null, difficulty: null, pain_level: null, color: null, notes: null }, []);
  threw = false;
  try { await BowelRecordRepo.remove(rec2.id); } catch { threw = true; }
  assert(threw && db.tables.bowel_records.length === 1, "failed remove leaves record intact (atomic)");
  __setTestDatabase(null);
}

await closeDatabase().catch(() => {});
console.log(`\n=== Result: ${passed} passed, ${failed} failed ===`);
if (failed > 0) { console.error("FAILED"); process.exit(1); }
console.log("PASS");
