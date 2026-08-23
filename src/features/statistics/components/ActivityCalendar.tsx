import type { CalendarDay } from "../../../core/services/statisticsService";

interface Props {
  data: CalendarDay[];
}

export function ActivityCalendar({ data }: Props) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-zinc-900">Activity calendar</h3>
      <p className="text-xs text-zinc-500">Green = bowel movement, Gray = no bowel movement, Empty = no record (with labels)</p>
      <div className="mt-3 grid grid-cols-7 gap-1.5 sm:gap-2" role="grid" aria-label="Activity calendar">
        {data.map((d) => {
          const bg =
            d.status === "bm" ? "bg-emerald-600 border-emerald-600 text-white" : d.status === "no_bm" ? "bg-zinc-300 border-zinc-300 text-zinc-700" : "bg-white border-dashed border-zinc-300 text-zinc-400";
          const label = d.status === "bm" ? `Bowel movement ${d.count ?? 0}` : d.status === "no_bm" ? "No bowel movement" : "No record";
          return (
            <div
              key={d.date}
              role="gridcell"
              aria-label={`${d.date}: ${label}`}
              title={`${d.date}: ${label}`}
              className={`flex flex-col items-center justify-center rounded-lg border p-1.5 text-center min-h-[56px] ${bg}`}
            >
              <span className="text-[10px] font-medium">{d.date.slice(5)}</span>
              <span className="text-xs font-bold">
                {d.status === "bm" ? `✓ ${d.count}` : d.status === "no_bm" ? "○" : "∅"}
              </span>
              <span className="text-[10px] leading-none">{d.status === "bm" ? "BM" : d.status === "no_bm" ? "No BM" : "No rec"}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-emerald-600 border border-emerald-600 inline-block" aria-hidden /> Bowel movement
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-zinc-300 border border-zinc-300 inline-block" aria-hidden /> No bowel movement
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-white border border-dashed border-zinc-300 inline-block" aria-hidden /> No record
        </span>
      </div>
    </div>
  );
}
