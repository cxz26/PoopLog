import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SecurityState {
  pin: string | null;
  useBiometric: boolean;
  requireAuthOnLaunch: boolean;
  
  isAuthenticated: boolean;
  
  setPin: (pin: string | null) => void;
  setUseBiometric: (use: boolean) => void;
  setRequireAuthOnLaunch: (require: boolean) => void;
  setAuthenticated: (auth: boolean) => void;
  
  lockApp: () => void;
}

export const useSecurityStore = create<SecurityState>()(
  persist(
    (set, get) => ({
      pin: null,
      useBiometric: false,
      requireAuthOnLaunch: false,
      isAuthenticated: false,
      
      setPin: (pin) => {
        if (!pin) {
          set({ pin: null, requireAuthOnLaunch: false, useBiometric: false });
        } else {
          set({ pin });
        }
      },
      setUseBiometric: (useBiometric) => set({ useBiometric }),
      setRequireAuthOnLaunch: (requireAuthOnLaunch) => set({ requireAuthOnLaunch }),
      setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
      
      lockApp: () => {
        if (get().requireAuthOnLaunch) {
          set({ isAuthenticated: false });
        }
      },
    }),
    {
      name: 'pooplog-security',
      partialize: (state) => ({ 
        pin: state.pin, 
        useBiometric: state.useBiometric, 
        requireAuthOnLaunch: state.requireAuthOnLaunch 
      }), // Don't persist isAuthenticated
    }
  )
);
