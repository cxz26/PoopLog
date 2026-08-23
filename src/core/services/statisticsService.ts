import { addDaysISO } from "../utils/date";
import type { DailyCheckin, BowelRecord, Tag } from "../types/entities";

export type TimeRange = "7" | "30" | "90" | "365" | "all";

export function getRangeDates(range: TimeRange, today: string, allCheckins?: DailyCheckin[]): string[] {
  if (range === "all") {
    if (!allCheckins || allCheckins.length === 0) {
      // No data: return last 7 days as fallback for empty state handling, caller will show empty
      return [];
    }
    const earliest = allCheckins.reduce((min, c) => (c.date < min ? c.date : min), allCheckins[0].date);
    const days: string[] = [];
    let cur = earliest;
    while (cur <= today) {
      days.push(cur);
      cur = addDaysISO(cur, 1);
      if (days.length > 2000) break; // safety for all time
    }
    return days;
  }
  const n = parseInt(range, 10);
  const start = addDaysISO(today, -(n - 1));
  const days: string[] = [];
  for (let i = 0; i < n; i++) days.push(addDaysISO(start, i));
  return days;
}

// Overview
export interface OverviewStats {
  totalBowelMovements: number;
  daysWithBM: number;
  daysWithoutBM: number;
  daysNotRecorded: number;
  avgPerLoggedDay: number | null;
  currentStreak: number;
  longestStreak: number;
  totalLoggedDays: number;
}

export function calculateOverview(
  checkins: DailyCheckin[],
  bowelRecords: BowelRecord[],
  rangeDates: string[],
  currentStreak: number,
  longestStreak: number,
): OverviewStats {
  const map = new Map(checkins.map((c) => [c.date, c]));
  let daysWithBM = 0;
  let daysWithoutBM = 0;
  let totalBM = bowelRecords.length; // total bowel movements in range = records count (already filtered by range dates via checkin ids)

  // For rangeDates, count logged vs not recorded
  for (const d of rangeDates) {
    const c = map.get(d);
    if (!c || c.completed !== 1) {
      // not recorded — counted later
      continue;
    }
    if (c.has_bowel_movement === 1) daysWithBM++;
    else if (c.has_bowel_movement === 0) daysWithoutBM++;
  }
  const totalLoggedDays = daysWithBM + daysWithoutBM;
  const daysNotRecorded = rangeDates.length - totalLoggedDays;
  const avgPerLoggedDay = totalLoggedDays > 0 ? totalBM / totalLoggedDays : null;

  return {
    totalBowelMovements: totalBM,
    daysWithBM,
    daysWithoutBM,
    daysNotRecorded: Math.max(0, daysNotRecorded),
    avgPerLoggedDay,
    currentStreak,
    longestStreak,
    totalLoggedDays,
  };
}

export function calculateLongestStreak(checkins: DailyCheckin[]): number {
  // Sort by date asc, then find longest consecutive completed streak
  const sorted = [...checkins].filter((c) => c.completed === 1).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (sorted.length === 0) return 0;
  let longest = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].date;
    const cur = sorted[i].date;
    if (addDaysISO(prev, 1) === cur) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }
  return longest;
}

// Daily frequency
export interface DailyFrequency {
  date: string;
  count: number | null; // null = no record, 0 = no BM, 1+ = BM count
  status: "bm" | "no_bm" | "no_record";
}

export function calculateDailyFrequency(
  checkins: DailyCheckin[],
  bowelRecords: BowelRecord[],
  rangeDates: string[],
): DailyFrequency[] {
  const checkinMap = new Map(checkins.map((c) => [c.date, c]));
  const countMap = new Map<string, number>();
  // Build count per date via daily_checkin_id -> date
  const idToDate = new Map<number, string>();
  for (const c of checkins) idToDate.set(c.id, c.date);
  for (const r of bowelRecords) {
    const d = idToDate.get(r.daily_checkin_id);
    if (!d) continue;
    countMap.set(d, (countMap.get(d) || 0) + 1);
  }

  return rangeDates.map((date) => {
    const c = checkinMap.get(date);
    if (!c || c.completed !== 1) return { date, count: null, status: "no_record" as const };
    if (c.has_bowel_movement === 1) {
      const cnt = countMap.get(date) ?? 0;
      return { date, count: cnt, status: "bm" as const };
    }
    // has_bowel_movement === 0 or null (treated as no BM if completed)
    return { date, count: 0, status: "no_bm" as const };
  });
}

// Bristol
export interface BristolDistribution {
  counts: { type: number; count: number; percentage: number }[];
  average: number | null;
  total: number;
}

export function calculateBristolDistribution(records: BowelRecord[]): BristolDistribution {
  const filtered = records.filter((r) => r.bristol_type != null);
  const total = filtered.length;
  const counts = Array.from({ length: 7 }, (_, i) => {
    const type = i + 1;
    const count = filtered.filter((r) => r.bristol_type === type).length;
    const percentage = total > 0 ? (count / total) * 100 : 0;
    return { type, count, percentage };
  });
  const average = total > 0 ? filtered.reduce((sum, r) => sum + (r.bristol_type ?? 0), 0) / total : null;
  return { counts, average, total };
}

// Tag frequency (symptoms, foods, exercise)
export interface TagFrequency {
  tag: Tag;
  count: number;
}

export function calculateTagFrequency(
  allTags: Tag[],
  bowelRecordTags: { bowel_record_id: number; tag_id: number }[],
  filterCategory: Tag["category"],
): TagFrequency[] {
  const tagMap = new Map(allTags.filter((t) => t.category === filterCategory).map((t) => [t.id, t]));
  const countMap = new Map<number, number>();
  for (const j of bowelRecordTags) {
    if (!tagMap.has(j.tag_id)) continue;
    countMap.set(j.tag_id, (countMap.get(j.tag_id) || 0) + 1);
  }
  const result: TagFrequency[] = [];
  for (const [id, count] of countMap.entries()) {
    const tag = tagMap.get(id);
    if (tag) result.push({ tag, count });
  }
  result.sort((a, b) => b.count - a.count);
  return result;
}

// Sleep
export interface SleepStats {
  averageMinutes: number | null;
  qualityCounts: { quality: string; count: number; percentage: number }[];
  total: number;
}

export function calculateSleepStats(
  sleepRecords: { total_minutes: number; quality: string | null }[],
): SleepStats {
  const total = sleepRecords.length;
  const averageMinutes = total > 0 ? sleepRecords.reduce((sum, s) => sum + s.total_minutes, 0) / total : null;
  const qualities = ["poor", "average", "good", "excellent"];
  const qualityCounts = qualities.map((q) => {
    const count = sleepRecords.filter((s) => s.quality === q).length;
    const percentage = total > 0 ? (count / total) * 100 : 0;
    return { quality: q, count, percentage };
  });
  // Only return those with count>0 for display, but keep all for completeness
  return { averageMinutes, qualityCounts: qualityCounts.filter((x) => x.count > 0), total };
}

// Water
export interface WaterStats {
  averageMl: number | null;
  total: number;
}

export function calculateWaterStats(waterRecords: { total_ml: number }[]): WaterStats {
  const total = waterRecords.length;
  const averageMl = total > 0 ? waterRecords.reduce((sum, w) => sum + w.total_ml, 0) / total : null;
  return { averageMl, total };
}

// Activity calendar data
export interface CalendarDay {
  date: string;
  status: "bm" | "no_bm" | "no_record";
  count: number | null;
}

export function calculateCalendarData(
  dailyFreq: DailyFrequency[],
): CalendarDay[] {
  return dailyFreq.map((d) => ({ date: d.date, status: d.status, count: d.count }));
}

// Streak helpers are in dashboardService; import there when needed
