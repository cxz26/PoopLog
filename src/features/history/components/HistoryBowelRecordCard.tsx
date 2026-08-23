import type { BowelRecord } from "../../../core/types/entities";
import { isoToTimeLabel } from "../../../core/utils/date";

interface Props {
  record: BowelRecord;
  onClick: () => void;
}

export function HistoryBowelRecordCard({ record, onClick }: Props) {
  const timeLabel = record.time_type === "approximate" ? record.approximate_time_label : isoToTimeLabel(record.occurred_at);

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-left hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 transition-colors"
      aria-label={`Bowel record at ${timeLabel}, Type ${record.bristol_type ?? "—"}`}
    >
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-900 border border-amber-200">
        {record.bristol_type ?? "—"}
      </span>
      <span className="flex flex-1 flex-col min-w-0">
        <span className="text-sm font-semibold text-zinc-900 truncate">{timeLabel ?? "—"} · Type {record.bristol_type ?? "—"}</span>
        <span className="text-xs text-zinc-600 truncate">
          {[record.amount, record.difficulty].filter(Boolean).join(" · ") || "No amount/difficulty"}
        </span>
      </span>
      <span className="text-zinc-400" aria-hidden>
        ›
      </span>
    </button>
  );
}
