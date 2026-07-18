import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeOption = 'system' | 'light' | 'dark';
export type TimeFormat = '12h' | '24h';
export type StartWeekOn = 'sunday' | 'monday';

interface SettingsState {
  theme: ThemeOption;
  timeFormat: TimeFormat;
  startWeekOn: StartWeekOn;
  hideSensitiveData: boolean;
  confirmDelete: boolean;
  preferredWaterUnit: 'mL' | 'L' | 'Cups';
  setTheme: (theme: ThemeOption) => void;
  setTimeFormat: (format: TimeFormat) => void;
  setStartWeekOn: (day: StartWeekOn) => void;
  setHideSensitiveData: (hide: boolean) => void;
  setConfirmDelete: (confirm: boolean) => void;
  setPreferredWaterUnit: (unit: 'mL' | 'L' | 'Cups') => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      timeFormat: '12h',
      startWeekOn: 'sunday',
      hideSensitiveData: false,
      confirmDelete: true,
      preferredWaterUnit: 'mL',
      
      setTheme: (theme) => set({ theme }),
      setTimeFormat: (timeFormat) => set({ timeFormat }),
      setStartWeekOn: (startWeekOn) => set({ startWeekOn }),
      setHideSensitiveData: (hideSensitiveData) => set({ hideSensitiveData }),
      setConfirmDelete: (confirmDelete) => set({ confirmDelete }),
      setPreferredWaterUnit: (preferredWaterUnit) => set({ preferredWaterUnit }),
      resetSettings: () => set({
        theme: 'system',
        timeFormat: '12h',
        startWeekOn: 'sunday',
        hideSensitiveData: false,
        confirmDelete: true,
        preferredWaterUnit: 'mL',
      }),
    }),
    {
      name: 'pooplog-settings',
    }
  )
);
