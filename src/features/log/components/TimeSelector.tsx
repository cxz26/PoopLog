import { currentTimeInputValue } from "../../../core/utils/date";

type TimeType = "exact" | "approximate";
const APPROX_LABELS = ["Early Morning", "Morning", "Late Morning", "Afternoon", "Evening", "Night", "Late Night"] as const;

interface Props {
  timeType: TimeType;
  exactTime: string; // HH:mm
  approxLabel: string | null;
  onChangeType: (t: TimeType) => void;
  onChangeExact: (v: string) => void;
  onChangeApprox: (v: string) => void;
}

export function TimeSelector({ timeType, exactTime, approxLabel, onChangeType, onChangeExact, onChangeApprox }: Props) {
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Time type" className="flex gap-2">
        <button
          role="radio"
          aria-checked={timeType === "exact"}
          onClick={() => onChangeType("exact")}
          className={`flex-1 min-h-[44px] rounded-xl border px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${
            timeType === "exact" ? "bg-zinc-900 text-white border-zinc-900" : "bg-white border-zinc-200 text-zinc-700"
          }`}
        >
          Exact time
        </button>
        <button
          role="radio"
          aria-checked={timeType === "approximate"}
          onClick={() => onChangeType("approximate")}
          className={`flex-1 min-h-[44px] rounded-xl border px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${
            timeType === "approximate" ? "bg-zinc-900 text-white border-zinc-900" : "bg-white border-zinc-200 text-zinc-700"
          }`}
        >
          Approximate
        </button>
      </div>

      {timeType === "exact" ? (
        <div>
          <label htmlFor="exact-time" className="mb-1 block text-sm font-medium text-zinc-700">
            Time
          </label>
          <input
            id="exact-time"
            type="time"
            value={exactTime}
            onChange={(e) => onChangeExact(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
          <p className="mt-1 text-xs text-zinc-500">Defaults to now ({currentTimeInputValue()}) if you skip.</p>
        </div>
      ) : (
        <div role="radiogroup" aria-label="Approximate time">
          <p className="mb-2 text-sm font-medium text-zinc-700">When was it?</p>
          <div className="flex flex-wrap gap-2">
            {APPROX_LABELS.map((l) => {
              const selected = approxLabel === l;
              return (
                <button
                  key={l}
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChangeApprox(l)}
                  className={`min-h-[36px] rounded-full border px-3.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${
                    selected ? "bg-amber-700 text-white border-amber-700" : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  {l}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
