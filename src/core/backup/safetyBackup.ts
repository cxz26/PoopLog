// @ts-nocheck
/**
 * Safety Backup — encrypted with SAME Backup Password, NEW random salt/nonce, never plaintext.
 * Stored in Tauri AppData/safety/ as .plog, at most 1 most-recent kept.
 *
 * Post-write verification: the freshly written file is read back AND decrypted
 * with the same password; any failure is treated as safety-backup creation
 * failure (the bad file is deleted and the error propagates, so a restore
 * aborts before touching the database).
 *
 * Ordering: backups are ranked newest-first by file mtime first, then by the
 * timestamp embedded in the filename, then by name. Pure lexical filename
 * ordering is not trustworthy: a clock rollback stamps a fresh backup with an
 * old-looking name, and same-second backups differ only by a random suffix.
 */

import { encryptPayload, decryptPayload } from "./backupCrypto";
import { createBackupPayload, serializeBackupPayload } from "./backupService";
import type { BackupFile } from "./backupTypes";
import { isTauri } from "../utils/platform";

// Platform detection: Tauri vs Node (for tests)

async function getSafetyDir(): Promise<string> {
  if (isTauri()) {
    // Tauri AppData/safety
    const { appDataDir, join } = await import("@tauri-apps/api/path");
    const { exists, mkdir } = await import("@tauri-apps/plugin-fs");
    const base = await appDataDir();
    const dir = await join(base, "safety");
    if (!(await exists(dir))) await mkdir(dir, { recursive: true });
    return dir;
  } else {
    // Node fallback for tests: temp dir
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { existsSync, mkdirSync } = await import("node:fs");
    const dir = join(tmpdir(), "pooplog-safety");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
  }
}

async function writeSafetyFile(path: string, content: string): Promise<void> {
  if (isTauri()) {
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    await writeTextFile(path, content);
  } else {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(path, content, "utf-8");
  }
}

async function readSafetyFile(path: string): Promise<string> {
  if (isTauri()) {
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    return readTextFile(path);
  } else {
    const { readFile } = await import("node:fs/promises");
    return readFile(path, "utf-8");
  }
}

async function removeSafetyFile(path: string): Promise<void> {
  if (isTauri()) {
    const { remove } = await import("@tauri-apps/plugin-fs");
    await remove(path);
  } else {
    const { unlink } = await import("node:fs/promises");
    await unlink(path);
  }
}

async function statMtime(fullPath: string): Promise<number> {
  try {
    if (isTauri()) {
      const { stat } = await import("@tauri-apps/plugin-fs");
      const s = await stat(fullPath);
      return typeof s.mtime === "number" ? s.mtime : Date.parse(s.mtime ?? "") || 0;
    } else {
      const { stat } = await import("node:fs/promises");
      const s = await stat(fullPath);
      return s.mtimeMs;
    }
  } catch {
    return 0;
  }
}

/** Timestamp embedded in a safety filename, or null if unparseable. */
export function parseSafetyFilenameTimestamp(name: string): number | null {
  // pooplog-safety-2026-09-02T13-38-52-380Z-ab12.plog (colons/dot are dashes)
  const m = /^pooplog-safety-(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})-(\d{3})Z-[a-z0-9]+\.plog$/.exec(name);
  if (!m) return null;
  const iso = `${m[1]}:${m[2]}:${m[3]}.${m[4]}Z`;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

interface SafetyEntry {
  name: string;
  fullPath: string;
  mtime: number;
  nameTs: number; // 0 when the filename carries no parseable timestamp
}

/**
 * Safety .plog files, ordered NEWEST first.
 * Rank: mtime (actual write time per filesystem) → embedded filename
 * timestamp → name. Ties on every key keep a deterministic order.
 */
async function listSafetyEntriesNewestFirst(dir: string): Promise<SafetyEntry[]> {
  let names: string[];
  if (isTauri()) {
    const { readDir } = await import("@tauri-apps/plugin-fs");
    try {
      const entries = await readDir(dir);
      names = entries.filter((e) => e.name.endsWith(".plog")).map((e) => e.name);
    } catch {
      return [];
    }
  } else {
    const { readdir } = await import("node:fs/promises");
    try {
      names = (await readdir(dir)).filter((n) => n.endsWith(".plog"));
    } catch {
      return [];
    }
  }
  const { join } = isTauri() ? await import("@tauri-apps/api/path") : await import("node:path");
  const entries: SafetyEntry[] = [];
  for (const name of names) {
    const fullPath = await (join as unknown as (a: string, b: string) => Promise<string> | string)(dir, name);
    const nameTs = parseSafetyFilenameTimestamp(name);
    entries.push({ name, fullPath: fullPath as string, mtime: await statMtime(fullPath as string), nameTs: nameTs ?? 0 });
  }
  entries.sort((a, b) => {
    if (b.mtime !== a.mtime) return b.mtime - a.mtime;
    if (b.nameTs !== a.nameTs) return b.nameTs - a.nameTs;
    return b.name < a.name ? -1 : b.name > a.name ? 1 : 0;
  });
  return entries;
}

/** Structural validity (no password available here): non-empty, JSON, looks like a BackupFile. */
async function isStructurallyValidSafetyFile(fullPath: string): Promise<boolean> {
  try {
    const content = await readSafetyFile(fullPath);
    if (!content || content.length === 0) return false;
    const parsed = JSON.parse(content);
    return !!(parsed && typeof parsed === "object" && parsed.payload && parsed.encryption && parsed.magic);
  } catch {
    return false;
  }
}

export async function createSafetyBackup(password: string): Promise<string> {
  if (!password || password.length < 8) throw new Error("Backup password must be at least 8 characters");
  // 1. Read current data via repositories (in-memory, no plaintext file)
  const payload = await createBackupPayload();
  const serialized = serializeBackupPayload(payload);

  // 2. Encrypt with SAME password but NEW random salt/nonce (encryptPayload generates new)
  const backupFile: BackupFile = await encryptPayload(serialized, password, {
    createdAt: new Date().toISOString(),
    appVersion: payload.appVersion,
    schemaVersion: payload.schemaVersion,
    encryption: { algorithm: "AES-256-GCM", kdf: "PBKDF2-SHA-256", kdfParams: { iterations: 250000 } },
  });

  const fileContent = JSON.stringify(backupFile, null, 2);

  // 3. Write encrypted .plog to AppData/safety
  const dir = await getSafetyDir();
  const { join } = isTauri() ? await import("@tauri-apps/api/path") : await import("node:path");
  const filename = `pooplog-safety-${new Date().toISOString().replace(/[:.]/g, "-")}-${Math.random().toString(36).slice(2, 6)}.plog`;
  const fullPath = await join(dir, filename);

  await writeSafetyFile(fullPath, fileContent);

  // 4. Verify the write by reading back AND decrypting with the same password.
  // A safety backup that cannot be decrypted is useless as a recovery path —
  // treat any failure here as creation failure (delete the bad file, throw),
  // so callers abort before any destructive operation.
  try {
    const written = await readSafetyFile(fullPath);
    if (!written || written.length === 0) throw new Error("file empty");
    const reparsed = JSON.parse(written) as BackupFile;
    const decrypted = await decryptPayload(reparsed, password);
    if (decrypted !== serialized) throw new Error("round-trip mismatch");
  } catch {
    try {
      await removeSafetyFile(fullPath);
    } catch {}
    throw new Error("Safety backup verification failed: file could not be read back and decrypted");
  }

  // 5. Cleanup: keep at most 1 most-recent (always retain the file just written)
  await cleanupSafetyBackups(fullPath);

  return fullPath;
}

/** Newest-first full paths (see listSafetyEntriesNewestFirst for ordering). */
export async function listSafetyBackups(): Promise<string[]> {
  const dir = await getSafetyDir();
  const entries = await listSafetyEntriesNewestFirst(dir);
  return entries.map((e) => e.fullPath);
}

/**
 * Keep at most one safety backup: the newest structurally valid one.
 * `keepPath` (the file createSafetyBackup just wrote and decrypt-verified) is
 * always retained when provided.
 */
export async function cleanupSafetyBackups(keepPath?: string): Promise<void> {
  const dir = await getSafetyDir();
  const entries = await listSafetyEntriesNewestFirst(dir);
  if (entries.length <= 1) return;
  let keep: SafetyEntry | undefined = keepPath ? entries.find((e) => e.fullPath === keepPath) : undefined;
  if (!keep) {
    for (const e of entries) {
      if (await isStructurallyValidSafetyFile(e.fullPath)) {
        keep = e;
        break;
      }
    }
  }
  for (const e of entries) {
    if (keep && e.fullPath === keep.fullPath) continue;
    try {
      await removeSafetyFile(e.fullPath);
    } catch {}
  }
}

export async function readSafetyBackupFile(path: string): Promise<string> {
  return readSafetyFile(path);
}

export async function getSafetyDirPath(): Promise<string> {
  return getSafetyDir();
}
