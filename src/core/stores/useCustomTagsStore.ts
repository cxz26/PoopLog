import { create } from 'zustand';
import { db, CustomTag } from '../services/database';

interface CustomTagsState {
  tags: CustomTag[];
  isLoading: boolean;
  loadTags: () => Promise<void>;
  addTag: (category: CustomTag['category'], name: string) => Promise<void>;
  deleteTag: (id: number) => Promise<void>;
  updateTag: (id: number, name: string) => Promise<void>;
  mergeTags: (keepId: number, mergeIds: number[]) => Promise<void>;
}

export const useCustomTagsStore = create<CustomTagsState>((set, get) => ({
  tags: [],
  isLoading: false,

  loadTags: async () => {
    set({ isLoading: true });
    try {
      const tags = await db.customTags.toArray();
      set({ tags });
    } catch (err) {
      console.error("Failed to load custom tags", err);
    } finally {
      set({ isLoading: false });
    }
  },

  addTag: async (category, name) => {
    if (!name.trim()) return;
    try {
      const existing = await db.customTags.where({ category, name: name.trim() }).first();
      if (existing) return;

      const newTag: CustomTag = {
        category,
        name: name.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      await db.customTags.add(newTag);
      await get().loadTags();
    } catch (err) {
      console.error("Failed to add custom tag", err);
    }
  },

  deleteTag: async (id) => {
    try {
      await db.customTags.delete(id);
      await get().loadTags();
    } catch (err) {
      console.error("Failed to delete custom tag", err);
    }
  },

  updateTag: async (id, name) => {
    try {
      await db.customTags.update(id, { name: name.trim(), updatedAt: Date.now() });
      await get().loadTags();
    } catch (err) {
      console.error("Failed to update custom tag", err);
    }
  },

  mergeTags: async (keepId, mergeIds) => {
    try {
      await db.transaction('rw', db.customTags, async () => {
        const keepTag = await db.customTags.get(keepId);
        if (!keepTag) return;
        
        const tagsToMerge = await db.customTags.where('id').anyOf(mergeIds).toArray();
        const oldNames = tagsToMerge.map(t => t.name);
        if (oldNames.length > 0) {
          const logs = await db.poopLogs.toArray();
          for (const log of logs) {
            let changed = false;
            const updatedLog = { ...log };
            
            if (keepTag.category === 'symptoms' && updatedLog.symptoms) {
              updatedLog.symptoms = updatedLog.symptoms.map(s => oldNames.includes(s) ? keepTag.name : s);
              changed = true;
            } else if (keepTag.category === 'foods' && updatedLog.foods) {
              updatedLog.foods = updatedLog.foods.map(s => oldNames.includes(s) ? keepTag.name : s);
              changed = true;
            } else if (keepTag.category === 'medications' && updatedLog.medications) {
              updatedLog.medications = updatedLog.medications.map(s => oldNames.includes(s) ? keepTag.name : s);
              changed = true;
            } else if (keepTag.category === 'exercise' && updatedLog.exercise) {
              updatedLog.exercise = updatedLog.exercise.map(s => oldNames.includes(s) ? keepTag.name : s);
              changed = true;
            }

            if (changed && log.id) {
               if (updatedLog.symptoms) updatedLog.symptoms = [...new Set(updatedLog.symptoms)];
               if (updatedLog.foods) updatedLog.foods = [...new Set(updatedLog.foods)];
               if (updatedLog.medications) updatedLog.medications = [...new Set(updatedLog.medications)];
               if (updatedLog.exercise) updatedLog.exercise = [...new Set(updatedLog.exercise)];
               await db.poopLogs.update(log.id, updatedLog);
            }
          }
        }
        
        await db.customTags.bulkDelete(mergeIds);
      });
      await get().loadTags();
    } catch (err) {
      console.error("Failed to merge custom tags", err);
    }
  }
}));
