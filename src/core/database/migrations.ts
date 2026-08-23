/**
 * Migration system — versioned schema changes.
 *
 * Each migration has a version (monotonically increasing) and an SQL
 * statement (or multiple statements) to apply.
 *
 * A special table `_migrations` tracks applied versions.
 */

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: "001_init_migrations_and_health_check",
    sql: `
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
    `,
  },
  {
    version: 2,
    name: "002_pooplog_core_schema",
    sql: `
      -- ============================================================
      -- Daily Check-ins
      -- ============================================================
      CREATE TABLE IF NOT EXISTS daily_checkins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
        has_bowel_movement INTEGER CHECK (has_bowel_movement IS NULL OR has_bowel_movement IN (0, 1)),
        recorded_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );

      -- ============================================================
      -- Bowel Records
      -- ============================================================
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
        difficulty TEXT CHECK (difficulty IS NULL OR difficulty IN ('easy','normal','strained','very_strained')),
        pain_level INTEGER CHECK (pain_level IS NULL OR pain_level BETWEEN 0 AND 10),
        color TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );

      -- ============================================================
      -- Tags (symptom, food, medication, exercise)
      -- ============================================================
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL CHECK (category IN ('symptom','food','medication','exercise')),
        name TEXT NOT NULL,
        is_builtin INTEGER NOT NULL DEFAULT 0 CHECK (is_builtin IN (0,1)),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        UNIQUE(category, name)
      );

      -- ============================================================
      -- Junction: bowel_record_tags
      -- ============================================================
      CREATE TABLE IF NOT EXISTS bowel_record_tags (
        bowel_record_id INTEGER NOT NULL REFERENCES bowel_records(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (bowel_record_id, tag_id)
      );

      -- ============================================================
      -- Sleep (per daily_checkin, optional, duration in minutes)
      -- ============================================================
      CREATE TABLE IF NOT EXISTS sleep_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        daily_checkin_id INTEGER NOT NULL UNIQUE REFERENCES daily_checkins(id) ON DELETE CASCADE,
        total_minutes INTEGER NOT NULL CHECK (total_minutes >= 0),
        quality TEXT CHECK (quality IS NULL OR quality IN ('poor','average','good','excellent')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );

      -- ============================================================
      -- Water (per daily_checkin, optional, ml)
      -- ============================================================
      CREATE TABLE IF NOT EXISTS water_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        daily_checkin_id INTEGER NOT NULL UNIQUE REFERENCES daily_checkins(id) ON DELETE CASCADE,
        total_ml INTEGER NOT NULL CHECK (total_ml >= 0),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );

      -- ============================================================
      -- Menstrual (per daily_checkin, optional, disabled by default)
      -- ============================================================
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

      -- ============================================================
      -- Indexes (spec §11)
      -- ============================================================
      CREATE INDEX IF NOT EXISTS idx_daily_checkins_date ON daily_checkins(date);
      CREATE INDEX IF NOT EXISTS idx_bowel_records_daily_checkin_id ON bowel_records(daily_checkin_id);
      CREATE INDEX IF NOT EXISTS idx_bowel_records_occurred_at ON bowel_records(occurred_at);
      CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category);
      CREATE INDEX IF NOT EXISTS idx_bowel_record_tags_record ON bowel_record_tags(bowel_record_id);
      CREATE INDEX IF NOT EXISTS idx_bowel_record_tags_tag ON bowel_record_tags(tag_id);
      CREATE INDEX IF NOT EXISTS idx_sleep_records_daily ON sleep_records(daily_checkin_id);
      CREATE INDEX IF NOT EXISTS idx_water_records_daily ON water_records(daily_checkin_id);
      CREATE INDEX IF NOT EXISTS idx_menstrual_records_daily ON menstrual_records(daily_checkin_id);

      -- ============================================================
      -- Seed built-in tags (idempotent via INSERT OR IGNORE)
      -- ============================================================
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
    `,
  },
  {
    version: 3,
    name: "003_difficulty_very_easy_and_complete_tags",
    sql: `
      -- Difficulty: allow very_easy (preserve existing 'easy' rows)
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

      -- Complete built-in tags (idempotent)
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
    `,
  },
];

/** Generate SQL to record a migration as applied. */
export function migrationInsertSql(m: Migration): string {
  return `INSERT INTO _migrations (version, name, applied_at) VALUES (${m.version}, '${m.name}', datetime('now'))`;
}
