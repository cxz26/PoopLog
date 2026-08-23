/** Strict backup type definitions — no `any`. Outer file is header + ciphertext. */

export const BACKUP_MAGIC = "PLOG" as const;
export const BACKUP_FORMAT_VERSION = 1 as const;

export interface BackupKdfParams {
  iterations: number;
}

export interface BackupEncryption {
  algorithm: "AES-256-GCM";
  kdf: "PBKDF2-SHA-256";
  kdfParams: BackupKdfParams;
  salt: string; // base64 16B
  nonce: string; // base64 12B
}

export interface BackupHeaderWithoutPayload {
  magic: typeof BACKUP_MAGIC;
  formatVersion: typeof BACKUP_FORMAT_VERSION;
  createdAt: string; // ISO
  appVersion: string;
  schemaVersion: number;
  encryption: BackupEncryption;
}

export interface BackupHeader extends BackupHeaderWithoutPayload {
  // payload is base64 ciphertext+tag, not part of AAD
}

export interface BackupFile {
  magic: typeof BACKUP_MAGIC;
  formatVersion: typeof BACKUP_FORMAT_VERSION;
  createdAt: string;
  appVersion: string;
  schemaVersion: number;
  encryption: BackupEncryption;
  payload: string; // base64 AES-GCM ciphertext
}

export interface BackupPayload {
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  counts: {
    daily_checkins: number;
    bowel_records: number;
    tags: number;
    bowel_record_tags: number;
    sleep_records: number;
    water_records: number;
    menstrual_records: number;
  };
  data: {
    daily_checkins: Array<{
      date: string;
      completed: number;
      has_bowel_movement: number | null;
      recorded_at: string | null;
      created_at: string;
      updated_at: string;
    }>;
    bowel_records: Array<{
      daily_checkin_date: string;
      occurred_at: string | null;
      time_type: "exact" | "approximate";
      approximate_time_label: string | null;
      bristol_type: number | null;
      amount: string | null;
      difficulty: string | null;
      pain_level: number | null;
      color: string | null;
      notes: string | null;
      created_at: string;
      updated_at: string;
    }>;
    tags: Array<{
      category: "symptom" | "food" | "medication" | "exercise";
      name: string;
      is_builtin: number;
      created_at: string;
      updated_at: string;
    }>;
    bowel_record_tags: Array<{
      bowel_record_index: number;
      tag_index: number;
    }>;
    sleep_records: Array<{
      daily_checkin_date: string;
      total_minutes: number;
      quality: string | null;
      created_at: string;
      updated_at: string;
    }>;
    water_records: Array<{
      daily_checkin_date: string;
      total_ml: number;
      created_at: string;
      updated_at: string;
    }>;
    menstrual_records: Array<{
      daily_checkin_date: string;
      has_period: number | null;
      flow: string | null;
      pain_level: number | null;
      notes: string | null;
      created_at: string;
      updated_at: string;
    }>;
    settings?: {
      theme?: string;
      units?: { water?: string; sleep?: string };
    };
  };
}
