import React, { useState } from 'react';
import { useCloudStore } from '@/src/core/stores/useCloudStore';
import { SettingsGroup, SettingsItem } from '@/src/shared/components/SettingsUI';
import { Cloud, CloudOff, RefreshCw, Key, Trash2, DownloadCloud } from 'lucide-react';
import { CryptoService } from '@/src/core/services/crypto';

export const CloudBackupSettings: React.FC = () => {
  const cloud = useCloudStore();
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [encryptionKey, setEncryptionKey] = useState(localStorage.getItem('pooplog_encryption_key') || '');
  const [newKey, setNewKey] = useState('');

  if (!cloud.isConfigured) {
    return (
      <SettingsGroup title="Cloud Backup">
        <SettingsItem 
          icon={<CloudOff />} 
          title="Not Configured" 
          subtitle="Supabase URL or Key is missing in .env"
        />
      </SettingsGroup>
    );
  }

  if (!cloud.user) {
    return (
      <SettingsGroup title="Cloud Backup (Optional)">
        <SettingsItem 
          icon={<Cloud />} 
          title="Sign in to enable cloud backup" 
          subtitle="Keep your data safe online."
          onClick={cloud.signInWithGoogle}
          action={<span className="text-primary font-bold">Sign In</span>}
        />
      </SettingsGroup>
    );
  }

  const handleSetKey = () => {
    if (!newKey) {
      const generated = CryptoService.generateSecureKey();
      setNewKey(generated);
    } else {
      setEncryptionKey(newKey);
      localStorage.setItem('pooplog_encryption_key', newKey);
      setShowKeyDialog(false);
      setNewKey('');
    }
  };

  const handleBackup = async () => {
    if (!encryptionKey) {
      setShowKeyDialog(true);
      return;
    }
    const success = await cloud.createBackup(encryptionKey);
    if (success) alert('Backup created successfully!');
    else alert('Backup failed.');
  };

  const handleRestore = async (backupName: string) => {
    if (!encryptionKey) {
      setShowKeyDialog(true);
      return;
    }
    if (window.confirm(`Restore from ${backupName}? This will replace your local data.`)) {
      const success = await cloud.restoreBackup(backupName, encryptionKey);
      if (success) {
        alert('Data restored successfully!');
        window.location.reload();
      } else {
        alert('Restore failed. Wrong encryption key?');
      }
    }
  };

  const handleDelete = async (backupName: string) => {
    if (window.confirm('Delete this backup?')) {
      await cloud.deleteBackup(backupName);
    }
  };

  return (
    <SettingsGroup title="Cloud Backup (Encrypted)">
      <SettingsItem 
        icon={<Cloud />} 
        title={cloud.user.email || 'Connected'}
        subtitle="Signed in"
        onClick={cloud.signOut}
        action={<span className="text-danger font-bold text-sm">Sign Out</span>}
      />
      
      <SettingsItem 
        icon={<Key />} 
        title="Encryption Key" 
        subtitle={encryptionKey ? 'Key is set (Local)' : 'No key set'}
        onClick={() => setShowKeyDialog(true)}
        action={<span className="text-primary font-bold">{encryptionKey ? 'Change' : 'Set'}</span>}
      />

      {showKeyDialog && (
        <div className="p-4 bg-surface/50 border-t border-border-main">
          <p className="text-sm text-text-main mb-2 font-medium">Set a strong key to encrypt your backups. You will need this to restore on another device.</p>
          <div className="flex gap-2">
            <input 
              type="text"
              value={newKey}
              onChange={e => setNewKey(e.target.value)}
              placeholder="Enter or generate key"
              className="flex-1 bg-background border border-border-main rounded-xl px-3 py-2 text-sm text-text-main outline-none focus:border-primary"
            />
            <button 
              onClick={handleSetKey}
              className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold"
            >
              {newKey ? 'Save' : 'Generate'}
            </button>
          </div>
          <button onClick={() => setShowKeyDialog(false)} className="text-text-main/50 text-sm mt-3 w-full text-center">Cancel</button>
        </div>
      )}

      <SettingsItem 
        icon={cloud.isBackingUp ? <RefreshCw className="animate-spin" /> : <Cloud />} 
        title="Back Up Now" 
        subtitle="Manually upload an encrypted backup"
        onClick={handleBackup}
      />

      {cloud.backups.length > 0 && (
        <div className="p-4 border-t border-border-main bg-background/50">
          <h4 className="text-xs font-bold text-text-main/50 uppercase mb-3">Backup History</h4>
          <div className="space-y-3">
            {cloud.backups.map(b => (
              <div key={b.name} className="flex items-center justify-between bg-surface p-3 rounded-xl border border-border-main">
                <div>
                  <div className="text-sm font-medium text-text-main">{new Date(b.created_at).toLocaleDateString()} {new Date(b.created_at).toLocaleTimeString()}</div>
                  <div className="text-xs text-text-main/50">{(b.size / 1024).toFixed(1)} KB</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleRestore(b.name)} className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20">
                    <DownloadCloud size={16} />
                  </button>
                  <button onClick={() => handleDelete(b.name)} className="w-8 h-8 rounded-full bg-danger/10 text-danger flex items-center justify-center hover:bg-danger/20">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </SettingsGroup>
  );
};
