import Dexie, { type Table } from 'dexie';
import { Logger } from './logger';

export interface DailyLog {
  id?: number;
  date: string; // YYYY-MM-DD
  checkedIn: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PoopLog {
  id?: number;
  dailyLogId?: number;
  date: string; // YYYY-MM-DD
  hasBowelMovement?: boolean; // if undefined, assume true
  time?: string; // HH:mm
  timeType?: 'exact' | 'approximate';
  timeLabel?: string;
  confidence?: 'Very Accurate' | 'Mostly Remember' | 'Rough Estimate' | 'Not Sure';
  bristolType?: number; // 1-7
  amount?: 'Small' | 'Medium' | 'Large' | 'Not Sure';
  difficulty?: 'Very Easy' | 'Easy' | 'Normal' | 'Difficult' | 'Very Difficult' | 'Hard' | 'Not Sure';
  pain?: number | 'Not Sure';
  symptoms?: string[];
  color?: string;
  foods?: string[];
  medications?: string[];
  exercise?: string[];
  sleepHours?: number | string; // Support string for simple mode
  sleepType?: 'exact' | 'simple';
  sleepSimple?: 'Less than 5 hours' | '5–7 hours' | '7–9 hours' | 'More than 9 hours' | 'Not Sure';
  sleepDurationMinutes?: number;
  sleepQuality?: 'Poor' | 'Average' | 'Good' | 'Excellent';
  water?: number | string; // Support string for simple mode
  waterType?: 'exact' | 'simple';
  waterSimple?: 'Very Little' | 'Some' | 'Enough' | 'A Lot' | 'Not Sure';
  waterDetailed?: number;
  waterUnit?: 'mL' | 'L' | 'Cups';
  waterML?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CustomTag {
  id?: number;
  category: 'symptoms' | 'foods' | 'medications' | 'exercise';
  name: string;
  createdAt: number;
  updatedAt: number;
  isBuiltIn?: boolean;
}

export class AppDatabase extends Dexie {
  public dailyLogs!: Table<DailyLog, number>;
  public poopLogs!: Table<PoopLog, number>;
  public customTags!: Table<CustomTag, number>;

  constructor() {
    super('PoopLogDatabase');
    
    // Define schema versions
    this.version(1).stores({
      dailyLogs: '++id, date',
      poopLogs: '++id, date, dailyLogId'
    });

    this.version(2).stores({
      dailyLogs: '++id, date',
      poopLogs: '++id, date, dailyLogId'
    });
    
    this.version(3).stores({
      customTags: '++id, category, name'
    });

    this.version(4).stores({
      dailyLogs: '++id, &date',
      poopLogs: '++id, date, dailyLogId',
      customTags: '++id, category, name'
    });
  }

  async initialize() {
    try {
      await this.open();
      Logger.info('Database initialized successfully');
    } catch (error) {
      Logger.error('Failed to initialize database', error);
      throw error;
    }
  }
}

export const db = new AppDatabase();
