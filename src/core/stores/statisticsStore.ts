import { create } from "zustand";
import type { TimeRange, OverviewStats, DailyFrequency, BristolDistribution, TagFrequency, SleepStats, WaterStats, CalendarDay } from "../services/statisticsService";

interface StatisticsState {
  timeRange: TimeRange;
  overview: OverviewStats | null;
  dailyFreq: DailyFrequency[];
  bristol: BristolDistribution | null;
  symptoms: TagFrequency[];
  foods: TagFrequency[];
  exercises: TagFrequency[];
  sleep: SleepStats | null;
  water: WaterStats | null;
  calendar: CalendarDay[];
  loading: boolean;
  error: string | null;
  setTimeRange: (r: TimeRange) => void;
  setData: (data: Partial<Omit<StatisticsState, "setTimeRange" | "setData" | "setLoading" | "setError">>) => void;
  setLoading: (b: boolean) => void;
  setError: (e: string | null) => void;
}

export const useStatisticsStore = create<StatisticsState>((set) => ({
  timeRange: "30",
  overview: null,
  dailyFreq: [],
  bristol: null,
  symptoms: [],
  foods: [],
  exercises: [],
  sleep: null,
  water: null,
  calendar: [],
  loading: true,
  error: null,
  setTimeRange: (timeRange) => set({ timeRange }),
  setData: (data) => set(data as any),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
