import { useRef, useEffect } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  error?: boolean;
  autoFocus?: boolean;
  label?: string;
}

export function PinInput({ value, onChange, onSubmit, disabled, error, autoFocus, label = "PIN" }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 8);
    onChange(v);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && onSubmit) onSubmit();
  };

  return (
    <div>
      <label htmlFor="pin-input" className="mb-2 block text-sm font-semibold text-zinc-900">
        {label}
      </label>
      <input
        ref={ref}
        id="pin-input"
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-label={label}
        aria-invalid={!!error}
        aria-describedby={error ? "pin-error" : undefined}
        placeholder="••••"
        className={`w-full rounded-xl border px-4 py-3 text-center text-lg tracking-[0.3em] font-mono focus:outline-none focus:ring-2 focus:ring-zinc-900 ${
          error ? "border-red-300 bg-red-50" : "border-zinc-200 bg-white"
        } disabled:opacity-50`}
      />
    </div>
  );
}

// Simple numeric keypad
export function PinKeypad({ onPress, onBackspace, onSubmit, disabled }: { onPress: (d: string) => void; onBackspace: () => void; onSubmit: () => void; disabled?: boolean }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Numeric keypad">
      {keys.slice(0, 9).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onPress(k)}
          disabled={disabled}
          className="min-h-[56px] rounded-xl border border-zinc-200 bg-white text-lg font-semibold text-zinc-900 hover:bg-zinc-50 active:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 disabled:opacity-50"
          aria-label={`Digit ${k}`}
        >
          {k}
        </button>
      ))}
      <button
        type="button"
        onClick={onBackspace}
        disabled={disabled}
        className="min-h-[56px] rounded-xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-700 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 disabled:opacity-50"
        aria-label="Backspace"
      >
        ⌫
      </button>
      <button
        type="button"
        onClick={() => onPress("0")}
        disabled={disabled}
        className="min-h-[56px] rounded-xl border border-zinc-200 bg-white text-lg font-semibold text-zinc-900 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 disabled:opacity-50"
        aria-label="Digit 0"
      >
        0
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled}
        className="min-h-[56px] rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 disabled:opacity-50"
        aria-label="Unlock"
      >
        ✓
      </button>
    </div>
  );
}
