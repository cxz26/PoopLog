import { create } from "zustand";
import type { DatabaseStatus } from "../types";

interface AppState {
  isTauri: boolean;
  databaseStatus: DatabaseStatus;
  databaseError: string | null;
  setIsTauri: (v: boolean) => void;
  setDatabaseStatus: (s: DatabaseStatus, err?: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isTauri: false,
  databaseStatus: "idle",
  databaseError: null,
  setIsTauri: (v) => set({ isTauri: v }),
  setDatabaseStatus: (s, err = null) => set({ databaseStatus: s, databaseError: err }),
}));
