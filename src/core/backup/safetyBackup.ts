// @ts-nocheck
/**
 * Safety Backup — encrypted with SAME Backup Password, NEW random salt/nonce, never plaintext.
 * Stored in Tauri AppData/safety/ as .plog, at most 1 most-recent kept.
 */

import { encryptPayload } from "./backupCrypto";
import { createBackupPayload, serializeBackupPayload } from "./backupService";
import type { BackupFile } from "./backupTypes";

// Platform detection: Tauri vs Node (for tests)
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

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

async function listSafetyFiles(dir: string): Promise<string[]> {
  if (isTauri()) {
    const { readDir } = await import("@tauri-apps/plugin-fs");
    try {
      const entries = await readDir(dir);
      return entries.filter((e) => e.name.endsWith(".plog")).map((e) => e.name).sort();
    } catch {
      return [];
    }
  } else {
    const { readdir } = await import("node:fs/promises");
    try {
      const files = await readdir(dir);
      return files.filter((n) => n.endsWith(".plog")).sort();
    } catch {
      return [];
    }
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

  // 4. Verify exists and non-empty
  let written = "";
  try {
    written = await readSafetyFile(fullPath);
  } catch {}
  if (!written || written.length === 0) throw new Error("Safety backup verification failed: file empty");

  // 5. Cleanup: keep at most 1 most-recent
  await cleanupSafetyBackups();

  return fullPath;
}

export async function listSafetyBackups(): Promise<string[]> {
  const dir = await getSafetyDir();
  const files = await listSafetyFiles(dir);
  const { join } = isTauri() ? await import("@tauri-apps/api/path") : await import("node:path");
  const fullPaths: string[] = [];
  for (const f of files) {
    const p = await (join as unknown as (a: string, b: string) => Promise<string> | string)(dir, f);
    fullPaths.push(p as string);
  }
  return fullPaths;
}

export async function cleanupSafetyBackups(): Promise<void> {
  const dir = await getSafetyDir();
  const files = await listSafetyFiles(dir);
  if (files.length <= 1) return;
  // Keep newest (lexicographically last due to timestamp in name), delete older
  const { join } = isTauri() ? await import("@tauri-apps/api/path") : await import("node:path");
  const toDelete = files.slice(0, files.length - 1);
  for (const f of toDelete) {
    const fullPath = await join(dir, f);
    try {
      if (isTauri()) {
        const { remove } = await import("@tauri-apps/plugin-fs");
        await remove(fullPath);
      } else {
        const { unlink } = await import("node:fs/promises");
        await unlink(fullPath);
      }
    } catch {}
  }
  // Also delete older than 7 days (based on filename timestamp)
  // For MVP, keep only 1, so already done. Future: check mtime.
}

export async function readSafetyBackupFile(path: string): Promise<string> {
  return readSafetyFile(path);
}

export async function getSafetyDirPath(): Promise<string> {
  return getSafetyDir();
}
