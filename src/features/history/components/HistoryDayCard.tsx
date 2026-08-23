import type { DailyCheckin, BowelRecord } from "../../../core/types/entities";
import { formatDisplayDate, isoToTimeLabel } from "../../../core/utils/date";
import { HistoryBowelRecordCard } from "./HistoryBowelRecordCard";

interface Props {
  checkin: DailyCheckin;
  records: BowelRecord[];
  onRecordClick: (r: BowelRecord) => void;
}

export function HistoryDayCard({ checkin, records, onRecordClick }: Props) {
  const hasBM = checkin.has_bowel_movement === 1;
  const count = records.length;
  const last = records[records.length - 1];

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-900">{formatDisplayDate(checkin.date)}</p>
          <p className="text-xs text-zinc-500">{checkin.date}</p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border ${
            hasBM ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-zinc-100 text-zinc-600 border-zinc-200"
          }`}
        >
          {hasBM ? `✓ ${count} bowel movement${count !== 1 ? "s" : ""}` : "○ No bowel movement"}
        </span>
      </div>

      {hasBM ? (
        count > 0 ? (
          <div className="mt-3 space-y-2">
            {records.map((r) => (
              <HistoryBowelRecordCard key={r.id} record={r} onClick={() => onRecordClick(r)} />
            ))}
            {last && (
              <p className="text-xs text-zinc-500">
                Last: {last.time_type === "approximate" ? last.approximate_time_label : isoToTimeLabel(last.occurred_at)} · Type {last.bristol_type ?? "—"}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Marked as bowel movement but no records yet — tap to add or change answer on Dashboard.
          </p>
        )
      ) : (
        <p className="mt-3 text-xs text-zinc-600">No records for this day.</p>
      )}
    </div>
  );
}
