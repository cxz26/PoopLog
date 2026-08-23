import { useEffect, useState, useCallback } from "react";
import { Button } from "../../shared/components/Button";
import { Card } from "../../shared/components/Card";
import { Modal } from "../../shared/components/Modal";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import { CheckinPrompt } from "./components/CheckinPrompt";
import { StreakBadge } from "./components/StreakBadge";
import { WeeklySummary } from "./components/WeeklySummary";
import { TodaySummary } from "./components/TodaySummary";
import { BowelLogForm } from "../log/BowelLogForm";
import { todayISO, formatDisplayDate, getWeekDates } from "../../core/utils/date";
import * as DailyCheckinRepo from "../../core/database/repositories/dailyCheckin.repository";
import * as BowelRecordRepo from "../../core/database/repositories/bowelRecord.repository";
import { useDashboardStore } from "../../core/stores/dashboardStore";
import { computeStreak, getWeeklyActivity } from "../../core/services/dashboardService";
import { useAppStore } from "../../core/stores/appStore";

export function Dashboard() {
  const { databaseStatus } = useAppStore();
  const { today, dailyCheckin, bowelRecords, streak, weeklyMap, loading, setToday, setDailyCheckin, setBowelRecords, setStreak, setWeeklyMap, setLoading, setError } =
    useDashboardStore();

  const [showLogModal, setShowLogModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showChangeConfirm, setShowChangeConfirm] = useState(false);

  const load = useCallback(async () => {
    if (databaseStatus !== "ready") return;
    setLoading(true);
    try {
      const t = todayISO();
      setToday(t);
      const dc = await DailyCheckinRepo.getByDate(t);
      setDailyCheckin(dc);
      if (dc) {
        const brs = await BowelRecordRepo.getByDailyCheckin(dc.id);
        setBowelRecords(brs);
      } else {
        setBowelRecords([]);
      }
      const s = await computeStreak();
      setStreak(s);
      const weekDates = getWeekDates(t);
      const wmap = await getWeeklyActivity(t);
      setWeeklyMap(wmap);
      // ensure weeklyMap includes all 7 dates (default false)
      const fullMap: Record<string, boolean> = {};
      for (const d of weekDates) fullMap[d] = !!wmap[d];
      setWeeklyMap(fullMap);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [databaseStatus, setBowelRecords, setDailyCheckin, setError, setLoading, setStreak, setToday, setWeeklyMap]);

  useEffect(() => {
    load();
  }, [load]);

  const handleNo = async () => {
    setActionLoading(true);
    try {
      const t = todayISO();
      await DailyCheckinRepo.markCompleted(t, 0);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handleYes = async () => {
    setActionLoading(true);
    try {
      const t = todayISO();
      await DailyCheckinRepo.markCompleted(t, 1);
      // ensure store updated before opening modal
      await load();
      // open log modal after ensuring dailyCheckin exists
      setShowLogModal(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangeAnswer = async () => {
    if (!dailyCheckin) return;
    const isCurrentlyYes = dailyCheckin.has_bowel_movement === 1;
    if (isCurrentlyYes) {
      // YES -> NO : need confirmation if records exist
      if (bowelRecords.length > 0) {
        setShowChangeConfirm(true);
        return;
      }
      await DailyCheckinRepo.markCompleted(today, 0);
      await load();
    } else {
      // NO -> YES
      await DailyCheckinRepo.markCompleted(today, 1);
      await load();
      setShowLogModal(true);
    }
  };

  const confirmChangeToNo = async () => {
    setShowChangeConfirm(false);
    // delete all bowel records for this checkin then mark NO
    for (const br of bowelRecords) {
      await BowelRecordRepo.remove(br.id);
    }
    await DailyCheckinRepo.markCompleted(today, 0);
    await load();
  };

  const handleAddAnother = () => {
    setShowLogModal(true);
  };

  if (databaseStatus !== "ready") {
    return (
      <div className="mx-auto max-w-[880px] px-4 py-10 text-center text-sm text-zinc-600">
        {databaseStatus === "initializing" ? "Initializing local database…" : "Database error — please restart the app."}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[880px] px-4 py-10 text-center text-sm text-zinc-600" aria-live="polite">
        Loading today's data…
      </div>
    );
  }

  const isCompleted = !!dailyCheckin?.completed;
  const hasBM = dailyCheckin?.has_bowel_movement === 1;
  const weekDates = getWeekDates(today);

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto flex min-h-screen max-w-[880px] flex-col px-4 py-6 sm:px-6 sm:py-8">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-700 text-lg text-white">💩</div>
            <div>
              <h1 className="text-lg font-bold leading-none text-zinc-900">PoopLog</h1>
              <p className="text-xs font-medium tracking-wide text-zinc-500">Local-first • Offline • Private</p>
            </div>
          </div>
          <StreakBadge streak={streak} />
        </header>

        {/* Current date */}
        <p className="mb-4 text-center text-sm font-medium text-zinc-600">{formatDisplayDate(today)}</p>

        {/* Weekly summary */}
        <div className="mb-6">
          <WeeklySummary dates={weekDates} map={weeklyMap} />
        </div>

        {/* Main action area */}
        <main className="mx-auto w-full max-w-[520px] flex-1 space-y-4">
          {!isCompleted ? (
            <CheckinPrompt onYes={handleYes} onNo={handleNo} loading={actionLoading} />
          ) : (
            <>
              {!hasBM ? (
                <Card className="text-center">
                  <p className="text-sm font-semibold text-emerald-700">✓ Today's check-in completed.</p>
                  <p className="mt-1 text-sm text-zinc-700">No bowel movement today.</p>
                  <p className="mt-1 text-xs text-zinc-500">You can change your answer if needed.</p>
                  <div className="mt-4 flex gap-2 justify-center">
                    <Button variant="secondary" onClick={handleChangeAnswer}>
                      Change Answer
                    </Button>
                  </div>
                </Card>
              ) : (
                <>
                  <Card className="text-center">
                    <p className="text-sm font-semibold text-emerald-700">✓ Today's check-in completed.</p>
                    <p className="mt-1 text-xs text-zinc-500">You can add more records or change your answer.</p>
                  </Card>

                  <TodaySummary count={bowelRecords.length} records={bowelRecords} />

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button fullWidth onClick={handleAddAnother}>
                      + Add bowel record
                    </Button>
                    <Button variant="secondary" onClick={handleChangeAnswer} className="sm:w-auto">
                      Change to No
                    </Button>
                  </div>

                  {bowelRecords.length === 0 && (
                    <Card className="text-center py-8">
                      <p className="text-sm text-zinc-600">No records yet for today.</p>
                      <p className="mt-1 text-xs text-zinc-500">Tap "Add bowel record" to log your first one.</p>
                    </Card>
                  )}
                </>
              )}
            </>
          )}

          {/* Help for first-time */}
          {!isCompleted && (
            <p className="text-center text-xs leading-relaxed text-zinc-500 px-2">
              First time? Just answer YES or NO. You can add details like Bristol type and time in 20–30 seconds. Optional fields can be skipped.
            </p>
          )}
        </main>

        <footer className="mt-8 text-center text-xs text-zinc-400">PoopLog Desktop • Phase 3 • Your data stays on this device</footer>
      </div>

      {/* Log modal */}
      <Modal open={showLogModal} onClose={() => setShowLogModal(false)} title="Log bowel movement">
        {dailyCheckin && (
          <BowelLogForm
            dateISO={today}
            dailyCheckinId={dailyCheckin.id}
            onClose={() => setShowLogModal(false)}
            onSaved={load}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={showChangeConfirm}
        title="Change to no bowel movement?"
        message={`You have ${bowelRecords.length} bowel record(s) for today. Changing to "No bowel movement" will delete these records. This cannot be undone.`}
        confirmLabel="Delete records"
        cancelLabel="Cancel"
        onConfirm={confirmChangeToNo}
        onCancel={() => setShowChangeConfirm(false)}
      />
    </div>
  );
}
