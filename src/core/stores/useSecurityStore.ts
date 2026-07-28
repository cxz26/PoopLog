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
          const salt = crypto.getRandomValues(new Uint8Array(16));
          set({ pinHash: `${await hashPin(pin, salt)}:${Array.from(salt, byte => byte.toString(16).padStart(2, '0')).join('')}` });
        }
      },
      verifyPin: async (pin) => {
        const stored = get().pinHash;
        if (!stored) return false;
        const [storedHash, saltHex] = stored.split(':');
        if (saltHex) {
          const salt = new Uint8Array(saltHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) ?? []);
          return storedHash === await hashPin(pin, salt);
        }
        const legacyDigest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
        const legacyHash = Array.from(new Uint8Array(legacyDigest), byte => byte.toString(16).padStart(2, '0')).join('');
        return stored === legacyHash;
      },
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

const hashPin = async (pin: string, salt: Uint8Array): Promise<string> => {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const digest = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};
