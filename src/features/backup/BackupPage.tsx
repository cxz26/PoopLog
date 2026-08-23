import { useState } from "react";
import { BackupPasswordInput } from "./components/BackupPasswordInput";
import { BackupPreviewCard } from "./components/BackupPreviewCard";
import { Button } from "../../shared/components/Button";
import { Card } from "../../shared/components/Card";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import { createBackupPayload, validateBackupPayload, serializeBackupPayload, getBackupDateRange } from "../../core/backup/backupService";
import { encryptPayload, decryptPayload } from "../../core/backup/backupCrypto";
import { restoreBackupFile } from "../../core/backup/restoreService";
import type { BackupFile } from "../../core/backup/backupTypes";

export function BackupPage() {
  // Create backup state
  const [createPassword, setCreatePassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<{ location: string; size: string; count: number; range: string } | null>(null);
  const [creating, setCreating] = useState(false);

  // Restore state
  const [restoreFile, setRestoreFile] = useState<BackupFile | null>(null);
  const [restoreFileName, setRestoreFileName] = useState<string | null>(null);
  const [restorePassword, setRestorePassword] = useState("");
  const [restorePreview, setRestorePreview] = useState<null | { createdAt: string; appVersion: string; schemaVersion: number; counts: { daily_checkins: number; bowel_records: number; tags: number; customTags?: number }; dateRange: { earliest: string | null; latest: string | null } }>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreProgress, setRestoreProgress] = useState<string | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);

  const handleCreateBackup = async () => {
    setCreateError(null);
    setCreateSuccess(null);
    if (!createPassword || !confirmPassword) {
      setCreateError("Please enter and confirm your backup password.");
      return;
    }
    if (createPassword.length < 8) {
      setCreateError("Backup password must be at least 8 characters.");
      return;
    }
    if (createPassword !== confirmPassword) {
      setCreateError("Passwords do not match.");
      return;
    }
    setCreating(true);
    try {
      // 1. Create payload
      setRestoreProgress("Creating backup…");
      const payload = await createBackupPayload();
      const serialized = serializeBackupPayload(payload);
      // 2. Encrypt
      const backupFile = await encryptPayload(serialized, createPassword, {
        magic: "PLOG",
        formatVersion: 1,
        createdAt: new Date().toISOString(),
        appVersion: payload.appVersion,
        schemaVersion: payload.schemaVersion,
        encryption: { algorithm: "AES-256-GCM", kdf: "PBKDF2-SHA-256", kdfParams: { iterations: 250000 } },
      });
      const fileContent = JSON.stringify(backupFile, null, 2);
      const suggestedName = `pooplog-backup-${new Date().toISOString().slice(0, 10)}-${new Date().toISOString().slice(11, 16).replace(":", "")}.plog`;

      // 3. Save dialog
      let savePath: string | null = null;
      try {
        const { save } = await import("@tauri-apps/plugin-dialog");
        savePath = await save({
          filters: [{ name: "PoopLog Backup", extensions: ["plog"] }],
          defaultPath: suggestedName,
          title: "Save PoopLog Backup",
        });
      } catch (e) {
        // Fallback for browser (should not happen in Tauri, but for QA)
        const { writeTextFile } = await import("@tauri-apps/plugin-fs").catch(() => ({ writeTextFile: null as unknown as (p: string, c: string) => Promise<void> }));
        if (!writeTextFile) throw e;
      }

      if (!savePath) {
        // User cancelled
        setCreating(false);
        setRestoreProgress(null);
        return;
      }

      // 4. Write file
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      await writeTextFile(savePath, fileContent);

      // 5. Verify
      const { exists } = await import("@tauri-apps/plugin-fs");
      const existsCheck = await exists(savePath);
      if (!existsCheck) throw new Error("Backup file not found after save");
      const { readTextFile: readTextFileVerify } = await import("@tauri-apps/plugin-fs");
      const written = await readTextFileVerify(savePath);
      if (!written || written.length === 0) throw new Error("Backup file is empty");

      const range = getBackupDateRange(payload);
      setCreateSuccess({
        location: savePath,
        size: `${(fileContent.length / 1024).toFixed(1)} KB`,
        count: payload.counts.bowel_records,
        range: range.earliest && range.latest ? `${range.earliest} → ${range.latest}` : "No records",
      });
      // Clear passwords
      setCreatePassword("");
      setConfirmPassword("");
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
      setRestoreProgress(null);
    }
  };

  const handleSelectRestoreFile = async () => {
    setRestoreError(null);
    setRestorePreview(null);
    setRestoreFile(null);
    setRestoreFileName(null);
    setRestoreSuccess(null);
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        filters: [{ name: "PoopLog Backup", extensions: ["plog"] }],
        multiple: false,
        title: "Select PoopLog Backup",
      });
      if (!selected || typeof selected !== "string") return;
      setRestoreFileName(selected);
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const content = await readTextFile(selected as string);
      if (!content || content.trim().length === 0) throw new Error("Backup file is empty");
      let outer: BackupFile;
      try {
        outer = JSON.parse(content) as BackupFile;
      } catch {
        throw new Error("Backup file is malformed");
      }
      if (!outer.payload || !outer.encryption || !outer.magic) throw new Error("Invalid backup file");
      if (outer.magic !== "PLOG") throw new Error("Invalid backup file");
      if (outer.formatVersion !== 1) throw new Error("This backup format is not supported by this version of PoopLog.");
      setRestoreFile(outer);
    } catch (e) {
      setRestoreError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDecryptAndPreview = async () => {
    if (!restoreFile) return;
    setRestoreError(null);
    setRestorePreview(null);
    if (!restorePassword || restorePassword.length < 8) {
      setRestoreError("Please enter your backup password (at least 8 characters).");
      return;
    }
    setRestoring(true);
    setRestoreProgress("Decrypting backup…");
    try {
      const plaintext = await decryptPayload(restoreFile, restorePassword);
      setRestoreProgress("Validating backup…");
      const payload = JSON.parse(plaintext);
      const validation = validateBackupPayload(payload);
      if (!validation.valid) throw new Error(`Backup validation failed: ${validation.errors[0].message}`);
      if (payload.schemaVersion > 3) throw new Error("This backup was created by a newer version of PoopLog. Update PoopLog before restoring it.");
      if (payload.schemaVersion < 3) throw new Error("This backup format is not supported by this version of PoopLog.");
      const range = getBackupDateRange(payload);
      const customTags = payload.data.tags.filter((t: { is_builtin: number }) => t.is_builtin === 0).length;
      setRestorePreview({
        createdAt: payload.exportedAt,
        appVersion: payload.appVersion,
        schemaVersion: payload.schemaVersion,
        counts: { daily_checkins: payload.counts.daily_checkins, bowel_records: payload.counts.bowel_records, tags: payload.counts.tags, customTags },
        dateRange: range,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Wrong password") || msg.includes("corrupted")) {
        setRestoreError("Wrong password or corrupted backup.");
      } else if (msg.includes("newer version")) {
        setRestoreError(msg);
      } else if (msg.includes("not supported")) {
        setRestoreError(msg);
      } else {
        setRestoreError(`Backup validation failed: ${msg}`);
      }
    } finally {
      setRestoring(false);
      setRestoreProgress(null);
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreFile) return;
    setShowRestoreConfirm(false);
    setRestoring(true);
    setRestoreError(null);
    setRestoreProgress("Creating safety backup…");
    try {
      // The restore service will create safety backup, then atomic replace
      setRestoreProgress("Restoring data…");
      const result = await restoreBackupFile(restoreFile, restorePassword);
      if (!result.success) {
        if (result.code === "BACKUP_FORMAT_TOO_NEW" || result.code === "BACKUP_SCHEMA_TOO_NEW") {
          setRestoreError("This backup was created by a newer version of PoopLog. Update PoopLog before restoring it.");
        } else if (result.code === "BACKUP_SCHEMA_TOO_OLD") {
          setRestoreError("This backup format is not supported by this version of PoopLog.");
        } else if (result.code === "DECRYPT_FAILED") {
          setRestoreError("Wrong password or corrupted backup.");
        } else if (result.code === "SAFETY_BACKUP_FAILED") {
          setRestoreError("PoopLog could not create a safety backup. Your current data has not been changed.");
        } else {
          setRestoreError(result.error ?? "PoopLog could not restore this backup. Your existing data was not changed.");
        }
        return;
      }
      setRestoreProgress("Finishing…");
      setRestoreSuccess(`Restore complete. Restored ${restorePreview?.counts.bowel_records ?? 0} records, ${restorePreview?.counts.daily_checkins ?? 0} check-ins. ${restorePreview?.dateRange.earliest ? `Date range: ${restorePreview.dateRange.earliest} → ${restorePreview.dateRange.latest}` : ""}`);
      // Clear sensitive state
      setRestorePassword("");
      // Reload application state after a short delay to show success
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setRestoreError(e instanceof Error ? e.message : String(e));
    } finally {
      setRestoring(false);
      setRestoreProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">Backup & Restore</h2>
        <p className="mt-1 text-sm text-zinc-600">Your data stays on this computer. Backups are encrypted files that you control.</p>
        <p className="mt-1 text-xs text-zinc-500">PoopLog does not upload your health data to a server. Backups are encrypted with a password you choose.</p>
      </div>

      {/* Create Backup */}
      <Card>
        <h3 className="text-sm font-semibold text-zinc-900">Create Backup</h3>
        <p className="mt-1 text-sm text-zinc-600">Create an encrypted .plog file and save it where you choose (USB, OneDrive, etc.).</p>
        <div className="mt-4 space-y-3">
          <BackupPasswordInput value={createPassword} onChange={setCreatePassword} label="Backup Password" id="create-backup-password" showStrength />
          <BackupPasswordInput value={confirmPassword} onChange={setConfirmPassword} label="Confirm Password" id="confirm-backup-password" onSubmit={handleCreateBackup} />
          {createError && (
            <p role="alert" className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {createError}
            </p>
          )}
          {createSuccess && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
              <p className="text-sm font-semibold text-emerald-700">Backup created successfully.</p>
              <p className="mt-1 text-xs text-zinc-600">Location: {createSuccess.location}</p>
              <p className="text-xs text-zinc-600">Size: {createSuccess.size} · Records: {createSuccess.count} · Range: {createSuccess.range}</p>
            </div>
          )}
          <Button fullWidth size="lg" onClick={handleCreateBackup} disabled={creating} aria-label="Create Backup">
            {creating ? "Creating…" : "Create Backup"}
          </Button>
        </div>
      </Card>

      {/* Restore Backup */}
      <Card>
        <h3 className="text-sm font-semibold text-zinc-900">Restore Backup</h3>
        <p className="mt-1 text-sm text-zinc-600">Restore from an encrypted .plog file. This will replace the current PoopLog data on this computer.</p>
        <div className="mt-4 space-y-3">
          <Button variant="secondary" fullWidth onClick={handleSelectRestoreFile} disabled={restoring} aria-label="Select backup file">
            {restoreFileName ? `Selected: ${restoreFileName.split(/[/\\]/).pop()}` : "Select .plog file"}
          </Button>
          {restoreFile && (
            <>
              <BackupPasswordInput value={restorePassword} onChange={setRestorePassword} label="Backup Password" id="restore-backup-password" onSubmit={handleDecryptAndPreview} />
              <Button fullWidth variant="secondary" onClick={handleDecryptAndPreview} disabled={restoring} aria-label="Preview backup">
                {restoring && restoreProgress === "Decrypting backup…" ? "Decrypting…" : "Preview Backup"}
              </Button>
            </>
          )}
          {restorePreview && (
            <BackupPreviewCard
              preview={{
                createdAt: restorePreview.createdAt,
                appVersion: restorePreview.appVersion,
                schemaVersion: restorePreview.schemaVersion,
                counts: restorePreview.counts,
                dateRange: restorePreview.dateRange,
              }}
            />
          )}
          {restorePreview && (
            <Button fullWidth variant="danger" onClick={() => setShowRestoreConfirm(true)} disabled={restoring} aria-label="Restore backup">
              Restore
            </Button>
          )}
          {restoreProgress && <p className="text-sm text-zinc-600" aria-live="polite">{restoreProgress}</p>}
          {restoreError && (
            <p role="alert" className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {restoreError}
            </p>
          )}
          {restoreSuccess && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
              <p className="text-sm font-semibold text-emerald-700">{restoreSuccess}</p>
            </div>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={showRestoreConfirm}
        title="Restore this backup?"
        message="This will replace the current PoopLog data on this computer. PoopLog will create an encrypted safety backup before replacing your data."
        confirmLabel="Restore"
        cancelLabel="Cancel"
        onConfirm={handleConfirmRestore}
        onCancel={() => setShowRestoreConfirm(false)}
      />
    </div>
  );
}
