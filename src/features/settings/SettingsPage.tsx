import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SettingsGroup, SettingsItem, Toggle } from '@/src/shared/components/SettingsUI';
import { useSettingsStore } from '@/src/core/stores/useSettingsStore';
import { useSecurityStore } from '@/src/core/stores/useSecurityStore';
import { exportToCSV, exportToJSON, exportToPDF, importFromJSON } from '@/src/core/utils/export';
import { db } from '@/src/core/services/database';
import { Palette, Clock, Calendar, Lock, Shield, Download, FileText, Database, Trash2, Info, Github, Droplet, Tag } from 'lucide-react';
import { SectionCard } from '@/src/shared/components/SectionCard';
import { CloudBackupSettings } from './CloudBackupSettings';
import { Button } from '@/src/shared/components/Button';
import packageJson from '@/package.json';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const settings = useSettingsStore();
  const security = useSecurityStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [importing, setImporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleExportJSON = async () => {
    await exportToJSON();
  };

  const handleExportCSV = async () => {
    await exportToCSV();
  };

  const handleExportPDF = async () => {
    await exportToPDF();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (window.confirm("Importing will overwrite your existing data. Are you sure?")) {
      setImporting(true);
      const success = await importFromJSON(file);
      setImporting(false);
      if (success) {
        alert("Data imported successfully!");
        window.location.reload();
      } else {
        alert("Failed to import backup.");
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteAll = async () => {
    await db.poopLogs.clear();
    await db.dailyLogs.clear();
    setShowDeleteConfirm(false);
    alert("All data deleted.");
    window.location.reload();
  };

  const handleSetPin = () => {
    if (security.pinHash) {
      if (window.confirm("Remove your PIN?")) {
        void security.setPin(null);
      }
    } else {
      const pin = window.prompt("Enter a 4-digit PIN:");
      if (pin && /^\d{4}$/.test(pin)) {
        void security.setPin(pin);
        alert("PIN set successfully.");
      } else {
        alert("Invalid PIN. Must be 4 digits.");
      }
    }
  };

  return (
    <div className="flex flex-col pt-2 min-h-0 w-full max-w-2xl mx-auto pb-12 overflow-y-auto relative">
      <SectionCard className="mb-6 bg-primary/5 border-primary/20 p-6 flex items-center justify-between">
        <div>
           <h2 className="text-xl font-bold text-text-main mb-1">PoopLog</h2>
           <p className="text-text-main/60 text-sm">Your offline-first bowel movement tracker.</p>
        </div>
        <div className="bg-primary text-white w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl shadow-lg">
          💩
        </div>
      </SectionCard>

      <SettingsGroup title="Appearance">
        <SettingsItem 
          icon={<Palette />} 
          title="Theme" 
          subtitle="System, Light, or Dark"
          action={
            <select 
              value={settings.theme} 
              onChange={e => settings.setTheme(e.target.value as any)}
              className="bg-transparent text-primary font-bold outline-none text-right cursor-pointer"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          }
        />
      </SettingsGroup>

      <SettingsGroup title="General">
        <SettingsItem 
          icon={<Tag />}
          title="Custom Tags"
          subtitle="Manage your custom symptoms, foods, etc."
          onClick={() => navigate('/settings/tags')}
        />
        <SettingsItem 
          icon={<Droplet />} 
          title="Preferred Water Unit" 
          action={
            <select 
              value={settings.preferredWaterUnit} 
              onChange={e => settings.setPreferredWaterUnit(e.target.value as any)}
              className="bg-transparent text-primary font-bold outline-none text-right cursor-pointer"
            >
              <option value="mL">mL</option>
              <option value="L">L</option>
              <option value="Cups">Cups</option>
            </select>
          }
        />
        <SettingsItem 
          icon={<Calendar />} 
          title="Start Week On" 
          action={
            <select 
              value={settings.startWeekOn} 
              onChange={e => settings.setStartWeekOn(e.target.value as any)}
              className="bg-transparent text-primary font-bold outline-none text-right cursor-pointer"
            >
              <option value="sunday">Sunday</option>
              <option value="monday">Monday</option>
            </select>
          }
        />
        <SettingsItem 
          icon={<Clock />} 
          title="Time Format" 
          action={
            <select 
              value={settings.timeFormat} 
              onChange={e => settings.setTimeFormat(e.target.value as any)}
              className="bg-transparent text-primary font-bold outline-none text-right cursor-pointer"
            >
              <option value="12h">12 Hour</option>
              <option value="24h">24 Hour</option>
            </select>
          }
        />
      </SettingsGroup>

      <CloudBackupSettings />

      <SettingsGroup title="Privacy & Security">
        <SettingsItem 
          icon={<Lock />} 
          title="App Lock PIN" 
          subtitle={security.pinHash ? "PIN is set" : "No PIN set"}
          onClick={handleSetPin}
          action={<span className="text-primary font-bold">{security.pinHash ? 'Remove' : 'Set PIN'}</span>}
        />
        {security.pinHash && (
          <SettingsItem 
            title="Require Auth on Launch" 
            action={
              <Toggle checked={security.requireAuthOnLaunch} onChange={security.setRequireAuthOnLaunch} />
            }
          />
        )}
        <SettingsItem 
          icon={<Shield />}
          title="Hide Sensitive Data" 
          subtitle="Blur stats when inactive"
          action={
            <Toggle checked={settings.hideSensitiveData} onChange={settings.setHideSensitiveData} />
          }
        />
      </SettingsGroup>

      <SettingsGroup title="Data Management">
        <SettingsItem 
          icon={<Download />} 
          title="Export Backup (JSON)" 
          subtitle="Complete backup for restoration"
          onClick={handleExportJSON}
        />
        <input 
          type="file" 
          accept=".json" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleImport}
        />
        <SettingsItem 
          icon={<Database />} 
          title="Import Backup" 
          subtitle={importing ? "Importing..." : "Restore from a JSON backup"}
          onClick={() => fileInputRef.current?.click()}
        />
        <SettingsItem 
          icon={<FileText />} 
          title="Export CSV" 
          subtitle="Export logs for spreadsheets"
          onClick={handleExportCSV}
        />
        <SettingsItem 
          icon={<FileText />} 
          title="Export PDF Report" 
          subtitle="Export a summary report"
          onClick={handleExportPDF}
        />
        <SettingsItem 
          icon={<Trash2 />} 
          title="Delete All Data" 
          subtitle="Permanently erase all logs"
          destructive
          onClick={() => setShowDeleteConfirm(true)}
        />
      </SettingsGroup>

      <SettingsGroup title="About">
        <SettingsItem 
          icon={<Info />} 
          title="Version" 
          action={<span className="text-text-main/50 font-bold">{packageJson.version}</span>}
        />
        <SettingsItem 
          icon={<Github />} 
          title="GitHub Repository" 
          onClick={() => window.open('https://github.com/cxz26/PoopLog', '_blank')}
        />
      </SettingsGroup>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-background rounded-[24px] p-6 w-full max-w-sm shadow-2xl border border-border-main" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-2">Delete all records?</h3>
            <p className="text-text-main/60 mb-6">This will permanently delete ALL your logs. This action cannot be undone.</p>
            <div className="flex gap-3">
              <Button variant="outlined" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button className="flex-1 bg-error text-white border-error" onClick={handleDeleteAll}>
                Delete All
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};