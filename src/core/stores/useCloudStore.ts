import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { CryptoService } from '../services/crypto';
import { getBackupData, restoreFromData } from '../utils/export';
import { User, Session } from '@supabase/supabase-js';

export interface BackupMetadata {
  name: string;
  created_at: string;
  size: number;
  id: string;
}

interface CloudState {
  session: Session | null;
  user: User | null;
  isConfigured: boolean;
  backups: BackupMetadata[];
  isLoadingBackups: boolean;
  isBackingUp: boolean;
  isRestoring: boolean;
  
  initialize: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  signOut: () => Promise<void>;
  loadBackups: () => Promise<void>;
  createBackup: (encryptionKey: string) => Promise<boolean>;
  restoreBackup: (backupName: string, encryptionKey: string) => Promise<boolean>;
  deleteBackup: (backupName: string) => Promise<boolean>;
}

export const useCloudStore = create<CloudState>((set, get) => ({
  session: null,
  user: null,
  isConfigured: isSupabaseConfigured(),
  backups: [],
  isLoadingBackups: false,
  isBackingUp: false,
  isRestoring: false,

  initialize: async () => {
    if (!get().isConfigured) return;
    
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user || null });
      if (session?.user) {
        get().loadBackups();
      } else {
        set({ backups: [] });
      }
    });

    const { data: { session } } = await supabase.auth.getSession();
    set({ session, user: session?.user || null });
    if (session?.user) {
      get().loadBackups();
    }
  },

  signInWithGoogle: async () => {
    if (!get().isConfigured) return;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/settings',
      }
    });
  },

  signInWithFacebook: async () => {
    if (!get().isConfigured) return;
    await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo: window.location.origin + '/settings',
      }
    });
  },

  signOut: async () => {
    if (!get().isConfigured) return;
    await supabase.auth.signOut();
  },

  loadBackups: async () => {
    const user = get().user;
    if (!user) return;
    
    set({ isLoadingBackups: true });
    try {
      const { data, error } = await supabase.storage
        .from('backups')
        .list(user.id, {
          sortBy: { column: 'created_at', order: 'desc' }
        });
        
      if (error) throw error;
      
      const backups: BackupMetadata[] = data
        .filter(f => f.name !== '.emptyFolderPlaceholder')
        .map(f => ({
          name: f.name,
          created_at: f.created_at,
          size: f.metadata?.size || 0,
          id: f.id || f.name,
        }));
        
      set({ backups });
    } catch (err) {
      console.error("Failed to load backups", err);
    } finally {
      set({ isLoadingBackups: false });
    }
  },

  createBackup: async (encryptionKey: string) => {
    const user = get().user;
    if (!user) return false;
    
    set({ isBackingUp: true });
    try {
      const dataStr = await getBackupData();
      const encryptedData = await CryptoService.encrypt(dataStr, encryptionKey);
      const filename = `backup_${new Date().getTime()}.enc`;
      const filePath = `${user.id}/${filename}`;
      
      const blob = new Blob([encryptedData], { type: 'text/plain' });
      
      const { error } = await supabase.storage
        .from('backups')
        .upload(filePath, blob, {
          upsert: true
        });
        
      if (error) throw error;
      
      await get().loadBackups();
      return true;
    } catch (err) {
      console.error("Backup failed", err);
      return false;
    } finally {
      set({ isBackingUp: false });
    }
  },

  restoreBackup: async (backupName: string, encryptionKey: string) => {
    const user = get().user;
    if (!user) return false;
    
    set({ isRestoring: true });
    try {
      const filePath = `${user.id}/${backupName}`;
      
      const { data, error } = await supabase.storage
        .from('backups')
        .download(filePath);
        
      if (error) throw error;
      
      const encryptedText = await data.text();
      const decryptedData = await CryptoService.decrypt(encryptedText, encryptionKey);
      const success = await restoreFromData(decryptedData);
      
      return success;
    } catch (err) {
      console.error("Restore failed", err);
      throw new Error(err instanceof Error ? err.message : 'Restore failed.', { cause: err });
    } finally {
      set({ isRestoring: false });
    }
  },

  deleteBackup: async (backupName: string) => {
    const user = get().user;
    if (!user) return false;
    
    try {
      const filePath = `${user.id}/${backupName}`;
      const { error } = await supabase.storage
        .from('backups')
        .remove([filePath]);
        
      if (error) throw error;
      
      await get().loadBackups();
      return true;
    } catch (err) {
      console.error("Delete backup failed", err);
      return false;
    }
  }
}));