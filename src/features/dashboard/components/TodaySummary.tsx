import type { BowelRecord } from "../../../core/types/entities";
import { isoToTimeLabel } from "../../../core/utils/date";

interface Props {
  count: number;
  records: BowelRecord[];
}

export function TodaySummary({ count, records }: Props) {
  if (count === 0) return null;
  const last = records[records.length - 1];
  return (
    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
      <p className="text-sm font-semibold text-emerald-900">Today's records</p>
      <p className="text-sm text-emerald-800">Bowel movements: {count}</p>
      {last && (
        <p className="mt-1 text-xs text-emerald-700">
          Last: {last.time_type === "approximate" ? last.approximate_time_label : isoToTimeLabel(last.occurred_at)} — Type {last.bristol_type ?? "—"}
        </p>
      )}
      <ul className="mt-2 space-y-1">
        {records.map((r) => (
          <li key={r.id} className="text-xs text-emerald-700">
            {r.time_type === "approximate" ? r.approximate_time_label : isoToTimeLabel(r.occurred_at)} — Type {r.bristol_type} {r.amount ? `· ${r.amount}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
