import { useEffect, useRef, useState } from "react";
import { PinInput, PinKeypad } from "../../shared/components/PinInput";
import { Button } from "../../shared/components/Button";
import { useSecurityStore } from "../../core/security/securityStore";
import { loadSecurityRecord, verifyPin, recordFailedAttempt, recordSuccess, getRemainingCooldown, getFailedCount, isInCooldown } from "../../core/security/pinService";

interface Props {
  onUnlock: () => void;
}

export function LockScreen({ onUnlock }: Props) {
  const [pin, setPin] = useState("");
  const { setError, error, setFailedCount, setCooldownRemaining } = useSecurityStore();
  const [cooldown, setCooldown] = useState(0);
  const [failed, setFailed] = useState(getFailedCount());
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus trap: keep focus inside lock screen
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    el.addEventListener("keydown", onKey);
    // focus PIN
    setTimeout(() => (document.getElementById("pin-input") as HTMLInputElement | null)?.focus(), 100);
    return () => el.removeEventListener("keydown", onKey);
  }, []);

  // Cooldown ticker
  useEffect(() => {
    const tick = () => {
      const rem = getRemainingCooldown();
      setCooldown(rem);
      setCooldownRemaining(rem);
      if (rem === 0 && isInCooldown() === false) {
        // update failed count display
        setFailed(getFailedCount());
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [setCooldownRemaining]);

  const handleUnlock = async () => {
    if (isInCooldown()) {
      setError(`Too many attempts. Try again in ${getRemainingCooldown()} seconds.`);
      return;
    }
    if (!pin || !/^\d{4,8}$/.test(pin)) {
      setError("Please enter your PIN.");
      return;
    }
    const rec = loadSecurityRecord();
    if (!rec) {
      setError("No PIN configured.");
      return;
    }
    try {
      const ok = await verifyPin(pin, rec);
      if (ok) {
        recordSuccess();
        setFailed(0);
        setError(null);
        setPin("");
        onUnlock();
      } else {
        const state = recordFailedAttempt();
        setFailed(state.count);
        setFailedCount(state.count);
        setError("Incorrect PIN.");
        setPin("");
        const rem = getRemainingCooldown();
        if (rem > 0) setCooldown(rem);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const inCooldown = cooldown > 0;

  return (
    <div ref={containerRef} className="min-h-screen bg-zinc-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[420px] space-y-4">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 text-white text-xl" aria-hidden>
            🔒
          </div>
          <h1 className="text-xl font-bold text-zinc-900">PoopLog</h1>
          <p className="mt-1 text-sm text-zinc-600">Enter your PIN to unlock</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
          <PinInput value={pin} onChange={setPin} onSubmit={handleUnlock} disabled={inCooldown} error={!!error} autoFocus label="PIN" />

          {error && (
            <p id="pin-error" role="alert" aria-live="assertive" className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {inCooldown ? (
            <p role="alert" className="text-center text-sm font-medium text-amber-700">
              Too many attempts. Try again in {cooldown} seconds.
            </p>
          ) : (
            failed > 0 && <p className="text-center text-xs text-zinc-500">Failed attempts: {failed}</p>
          )}

          <PinKeypad onPress={(d) => setPin((p) => (p + d).slice(0, 8))} onBackspace={() => setPin((p) => p.slice(0, -1))} onSubmit={handleUnlock} disabled={inCooldown} />

          <Button fullWidth size="lg" onClick={handleUnlock} disabled={inCooldown} aria-label="Unlock">
            Unlock
          </Button>

          <p className="text-center text-xs text-zinc-500">Your PIN is stored only as a secure verifier on this device.</p>
        </div>
      </div>
    </div>
  );
}
