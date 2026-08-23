import type { SleepStats, WaterStats } from "../../../core/services/statisticsService";

export function SleepWaterCards({ sleep, water }: { sleep: SleepStats | null; water: WaterStats | null }) {
  const sleepEmpty = !sleep || sleep.total === 0;
  const waterEmpty = !water || water.total === 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900">Sleep</h3>
        {sleepEmpty ? (
          <p className="mt-2 text-sm text-zinc-600">No sleep data.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-zinc-900">
              Average: {sleep!.averageMinutes != null ? `${Math.floor(sleep!.averageMinutes / 60)}h ${Math.round(sleep!.averageMinutes % 60)}m` : "—"} ({sleep!.averageMinutes?.toFixed(0) ?? "—"} min)
            </p>
            <p className="text-xs text-zinc-500">Total records: {sleep!.total} · Ignore NULL</p>
            {sleep!.qualityCounts.length > 0 && (
              <ul className="mt-3 space-y-1">
                {sleep!.qualityCounts.map((q) => (
                  <li key={q.quality} className="flex justify-between text-xs">
                    <span className="capitalize text-zinc-700">{q.quality}</span>
                    <span className="text-zinc-600">
                      {q.count} ({q.percentage.toFixed(0)}%)
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900">Water</h3>
        {waterEmpty ? (
          <p className="mt-2 text-sm text-zinc-600">No water data.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-zinc-900">
              Average: {water!.averageMl != null ? `${(water!.averageMl / 1000).toFixed(1)} L (${water!.averageMl.toFixed(0)} mL)` : "—"}
            </p>
            <p className="text-xs text-zinc-500">Total records: {water!.total} · Ignore NULL · Stored as mL</p>
          </>
        )}
      </div>
    </div>
  );
}
