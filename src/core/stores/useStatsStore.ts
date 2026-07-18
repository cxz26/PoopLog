import { create } from 'zustand';
import { db, PoopLog } from '../services/database';
import { TimeFilter, filterLogsByTime, calculateStreaks } from '../utils/analytics';
import { differenceInDays, parseISO } from 'date-fns';

interface StatsState {
  allPoopLogs: PoopLog[];
  timeFilter: TimeFilter;
  isLoading: boolean;
  
  loadStatsData: () => Promise<void>;
  setTimeFilter: (filter: TimeFilter) => void;
}

export const useStatsStore = create<StatsState>((set) => ({
  allPoopLogs: [],
  timeFilter: '30days',
  isLoading: false,

  loadStatsData: async () => {
    set({ isLoading: true });
    try {
      const pLogs = await db.poopLogs.orderBy('date').reverse().toArray();
      set({ allPoopLogs: pLogs });
    } finally {
      set({ isLoading: false });
    }
  },
  
  setTimeFilter: (filter: TimeFilter) => {
    set({ timeFilter: filter });
  }
}));
