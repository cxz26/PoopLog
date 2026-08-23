import type { BristolDistribution } from "../../../core/services/statisticsService";

interface Props {
  data: BristolDistribution;
}

export function BristolChart({ data }: Props) {
  if (data.total === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900">Bristol distribution</h3>
        <p className="mt-2 text-sm text-zinc-600">No Bristol data yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-zinc-900">Bristol distribution (Types 1–7)</h3>
      <p className="text-xs text-zinc-500">
        Average: {data.average != null ? data.average.toFixed(1) : "—"} · Total: {data.total}
      </p>
      <div className="mt-4 space-y-2" role="img" aria-label="Bristol distribution chart">
        {data.counts.map((c) => (
          <div key={c.type} className="flex items-center gap-2">
            <span className="w-12 text-xs font-medium text-zinc-700">Type {c.type}</span>
            <div className="flex-1 h-6 rounded-full bg-zinc-100 overflow-hidden" aria-hidden>
              <div className="h-full bg-amber-600 transition-all" style={{ width: `${c.percentage}%` }} />
            </div>
            <span className="w-20 text-right text-xs text-zinc-600">
              {c.count} ({c.percentage.toFixed(0)}%)
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-zinc-500">Ignore NULL/missing Bristol values.</p>
    </div>
  );
}
