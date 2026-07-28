import { create } from 'zustand';
import { db, PoopLog } from '../services/database';
import { calculateStreaks } from '../utils/analytics';

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
    await db.transaction('rw', db.poopLogs, db.dailyLogs, async () => {
      const existing = await db.poopLogs.where('date').equals(dateStr).toArray();
      if (existing.some(log => log.hasBowelMovement !== false) || existing.some(log => log.hasBowelMovement === false)) return;
      await db.poopLogs.add({ date: dateStr, hasBowelMovement: false, createdAt: now, updatedAt: now });
      await db.dailyLogs.put({ date: dateStr, checkedIn: true, createdAt: now, updatedAt: now });
    });
    await get().loadTodayData(dateStr);
  },

  savePoopLog: async (log) => {
    const now = Date.now();
    await db.transaction('rw', db.poopLogs, db.dailyLogs, async () => {
      const existing = await db.poopLogs.where('date').equals(log.date).toArray();
      await Promise.all(existing.filter(item => item.hasBowelMovement === false && item.id !== undefined).map(item => db.poopLogs.delete(item.id!)));
      await db.poopLogs.add({ ...log, hasBowelMovement: true, createdAt: now, updatedAt: now });
      await db.dailyLogs.put({ date: log.date, checkedIn: true, createdAt: now, updatedAt: now });
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
    const logs = await db.poopLogs.toArray();
    set({ streak: calculateStreaks(logs).current });
  }
}));
