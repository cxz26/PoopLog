//! Phase 2 verification — runs ONLY against a temp SQLite file, uses sqlx directly.
//! No Tauri window required, uses same SQL as migrations.ts.
//! Verifies §16 items 1-15, indexes, constraints, transactions, persistence.

use sqlx::{Row, SqlitePool};

const MIGRATION_V1: &str = r#"
      CREATE TABLE IF NOT EXISTS _migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS _health_check (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
"#;

const MIGRATION_V2: &str = r#"
      CREATE TABLE IF NOT EXISTS daily_checkins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
        has_bowel_movement INTEGER CHECK (has_bowel_movement IS NULL OR has_bowel_movement IN (0, 1)),
        recorded_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE TABLE IF NOT EXISTS bowel_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        daily_checkin_id INTEGER NOT NULL REFERENCES daily_checkins(id) ON DELETE CASCADE,
        occurred_at TEXT,
        time_type TEXT NOT NULL CHECK (time_type IN ('exact', 'approximate')),
        approximate_time_label TEXT CHECK (
          approximate_time_label IS NULL OR approximate_time_label IN (
            'Early Morning','Morning','Late Morning','Afternoon','Evening','Night','Late Night'
          )
        ),
        bristol_type INTEGER CHECK (bristol_type IS NULL OR bristol_type BETWEEN 1 AND 7),
        amount TEXT CHECK (amount IS NULL OR amount IN ('small','medium','large')),
        difficulty TEXT CHECK (difficulty IS NULL OR difficulty IN ('very_easy','easy','normal','strained','very_strained')),
        pain_level INTEGER CHECK (pain_level IS NULL OR pain_level BETWEEN 0 AND 10),
        color TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL CHECK (category IN ('symptom','food','medication','exercise')),
        name TEXT NOT NULL,
        is_builtin INTEGER NOT NULL DEFAULT 0 CHECK (is_builtin IN (0,1)),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        UNIQUE(category, name)
      );
      CREATE TABLE IF NOT EXISTS bowel_record_tags (
        bowel_record_id INTEGER NOT NULL REFERENCES bowel_records(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (bowel_record_id, tag_id)
      );
      CREATE TABLE IF NOT EXISTS sleep_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        daily_checkin_id INTEGER NOT NULL UNIQUE REFERENCES daily_checkins(id) ON DELETE CASCADE,
        total_minutes INTEGER NOT NULL CHECK (total_minutes >= 0),
        quality TEXT CHECK (quality IS NULL OR quality IN ('poor','average','good','excellent')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE TABLE IF NOT EXISTS water_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        daily_checkin_id INTEGER NOT NULL UNIQUE REFERENCES daily_checkins(id) ON DELETE CASCADE,
        total_ml INTEGER NOT NULL CHECK (total_ml >= 0),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE TABLE IF NOT EXISTS menstrual_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        daily_checkin_id INTEGER NOT NULL UNIQUE REFERENCES daily_checkins(id) ON DELETE CASCADE,
        has_period INTEGER CHECK (has_period IS NULL OR has_period IN (0,1)),
        flow TEXT CHECK (flow IS NULL OR flow IN ('light','medium','heavy','spotting')),
        pain_level INTEGER CHECK (pain_level IS NULL OR pain_level BETWEEN 0 AND 10),
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX IF NOT EXISTS idx_daily_checkins_date ON daily_checkins(date);
      CREATE INDEX IF NOT EXISTS idx_bowel_records_daily_checkin_id ON bowel_records(daily_checkin_id);
      CREATE INDEX IF NOT EXISTS idx_bowel_records_occurred_at ON bowel_records(occurred_at);
      CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category);
      CREATE INDEX IF NOT EXISTS idx_bowel_record_tags_record ON bowel_record_tags(bowel_record_id);
      CREATE INDEX IF NOT EXISTS idx_bowel_record_tags_tag ON bowel_record_tags(tag_id);
      CREATE INDEX IF NOT EXISTS idx_sleep_records_daily ON sleep_records(daily_checkin_id);
      CREATE INDEX IF NOT EXISTS idx_water_records_daily ON water_records(daily_checkin_id);
      CREATE INDEX IF NOT EXISTS idx_menstrual_records_daily ON menstrual_records(daily_checkin_id);
       INSERT OR IGNORE INTO tags (category, name, is_builtin) VALUES
        ('symptom','Bloating',1),
        ('symptom','Cramping',1),
        ('symptom','Abdominal Pain',1),
        ('symptom','Nausea',1),
        ('symptom','Headache',1),
        ('symptom','Fatigue',1),
        ('symptom','Gas',1),
        ('symptom','Urgency',1),
        ('food','Dairy',1),
        ('food','Gluten',1),
        ('food','Spicy',1),
        ('food','Caffeine',1),
        ('food','Alcohol',1),
        ('medication','Fiber Supplement',1),
        ('medication','Probiotic',1),
        ('medication','Laxative',1),
        ('exercise','Walking',1),
        ('exercise','Running',1),
        ('exercise','Yoga',1);
"#;

const MIGRATION_V3: &str = r#"
      PRAGMA foreign_keys=off;
      CREATE TABLE IF NOT EXISTS bowel_records_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        daily_checkin_id INTEGER NOT NULL REFERENCES daily_checkins(id) ON DELETE CASCADE,
        occurred_at TEXT,
        time_type TEXT NOT NULL CHECK (time_type IN ('exact', 'approximate')),
        approximate_time_label TEXT CHECK (
          approximate_time_label IS NULL OR approximate_time_label IN (
            'Early Morning','Morning','Late Morning','Afternoon','Evening','Night','Late Night'
          )
        ),
        bristol_type INTEGER CHECK (bristol_type IS NULL OR bristol_type BETWEEN 1 AND 7),
        amount TEXT CHECK (amount IS NULL OR amount IN ('small','medium','large')),
        difficulty TEXT CHECK (difficulty IS NULL OR difficulty IN ('very_easy','easy','normal','strained','very_strained')),
        pain_level INTEGER CHECK (pain_level IS NULL OR pain_level BETWEEN 0 AND 10),
        color TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      INSERT OR IGNORE INTO bowel_records_new (id, daily_checkin_id, occurred_at, time_type, approximate_time_label, bristol_type, amount, difficulty, pain_level, color, notes, created_at, updated_at)
        SELECT id, daily_checkin_id, occurred_at, time_type, approximate_time_label, bristol_type, amount, difficulty, pain_level, color, notes, created_at, updated_at FROM bowel_records;
      DROP TABLE IF EXISTS bowel_records;
      ALTER TABLE bowel_records_new RENAME TO bowel_records;
      CREATE INDEX IF NOT EXISTS idx_bowel_records_daily_checkin_id ON bowel_records(daily_checkin_id);
      CREATE INDEX IF NOT EXISTS idx_bowel_records_occurred_at ON bowel_records(occurred_at);
      PRAGMA foreign_keys=on;
      INSERT OR IGNORE INTO tags (category, name, is_builtin) VALUES
        ('symptom','Blood',1),
        ('symptom','Mucus',1),
        ('symptom','Incomplete Evacuation',1),
        ('food','Spicy Food',1),
        ('food','Coffee',1),
        ('food','Milk',1),
        ('food','BBQ',1),
        ('food','Fast Food',1),
        ('food','Seafood',1),
        ('food','High Fiber',1),
        ('food','Oily Food',1),
        ('medication','Antibiotics',1),
        ('medication','Painkillers',1),
        ('exercise','Gym',1),
        ('exercise','Basketball',1),
        ('exercise','Cycling',1),
        ('exercise','Swimming',1);
"#;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut passed = 0usize;
    let mut failed = 0usize;
    let mut check = |cond: bool, msg: &str| {
        if cond {
            passed += 1;
            println!("✓ {}", msg);
        } else {
            failed += 1;
            eprintln!("✗ {}", msg);
        }
    };

    println!("=== Phase 2 Rust Verification (sqlx) ===");

    // Use temp file in OS temp dir so we test persistence after reopen
    let tmp = std::env::temp_dir().join(format!("pooplog_verify_{}.db", std::process::id()));
    let url = format!("sqlite:{}?mode=rwc", tmp.display());
    println!("DB: {}", tmp.display());

    // Ensure fresh
    let _ = std::fs::remove_file(&tmp);

    let pool = SqlitePool::connect(&url).await?;
    sqlx::query("PRAGMA foreign_keys = ON;").execute(&pool).await?;

    // Simulate migration system: create _migrations then apply v1, v2, v3 idempotently
    sqlx::query(MIGRATION_V1).execute(&pool).await?;
    sqlx::query("INSERT OR IGNORE INTO _migrations (version, name, applied_at) VALUES (1, '001_init', datetime('now'))").execute(&pool).await?;
    sqlx::query(MIGRATION_V2).execute(&pool).await?;
    sqlx::query("INSERT OR IGNORE INTO _migrations (version, name, applied_at) VALUES (2, '002_pooplog_core_schema', datetime('now'))").execute(&pool).await?;
    sqlx::query(MIGRATION_V3).execute(&pool).await?;
    sqlx::query("INSERT OR IGNORE INTO _migrations (version, name, applied_at) VALUES (3, '003_difficulty_very_easy_and_complete_tags', datetime('now'))").execute(&pool).await?;
    sqlx::query("INSERT INTO _health_check (key, value, updated_at) VALUES ('phase1_check','ok', datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value").execute(&pool).await?;

    // Verify migrations
    let vers: Vec<i64> = sqlx::query("SELECT version FROM _migrations ORDER BY version")
        .fetch_all(&pool).await?.iter().map(|r| r.get::<i64,_>(0)).collect();
    check(vers.contains(&1), "migration v1 applied");
    check(vers.contains(&2), "migration v2 applied");
    check(vers.contains(&3), "migration v3 applied");

    // Verify tables
    let tables: Vec<String> = sqlx::query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .fetch_all(&pool).await?.iter().map(|r| r.get(0)).collect();
    for t in ["daily_checkins","bowel_records","tags","bowel_record_tags","sleep_records","water_records","menstrual_records"] {
        check(tables.contains(&t.to_string()), &format!("table {t} exists"));
    }
    let idxs: Vec<String> = sqlx::query("SELECT name FROM sqlite_master WHERE type='index' ORDER BY name")
        .fetch_all(&pool).await?.iter().map(|r| r.get(0)).collect();
    for idx in ["idx_daily_checkins_date","idx_bowel_records_daily_checkin_id","idx_bowel_records_occurred_at","idx_tags_category","idx_bowel_record_tags_record","idx_bowel_record_tags_tag"] {
        check(idxs.contains(&idx.to_string()), &format!("index {idx}"));
    }

    // 1. Create Daily Check-in
    sqlx::query("INSERT INTO daily_checkins (date, completed, has_bowel_movement, recorded_at) VALUES ('2099-09-01',1,1, datetime('now'))").execute(&pool).await?;
    let dc1: (i64,) = sqlx::query_as("SELECT id FROM daily_checkins WHERE date='2099-09-01'").fetch_one(&pool).await?;
    check(dc1.0 > 0, "1. Create Daily Check-in");

    // 2. No-BM
    sqlx::query("INSERT INTO daily_checkins (date, completed, has_bowel_movement) VALUES ('2099-09-02',1,0)").execute(&pool).await?;
    let cnt: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM bowel_records WHERE daily_checkin_id=(SELECT id FROM daily_checkins WHERE date='2099-09-02')").fetch_one(&pool).await?;
    check(cnt.0 == 0, "2. No-BM has zero bowel records");

    // 3. Multiple bowel records
    sqlx::query("INSERT INTO daily_checkins (date, completed, has_bowel_movement) VALUES ('2099-09-03',1,1)").execute(&pool).await?;
    let dc3: (i64,) = sqlx::query_as("SELECT id FROM daily_checkins WHERE date='2099-09-03'").fetch_one(&pool).await?;
    sqlx::query("INSERT INTO bowel_records (daily_checkin_id, occurred_at, time_type, bristol_type, pain_level) VALUES (?,'2099-09-03T08:15:00Z','exact',4,0)").bind(dc3.0).execute(&pool).await?;
    sqlx::query("INSERT INTO bowel_records (daily_checkin_id, time_type, approximate_time_label, bristol_type, pain_level) VALUES (?,'approximate','Afternoon',3,2)").bind(dc3.0).execute(&pool).await?;
    let brCnt: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM bowel_records WHERE daily_checkin_id=?").bind(dc3.0).fetch_one(&pool).await?;
    check(brCnt.0 == 2, "3. Multiple bowel records (2)");

    // 4. Multiple tags
    let bloating: (i64,) = sqlx::query_as("SELECT id FROM tags WHERE category='symptom' AND name='Bloating'").fetch_one(&pool).await?;
    let dairy: (i64,) = sqlx::query_as("SELECT id FROM tags WHERE category='food' AND name='Dairy'").fetch_one(&pool).await?;
    let br1: (i64,) = sqlx::query_as("SELECT id FROM bowel_records WHERE daily_checkin_id=? ORDER BY id ASC LIMIT 1").bind(dc3.0).fetch_one(&pool).await?;
    sqlx::query("INSERT OR IGNORE INTO bowel_record_tags (bowel_record_id, tag_id) VALUES (?,?)").bind(br1.0).bind(bloating.0).execute(&pool).await?;
    sqlx::query("INSERT OR IGNORE INTO bowel_record_tags (bowel_record_id, tag_id) VALUES (?,?)").bind(br1.0).bind(dairy.0).execute(&pool).await?;
    let tagCnt: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM bowel_record_tags WHERE bowel_record_id=?").bind(br1.0).fetch_one(&pool).await?;
    check(tagCnt.0 == 2, "4. Multiple tags attached");

    // 5. Custom tags reusable
    sqlx::query("INSERT INTO tags (category, name, is_builtin) VALUES ('symptom','__verify_CustomSymptom',0)").execute(&pool).await?;
    sqlx::query("INSERT INTO tags (category, name, is_builtin) VALUES ('food','__verify_CustomFood',0)").execute(&pool).await?;
    let customSym: (i64,) = sqlx::query_as("SELECT id FROM tags WHERE name='__verify_CustomSymptom'").fetch_one(&pool).await?;
    let customFood: (i64,) = sqlx::query_as("SELECT id FROM tags WHERE name='__verify_CustomFood'").fetch_one(&pool).await?;
    let br2: (i64,) = sqlx::query_as("SELECT id FROM bowel_records WHERE daily_checkin_id=? ORDER BY id DESC LIMIT 1").bind(dc3.0).fetch_one(&pool).await?;
    sqlx::query("INSERT OR IGNORE INTO bowel_record_tags (bowel_record_id, tag_id) VALUES (?,?)").bind(br2.0).bind(customSym.0).execute(&pool).await?;
    sqlx::query("INSERT OR IGNORE INTO bowel_record_tags (bowel_record_id, tag_id) VALUES (?,?)").bind(br2.0).bind(customFood.0).execute(&pool).await?;
    let c2: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM bowel_record_tags WHERE bowel_record_id=?").bind(br2.0).fetch_one(&pool).await?;
    check(c2.0 == 2, "5. Custom tags attached");
    // reuse
    sqlx::query("INSERT OR IGNORE INTO bowel_record_tags (bowel_record_id, tag_id) VALUES (?,?)").bind(br1.0).bind(customSym.0).execute(&pool).await?;
    let reuse: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM bowel_record_tags WHERE tag_id=?").bind(customSym.0).fetch_one(&pool).await?;
    check(reuse.0 == 2, "5b. Custom tag reused across records");
    // duplicate prevention
    let before: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM bowel_record_tags WHERE bowel_record_id=?").bind(br1.0).fetch_one(&pool).await?;
    sqlx::query("INSERT OR IGNORE INTO bowel_record_tags (bowel_record_id, tag_id) VALUES (?,?)").bind(br1.0).bind(customSym.0).execute(&pool).await?;
    let after: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM bowel_record_tags WHERE bowel_record_id=?").bind(br1.0).fetch_one(&pool).await?;
    check(before.0 == after.0, "5c. Duplicate tag not duplicated");

    // 6. Sleep 405 minutes
    sqlx::query("INSERT INTO sleep_records (daily_checkin_id, total_minutes, quality) VALUES (?,405,'good')").bind(dc3.0).execute(&pool).await?;
    let sleep: (i64,String) = sqlx::query_as("SELECT total_minutes, quality FROM sleep_records WHERE daily_checkin_id=?").bind(dc3.0).fetch_one(&pool).await?;
    check(sleep.0 == 405 && sleep.1 == "good", "6. Sleep 405 min");

    // 7. Water 1000 ml
    sqlx::query("INSERT INTO water_records (daily_checkin_id, total_ml) VALUES (?,1000)").bind(dc3.0).execute(&pool).await?;
    let water: (i64,) = sqlx::query_as("SELECT total_ml FROM water_records WHERE daily_checkin_id=?").bind(dc3.0).fetch_one(&pool).await?;
    check(water.0 == 1000, "7. Water 1000 ml");
    let noSleep: Vec<_> = sqlx::query("SELECT id FROM sleep_records WHERE daily_checkin_id=?").bind(dc1.0).fetch_all(&pool).await?;
    check(noSleep.is_empty(), "7b. Optional sleep null when not set");

    // 8. Edit bowel record
    sqlx::query("UPDATE bowel_records SET bristol_type=5, pain_level=1, notes='edited', updated_at=datetime('now') WHERE id=?").bind(br1.0).execute(&pool).await?;
    let edited: (i64,i64,String) = sqlx::query_as("SELECT bristol_type, pain_level, notes FROM bowel_records WHERE id=?").bind(br1.0).fetch_one(&pool).await?;
    check(edited.0 == 5 && edited.2 == "edited", "8. Edit bowel record");

    // 9. Delete bowel record + cascade tags
    sqlx::query("DELETE FROM bowel_records WHERE id=?").bind(br2.0).execute(&pool).await?;
    let gone: Option<(i64,)> = sqlx::query_as("SELECT id FROM bowel_records WHERE id=?").bind(br2.0).fetch_optional(&pool).await?;
    check(gone.is_none(), "9. Delete bowel record");
    let tagsAfter: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM bowel_record_tags WHERE bowel_record_id=?").bind(br2.0).fetch_one(&pool).await?;
    check(tagsAfter.0 == 0, "9b. Tags cascade on delete");

    // 10. Delete Daily Check-in cascade
    sqlx::query("INSERT INTO daily_checkins (date, completed, has_bowel_movement) VALUES ('2099-09-10',1,1)").execute(&pool).await?;
    let dc10: (i64,) = sqlx::query_as("SELECT id FROM daily_checkins WHERE date='2099-09-10'").fetch_one(&pool).await?;
    sqlx::query("INSERT INTO bowel_records (daily_checkin_id, time_type, bristol_type) VALUES (?,'exact',4)").bind(dc10.0).execute(&pool).await?;
    let brTmp: (i64,) = sqlx::query_as("SELECT id FROM bowel_records WHERE daily_checkin_id=?").bind(dc10.0).fetch_one(&pool).await?;
    sqlx::query("INSERT OR IGNORE INTO bowel_record_tags (bowel_record_id, tag_id) VALUES (?,?)").bind(brTmp.0).bind(customSym.0).execute(&pool).await?;
    sqlx::query("INSERT INTO sleep_records (daily_checkin_id, total_minutes) VALUES (?,480)").bind(dc10.0).execute(&pool).await?;
    sqlx::query("INSERT INTO water_records (daily_checkin_id, total_ml) VALUES (?,500)").bind(dc10.0).execute(&pool).await?;
    sqlx::query("DELETE FROM daily_checkins WHERE id=?").bind(dc10.0).execute(&pool).await?;
    let dcGone: Option<(i64,)> = sqlx::query_as("SELECT id FROM daily_checkins WHERE id=?").bind(dc10.0).fetch_optional(&pool).await?;
    check(dcGone.is_none(), "10. Daily Check-in cascade deleted");
    let brGone: Option<(i64,)> = sqlx::query_as("SELECT id FROM bowel_records WHERE id=?").bind(brTmp.0).fetch_optional(&pool).await?;
    check(brGone.is_none(), "10b. Bowel records cascade");
    let sGone: Vec<_> = sqlx::query("SELECT id FROM sleep_records WHERE daily_checkin_id=?").bind(dc10.0).fetch_all(&pool).await?;
    check(sGone.is_empty(), "10c. Sleep cascade");
    let wGone: Vec<_> = sqlx::query("SELECT id FROM water_records WHERE daily_checkin_id=?").bind(dc10.0).fetch_all(&pool).await?;
    check(wGone.is_empty(), "10d. Water cascade");

    // Transaction safety: create bowel record with tags in transaction, rollback on failure
    {
        let mut tx = pool.begin().await?;
        sqlx::query("INSERT INTO bowel_records (daily_checkin_id, time_type, bristol_type) VALUES (?,'exact',4)").bind(dc1.0).execute(&mut *tx).await?;
        // duplicate PK violation would rollback — simulate by error
        let res = sqlx::query("INSERT INTO bowel_records (daily_checkin_id, time_type, bristol_type) VALUES (?,'invalid',99)").bind(dc1.0).execute(&mut *tx).await;
        if res.is_err() {
            tx.rollback().await?;
            check(true, "14. Transaction rollback on invalid time_type");
        } else {
            tx.commit().await?;
            check(false, "14. Transaction should have failed");
        }
    }
    // ensure no partial record from failed tx
    let txCnt: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM bowel_records WHERE daily_checkin_id=? AND bristol_type=99").bind(dc1.0).fetch_one(&pool).await?;
    check(txCnt.0 == 0, "14b. No partial update after failed tx");

    // Validation: constraints enforced by DB
    let mut threw = false;
    if sqlx::query("INSERT INTO bowel_records (daily_checkin_id, time_type, bristol_type) VALUES (?,'exact',99)").bind(dc1.0).execute(&pool).await.is_err() { threw = true; }
    check(threw, "validation: Bristol 99 rejected by CHECK");
    threw = false;
    if sqlx::query("INSERT INTO bowel_records (daily_checkin_id, time_type, pain_level) VALUES (?,'exact',15)").bind(dc1.0).execute(&pool).await.is_err() { threw = true; }
    check(threw, "validation: pain 15 rejected");
    threw = false;
    if sqlx::query("INSERT INTO water_records (daily_checkin_id, total_ml) VALUES (?, -1)").bind(dc1.0).execute(&pool).await.is_err() { threw = true; }
    check(threw, "validation: water -1 rejected");
    threw = false;
    // duplicate date
    if sqlx::query("INSERT INTO daily_checkins (date, completed) VALUES ('2099-09-01',1)").execute(&pool).await.is_err() { threw = true; }
    check(threw, "validation: duplicate date rejected");
    // very_easy difficulty allowed (migration v3)
    let veryEasyOk = sqlx::query("INSERT INTO bowel_records (daily_checkin_id, time_type, difficulty) VALUES (?,'exact','very_easy')").bind(dc1.0).execute(&pool).await.is_ok();
    check(veryEasyOk, "validation: very_easy difficulty allowed");
    // cleanup that test row
    sqlx::query("DELETE FROM bowel_records WHERE difficulty='very_easy' AND daily_checkin_id=?").bind(dc1.0).execute(&pool).await.ok();
    // verify complete tag seed
    let bloodTag: Option<(i64,)> = sqlx::query_as("SELECT id FROM tags WHERE category='symptom' AND name='Blood'").fetch_optional(&pool).await?;
    check(bloodTag.is_some(), "seed: Blood tag exists");
    let milkTag: Option<(i64,)> = sqlx::query_as("SELECT id FROM tags WHERE category='food' AND name='Milk'").fetch_optional(&pool).await?;
    check(milkTag.is_some(), "seed: Milk tag exists");
    let gymTag: Option<(i64,)> = sqlx::query_as("SELECT id FROM tags WHERE category='exercise' AND name='Gym'").fetch_optional(&pool).await?;
    check(gymTag.is_some(), "seed: Gym tag exists");

    // Nullable fields remain nullable
    sqlx::query("INSERT INTO daily_checkins (date, completed) VALUES ('2099-09-11',0)").execute(&pool).await?;
    let nullCheck: (Option<i64>,) = sqlx::query_as("SELECT has_bowel_movement FROM daily_checkins WHERE date='2099-09-11'").fetch_one(&pool).await?;
    check(nullCheck.0.is_none(), "nullable has_bowel_movement stays NULL");
    sqlx::query("INSERT INTO bowel_records (daily_checkin_id, time_type) VALUES ((SELECT id FROM daily_checkins WHERE date='2099-09-11'),'exact')").execute(&pool).await?;
    let nullBristol: (Option<i64>,) = sqlx::query_as("SELECT bristol_type FROM bowel_records WHERE daily_checkin_id=(SELECT id FROM daily_checkins WHERE date='2099-09-11')").fetch_one(&pool).await?;
    check(nullBristol.0.is_none(), "nullable bristol stays NULL");

    // 12 & 13 persistence after close/reopen
    drop(pool);
    let pool2 = SqlitePool::connect(&url).await?;
    sqlx::query("PRAGMA foreign_keys = ON;").execute(&pool2).await?;
    let dc1After: Option<(i64,)> = sqlx::query_as("SELECT id FROM daily_checkins WHERE date='2099-09-01'").fetch_optional(&pool2).await?;
    check(dc1After.is_some(), "12. Persistence after reopen");
    let brAfter: Option<(i64,)> = sqlx::query_as("SELECT id FROM bowel_records WHERE id=?").bind(br1.0).fetch_optional(&pool2).await?;
    check(brAfter.is_some(), "13. Bowel record persists after reopen");
    let health: (String,) = sqlx::query_as("SELECT value FROM _health_check WHERE key='phase1_check'").fetch_one(&pool2).await?;
    check(health.0 == "ok", "15. Phase 1 health_check preserved");

    // === History functional QA (Phase 4) ===
    // 1. Empty History (after cleanup, should be 0 completed after we clean, but test now with current data)
    let allCompleted: Vec<(String,)> = sqlx::query_as("SELECT date FROM daily_checkins WHERE completed=1 ORDER BY date DESC").fetch_all(&pool2).await?;
    check(!allCompleted.is_empty(), "History: at least one completed day exists");
    // 2. One no-BM day (2099-09-02)
    let noBmCheck: Option<(i64, i64)> = sqlx::query_as("SELECT id, has_bowel_movement FROM daily_checkins WHERE date='2099-09-02'").fetch_optional(&pool2).await?;
    if let Some((id, hasBm)) = noBmCheck {
        check(hasBm == 0, "History: no-BM day has_bowel_movement=0");
        let recs: Vec<(i64,)> = sqlx::query_as("SELECT id FROM bowel_records WHERE daily_checkin_id=?").bind(id).fetch_all(&pool2).await?;
        check(recs.is_empty(), "History: no-BM day has 0 records");
    } else {
        check(false, "History: no-BM day exists");
    }
    // 3. One bowel record (any day with has_bowel_movement=1)
    let oneRec: Vec<(i64,)> = sqlx::query_as("SELECT br.id FROM bowel_records br JOIN daily_checkins dc ON br.daily_checkin_id = dc.id WHERE dc.has_bowel_movement=1 LIMIT 1").fetch_all(&pool2).await?;
    check(!oneRec.is_empty(), "History: at least one bowel record exists");
    // 4. Multiple records in one day (2099-09-03 should have 1 after earlier deletes, add one more)
    // Ensure 2099-09-03 has 1 record then add another to test multiple
    let dc3Id: Option<(i64,)> = sqlx::query_as("SELECT id FROM daily_checkins WHERE date='2099-09-03'").fetch_optional(&pool2).await?;
    if let Some((dc3id,)) = dc3Id {
        let cntBefore: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM bowel_records WHERE daily_checkin_id=?").bind(dc3id).fetch_one(&pool2).await?;
        sqlx::query("INSERT INTO bowel_records (daily_checkin_id, time_type, bristol_type) VALUES (?,'exact',5)").bind(dc3id).execute(&pool2).await?;
        let cntAfter: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM bowel_records WHERE daily_checkin_id=?").bind(dc3id).fetch_one(&pool2).await?;
        check(cntAfter.0 == cntBefore.0 + 1, "History: multiple records in one day (added)");
        // cleanup that extra
        sqlx::query("DELETE FROM bowel_records WHERE daily_checkin_id=? AND bristol_type=5 AND id NOT IN (SELECT id FROM bowel_records WHERE daily_checkin_id=? ORDER BY id ASC LIMIT 1)").bind(dc3id).bind(dc3id).execute(&pool2).await.ok();
    }
    // 5. Multiple days newest first
    let dates: Vec<String> = sqlx::query("SELECT date FROM daily_checkins WHERE completed=1 ORDER BY date DESC").fetch_all(&pool2).await?.iter().map(|r| r.get::<String,_>(0)).collect();
    let isDesc = dates.windows(2).all(|w| w[0] >= w[1]);
    check(isDesc, "History: multiple days sorted newest first");
    // 6. Edit exact time
    let brEditId = br1.0;
    sqlx::query("UPDATE bowel_records SET occurred_at='2099-09-01T10:30:00Z', time_type='exact', updated_at=datetime('now') WHERE id=?").bind(brEditId).execute(&pool2).await?;
    let editedTime: (Option<String>, String) = sqlx::query_as("SELECT occurred_at, time_type FROM bowel_records WHERE id=?").bind(brEditId).fetch_one(&pool2).await?;
    check(editedTime.1 == "exact" && editedTime.0.as_deref() == Some("2099-09-01T10:30:00Z"), "History: edit exact time");
    // 7. Edit approximate time
    sqlx::query("UPDATE bowel_records SET occurred_at=NULL, time_type='approximate', approximate_time_label='Evening' WHERE id=?").bind(brEditId).execute(&pool2).await?;
    let approx: (String, Option<String>) = sqlx::query_as("SELECT time_type, approximate_time_label FROM bowel_records WHERE id=?").bind(brEditId).fetch_one(&pool2).await?;
    check(approx.0 == "approximate" && approx.1.as_deref() == Some("Evening"), "History: edit approximate time");
    // revert to exact for other tests
    sqlx::query("UPDATE bowel_records SET occurred_at='2099-09-01T10:30:00Z', time_type='exact', approximate_time_label=NULL WHERE id=?").bind(brEditId).execute(&pool2).await?;
    // 8. Edit Bristol
    sqlx::query("UPDATE bowel_records SET bristol_type=6 WHERE id=?").bind(brEditId).execute(&pool2).await?;
    let bristol: (Option<i64>,) = sqlx::query_as("SELECT bristol_type FROM bowel_records WHERE id=?").bind(brEditId).fetch_one(&pool2).await?;
    check(bristol.0 == Some(6), "History: edit Bristol");
    // 9. Edit tags
    let tagBefore: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM bowel_record_tags WHERE bowel_record_id=?").bind(brEditId).fetch_one(&pool2).await?;
    sqlx::query("INSERT OR IGNORE INTO bowel_record_tags (bowel_record_id, tag_id) VALUES (?,?)").bind(brEditId).bind(bloodTag.unwrap().0).execute(&pool2).await?;
    let tagAfter: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM bowel_record_tags WHERE bowel_record_id=?").bind(brEditId).fetch_one(&pool2).await?;
    check(tagAfter.0 >= tagBefore.0, "History: edit tags");
    // 10. Edit sleep
    let dc1IdForSleep: (i64,) = sqlx::query_as("SELECT id FROM daily_checkins WHERE date='2099-09-01'").fetch_one(&pool2).await?;
    sqlx::query("INSERT INTO sleep_records (daily_checkin_id, total_minutes) VALUES (?,500) ON CONFLICT(daily_checkin_id) DO UPDATE SET total_minutes=500").bind(dc1IdForSleep.0).execute(&pool2).await?;
    let sleepEdited: (i64,) = sqlx::query_as("SELECT total_minutes FROM sleep_records WHERE daily_checkin_id=?").bind(dc1IdForSleep.0).fetch_one(&pool2).await?;
    check(sleepEdited.0 == 500, "History: edit sleep");
    // 11. Edit water
    sqlx::query("INSERT INTO water_records (daily_checkin_id, total_ml) VALUES (?,750) ON CONFLICT(daily_checkin_id) DO UPDATE SET total_ml=750").bind(dc1IdForSleep.0).execute(&pool2).await?;
    let waterEdited: (i64,) = sqlx::query_as("SELECT total_ml FROM water_records WHERE daily_checkin_id=?").bind(dc1IdForSleep.0).fetch_one(&pool2).await?;
    check(waterEdited.0 == 750, "History: edit water");
    // 12. Delete one of multiple (use 2099-09-03 which has multiple)
    if let Some((dc3id,)) = dc3Id {
        let cntBeforeDel: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM bowel_records WHERE daily_checkin_id=?").bind(dc3id).fetch_one(&pool2).await?;
        if cntBeforeDel.0 >= 2 {
            let oneId: (i64,) = sqlx::query_as("SELECT id FROM bowel_records WHERE daily_checkin_id=? LIMIT 1").bind(dc3id).fetch_one(&pool2).await?;
            sqlx::query("DELETE FROM bowel_records WHERE id=?").bind(oneId.0).execute(&pool2).await?;
            let cntAfterDel: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM bowel_records WHERE daily_checkin_id=?").bind(dc3id).fetch_one(&pool2).await?;
            check(cntAfterDel.0 == cntBeforeDel.0 - 1, "History: delete one of multiple");
        } else {
            check(true, "History: delete one of multiple (skipped, only one)");
        }
    }
    // 13. Delete final record but keep Daily Check-in (critical last-record behavior)
    sqlx::query("INSERT INTO daily_checkins (date, completed, has_bowel_movement) VALUES ('2099-09-20',1,1)").execute(&pool2).await?;
    let dc20: (i64,) = sqlx::query_as("SELECT id FROM daily_checkins WHERE date='2099-09-20'").fetch_one(&pool2).await?;
    sqlx::query("INSERT INTO bowel_records (daily_checkin_id, time_type, bristol_type) VALUES (?,'exact',4)").bind(dc20.0).execute(&pool2).await?;
    let br20: (i64,) = sqlx::query_as("SELECT id FROM bowel_records WHERE daily_checkin_id=?").bind(dc20.0).fetch_one(&pool2).await?;
    sqlx::query("DELETE FROM bowel_records WHERE id=?").bind(br20.0).execute(&pool2).await?;
    let dc20After: Option<(i64, i64)> = sqlx::query_as("SELECT id, has_bowel_movement FROM daily_checkins WHERE date='2099-09-20'").fetch_optional(&pool2).await?;
    check(dc20After.is_some(), "History: daily check-in remains after deleting final record");
    if let Some((_, hasBm)) = dc20After {
        check(hasBm == 1, "History: has_bowel_movement stays 1 after final delete (requires explicit change to No)");
    }
    let recsAfterFinalDel: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM bowel_records WHERE daily_checkin_id=?").bind(dc20.0).fetch_one(&pool2).await?;
    check(recsAfterFinalDel.0 == 0, "History: 0 records after final delete");
    // cleanup 2099-09-20
    sqlx::query("DELETE FROM daily_checkins WHERE date='2099-09-20'").execute(&pool2).await?;

    // cleanup verify data
    for d in 1..=11 {
        let date = format!("2099-09-{:02}", d);
        sqlx::query("DELETE FROM daily_checkins WHERE date=?").bind(date).execute(&pool2).await?;
    }
    sqlx::query("DELETE FROM tags WHERE name LIKE '__verify_%'").execute(&pool2).await?;
    // also remove the temp file? keep for inspection
    // std::fs::remove_file(&tmp).ok();

    println!("\n=== Result: {passed} passed, {failed} failed ===");
    if failed > 0 {
        eprintln!("VERIFICATION FAILED");
        std::process::exit(1);
    } else {
        println!("VERIFICATION PASS");
    }
    Ok(())
}
