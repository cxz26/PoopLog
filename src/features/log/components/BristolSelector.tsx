const BRISTOL: { value: number; label: string; desc: string }[] = [
  { value: 1, label: "Type 1", desc: "Separate hard lumps, hard to pass" },
  { value: 2, label: "Type 2", desc: "Sausage-shaped but lumpy" },
  { value: 3, label: "Type 3", desc: "Like a sausage with cracks" },
  { value: 4, label: "Type 4", desc: "Sausage, smooth and soft" },
  { value: 5, label: "Type 5", desc: "Soft blobs, clear edges" },
  { value: 6, label: "Type 6", desc: "Fluffy pieces, mushy" },
  { value: 7, label: "Type 7", desc: "Watery, no solids" },
];

interface Props {
  value: number | null;
  onChange: (v: number) => void;
}

export function BristolSelector({ value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label="Bristol stool type" className="grid grid-cols-1 gap-2">
      {BRISTOL.map((b) => {
        const selected = value === b.value;
        return (
          <button
            key={b.value}
            role="radio"
            aria-checked={selected}
            aria-label={`${b.label}: ${b.desc}`}
            onClick={() => onChange(b.value)}
            className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-1 ${
              selected ? "bg-amber-50 border-amber-700 shadow-sm" : "bg-white border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            <span
              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold border ${
                selected ? "bg-amber-700 text-white border-amber-700" : "bg-zinc-100 text-zinc-700 border-zinc-200"
              }`}
              aria-hidden
            >
              {b.value}
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-semibold text-zinc-900">{b.label}</span>
              <span className="text-xs leading-tight text-zinc-600">{b.desc}</span>
            </span>
            {selected && <span className="ml-auto text-amber-700" aria-hidden>✓</span>}
          </button>
        );
      })}
    </div>
  );
}
