/** Database entity types — strictly typed, no `any`. */

export type TimeType = "exact" | "approximate";
export type ApproximateTimeLabel =
  | "Early Morning"
  | "Morning"
  | "Late Morning"
  | "Afternoon"
  | "Evening"
  | "Night"
  | "Late Night";

export type TagCategory = "symptom" | "food" | "medication" | "exercise";
export type SleepQuality = "poor" | "average" | "good" | "excellent";
export type MenstrualFlow = "light" | "medium" | "heavy" | "spotting";
export type Amount = "small" | "medium" | "large";
export type Difficulty = "easy" | "normal" | "strained" | "very_strained";

// ---------------------------------------------------------------------------
// Daily Check-in
// ---------------------------------------------------------------------------
export interface DailyCheckin {
  id: number;
  date: string; // YYYY-MM-DD, unique
  completed: 0 | 1;
  has_bowel_movement: 0 | 1 | null;
  recorded_at: string | null; // ISO8601
  created_at: string;
  updated_at: string;
}

export type DailyCheckinInput = {
  date: string;
  completed?: 0 | 1;
  has_bowel_movement?: 0 | 1 | null;
  recorded_at?: string | null;
};

// ---------------------------------------------------------------------------
// Bowel Record
// ---------------------------------------------------------------------------
export interface BowelRecord {
  id: number;
  daily_checkin_id: number;
  occurred_at: string | null;
  time_type: TimeType;
  approximate_time_label: ApproximateTimeLabel | null;
  bristol_type: number | null; // 1-7
  amount: Amount | null;
  difficulty: Difficulty | null;
  pain_level: number | null; // 0-10
  color: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type BowelRecordInput = {
  daily_checkin_id: number;
  occurred_at?: string | null;
  time_type: TimeType;
  approximate_time_label?: ApproximateTimeLabel | null;
  bristol_type?: number | null;
  amount?: Amount | null;
  difficulty?: Difficulty | null;
  pain_level?: number | null;
  color?: string | null;
  notes?: string | null;
};

// ---------------------------------------------------------------------------
// Tag
// ---------------------------------------------------------------------------
export interface Tag {
  id: number;
  category: TagCategory;
  name: string;
  is_builtin: 0 | 1;
  created_at: string;
  updated_at: string;
}

export type TagInput = {
  category: TagCategory;
  name: string;
  is_builtin?: 0 | 1;
};

// ---------------------------------------------------------------------------
// Sleep / Water / Menstrual (per daily_checkin, optional)
// ---------------------------------------------------------------------------
export interface SleepRecord {
  id: number;
  daily_checkin_id: number;
  total_minutes: number; // >=0
  quality: SleepQuality | null;
  created_at: string;
  updated_at: string;
}

export interface WaterRecord {
  id: number;
  daily_checkin_id: number;
  total_ml: number; // >=0
  created_at: string;
  updated_at: string;
}

export interface MenstrualRecord {
  id: number;
  daily_checkin_id: number;
  has_period: 0 | 1 | null;
  flow: MenstrualFlow | null;
  pain_level: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
