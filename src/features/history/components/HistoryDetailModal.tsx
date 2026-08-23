import { useEffect, useState } from "react";
import { Modal } from "../../../shared/components/Modal";
import { Button } from "../../../shared/components/Button";
import { ConfirmDialog } from "../../../shared/components/ConfirmDialog";
import { TimeSelector } from "../../log/components/TimeSelector";
import { BristolSelector } from "../../log/components/BristolSelector";
import { AmountSelector } from "../../log/components/AmountSelector";
import { DifficultySelector } from "../../log/components/DifficultySelector";
import { Chip } from "../../../shared/components/Chip";
import { Card } from "../../../shared/components/Card";
import { currentTimeInputValue, isoToTimeLabel, timeInputToISO } from "../../../core/utils/date";
import * as BowelRecordRepo from "../../../core/database/repositories/bowelRecord.repository";
import * as TagRepo from "../../../core/database/repositories/tag.repository";
import * as DailyCheckinRepo from "../../../core/database/repositories/dailyCheckin.repository";
import type { BowelRecord, Tag } from "../../../core/types/entities";

interface Props {
  open: boolean;
  record: BowelRecord | null;
  dailyCheckinId: number | null;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}

export function HistoryDetailModal({ open, record, dailyCheckinId, onClose, onUpdated, onDeleted }: Props) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [recordTags, setRecordTags] = useState<Tag[]>([]);
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);
  const [waterMl, setWaterMl] = useState<number | null>(null);

  // Edit form state
  const [timeType, setTimeType] = useState<"exact" | "approximate">("exact");
  const [exactTime, setExactTime] = useState(currentTimeInputValue());
  const [approxLabel, setApproxLabel] = useState<string | null>(null);
  const [bristol, setBristol] = useState<number | null>(null);
  const [amount, setAmount] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<string | null>(null);
  const [pain, setPain] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [sleepH, setSleepH] = useState("");
  const [sleepM, setSleepM] = useState("");
  const [water, setWater] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [allSymptomTags, setAllSymptomTags] = useState<Tag[]>([]);
  const [allFoodTags, setAllFoodTags] = useState<Tag[]>([]);
  const [allMedTags, setAllMedTags] = useState<Tag[]>([]);
  const [allExerciseTags, setAllExerciseTags] = useState<Tag[]>([]);

  // Load detail data
  useEffect(() => {
    if (!open || !record) return;
    setMode("view");
    setError(null);
    // Load tags for this record
    BowelRecordRepo.getTags(record.id)
      .then(setRecordTags)
      .catch(() => setRecordTags([]));
    // Load all tags for edit
    TagRepo.getByCategory("symptom")
      .then(setAllSymptomTags)
      .catch(() => {});
    TagRepo.getByCategory("food")
      .then(setAllFoodTags)
      .catch(() => {});
    TagRepo.getByCategory("medication")
      .then(setAllMedTags)
      .catch(() => {});
    TagRepo.getByCategory("exercise")
      .then(setAllExerciseTags)
      .catch(() => {});
    // Load sleep/water for the day (if dailyCheckinId provided)
    if (dailyCheckinId) {
      DailyCheckinRepo.getSleep(dailyCheckinId)
        .then((s) => setSleepMinutes(s?.total_minutes ?? null))
        .catch(() => {});
      DailyCheckinRepo.getWater(dailyCheckinId)
        .then((w) => setWaterMl(w?.total_ml ?? null))
        .catch(() => {});
    }
    // Init edit form from record
    setTimeType(record.time_type);
    if (record.time_type === "exact" && record.occurred_at) {
      const d = new Date(record.occurred_at);
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      setExactTime(`${hh}:${mm}`);
      setApproxLabel(null);
    } else if (record.time_type === "approximate") {
      setApproxLabel(record.approximate_time_label);
      setExactTime(currentTimeInputValue());
    } else {
      setExactTime(currentTimeInputValue());
      setApproxLabel(null);
    }
    setBristol(record.bristol_type);
    setAmount(record.amount);
    setDifficulty(record.difficulty);
    setPain(record.pain_level);
    setNotes(record.notes ?? "");
    // tags will be set after fetch
    BowelRecordRepo.getTags(record.id).then((ts) => setSelectedTags(ts.map((t) => t.id)));
    // sleep/water edit fields
    if (dailyCheckinId) {
      DailyCheckinRepo.getSleep(dailyCheckinId).then((s) => {
        if (s) {
          setSleepH(String(Math.floor(s.total_minutes / 60)));
          setSleepM(String(s.total_minutes % 60));
        } else {
          setSleepH("");
          setSleepM("");
        }
      });
      DailyCheckinRepo.getWater(dailyCheckinId).then((w) => {
        setWater(w ? String(w.total_ml) : "");
      });
    }
  }, [open, record, dailyCheckinId]);

  const handleDelete = async () => {
    if (!record) return;
    setSaving(true);
    try {
      await BowelRecordRepo.remove(record.id);
      setShowDeleteConfirm(false);
      onDeleted();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!record) return;
    if (bristol == null || amount == null || difficulty == null) {
      setError("Bristol, Amount and Difficulty are required.");
      return;
    }
    if (timeType === "approximate" && !approxLabel) {
      setError("Choose an approximate time label.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Need date for exact time -> use occurred_at date or today? Use record's occurred_at date if exists, else use daily checkin date? Simpler use today? But we need dailyCheckin date.
      // For edit, we keep occurred_at as ISO derived from original date part + new time.
      let occurredAt: string | null = null;
      if (timeType === "exact") {
        // Use existing occurred_at date part if available, else use today
        const baseDate = record.occurred_at ? record.occurred_at.slice(0, 10) : new Date().toISOString().slice(0, 10);
        // If we have dailyCheckinId, we could fetch its date, but we don't have it here; use baseDate
        occurredAt = timeInputToISO(baseDate, exactTime);
      }
      await BowelRecordRepo.update(record.id, {
        occurred_at: occurredAt,
        time_type: timeType,
        approximate_time_label: timeType === "approximate" ? (approxLabel as any) : null,
        bristol_type: bristol,
        amount: amount as any,
        difficulty: difficulty as any,
        pain_level: pain,
        notes: notes || null,
      });
      // Update tags
      await BowelRecordRepo.setTags(record.id, selectedTags);
      // Update sleep/water if dailyCheckinId
      if (dailyCheckinId) {
        const h = parseInt(sleepH || "0", 10);
        const m = parseInt(sleepM || "0", 10);
        const total = (Number.isNaN(h) ? 0 : h) * 60 + (Number.isNaN(m) ? 0 : m);
        if (sleepH || sleepM) {
          if (total > 0) await DailyCheckinRepo.setSleep(dailyCheckinId, total, null);
          else await DailyCheckinRepo.clearSleep(dailyCheckinId);
        }
        if (water) {
          const ml = parseInt(water, 10);
          if (!Number.isNaN(ml) && ml >= 0) await DailyCheckinRepo.setWater(dailyCheckinId, ml);
        } else {
          // if cleared, remove water
          // keep existing if not edited? For now don't clear if empty
        }
      }
      onUpdated();
      setMode("view");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleTag = (id: number) => {
    setSelectedTags((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  if (!record) return null;

  const timeDisplay = record.time_type === "approximate" ? record.approximate_time_label : isoToTimeLabel(record.occurred_at);

  return (
    <>
      <Modal open={open} onClose={onClose} title={mode === "view" ? "Bowel record detail" : "Edit bowel record"}>
        {mode === "view" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-zinc-50 p-3">
                <p className="text-xs font-semibold uppercase text-zinc-500">Time</p>
                <p className="mt-1 font-medium text-zinc-900">{timeDisplay ?? "—"}</p>
                <p className="text-xs text-zinc-500">{record.time_type === "exact" ? "Exact" : "Approximate"}</p>
              </div>
              <div className="rounded-xl bg-zinc-50 p-3">
                <p className="text-xs font-semibold uppercase text-zinc-500">Bristol</p>
                <p className="mt-1 font-medium text-zinc-900">Type {record.bristol_type ?? "—"}</p>
              </div>
              <div className="rounded-xl bg-zinc-50 p-3">
                <p className="text-xs font-semibold uppercase text-zinc-500">Amount</p>
                <p className="mt-1 font-medium text-zinc-900 capitalize">{record.amount ?? "—"}</p>
              </div>
              <div className="rounded-xl bg-zinc-50 p-3">
                <p className="text-xs font-semibold uppercase text-zinc-500">Difficulty</p>
                <p className="mt-1 font-medium text-zinc-900 capitalize">{record.difficulty ? record.difficulty.replace("_", " ") : "—"}</p>
              </div>
            </div>

            {record.pain_level != null && (
              <Card>
                <p className="text-xs font-semibold uppercase text-zinc-500">Pain</p>
                <p className="mt-1 text-sm text-zinc-900">{record.pain_level} / 10</p>
              </Card>
            )}

            {recordTags.length > 0 && (
              <Card>
                <p className="text-xs font-semibold uppercase text-zinc-500">Tags</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {recordTags.map((t) => (
                    <span key={t.id} className="rounded-full bg-zinc-100 border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700">
                      {t.name} <span className="text-zinc-500">({t.category})</span>
                    </span>
                  ))}
                </div>
              </Card>
            )}

            {sleepMinutes != null && (
              <Card>
                <p className="text-xs font-semibold uppercase text-zinc-500">Sleep</p>
                <p className="mt-1 text-sm text-zinc-900">
                  {Math.floor(sleepMinutes / 60)}h {sleepMinutes % 60}m ({sleepMinutes} min)
                </p>
              </Card>
            )}

            {waterMl != null && (
              <Card>
                <p className="text-xs font-semibold uppercase text-zinc-500">Water</p>
                <p className="mt-1 text-sm text-zinc-900">{waterMl >= 1000 ? `${waterMl / 1000} L` : `${waterMl} mL`}</p>
              </Card>
            )}

            {record.notes && (
              <Card>
                <p className="text-xs font-semibold uppercase text-zinc-500">Notes</p>
                <p className="mt-1 text-sm text-zinc-900 whitespace-pre-wrap">{record.notes}</p>
              </Card>
            )}

            {error && (
              <p role="alert" className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="secondary" onClick={() => setMode("edit")} className="flex-1">
                Edit
              </Button>
              <Button variant="danger" onClick={() => setShowDeleteConfirm(true)} aria-label={`Delete bowel record ${record.id}`} className="flex-1">
                Delete
              </Button>
            </div>
          </div>
        ) : (
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

            <Card>
              <p className="mb-2 text-sm font-semibold">Pain (0–10)</p>
              <div className="flex items-center gap-3">
                <input type="range" min={0} max={10} value={pain ?? 0} onChange={(e) => setPain(parseInt(e.target.value, 10))} className="flex-1 accent-zinc-900" aria-label="Pain level" />
                <span className="w-10 text-center text-sm font-bold">{pain ?? "—"}</span>
                <Button variant="ghost" size="sm" onClick={() => setPain(null)}>
                  Skip
                </Button>
              </div>
            </Card>

            <Card>
              <p className="mb-2 text-sm font-semibold">Symptoms</p>
              <div className="flex flex-wrap gap-2">
                {allSymptomTags.map((t) => (
                  <Chip key={t.id} selected={selectedTags.includes(t.id)} onClick={() => toggleTag(t.id)}>
                    {t.name}
                  </Chip>
                ))}
              </div>
            </Card>
            <Card>
              <p className="mb-2 text-sm font-semibold">Food</p>
              <div className="flex flex-wrap gap-2">
                {allFoodTags.map((t) => (
                  <Chip key={t.id} selected={selectedTags.includes(t.id)} onClick={() => toggleTag(t.id)}>
                    {t.name}
                  </Chip>
                ))}
              </div>
            </Card>
            <Card>
              <p className="mb-2 text-sm font-semibold">Medication</p>
              <div className="flex flex-wrap gap-2">
                {allMedTags.map((t) => (
                  <Chip key={t.id} selected={selectedTags.includes(t.id)} onClick={() => toggleTag(t.id)}>
                    {t.name}
                  </Chip>
                ))}
              </div>
            </Card>
            <Card>
              <p className="mb-2 text-sm font-semibold">Exercise</p>
              <div className="flex flex-wrap gap-2">
                {allExerciseTags.map((t) => (
                  <Chip key={t.id} selected={selectedTags.includes(t.id)} onClick={() => toggleTag(t.id)}>
                    {t.name}
                  </Chip>
                ))}
              </div>
            </Card>

            <Card>
              <p className="mb-2 text-sm font-semibold">Sleep</p>
              <div className="flex gap-2">
                <label className="flex-1">
                  <span className="text-xs text-zinc-600">Hours</span>
                  <input type="number" min={0} max={24} value={sleepH} onChange={(e) => setSleepH(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
                </label>
                <label className="flex-1">
                  <span className="text-xs text-zinc-600">Minutes</span>
                  <input type="number" min={0} max={59} value={sleepM} onChange={(e) => setSleepM(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
                </label>
              </div>
            </Card>
            <Card>
              <p className="mb-2 text-sm font-semibold">Water</p>
              <input type="number" min={0} placeholder="mL" value={water} onChange={(e) => setWater(e.target.value)} className="w-full rounded-xl border border-zinc-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
            </Card>

            <Card>
              <label htmlFor="edit-notes" className="mb-2 block text-sm font-semibold">
                Notes
              </label>
              <textarea id="edit-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-xl border border-zinc-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900" />
            </Card>

            {error && (
              <p role="alert" className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setMode("view")} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={saving} className="flex-1" aria-label="Save edited bowel record">
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete this bowel record?"
        message="This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}
