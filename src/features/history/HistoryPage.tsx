import { useEffect, useState, useCallback } from "react";
import { HistoryDayCard } from "./components/HistoryDayCard";
import { HistoryEmptyState } from "./components/HistoryEmptyState";
import { HistoryDetailModal } from "./components/HistoryDetailModal";
import * as DailyCheckinRepo from "../../core/database/repositories/dailyCheckin.repository";
import * as BowelRecordRepo from "../../core/database/repositories/bowelRecord.repository";
import type { DailyCheckin, BowelRecord } from "../../core/types/entities";
import { useAppStore } from "../../core/stores/appStore";
import { Button } from "../../shared/components/Button";

type DayEntry = { checkin: DailyCheckin; records: BowelRecord[] };

export function HistoryPage({ onBack }: { onBack?: () => void }) {
  const { databaseStatus } = useAppStore();
  const [days, setDays] = useState<DayEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<BowelRecord | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (databaseStatus !== "ready") return;
    setLoading(true);
    try {
      const all = await DailyCheckinRepo.getAll();
      // Only completed, newest first, dedup by date (already unique)
      const completed = all.filter((c) => c.completed === 1).sort((a, b) => (a.date < b.date ? 1 : -1));
      const entries: DayEntry[] = [];
      for (const c of completed) {
        const recs = await BowelRecordRepo.getByDailyCheckin(c.id);
        entries.push({ checkin: c, records: recs });
      }
      setDays(entries);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [databaseStatus]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRecordClick = (r: BowelRecord) => {
    setSelectedRecord(r);
    // Find day id for this record
    const day = days.find((d) => d.records.some((x) => x.id === r.id));
    setSelectedDayId(day?.checkin.id ?? r.daily_checkin_id);
    setModalOpen(true);
  };

  const handleUpdated = async () => {
    await load();
  };

  const handleDeleted = async () => {
    await load();
  };

  if (databaseStatus !== "ready") {
    return <div className="p-6 text-center text-sm text-zinc-600">Database not ready</div>;
  }

  if (loading) {
    return <div className="p-6 text-center text-sm text-zinc-600" aria-live="polite">Loading history…</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-[880px] px-4 py-6 sm:px-6">
        <div className="mb-6 flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back to dashboard">
              ← Back
            </Button>
          )}
          <h1 className="text-lg font-bold text-zinc-900">History</h1>
          <span className="ml-auto text-xs text-zinc-500">{days.length} day{days.length !== 1 ? "s" : ""}</span>
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {days.length === 0 ? (
          <HistoryEmptyState />
        ) : (
          <div className="space-y-3">
            {days.map(({ checkin, records }) => (
              <HistoryDayCard key={checkin.id} checkin={checkin} records={records} onRecordClick={handleRecordClick} />
            ))}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-zinc-400">Only completed days appear. No-bowel-movement days show as ○.</p>
      </div>

      <HistoryDetailModal
        open={modalOpen}
        record={selectedRecord}
        dailyCheckinId={selectedDayId}
        onClose={() => setModalOpen(false)}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
