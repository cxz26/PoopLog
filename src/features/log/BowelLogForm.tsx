import { useEffect, useState } from "react";
import { Button } from "../../shared/components/Button";
import { Card } from "../../shared/components/Card";
import { Chip } from "../../shared/components/Chip";
import { TimeSelector } from "./components/TimeSelector";
import { BristolSelector } from "./components/BristolSelector";
import { AmountSelector } from "./components/AmountSelector";
import { DifficultySelector } from "./components/DifficultySelector";
import { currentTimeInputValue, timeInputToISO } from "../../core/utils/date";
import * as TagRepo from "../../core/database/repositories/tag.repository";
import * as BowelRecordRepo from "../../core/database/repositories/bowelRecord.repository";
import * as DailyCheckinRepo from "../../core/database/repositories/dailyCheckin.repository";
import type { Tag } from "../../core/types/entities";

interface Props {
  dateISO: string; // YYYY-MM-DD
  dailyCheckinId: number;
  onClose: () => void;
  onSaved: () => void;
}

export function BowelLogForm({ dateISO, dailyCheckinId, onClose, onSaved }: Props) {
  // Required
  const [timeType, setTimeType] = useState<"exact" | "approximate">("exact");
  const [exactTime, setExactTime] = useState(currentTimeInputValue());
  const [approxLabel, setApproxLabel] = useState<string | null>(null);
  const [bristol, setBristol] = useState<number | null>(null);
  const [amount, setAmount] = useState<string | null>(null); // null means Not Sure
  const [difficulty, setDifficulty] = useState<string | null>(null);
  // Track if user has explicitly chosen amount/difficulty (including Not Sure)
  const [amountChosen, setAmountChosen] = useState(false);
  const [difficultyChosen, setDifficultyChosen] = useState(false);

  // Optional
  const [pain, setPain] = useState<number | null>(null);
  const [sleepHours, setSleepHours] = useState<string>("");
  const [sleepMins, setSleepMins] = useState<string>("");
  const [waterMl, setWaterMl] = useState<string>("");
  const [notes, setNotes] = useState("");

  // Tags
  const [symptomTags, setSymptomTags] = useState<Tag[]>([]);
  const [foodTags, setFoodTags] = useState<Tag[]>([]);
  const [medTags, setMedTags] = useState<Tag[]>([]);
  const [exerciseTags, setExerciseTags] = useState<Tag[]>([]);
  const [selectedSymptoms, setSelectedSymptoms] = useState<number[]>([]);
  const [selectedFoods, setSelectedFoods] = useState<number[]>([]);
  const [selectedMeds, setSelectedMeds] = useState<number[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<number[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOptional, setShowOptional] = useState(false);

  useEffect(() => {
    // Load tags — use what exists, if missing we still allow saving with zero
    TagRepo.getByCategory("symptom").then(setSymptomTags).catch(() => {});
    TagRepo.getByCategory("food").then(setFoodTags).catch(() => {});
    TagRepo.getByCategory("medication").then(setMedTags).catch(() => {});
    TagRepo.getByCategory("exercise").then(setExerciseTags).catch(() => {});
  }, []);

  const requiredOk = bristol !== null && amountChosen && difficultyChosen && (timeType === "exact" ? !!exactTime : !!approxLabel);

  const handleAmount = (v: string | null) => {
    setAmount(v);
    setAmountChosen(true);
  };
  const handleDifficulty = (v: string | null) => {
    setDifficulty(v);
    setDifficultyChosen(true);
  };

  const toggle = (arr: number[], id: number, setter: (a: number[]) => void) => {
    if (arr.includes(id)) setter(arr.filter((x) => x !== id));
    else setter([...arr, id]);
  };

  const handleSave = async () => {
    if (!requiredOk) {
      setError("Please complete Time, Bristol Type, Amount and Difficulty.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const occurredAt = timeType === "exact" ? timeInputToISO(dateISO, exactTime) : null;
      const tagIds = [...selectedSymptoms, ...selectedFoods, ...selectedMeds, ...selectedExercises];

      // Create bowel record (transactional with tags)
      await BowelRecordRepo.createWithTags(
        {
          daily_checkin_id: dailyCheckinId,
          occurred_at: occurredAt,
          time_type: timeType,
          approximate_time_label: timeType === "approximate" ? (approxLabel as any) : null,
          bristol_type: bristol,
          amount: amount as any,
          difficulty: difficulty as any,
          pain_level: pain,
          notes: notes || null,
        },
        tagIds,
      );

      // Optional sleep/water — per daily_checkin
      if (sleepHours || sleepMins) {
        const h = parseInt(sleepHours || "0", 10);
        const m = parseInt(sleepMins || "0", 10);
        const total = (Number.isNaN(h) ? 0 : h) * 60 + (Number.isNaN(m) ? 0 : m);
        if (total > 0) {
          if (total < 0 || total > 24 * 60) throw new Error("Sleep must be 0–1440 minutes");
          await DailyCheckinRepo.setSleep(dailyCheckinId, total, null);
        }
      }
      if (waterMl) {
        const ml = parseInt(waterMl, 10);
        if (!Number.isNaN(ml) && ml >= 0) {
          // If water already exists, we overwrite with latest value (simple)
          const existing = await DailyCheckinRepo.getWater(dailyCheckinId);
          const newTotal = existing ? ml : ml; // for now just set to entered value
          await DailyCheckinRepo.setWater(dailyCheckinId, newTotal);
        }
      }

      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Required section */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Required</h3>

        <Card className="p-4">
          <p className="mb-3 text-sm font-semibold text-zinc-900">
            Time <span className="text-red-600">*</span>
          </p>
          <TimeSelector
            timeType={timeType}
            exactTime={exactTime}
            approxLabel={approxLabel}
            onChangeType={setTimeType}
            onChangeExact={setExactTime}
            onChangeApprox={setApproxLabel}
          />
        </Card>

        <Card className="p-4">
          <p className="mb-3 text-sm font-semibold text-zinc-900">
            Bristol Type <span className="text-red-600">*</span>
          </p>
          <BristolSelector value={bristol} onChange={setBristol} />
        </Card>

        <Card className="p-4">
          <p className="mb-3 text-sm font-semibold text-zinc-900">
            Amount <span className="text-red-600">*</span>
          </p>
          <AmountSelector value={amount} onChange={handleAmount} />
          <p className="mt-2 text-xs text-zinc-500">Choose Not Sure if you're unsure — still counts as completed.</p>
        </Card>

        <Card className="p-4">
          <p className="mb-3 text-sm font-semibold text-zinc-900">
            Difficulty <span className="text-red-600">*</span>
          </p>
          <DifficultySelector value={difficulty} onChange={handleDifficulty} />
        </Card>
      </div>

      {/* Quick save */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button fullWidth size="lg" onClick={handleSave} disabled={saving || !requiredOk} aria-label="Save bowel record">
          {saving ? "Saving…" : "Save Now"}
        </Button>
        <Button variant="secondary" size="lg" onClick={() => setShowOptional((v) => !v)} className="sm:w-auto" aria-expanded={showOptional}>
          {showOptional ? "Hide details" : "Continue Adding Details"}
        </Button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Optional */}
      {showOptional && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Optional — skip anything you don't need</h3>

          <Card className="p-4">
            <p className="mb-2 text-sm font-semibold text-zinc-900">Pain (0–10)</p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={10}
                value={pain ?? 0}
                onChange={(e) => setPain(parseInt(e.target.value, 10))}
                className="flex-1 accent-zinc-900"
                aria-label="Pain level"
              />
              <span className="w-10 text-center text-sm font-bold">{pain ?? "—"}</span>
              <Button variant="ghost" size="sm" onClick={() => setPain(null)}>
                Skip
              </Button>
            </div>
          </Card>

          <Card className="p-4">
            <p className="mb-2 text-sm font-semibold text-zinc-900">Symptoms</p>
            <div className="flex flex-wrap gap-2">
              {symptomTags.length === 0 && <span className="text-xs text-zinc-500">No tags — you can skip.</span>}
              {symptomTags.map((t) => (
                <Chip key={t.id} selected={selectedSymptoms.includes(t.id)} onClick={() => toggle(selectedSymptoms, t.id, setSelectedSymptoms)}>
                  {t.name}
                </Chip>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <p className="mb-2 text-sm font-semibold text-zinc-900">Food</p>
            <div className="flex flex-wrap gap-2">
              {foodTags.map((t) => (
                <Chip key={t.id} selected={selectedFoods.includes(t.id)} onClick={() => toggle(selectedFoods, t.id, setSelectedFoods)}>
                  {t.name}
                </Chip>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <p className="mb-2 text-sm font-semibold text-zinc-900">Medication</p>
            <div className="flex flex-wrap gap-2">
              {medTags.map((t) => (
                <Chip key={t.id} selected={selectedMeds.includes(t.id)} onClick={() => toggle(selectedMeds, t.id, setSelectedMeds)}>
                  {t.name}
                </Chip>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <p className="mb-2 text-sm font-semibold text-zinc-900">Exercise</p>
            <div className="flex flex-wrap gap-2">
              {exerciseTags.map((t) => (
                <Chip key={t.id} selected={selectedExercises.includes(t.id)} onClick={() => toggle(selectedExercises, t.id, setSelectedExercises)}>
                  {t.name}
                </Chip>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <p className="mb-2 text-sm font-semibold text-zinc-900">Sleep</p>
            <div className="flex gap-2">
              <label className="flex-1">
                <span className="text-xs text-zinc-600">Hours</span>
                <input
                  type="number"
                  min={0}
                  max={24}
                  placeholder="6"
                  value={sleepHours}
                  onChange={(e) => setSleepHours(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </label>
              <label className="flex-1">
                <span className="text-xs text-zinc-600">Minutes</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  placeholder="45"
                  value={sleepMins}
                  onChange={(e) => setSleepMins(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </label>
            </div>
            <p className="mt-1 text-xs text-zinc-500">Stored as total minutes (e.g., 6h 45m → 405).</p>
          </Card>

          <Card className="p-4">
            <p className="mb-2 text-sm font-semibold text-zinc-900">Water</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {[250, 500, 750, 1000, 1500, 2000].map((ml) => (
                <button
                  key={ml}
                  onClick={() => setWaterMl(String(ml))}
                  className={`min-h-[36px] rounded-full border px-3 text-sm font-medium ${waterMl === String(ml) ? "bg-zinc-900 text-white border-zinc-900" : "bg-white border-zinc-200 text-zinc-700"}`}
                >
                  {ml >= 1000 ? `${ml / 1000} L` : `${ml} mL`}
                </button>
              ))}
            </div>
            <label>
              <span className="text-xs text-zinc-600">Custom (mL)</span>
              <input
                type="number"
                min={0}
                placeholder="500"
                value={waterMl}
                onChange={(e) => setWaterMl(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </label>
            <p className="mt-1 text-xs text-zinc-500">Stored as milliliters.</p>
          </Card>

          <Card className="p-4">
            <label htmlFor="notes" className="mb-2 block text-sm font-semibold text-zinc-900">
              Notes
            </label>
            <textarea
              id="notes"
              rows={3}
              placeholder="Optional notes…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </Card>

          <Button fullWidth size="lg" onClick={handleSave} disabled={saving || !requiredOk}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
    </div>
  );
}
