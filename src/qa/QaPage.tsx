import { useState } from "react";
import { CheckinPrompt } from "../features/dashboard/components/CheckinPrompt";
import { StreakBadge } from "../features/dashboard/components/StreakBadge";
import { WeeklySummary } from "../features/dashboard/components/WeeklySummary";
import { TodaySummary } from "../features/dashboard/components/TodaySummary";
import { BristolSelector } from "../features/log/components/BristolSelector";
import { AmountSelector } from "../features/log/components/AmountSelector";
import { DifficultySelector } from "../features/log/components/DifficultySelector";
import { TimeSelector } from "../features/log/components/TimeSelector";
import { Modal } from "../shared/components/Modal";
import { ConfirmDialog } from "../shared/components/ConfirmDialog";
import { Button } from "../shared/components/Button";
import { Card } from "../shared/components/Card";
import { currentTimeInputValue } from "../core/utils/date";
import { HistoryDayCard } from "../features/history/components/HistoryDayCard";
import { HistoryEmptyState } from "../features/history/components/HistoryEmptyState";
import { TimeRangeFilter } from "../features/statistics/components/TimeRangeFilter";
import { OverviewCards } from "../features/statistics/components/OverviewCards";
import { BowelFrequencyChart } from "../features/statistics/components/BowelFrequencyChart";
import { BristolChart } from "../features/statistics/components/BristolChart";
import { TagFrequencyList } from "../features/statistics/components/TagFrequencyList";
import { SleepWaterCards } from "../features/statistics/components/SleepWaterCards";
import { ActivityCalendar } from "../features/statistics/components/ActivityCalendar";
import { PinSetup } from "../features/security/PinSetup";
import { LockScreen } from "../features/security/LockScreen";

// Mock data for visual QA — no DB required
const MOCK_WEEK_DATES = [
  "2026-08-16",
  "2026-08-17",
  "2026-08-18",
  "2026-08-19",
  "2026-08-20",
  "2026-08-21",
  "2026-08-22",
];
const MOCK_WEEK_MAP: Record<string, boolean> = {
  "2026-08-16": true,
  "2026-08-17": true,
  "2026-08-18": false,
  "2026-08-19": true,
  "2026-08-20": true,
  "2026-08-21": false,
  "2026-08-22": true,
};

export function QaPage() {
  const [showModal, setShowModal] = useState(false);
  const [showHistoryDetail, setShowHistoryDetail] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [timeRange, setTimeRange] = useState<"7" | "30" | "90" | "365" | "all">("7");
  const [bristol, setBristol] = useState<number | null>(4);
  const [amount, setAmount] = useState<string | null>("medium");
  const [difficulty, setDifficulty] = useState<string | null>("normal");
  const [timeType, setTimeType] = useState<"exact" | "approximate">("exact");
  const [exactTime, setExactTime] = useState(currentTimeInputValue());
  const [approxLabel, setApproxLabel] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-6">
      <div className="mx-auto max-w-[880px] space-y-8">
        <h1 className="text-center text-lg font-bold">QA Responsive Test — All Components</h1>
        <p className="text-center text-xs text-zinc-500">Viewports: 320 375 390 430 768 1024 1440 — check YES/NO, Bristol, Modal, optional, scroll, overflow</p>

        {/* 1. YES/NO */}
        <section data-testid="qa-yesno">
          <h2 className="mb-2 text-sm font-semibold">1. YES / NO controls</h2>
          <CheckinPrompt onYes={() => setShowModal(true)} onNo={() => alert("NO clicked")} />
        </section>

        {/* 2. Streak + Weekly */}
        <section className="grid gap-4 sm:grid-cols-2">
          <StreakBadge streak={5} />
          <WeeklySummary dates={MOCK_WEEK_DATES} map={MOCK_WEEK_MAP} />
        </section>

        {/* 3. Today Summary */}
        <section>
          <h2 className="mb-2 text-sm font-semibold">Today Summary (2 records)</h2>
          <TodaySummary
            count={2}
            records={[
              {
                id: 1,
                daily_checkin_id: 1,
                occurred_at: new Date().toISOString(),
                time_type: "exact",
                approximate_time_label: null,
                bristol_type: 4,
                amount: "medium",
                difficulty: "normal",
                pain_level: null,
                color: null,
                notes: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              } as any,
              {
                id: 2,
                daily_checkin_id: 1,
                occurred_at: null,
                time_type: "approximate",
                approximate_time_label: "Afternoon",
                bristol_type: 3,
                amount: "small",
                difficulty: "easy",
                pain_level: 2,
                color: null,
                notes: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              } as any,
            ]}
          />
        </section>

        {/* 4. Bristol */}
        <section data-testid="qa-bristol">
          <h2 className="mb-2 text-sm font-semibold">2. Bristol selector (7 types)</h2>
          <Card>
            <BristolSelector value={bristol} onChange={setBristol} />
          </Card>
        </section>

        {/* 5. Amount + Difficulty */}
        <section className="grid gap-4 sm:grid-cols-2" data-testid="qa-amount-difficulty">
          <Card>
            <p className="mb-2 text-sm font-semibold">Amount</p>
            <AmountSelector value={amount} onChange={setAmount} />
          </Card>
          <Card>
            <p className="mb-2 text-sm font-semibold">Difficulty</p>
            <DifficultySelector value={difficulty} onChange={setDifficulty} />
          </Card>
        </section>

        {/* 6. Time */}
        <section data-testid="qa-time">
          <h2 className="mb-2 text-sm font-semibold">3. Time selector</h2>
          <Card>
            <TimeSelector
              timeType={timeType}
              exactTime={exactTime}
              approxLabel={approxLabel}
              onChangeType={setTimeType}
              onChangeExact={setExactTime}
              onChangeApprox={setApproxLabel}
            />
          </Card>
        </section>

        {/* 7. Modal */}
        <section>
          <Button onClick={() => setShowModal(true)}>Open Modal (BowelLogForm mock)</Button>
          <Modal open={showModal} onClose={() => setShowModal(false)} title="Log bowel movement">
            <div className="space-y-4">
              <Card>
                <p className="mb-2 text-sm font-semibold">Time *</p>
                <TimeSelector
                  timeType={timeType}
                  exactTime={exactTime}
                  approxLabel={approxLabel}
                  onChangeType={setTimeType}
                  onChangeExact={setExactTime}
                  onChangeApprox={setApproxLabel}
                />
              </Card>
              <Card>
                <p className="mb-2 text-sm font-semibold">Bristol *</p>
                <BristolSelector value={bristol} onChange={setBristol} />
              </Card>
              <Card>
                <p className="mb-2 text-sm font-semibold">Amount *</p>
                <AmountSelector value={amount} onChange={setAmount} />
              </Card>
              <Card>
                <p className="mb-2 text-sm font-semibold">Difficulty *</p>
                <DifficultySelector value={difficulty} onChange={setDifficulty} />
              </Card>
              <div className="flex gap-2">
                <Button fullWidth>Save Now</Button>
                <Button variant="secondary" onClick={() => setShowOptional((v) => !v)} aria-expanded={showOptional}>
                  {showOptional ? "Hide details" : "Continue Adding Details"}
                </Button>
              </div>
              {showOptional && (
                <div className="space-y-4">
                  <Card>
                    <p className="text-sm font-semibold">Pain 0–10</p>
                    <p className="text-xs text-zinc-500">Optional slider + chips</p>
                  </Card>
                  <Card>
                    <p className="text-sm font-semibold">Symptoms / Food / Meds / Exercise</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {["Bloating", "Gas", "Urgency", "Dairy", "Spicy", "Walking"].map((n) => (
                        <span key={n} className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs">
                          {n}
                        </span>
                      ))}
                    </div>
                  </Card>
                  <Card>
                    <p className="text-sm font-semibold">Sleep / Water / Notes</p>
                    <p className="text-xs text-zinc-500">Vertical scroll test — long content</p>
                    <div className="mt-2 h-40 rounded bg-zinc-100 flex items-center justify-center text-xs text-zinc-500">Scrollable content area</div>
                  </Card>
                  <Button fullWidth>Save</Button>
                </div>
              )}
            </div>
          </Modal>
        </section>

        {/* 8. History */}
        <section data-testid="qa-history">
          <h2 className="mb-2 text-sm font-semibold">8. History — day cards (newest first)</h2>
          <div className="space-y-3">
            <HistoryDayCard
              checkin={{ id: 101, date: "2026-08-22", completed: 1, has_bowel_movement: 1, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }}
              records={[
                { id: 1, daily_checkin_id: 101, occurred_at: new Date().toISOString(), time_type: "exact", approximate_time_label: null, bristol_type: 4, amount: "medium", difficulty: "normal", pain_level: 1, color: null, notes: "Note example", created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any,
                { id: 2, daily_checkin_id: 101, occurred_at: null, time_type: "approximate", approximate_time_label: "Afternoon", bristol_type: 3, amount: "small", difficulty: "very_easy" as any, pain_level: null, color: null, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any,
              ]}
              onRecordClick={() => setShowHistoryDetail(true)}
            />
            <HistoryDayCard
              checkin={{ id: 102, date: "2026-08-21", completed: 1, has_bowel_movement: 0, recorded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }}
              records={[]}
              onRecordClick={() => {}}
            />
          </div>
          <div className="mt-4">
            <HistoryEmptyState />
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => setShowHistoryDetail(true)}>Open Detail Modal</Button>
            <Button variant="secondary" onClick={() => setShowDeleteConfirm(true)}>
              Open Delete Confirm
            </Button>
          </div>
          <Modal open={showHistoryDetail} onClose={() => setShowHistoryDetail(false)} title="Bowel record detail">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-zinc-50 p-3">
                  <p className="text-xs font-semibold uppercase text-zinc-500">Time</p>
                  <p className="mt-1 font-medium">08:15 · Type 4</p>
                </div>
                <div className="rounded-xl bg-zinc-50 p-3">
                  <p className="text-xs font-semibold uppercase text-zinc-500">Bristol</p>
                  <p className="mt-1 font-medium">Type 4 — Sausage, smooth</p>
                </div>
              </div>
              <Card>
                <p className="text-xs font-semibold uppercase">Pain</p>
                <p className="text-sm">2 / 10</p>
              </Card>
              <Card>
                <p className="text-xs font-semibold uppercase">Tags</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-zinc-100 border px-2.5 py-1 text-xs">Bloating (symptom)</span>
                  <span className="rounded-full bg-zinc-100 border px-2.5 py-1 text-xs">Coffee (food)</span>
                </div>
              </Card>
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1">
                  Edit
                </Button>
                <Button variant="danger" className="flex-1" onClick={() => setShowDeleteConfirm(true)}>
                  Delete
                </Button>
              </div>
            </div>
          </Modal>
          <ConfirmDialog
            open={showDeleteConfirm}
            title="Delete this bowel record?"
            message="This action cannot be undone."
            confirmLabel="Delete"
            cancelLabel="Cancel"
            onConfirm={() => setShowDeleteConfirm(false)}
            onCancel={() => setShowDeleteConfirm(false)}
          />
        </section>

        {/* 9. Statistics */}
        <section data-testid="qa-statistics">
          <h2 className="mb-2 text-sm font-semibold">9. Statistics — overview + charts + calendar</h2>
          <div className="space-y-4">
            <TimeRangeFilter value={timeRange} onChange={setTimeRange as any} />
            <OverviewCards
              stats={{
                totalBowelMovements: 12,
                daysWithBM: 8,
                daysWithoutBM: 3,
                daysNotRecorded: 2,
                avgPerLoggedDay: 1.1,
                currentStreak: 5,
                longestStreak: 12,
                totalLoggedDays: 11,
              }}
            />
            <BowelFrequencyChart
              data={[
                { date: "2026-08-16", count: 1, status: "bm" },
                { date: "2026-08-17", count: 0, status: "no_bm" },
                { date: "2026-08-18", count: null, status: "no_record" },
                { date: "2026-08-19", count: 2, status: "bm" },
                { date: "2026-08-20", count: 1, status: "bm" },
                { date: "2026-08-21", count: 0, status: "no_bm" },
                { date: "2026-08-22", count: 1, status: "bm" },
              ]}
            />
            <BristolChart data={{ counts: [{ type: 1, count: 1, percentage: 10 }, { type: 2, count: 2, percentage: 20 }, { type: 3, count: 3, percentage: 30 }, { type: 4, count: 4, percentage: 40 }, { type: 5, count: 0, percentage: 0 }, { type: 6, count: 0, percentage: 0 }, { type: 7, count: 0, percentage: 0 }], average: 3.5, total: 10 }} />
            <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-3">
              <TagFrequencyList title="Symptoms" data={[{ tag: { id: 1, category: "symptom", name: "Bloating", is_builtin: 1, created_at: "", updated_at: "" }, count: 5 }, { tag: { id: 2, category: "symptom", name: "Gas", is_builtin: 1, created_at: "", updated_at: "" }, count: 3 }]} />
              <TagFrequencyList title="Foods" data={[{ tag: { id: 3, category: "food", name: "Coffee", is_builtin: 1, created_at: "", updated_at: "" }, count: 4 }]} />
              <TagFrequencyList title="Exercise" data={[]} emptyText="No exercise recorded." />
            </div>
            <SleepWaterCards sleep={{ averageMinutes: 405, qualityCounts: [{ quality: "good", count: 3, percentage: 60 }, { quality: "average", count: 2, percentage: 40 }], total: 5 }} water={{ averageMl: 1200, total: 5 }} />
            <ActivityCalendar
              data={[
                { date: "2026-08-16", status: "bm", count: 1 },
                { date: "2026-08-17", status: "no_bm", count: 0 },
                { date: "2026-08-18", status: "no_record", count: null },
                { date: "2026-08-19", status: "bm", count: 2 },
                { date: "2026-08-20", status: "bm", count: 1 },
                { date: "2026-08-21", status: "no_bm", count: 0 },
                { date: "2026-08-22", status: "bm", count: 1 },
              ]}
            />
          </div>
        </section>

        {/* 10. Security — PIN Setup & Lock Screen */}
        <section data-testid="qa-security">
          <h2 className="mb-2 text-sm font-semibold">10. Security — PIN Setup & Lock Screen</h2>
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-2">
              <p className="mb-2 text-xs font-semibold text-zinc-500">PinSetup preview (isolated)</p>
              <div className="max-h-[500px] overflow-auto rounded-lg border border-zinc-100">
                <PinSetup onComplete={() => {}} onSkip={() => {}} />
              </div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-2">
              <p className="mb-2 text-xs font-semibold text-zinc-500">LockScreen preview (isolated)</p>
              <div className="max-h-[600px] overflow-auto rounded-lg border border-zinc-100">
                <LockScreen onUnlock={() => {}} />
              </div>
            </div>
          </div>
        </section>

        {/* 11. Backup & Restore */}
        <section data-testid="qa-backup">
          <h2 className="mb-2 text-sm font-semibold">11. Backup & Restore</h2>
          <div className="rounded-xl border border-zinc-200 bg-white p-2">
            <p className="mb-2 text-xs font-semibold text-zinc-500">BackupPage preview (isolated)</p>
            <div className="max-h-[800px] overflow-auto rounded-lg border border-zinc-100 p-2">
              <div className="space-y-4">
                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                  <h3 className="text-sm font-semibold">Create Backup</h3>
                  <p className="text-xs text-zinc-600">Backup Password + strength + confirm</p>
                  <div className="mt-2 h-20 rounded bg-zinc-50 flex items-center justify-center text-xs text-zinc-500">BackupPasswordInput preview</div>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                  <h3 className="text-sm font-semibold">Restore Backup</h3>
                  <p className="text-xs text-zinc-600">Select .plog + preview card</p>
                  <div className="mt-2 h-20 rounded bg-zinc-50 flex items-center justify-center text-xs text-zinc-500">BackupPreviewCard preview</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <p className="text-center text-xs text-zinc-400">QA page — no DB, pure layout. Check horizontal overflow, clipping, touch targets ≥44px.</p>
      </div>
    </div>
  );
}
