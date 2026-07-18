import { create } from 'zustand';

interface HistoryFilterState {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  
  bristolTypes: number[];
  toggleBristolType: (type: number) => void;
  
  symptoms: string[];
  toggleSymptom: (sym: string) => void;
  
  foods: string[];
  toggleFood: (food: string) => void;
  
  sortOrder: 'newest' | 'oldest' | 'highest-bristol' | 'lowest-bristol' | 'most-pain' | 'least-pain';
  setSortOrder: (order: 'newest' | 'oldest' | 'highest-bristol' | 'lowest-bristol' | 'most-pain' | 'least-pain') => void;
  
  clearFilters: () => void;
}

export const useHistoryFilterStore = create<HistoryFilterState>((set) => ({
  searchQuery: '',
  setSearchQuery: (query: string) => set({ searchQuery: query }),
  
  bristolTypes: [],
  toggleBristolType: (type) => set((state) => ({
    bristolTypes: state.bristolTypes.includes(type) 
      ? state.bristolTypes.filter(t => t !== type) 
      : [...state.bristolTypes, type]
  })),
  
  symptoms: [],
  toggleSymptom: (sym) => set((state) => ({
    symptoms: state.symptoms.includes(sym) 
      ? state.symptoms.filter(s => s !== sym) 
      : [...state.symptoms, sym]
  })),
  
  foods: [],
  toggleFood: (food) => set((state) => ({
    foods: state.foods.includes(food) 
      ? state.foods.filter(f => f !== food) 
      : [...state.foods, food]
  })),
  
  sortOrder: 'newest',
  setSortOrder: (order) => set({ sortOrder: order }),
  
  clearFilters: () => set({
    searchQuery: '', bristolTypes: [], symptoms: [], foods: [], sortOrder: 'newest'
  }),
}));
