import { create } from 'zustand';
import { db, PoopLog } from '../services/database';

interface LogState {
  todayPoopLogs: PoopLog[];
  historyPoopLogs: PoopLog[];
  streak: number;
  isLoading: boolean;
  
  loadTodayData: (dateStr: string) => Promise<void>;
  loadHistory: () => Promise<void>;
  checkInNo: (dateStr: string) => Promise<void>;
  savePoopLog: (log: Omit<PoopLog, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updatePoopLog: (id: number, log: Partial<PoopLog>) => Promise<void>;
  deletePoopLog: (id: number) => Promise<void>;
  calculateStreak: () => Promise<void>;
}

export const useLogStore = create<LogState>((set, get) => ({
  todayPoopLogs: [],
  historyPoopLogs: [],
  streak: 0,
  isLoading: false,

  loadTodayData: async (dateStr: string) => {
    set({ isLoading: true });
    try {
      const poopLogs = await db.poopLogs.where('date').equals(dateStr).toArray();
      set({ todayPoopLogs: poopLogs });
      await get().calculateStreak();
    } finally {
      set({ isLoading: false });
    }
  },

  loadHistory: async () => {
    set({ isLoading: true });
    try {
      const logs = await db.poopLogs.orderBy('date').reverse().toArray();
      set({ historyPoopLogs: logs });
    } finally {
      set({ isLoading: false });
    }
  },

  checkInNo: async (dateStr: string) => {
    const now = Date.now();
    await db.poopLogs.add({
      date: dateStr,
      hasBowelMovement: false,
      createdAt: now,
      updatedAt: now,
    });
    await get().loadTodayData(dateStr);
  },

  savePoopLog: async (log) => {
    const now = Date.now();
    await db.poopLogs.add({
      ...log,
      hasBowelMovement: true,
      createdAt: now,
      updatedAt: now,
    });
    await get().loadTodayData(log.date);
  },

  updatePoopLog: async (id, updates) => {
    await db.poopLogs.update(id, { ...updates, updatedAt: Date.now() });
    const log = await db.poopLogs.get(id);
    if (log) {
      await get().loadTodayData(log.date);
    }
    await get().loadHistory();
  },

  deletePoopLog: async (id) => {
    const log = await db.poopLogs.get(id);
    if (log) {
      await db.poopLogs.delete(id);
      await get().loadTodayData(log.date);
      await get().loadHistory();
    }
  },

  calculateStreak: async () => {
    // Simple streak calculation: count consecutive days backwards from today
    // We get all unique dates from poopLogs
    const logs = await db.poopLogs.orderBy('date').reverse().toArray();
    if (logs.length === 0) {
      set({ streak: 0 });
      return;
    }
    
    // Extract unique dates
    const uniqueDates = Array.from(new Set(logs.map(l => l.date)));
    
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let checkDate = new Date(today);
    
    // For each day backwards
    for (const dateStr of uniqueDates) {
      const logDate = new Date(dateStr);
      logDate.setHours(0,0,0,0);
      
      const diffTime = checkDate.getTime() - logDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
      
      if (diffDays === 0) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (diffDays === 1) {
         currentStreak++;
         checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    set({ streak: currentStreak });
  }
}));
