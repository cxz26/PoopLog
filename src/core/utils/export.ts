import { db } from '../services/database';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import { format } from 'date-fns';

export const exportToCSV = async () => {
  const poopLogs = await db.poopLogs.toArray();
  const formattedLogs = poopLogs.map(log => ({
    ...log,
    symptoms: log.symptoms?.join(', ') || '',
    foods: log.foods?.join(', ') || '',
    exercise: log.exercise?.join(', ') || '',
    medications: log.medications?.join(', ') || ''
  }));

  const csv = Papa.unparse(formattedLogs);
  downloadFile(csv, `pooplog-data-${format(new Date(), 'yyyy-MM-dd')}.csv`, 'text/csv');
};

export const exportToJSON = async () => {
  const poopLogs = await db.poopLogs.toArray();
  const dailyLogs = await db.dailyLogs.toArray();
  const customTags = await db.customTags.toArray();
  
  const backup = {
    version: 1,
    exportDate: new Date().toISOString(),
    data: {
      poopLogs,
      dailyLogs,
      customTags
    }
  };
  
  const json = JSON.stringify(backup, null, 2);
  downloadFile(json, `pooplog-backup-${format(new Date(), 'yyyy-MM-dd')}.json`, 'application/json');
};

export const exportToPDF = async () => {
  const poopLogs = await db.poopLogs.toArray();
  
  const doc = new jsPDF();
  doc.setFontSize(20);
  doc.text('PoopLog Summary Report', 14, 22);
  
  doc.setFontSize(12);
  doc.text(`Generated on: ${format(new Date(), 'PPP')}`, 14, 32);
  doc.text(`Total Logs: ${poopLogs.length}`, 14, 40);
  const recent = [...poopLogs].reverse().slice(0, 20);
  let y = 50;
  
  doc.setFontSize(14);
  doc.text('Recent Logs', 14, y);
  y += 10;
  
  doc.setFontSize(10);
  recent.forEach((log) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    const timeDisplay = log.timeType === 'approximate' ? `${log.timeLabel} (Approx.)` : log.time;
    const painDisplay = log.pain === 'Not Sure' ? 'Estimated' : `${log.pain}/10`;
    const line = `${log.date} ${timeDisplay} - Type ${log.bristolType} | ${log.amount} | ${log.difficulty} | Pain: ${painDisplay}`;
    doc.text(line, 14, y);
    y += 8;
  });

  doc.save(`pooplog-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};

export const importFromJSON = async (file: File): Promise<boolean> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const backup = JSON.parse(content);
        
        if (!backup.data || !Array.isArray(backup.data.poopLogs) || !backup.data.poopLogs.every(isValidLog)) {
          throw new Error('Invalid backup file');
        }
        await db.transaction('rw', db.poopLogs, db.dailyLogs, db.customTags, async () => {
          await db.poopLogs.clear();
          await db.dailyLogs.clear();
          await db.customTags.clear();
          
          if (backup.data.poopLogs.length > 0) {
            await db.poopLogs.bulkAdd(backup.data.poopLogs);
          }
          if (Array.isArray(backup.data.dailyLogs) && backup.data.dailyLogs.length > 0) {
            await db.dailyLogs.bulkAdd(backup.data.dailyLogs);
          }
          if (Array.isArray(backup.data.customTags) && backup.data.customTags.length > 0) await db.customTags.bulkAdd(backup.data.customTags);
        });
        
        resolve(true);
      } catch (err) {
        console.error("Import error", err);
        resolve(false);
      }
    };
    reader.onerror = () => resolve(false);
    reader.readAsText(file);
  });
};

export const getBackupData = async (): Promise<string> => {
  const poopLogs = await db.poopLogs.toArray();
  const dailyLogs = await db.dailyLogs.toArray();
  const customTags = await db.customTags.toArray();
  
  const backup = {
    version: 1,
    exportDate: new Date().toISOString(),
    data: {
      poopLogs,
      dailyLogs,
      customTags
    }
  };
  
  return JSON.stringify(backup);
};

export const restoreFromData = async (jsonString: string): Promise<boolean> => {
  try {
    const backup = JSON.parse(jsonString);
    
    if (!backup.data || !Array.isArray(backup.data.poopLogs) || !backup.data.poopLogs.every(isValidLog)) {
      throw new Error('Invalid backup data format');
    }
    await db.transaction('rw', db.poopLogs, db.dailyLogs, db.customTags, async () => {
      await db.poopLogs.clear();
      await db.dailyLogs.clear();
      await db.customTags.clear();
      
      if (backup.data.poopLogs.length > 0) {
        await db.poopLogs.bulkAdd(backup.data.poopLogs);
      }
      if (backup.data.dailyLogs && backup.data.dailyLogs.length > 0) {
        await db.dailyLogs.bulkAdd(backup.data.dailyLogs);
      }
      if (Array.isArray(backup.data.customTags) && backup.data.customTags.length > 0) await db.customTags.bulkAdd(backup.data.customTags);
    });
    
    return true;
  } catch (err) {
    console.error("Restore error", err);
    return false;
  }
};

const isValidLog = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  const log = value as Record<string, unknown>;
  if (typeof log.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(log.date) || Number.isNaN(Date.parse(`${log.date}T00:00:00`))) return false;
  return log.bristolType === undefined || (typeof log.bristolType === 'number' && log.bristolType >= 1 && log.bristolType <= 7);
};

const downloadFile = (content: string, filename: string, contentType: string) => {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
