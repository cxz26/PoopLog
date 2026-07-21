import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SecurityState {
  pinHash: string | null;
  requireAuthOnLaunch: boolean;
  
  isAuthenticated: boolean;
  
  setPin: (pin: string | null) => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
  setRequireAuthOnLaunch: (require: boolean) => void;
  setAuthenticated: (auth: boolean) => void;
  
  lockApp: () => void;
}

export const useSecurityStore = create<SecurityState>()(
  persist(
    (set, get) => ({
      pinHash: null,
      requireAuthOnLaunch: false,
      isAuthenticated: false,
      
      setPin: async (pin) => {
        if (!pin) {
          set({ pinHash: null, requireAuthOnLaunch: false });
        } else {
          set({ pinHash: await hashPin(pin) });
        }
      },
      verifyPin: async (pin) => (get().pinHash === await hashPin(pin)),
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
        pinHash: state.pinHash,
        requireAuthOnLaunch: state.requireAuthOnLaunch,
        isAuthenticated: false
      }),
      version: 2,
      migrate: () => ({ pinHash: null, requireAuthOnLaunch: false, isAuthenticated: false }),
    }
  )
);

const hashPin = async (pin: string): Promise<string> => {
  const bytes = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};
