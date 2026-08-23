// Difficulty values stored as distinct DB values (migration v3 adds very_easy)
const OPTIONS: { label: string; dbValue: string | null }[] = [
  { label: "Very Easy", dbValue: "very_easy" },
  { label: "Easy", dbValue: "easy" },
  { label: "Normal", dbValue: "normal" },
  { label: "Difficult", dbValue: "strained" },
  { label: "Very Difficult", dbValue: "very_strained" },
  { label: "Not Sure", dbValue: null },
];

interface Props {
  value: string | null;
  onChange: (v: string | null) => void;
}

export function DifficultySelector({ value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label="Difficulty" className="flex flex-wrap gap-2">
      {OPTIONS.map((o) => {
        const isSelected = value === o.dbValue;
        return (
          <button
            key={o.label}
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(o.dbValue)}
            className={`min-h-[44px] rounded-full border px-3.5 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${
              isSelected ? "bg-zinc-900 text-white border-zinc-900" : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
