import { useState } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  label: string;
  id?: string;
  onSubmit?: () => void;
  disabled?: boolean;
  showStrength?: boolean;
}

function getStrength(password: string): { label: string; color: string; width: string } {
  if (password.length === 0) return { label: "", color: "", width: "0%" };
  if (password.length < 8) return { label: "Too short", color: "bg-red-500", width: "25%" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 2) return { label: "Weak", color: "bg-amber-500", width: "50%" };
  if (score === 3) return { label: "Good", color: "bg-yellow-500", width: "75%" };
  return { label: "Strong", color: "bg-emerald-600", width: "100%" };
}

export function BackupPasswordInput({ value, onChange, label, id = "backup-password", onSubmit, disabled, showStrength }: Props) {
  const [visible, setVisible] = useState(false);
  const strength = showStrength ? getStrength(value) : null;

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-zinc-900">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit?.()}
          disabled={disabled}
          autoComplete="new-password"
          aria-label={label}
          aria-describedby={showStrength ? `${id}-warning` : undefined}
          placeholder="••••••••"
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {showStrength && value.length > 0 && strength && (
        <div className="mt-2">
          <div className="h-1.5 w-full rounded-full bg-zinc-200 overflow-hidden" aria-hidden>
            <div className={`h-full ${strength.color} transition-all`} style={{ width: strength.width }} />
          </div>
          <p className="mt-1 text-xs text-zinc-600" aria-live="polite">
            Strength: {strength.label}
          </p>
        </div>
      )}
      {showStrength && (
        <p id={`${id}-warning`} className="mt-2 text-xs leading-relaxed text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Your backup is encrypted. If you forget this password, the backup cannot be recovered.
        </p>
      )}
    </div>
  );
}
