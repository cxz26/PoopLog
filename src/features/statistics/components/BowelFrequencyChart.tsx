import type { DailyFrequency } from "../../../core/services/statisticsService";

interface Props {
  data: DailyFrequency[];
}

export function BowelFrequencyChart({ data }: Props) {
  const max = Math.max(1, ...data.map((d) => d.count ?? 0));

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-zinc-900">Bowel frequency (per day)</h3>
      <p className="text-xs text-zinc-500">0 = no bowel movement, empty = no record (not counted as 0)</p>
      <div className="mt-4 flex items-end gap-1 overflow-x-auto pb-2" role="img" aria-label="Bowel frequency chart">
        {data.map((d) => {
          const isNoRecord = d.status === "no_record";
          const height = isNoRecord ? 4 : ((d.count ?? 0) / max) * 80 + 8;
          const bg = isNoRecord ? "bg-zinc-100 border border-dashed border-zinc-300" : d.count === 0 ? "bg-zinc-300" : "bg-emerald-600";
          const label = isNoRecord ? "no record" : d.count === 0 ? "no BM" : `${d.count}`;
          return (
            <div key={d.date} className="flex flex-col items-center gap-1 shrink-0" style={{ width: `${Math.max(24, 100 / Math.min(data.length, 30))}%`, minWidth: 28 }}>
              <div
                className={`w-full rounded-t ${bg} transition-all`}
                style={{ height: `${height}px` }}
                role="img"
                aria-label={`${d.date}: ${isNoRecord ? "no record" : `${d.count} bowel movement${d.count !== 1 ? "s" : ""}`}`}
                title={`${d.date}: ${isNoRecord ? "no record" : `${d.count}`}`}
              />
              <span className="text-[10px] text-zinc-500">{d.date.slice(5)}</span>
              <span className="text-[10px] font-medium text-zinc-700">{label}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-3 text-xs text-zinc-600">
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-emerald-600 inline-block" aria-hidden /> Bowel movement
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-zinc-300 inline-block" aria-hidden /> No BM (0)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-zinc-100 border border-dashed border-zinc-300 inline-block" aria-hidden /> No record
        </span>
      </div>
    </div>
  );
}
