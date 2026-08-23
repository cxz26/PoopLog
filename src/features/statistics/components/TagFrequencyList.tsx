import type { TagFrequency } from "../../../core/services/statisticsService";

interface Props {
  title: string;
  data: TagFrequency[];
  emptyText?: string;
}

export function TagFrequencyList({ title, data, emptyText = "No records yet." }: Props) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        <p className="mt-2 text-sm text-zinc-600">{emptyText}</p>
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.count));

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      <p className="text-xs text-zinc-500">Most frequent (actual tag usage, skipped not counted)</p>
      <ul className="mt-3 space-y-2" role="list">
        {data.slice(0, 8).map(({ tag, count }) => (
          <li key={tag.id} className="flex items-center gap-2">
            <span className="flex-1 text-sm text-zinc-900 truncate">{tag.name}</span>
            <div className="flex-1 max-w-[120px] h-2 rounded-full bg-zinc-100 overflow-hidden" aria-hidden>
              <div className="h-full bg-zinc-900" style={{ width: `${(count / max) * 100}%` }} />
            </div>
            <span className="text-xs font-medium text-zinc-700 w-8 text-right">{count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
