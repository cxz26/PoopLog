import { db } from '../services/database';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import { format } from 'date-fns';

export const exportToCSV = async () => {
  const poopLogs = await db.poopLogs.toArray();
  const dailyLogs = await db.dailyLogs.toArray();
  
  // Convert poop logs array fields to strings
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
  
  const backup = {
    version: 1,
    exportDate: new Date().toISOString(),
    data: {
      poopLogs,
      dailyLogs
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
  
  // Basic list of last 20 logs for PDF
  const recent = [...poopLogs].reverse().slice(0, 20);
  let y = 50;
  
  doc.setFontSize(14);
  doc.text('Recent Logs', 14, y);
  y += 10;
  
  doc.setFontSize(10);
  recent.forEach((log, index) => {
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
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const backup = JSON.parse(content);
        
        if (!backup.data || !backup.data.poopLogs) {
          throw new Error('Invalid backup file');
        }

        // Wipe and restore
        await db.transaction('rw', db.poopLogs, db.dailyLogs, async () => {
          await db.poopLogs.clear();
          await db.dailyLogs.clear();
          
          if (backup.data.poopLogs.length > 0) {
            await db.poopLogs.bulkAdd(backup.data.poopLogs);
          }
          if (backup.data.dailyLogs.length > 0) {
            await db.dailyLogs.bulkAdd(backup.data.dailyLogs);
          }
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
  
  const backup = {
    version: 1,
    exportDate: new Date().toISOString(),
    data: {
      poopLogs,
      dailyLogs
    }
  };
  
  return JSON.stringify(backup);
};

export const restoreFromData = async (jsonString: string): Promise<boolean> => {
  try {
    const backup = JSON.parse(jsonString);
    
    if (!backup.data || !backup.data.poopLogs) {
      throw new Error('Invalid backup data format');
    }

    // Wipe and restore
    await db.transaction('rw', db.poopLogs, db.dailyLogs, async () => {
      await db.poopLogs.clear();
      await db.dailyLogs.clear();
      
      if (backup.data.poopLogs.length > 0) {
        await db.poopLogs.bulkAdd(backup.data.poopLogs);
      }
      if (backup.data.dailyLogs && backup.data.dailyLogs.length > 0) {
        await db.dailyLogs.bulkAdd(backup.data.dailyLogs);
      }
    });
    
    return true;
  } catch (err) {
    console.error("Restore error", err);
    return false;
  }
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
