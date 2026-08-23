import { useState } from "react";
import { PinInput } from "../../shared/components/PinInput";
import { Button } from "../../shared/components/Button";
import { Card } from "../../shared/components/Card";
import { hashPin, saveSecurityRecord } from "../../core/security/pinService";

interface Props {
  onComplete: () => void;
  onSkip?: () => void;
}

export function PinSetup({ onComplete, onSkip }: Props) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setError(null);
    if (!pin || !confirm) {
      setError("Please enter and confirm your PIN.");
      return;
    }
    if (pin !== confirm) {
      setError("PINs do not match.");
      return;
    }
    if (!/^\d{4,8}$/.test(pin)) {
      setError("PIN must be 4–8 digits.");
      return;
    }
    setSaving(true);
    try {
      const rec = await hashPin(pin);
      saveSecurityRecord(rec);
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[420px] space-y-4">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-700 text-white text-xl">🔒</div>
          <h1 className="text-xl font-bold text-zinc-900">Protect PoopLog</h1>
          <p className="mt-1 text-sm text-zinc-600">Create a PIN to protect your health records.</p>
          <p className="mt-1 text-xs text-zinc-500">4–8 digits • Stored securely on this device</p>
        </div>

        <Card>
          <div className="space-y-4">
            <PinInput value={pin} onChange={setPin} label="Create PIN" autoFocus />
            <PinInput value={confirm} onChange={setConfirm} label="Confirm PIN" onSubmit={handleCreate} />
            {error && (
              <p id="pin-error" role="alert" className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <Button fullWidth size="lg" onClick={handleCreate} disabled={saving} aria-label="Create PIN">
              {saving ? "Creating…" : "Create PIN"}
            </Button>
            {onSkip && (
              <Button variant="ghost" fullWidth onClick={onSkip} aria-label="Skip PIN setup">
                Skip for now
              </Button>
            )}
            <p className="text-center text-xs text-zinc-500">You can change or disable this PIN later in Settings.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
