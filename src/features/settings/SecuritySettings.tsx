import { useState } from "react";
import { PinInput } from "../../shared/components/PinInput";
import { Button } from "../../shared/components/Button";
import { Card } from "../../shared/components/Card";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import { hashPin, saveSecurityRecord, loadSecurityRecord, verifyPin, clearSecurityRecord, clearAttempts } from "../../core/security/pinService";
import { useSecurityStore } from "../../core/security/securityStore";

interface Props {
  onLockNow: () => void;
}

export function SecuritySettings({ onLockNow }: Props) {
  const { hasPin, setHasPin, setStatus } = useSecurityStore();
  const [mode, setMode] = useState<"view" | "change" | "disable">("view");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);

  const handleChangePin = async () => {
    setError(null);
    setSuccess(null);
    if (!currentPin || !newPin || !confirmPin) {
      setError("Please fill all fields.");
      return;
    }
    if (newPin !== confirmPin) {
      setError("New PINs do not match.");
      return;
    }
    if (!/^\d{4,8}$/.test(newPin)) {
      setError("New PIN must be 4–8 digits.");
      return;
    }
    const rec = loadSecurityRecord();
    if (!rec) {
      setError("No PIN configured.");
      return;
    }
    const ok = await verifyPin(currentPin, rec);
    if (!ok) {
      setError("Current PIN is incorrect.");
      return;
    }
    const newRec = await hashPin(newPin);
    saveSecurityRecord(newRec);
    clearAttempts();
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setSuccess("PIN changed successfully.");
    setMode("view");
  };

  const handleDisable = async () => {
    setError(null);
    if (!currentPin) {
      setError("Please enter your current PIN.");
      return;
    }
    const rec = loadSecurityRecord();
    if (!rec) {
      setError("No PIN configured.");
      return;
    }
    const ok = await verifyPin(currentPin, rec);
    if (!ok) {
      setError("Current PIN is incorrect.");
      return;
    }
    setShowDisableConfirm(true);
  };

  const confirmDisable = () => {
    clearSecurityRecord();
    setHasPin(false);
    setStatus("unlocked");
    setShowDisableConfirm(false);
    setCurrentPin("");
    setSuccess("PIN disabled. App will no longer require a PIN.");
    setMode("view");
  };

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-zinc-900">Security</h2>
      <p className="text-sm text-zinc-600">Protect your health records with a PIN. Stored only as a secure verifier on this device.</p>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-900">PIN protection</p>
            <p className="text-xs text-zinc-500">{hasPin ? "Enabled — app locks on startup" : "Disabled"}</p>
          </div>
          <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold ${hasPin ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-zinc-100 text-zinc-600 border border-zinc-200"}`}>
            {hasPin ? "On" : "Off"}
          </span>
        </div>
        {hasPin && (
          <div className="mt-4">
            <Button variant="secondary" size="sm" onClick={onLockNow} aria-label="Lock now">
              Lock Now
            </Button>
            <p className="mt-2 text-xs text-zinc-500">Locks the app and shows the PIN screen.</p>
          </div>
        )}
      </Card>

      {mode === "view" && hasPin && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" onClick={() => setMode("change")}>
            Change PIN
          </Button>
          <Button variant="ghost" onClick={() => setMode("disable")}>
            Disable PIN
          </Button>
        </div>
      )}

      {mode === "change" && (
        <Card>
          <h3 className="text-sm font-semibold text-zinc-900">Change PIN</h3>
          <div className="mt-3 space-y-3">
            <PinInput value={currentPin} onChange={setCurrentPin} label="Current PIN" />
            <PinInput value={newPin} onChange={setNewPin} label="New PIN" />
            <PinInput value={confirmPin} onChange={setConfirmPin} label="Confirm New PIN" onSubmit={handleChangePin} />
            {error && (
              <p role="alert" className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            {success && <p className="text-sm text-emerald-700">{success}</p>}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setMode("view")} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleChangePin} className="flex-1">
                Save
              </Button>
            </div>
          </div>
        </Card>
      )}

      {mode === "disable" && (
        <Card>
          <h3 className="text-sm font-semibold text-zinc-900">Disable PIN</h3>
          <p className="mt-1 text-sm text-zinc-600">Enter your current PIN to confirm.</p>
          <div className="mt-3 space-y-3">
            <PinInput value={currentPin} onChange={setCurrentPin} label="Current PIN" />
            {error && (
              <p role="alert" className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setMode("view")} className="flex-1">
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDisable} className="flex-1">
                Continue
              </Button>
            </div>
          </div>
        </Card>
      )}

      {success && mode === "view" && <p className="text-sm text-emerald-700">{success}</p>}
      {error && mode === "view" && (
        <p role="alert" className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={showDisableConfirm}
        title="Turn off PIN protection?"
        message="Your health records will no longer require a PIN when PoopLog starts."
        confirmLabel="Turn off"
        cancelLabel="Cancel"
        onConfirm={confirmDisable}
        onCancel={() => setShowDisableConfirm(false)}
      />
    </div>
  );
}
