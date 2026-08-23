import type { TimeRange } from "../../../core/services/statisticsService";

const OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "7", label: "7 Days" },
  { value: "30", label: "30 Days" },
  { value: "90", label: "90 Days" },
  { value: "365", label: "1 Year" },
  { value: "all", label: "All Time" },
];

interface Props {
  value: TimeRange;
  onChange: (v: TimeRange) => void;
}

export function TimeRangeFilter({ value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label="Time range" className="flex flex-wrap gap-2">
      {OPTIONS.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
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
