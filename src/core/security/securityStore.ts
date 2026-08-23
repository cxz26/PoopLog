import { create } from "zustand";

export type SecurityStatus = "unconfigured" | "locked" | "authenticating" | "unlocked" | "cooling_down";

interface SecurityState {
  status: SecurityStatus;
  hasPin: boolean;
  failedCount: number;
  cooldownRemaining: number;
  error: string | null;
  setStatus: (s: SecurityStatus) => void;
  setHasPin: (b: boolean) => void;
  setFailedCount: (n: number) => void;
  setCooldownRemaining: (n: number) => void;
  setError: (e: string | null) => void;
}

export const useSecurityStore = create<SecurityState>((set) => ({
  status: "unconfigured",
  hasPin: false,
  failedCount: 0,
  cooldownRemaining: 0,
  error: null,
  setStatus: (status) => set({ status }),
  setHasPin: (hasPin) => set({ hasPin }),
  setFailedCount: (failedCount) => set({ failedCount }),
  setCooldownRemaining: (cooldownRemaining) => set({ cooldownRemaining }),
  setError: (error) => set({ error }),
}));
