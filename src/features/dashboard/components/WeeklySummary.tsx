import { formatShortDate } from "../../../core/utils/date";

interface Props {
  dates: string[]; // 7 ISO dates
  map: Record<string, boolean>;
}

export function WeeklySummary({ dates, map }: Props) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">Last 7 days</p>
      <div className="grid grid-cols-7 gap-1.5">
        {dates.map((d) => {
          const done = !!map[d];
          const isToday = d === dates[dates.length - 1];
          return (
            <div key={d} className="flex flex-col items-center gap-1">
              <span className={`text-[10px] font-medium ${isToday ? "text-zinc-900" : "text-zinc-500"}`}>{formatShortDate(d).split(" ")[0].slice(0, 2)}</span>
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold border ${
                  done ? "bg-emerald-600 text-white border-emerald-600" : "bg-zinc-100 text-zinc-400 border-zinc-200"
                }`}
                aria-label={`${d}: ${done ? "completed" : "not completed"}`}
              >
                {done ? "✓" : "·"}
              </span>
              <span className="text-[10px] text-zinc-400">{d.slice(5)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
