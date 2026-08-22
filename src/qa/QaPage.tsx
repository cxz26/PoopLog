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
import { Button } from "../shared/components/Button";
import { Card } from "../shared/components/Card";
import { currentTimeInputValue } from "../core/utils/date";

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
  const [showOptional, setShowOptional] = useState(false);
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

        <p className="text-center text-xs text-zinc-400">QA page — no DB, pure layout. Check horizontal overflow, clipping, touch targets ≥44px.</p>
      </div>
    </div>
  );
}
