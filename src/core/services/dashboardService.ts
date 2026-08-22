import { addDaysISO, todayISO } from "../utils/date";
import * as DailyCheckinRepo from "../database/repositories/dailyCheckin.repository";

/** Compute current streak: consecutive completed days ending at today. */
export async function computeStreak(): Promise<number> {
  let streak = 0;
  let cursor = todayISO();
  // guard: max 365
  for (let i = 0; i < 365; i++) {
    const dc = await DailyCheckinRepo.getByDate(cursor);
    if (dc && dc.completed === 1) {
      streak++;
      cursor = addDaysISO(cursor, -1);
    } else {
      break;
    }
  }
  return streak;
}

/** Weekly activity map: date -> completed boolean */
export async function getWeeklyActivity(anchorISO: string): Promise<Record<string, boolean>> {
  const start = addDaysISO(anchorISO, -6);
  const rows = await DailyCheckinRepo.getDateRange(start, anchorISO);
  const map: Record<string, boolean> = {};
  for (const r of rows) map[r.date] = r.completed === 1;
  return map;
}
