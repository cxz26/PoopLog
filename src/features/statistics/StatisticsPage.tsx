import { useEffect, useCallback } from "react";
import { useStatisticsStore } from "../../core/stores/statisticsStore";
import { useAppStore } from "../../core/stores/appStore";
import { todayISO } from "../../core/utils/date";
import { getRangeDates, calculateOverview, calculateDailyFrequency, calculateBristolDistribution, calculateTagFrequency, calculateSleepStats, calculateWaterStats, calculateCalendarData, calculateLongestStreak } from "../../core/services/statisticsService";
import { computeStreak } from "../../core/services/dashboardService";
import * as DailyCheckinRepo from "../../core/database/repositories/dailyCheckin.repository";
import * as BowelRecordRepo from "../../core/database/repositories/bowelRecord.repository";
import * as TagRepo from "../../core/database/repositories/tag.repository";
import { TimeRangeFilter } from "./components/TimeRangeFilter";
import { OverviewCards } from "./components/OverviewCards";
import { BowelFrequencyChart } from "./components/BowelFrequencyChart";
import { BristolChart } from "./components/BristolChart";
import { TagFrequencyList } from "./components/TagFrequencyList";
import { SleepWaterCards } from "./components/SleepWaterCards";
import { ActivityCalendar } from "./components/ActivityCalendar";
import { StatisticsEmptyState } from "./components/StatisticsEmptyState";
import { Button } from "../../shared/components/Button";

export function StatisticsPage({ onBack }: { onBack?: () => void }) {
  const { databaseStatus } = useAppStore();
  const { timeRange, overview, dailyFreq, bristol, symptoms, foods, exercises, sleep, water, calendar, loading, error, setTimeRange, setData, setLoading, setError } = useStatisticsStore();

  const load = useCallback(async () => {
    if (databaseStatus !== "ready") return;
    setLoading(true);
    try {
      const today = todayISO();
      const allCheckins = await DailyCheckinRepo.getAll();
      const rangeDates = getRangeDates(timeRange, today, allCheckins);

      // If All Time and no data, show empty
      if (rangeDates.length === 0) {
        setData({
          overview: null,
          dailyFreq: [],
          bristol: null,
          symptoms: [],
          foods: [],
          exercises: [],
          sleep: null,
          water: null,
          calendar: [],
        });
        setError(null);
        return;
      }

      // Fetch relevant checkins in range + all records for those checkins
      const rangeSet = new Set(rangeDates);
      const checkinsInRange = allCheckins.filter((c) => rangeSet.has(c.date));

      // Fetch bowel records for checkins in range
      const allBowelRecords: import("../../core/types/entities").BowelRecord[] = [];
      for (const c of checkinsInRange) {
        const recs = await BowelRecordRepo.getByDailyCheckin(c.id);
        allBowelRecords.push(...recs);
      }

      // Fetch tags and junction for records in range
      const allTags = await TagRepo.getAll();
      // Need bowel_record_tags for those records
      const allJunction: { bowel_record_id: number; tag_id: number }[] = [];
      for (const r of allBowelRecords) {
        const tags = await BowelRecordRepo.getTags(r.id);
        for (const t of tags) allJunction.push({ bowel_record_id: r.id, tag_id: t.id });
      }

      // Fetch sleep/water for checkins in range
      const sleepRecords: { total_minutes: number; quality: string | null }[] = [];
      const waterRecords: { total_ml: number }[] = [];
      for (const c of checkinsInRange) {
        const s = await DailyCheckinRepo.getSleep(c.id);
        if (s) sleepRecords.push({ total_minutes: s.total_minutes, quality: s.quality });
        const w = await DailyCheckinRepo.getWater(c.id);
        if (w) waterRecords.push({ total_ml: w.total_ml });
      }

      const currentStreak = await computeStreak();
      const longestStreak = calculateLongestStreak(allCheckins);

      const overview = calculateOverview(checkinsInRange, allBowelRecords, rangeDates, currentStreak, longestStreak);
      const dailyFreq = calculateDailyFrequency(checkinsInRange, allBowelRecords, rangeDates);
      const bristol = calculateBristolDistribution(allBowelRecords);
      const symptoms = calculateTagFrequency(allTags, allJunction, "symptom");
      const foods = calculateTagFrequency(allTags, allJunction, "food");
      const exercises = calculateTagFrequency(allTags, allJunction, "exercise");
      const sleep = calculateSleepStats(sleepRecords);
      const water = calculateWaterStats(waterRecords);
      const calendar = calculateCalendarData(dailyFreq);

      setData({ overview, dailyFreq, bristol, symptoms, foods, exercises, sleep, water, calendar });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [databaseStatus, timeRange, setData, setError, setLoading]);

  useEffect(() => {
    load();
  }, [load]);

  if (databaseStatus !== "ready") {
    return <div className="p-6 text-center text-sm text-zinc-600">Database not ready</div>;
  }

  if (loading) {
    return <div className="p-6 text-center text-sm text-zinc-600" aria-live="polite">Loading statistics…</div>;
  }

  const hasAnyData = overview != null && overview.totalLoggedDays > 0;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-[880px] px-4 py-6 sm:px-6">
        <div className="mb-6 flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back to dashboard">
              ← Back
            </Button>
          )}
          <h1 className="text-lg font-bold text-zinc-900">Statistics</h1>
          <span className="ml-auto text-xs text-zinc-500">{hasAnyData ? `${overview?.totalLoggedDays} logged days` : "No data"}</span>
        </div>

        <div className="mb-6">
          <TimeRangeFilter value={timeRange} onChange={setTimeRange} />
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {!hasAnyData ? (
          <StatisticsEmptyState />
        ) : (
          <div className="space-y-4">
            {overview && <OverviewCards stats={overview} />}
            <BowelFrequencyChart data={dailyFreq} />
            {bristol && <BristolChart data={bristol} />}
            <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-3">
              <TagFrequencyList title="Symptoms" data={symptoms} emptyText="No symptoms recorded." />
              <TagFrequencyList title="Foods" data={foods} emptyText="No foods recorded." />
              <TagFrequencyList title="Exercise" data={exercises} emptyText="No exercise recorded." />
            </div>
            <SleepWaterCards sleep={sleep} water={water} />
            <ActivityCalendar data={calendar} />
          </div>
        )}

        <p className="mt-8 text-center text-xs text-zinc-400">Statistics from daily check-ins + bowel records. Missing days are not counted as 0.</p>
      </div>
    </div>
  );
}
