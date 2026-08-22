import { create } from "zustand";
import type { DailyCheckin, BowelRecord } from "../types/entities";

interface DashboardState {
  today: string; // YYYY-MM-DD
  dailyCheckin: DailyCheckin | null;
  bowelRecords: BowelRecord[];
  streak: number;
  weeklyMap: Record<string, boolean>;
  loading: boolean;
  error: string | null;
  setToday: (d: string) => void;
  setDailyCheckin: (dc: DailyCheckin | null) => void;
  setBowelRecords: (rs: BowelRecord[]) => void;
  setStreak: (n: number) => void;
  setWeeklyMap: (m: Record<string, boolean>) => void;
  setLoading: (b: boolean) => void;
  setError: (e: string | null) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  today: "",
  dailyCheckin: null,
  bowelRecords: [],
  streak: 0,
  weeklyMap: {},
  loading: true,
  error: null,
  setToday: (today) => set({ today }),
  setDailyCheckin: (dailyCheckin) => set({ dailyCheckin }),
  setBowelRecords: (bowelRecords) => set({ bowelRecords }),
  setStreak: (streak) => set({ streak }),
  setWeeklyMap: (weeklyMap) => set({ weeklyMap }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
