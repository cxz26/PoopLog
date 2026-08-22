const OPTIONS = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
  { value: null, label: "Not Sure" },
] as const;

interface Props {
  value: string | null;
  onChange: (v: string | null) => void;
}

export function AmountSelector({ value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label="Amount" className="flex flex-wrap gap-2">
      {OPTIONS.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={`min-h-[44px] rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${
              selected ? "bg-zinc-900 text-white border-zinc-900" : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
