import { PoopLog } from '../services/database';
import { differenceInCalendarDays, format, parseISO, startOfDay, subDays } from 'date-fns';

export type TimeFilter = '7days' | '30days' | '90days' | '1year' | 'all';

const FILTER_DAY_COUNTS: Record<Exclude<TimeFilter, 'all'>, number> = {
  '7days': 7,
  '30days': 30,
  '90days': 90,
  '1year': 365,
};

export const getTimeFilterDayCount = (filter: Exclude<TimeFilter, 'all'>): number =>
  FILTER_DAY_COUNTS[filter];

export const filterLogsByTime = (logs: PoopLog[], filter: TimeFilter): PoopLog[] => {
  if (filter === 'all') return logs;

  // Log dates are calendar dates. Comparing them with the current time drops
  // boundary-day records, so use an inclusive calendar-day range instead.
  const today = startOfDay(new Date());
  const cutoff = format(subDays(today, getTimeFilterDayCount(filter) - 1), 'yyyy-MM-dd');
  const end = format(today, 'yyyy-MM-dd');
  return logs.filter(log => log.date >= cutoff && log.date <= end);
};

export const calculateStreaks = (logs: PoopLog[]) => {
  if (logs.length === 0) return { current: 0, longest: 0 };
  
  const uniqueDates = Array.from(new Set(logs.map(l => l.date))).sort();
  const today = startOfDay(new Date());
  const todayString = format(today, 'yyyy-MM-dd');

  let currentStreak = 0;
  let expectedDate = todayString;
  for (let i = uniqueDates.length - 1; i >= 0; i--) {
    const date = uniqueDates[i];
    if (date > todayString) continue;

    if (date === expectedDate) {
      currentStreak++;
      expectedDate = format(subDays(parseISO(expectedDate), 1), 'yyyy-MM-dd');
    } else if (currentStreak === 0 && date === format(subDays(today, 1), 'yyyy-MM-dd')) {
      currentStreak = 1;
      expectedDate = format(subDays(parseISO(date), 1), 'yyyy-MM-dd');
    } else if (date < expectedDate) {
      break;
    }
  }

  let longestStreak = 1;
  let runningStreak = 1;
  for (let i = 1; i < uniqueDates.length; i++) {
    if (differenceInCalendarDays(parseISO(uniqueDates[i]), parseISO(uniqueDates[i - 1])) === 1) {
      runningStreak++;
    } else {
      runningStreak = 1;
    }
    longestStreak = Math.max(longestStreak, runningStreak);
  }

  return { current: currentStreak, longest: longestStreak };
};

export const calculateAverageBristol = (logs: PoopLog[]) => {
  const bmLogs = logs.filter(l => l.hasBowelMovement !== false && l.bristolType !== undefined);
  if (bmLogs.length === 0) return 0;
  const sum = bmLogs.reduce((acc, log) => acc + (log.bristolType || 0), 0);
  return Math.round((sum / bmLogs.length) * 10) / 10;
};

export const calculateAverageDailyFrequency = (logs: PoopLog[], daysCount: number) => {
  const bmLogs = logs.filter(l => l.hasBowelMovement !== false);
  if (daysCount === 0) return 0;
  return Math.round((bmLogs.length / daysCount) * 10) / 10;
};

export const calculateMostCommon = <T extends string | number>(items: T[]): T | null => {
  if (items.length === 0) return null;
  const counts = new Map<T, number>();
  let maxCount = 0;
  let mostCommon: T | null = null;
  
  for (const item of items) {
    if (item === undefined || item === 'Not Sure' || item === 'Unknown' || item === 'Skipped' || item === 'None' || item === "I don't remember") continue;
    const count = (counts.get(item) || 0) + 1;
    counts.set(item, count);
    if (count > maxCount) {
      maxCount = count;
      mostCommon = item;
    }
  }
  return mostCommon;
};

export const calculateDistribution = <T extends string | number>(items: T[]) => {
  const counts = new Map<T, number>();
  for (const item of items) {
    if (item === undefined || item === 'Not Sure' || item === 'Unknown' || item === 'Skipped' || item === 'None' || item === "I don't remember") continue;
    counts.set(item, (counts.get(item) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
};

export const calculateMostCommonTime = (logs: PoopLog[]) => {
  const bmLogs = logs.filter(l => l.hasBowelMovement !== false && l.time);
  if (bmLogs.length === 0) return 'N/A';
  const times = bmLogs.map(l => {
    if (l.timeType === 'approximate' && l.timeLabel) return l.timeLabel;
    const [h] = (l.time || '00:00').split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:00 ${ampm}`;
  });
  const mostCommonHour = calculateMostCommon(times);
  if (mostCommonHour === null) return 'N/A';
  return mostCommonHour;
};
