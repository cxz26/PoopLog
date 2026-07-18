import React, { useEffect, useMemo, useState } from 'react';
import { History, ArrowRight, Search, Filter, X } from 'lucide-react';
import { EmptyState } from '@/src/shared/components/EmptyState';
import { SectionCard } from '@/src/shared/components/SectionCard';
import { Chip } from '@/src/shared/components/Chip';
import { useLogStore } from '@/src/core/stores/useLogStore';
import { useHistoryFilterStore } from '@/src/core/stores/useHistoryFilterStore';
import { useNavigate } from 'react-router-dom';
import { APP_CONSTANTS } from '@/src/core/constants';
import { formatDateDisplay } from '@/src/core/utils/date';
import { parseISO, isToday, isYesterday, isThisWeek } from 'date-fns';
import { PoopLog } from '@/src/core/services/database';

export const HistoryPage: React.FC = () => {
  const { historyPoopLogs, loadHistory } = useLogStore();
  const { 
    searchQuery, setSearchQuery, 
    bristolTypes, toggleBristolType, 
    sortOrder, setSortOrder, 
    clearFilters, symptoms, toggleSymptom 
  } = useHistoryFilterStore();
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const allSymptoms = useMemo(() => {
    const set = new Set<string>();
    historyPoopLogs.forEach(l => l.symptoms?.forEach(s => set.add(s)));
    return Array.from(set);
  }, [historyPoopLogs]);

  const filteredLogs = useMemo(() => {
    let result = historyPoopLogs;
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(log => {
        const matchNotes = log.notes?.toLowerCase().includes(q);
        const matchFood = log.foods?.some(f => f.toLowerCase().includes(q));
        const matchMeds = log.medications?.some(m => m.toLowerCase().includes(q));
        const matchEx = log.exercise?.some(e => e.toLowerCase().includes(q));
        return matchNotes || matchFood || matchMeds || matchEx;
      });
    }
    
    if (bristolTypes.length > 0) {
      result = result.filter(log => bristolTypes.includes(log.bristolType));
    }
    
    if (symptoms.length > 0) {
      result = result.filter(log => log.symptoms?.some(s => symptoms.includes(s)));
    }
    
      // Sort
      result = [...result].sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time || '00:00'}`).getTime();
        const dateB = new Date(`${b.date}T${b.time || '00:00'}`).getTime();
        
        const aBristol = a.bristolType || 0;
        const bBristol = b.bristolType || 0;
        const aPain = typeof a.pain === 'number' ? a.pain : -1;
        const bPain = typeof b.pain === 'number' ? b.pain : -1;

        switch (sortOrder) {
        case 'newest': return dateB - dateA;
        case 'oldest': return dateA - dateB;
        case 'highest-bristol': return bBristol - aBristol || dateB - dateA;
        case 'lowest-bristol': return aBristol - bBristol || dateB - dateA;
        case 'most-pain': return bPain - aPain || dateB - dateA;
        case 'least-pain': return aPain - bPain || dateB - dateA;
        default: return dateB - dateA;
      }
    });

    return result;
  }, [historyPoopLogs, searchQuery, bristolTypes, sortOrder, symptoms]);

  const groupedLogs = useMemo(() => {
    const groups: Record<string, PoopLog[]> = {
      'Today': [],
      'Yesterday': [],
      'This Week': [],
      'Earlier': []
    };
    
    if (sortOrder !== 'newest' && sortOrder !== 'oldest') {
      return { 'All Logs': filteredLogs }; // don't group by date if sorting by bristol/pain
    }

    filteredLogs.forEach(log => {
      const date = parseISO(log.date);
      if (isToday(date)) groups['Today'].push(log);
      else if (isYesterday(date)) groups['Yesterday'].push(log);
      else if (isThisWeek(date)) groups['This Week'].push(log);
      else groups['Earlier'].push(log);
    });
    return groups;
  }, [filteredLogs, sortOrder]);

  const groupKeys = Object.keys(groupedLogs);
  const activeFilterCount = bristolTypes.length + symptoms.length + (sortOrder !== 'newest' ? 1 : 0);

  return (
    <div className="flex flex-col pt-2 min-h-0 w-full">
      
      {/* Search & Filter Bar */}
      <div className="mb-4 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-main/40" size={20} />
            <input 
              type="text" 
              placeholder="Search..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-surface border border-border-main rounded-full py-3 pl-12 pr-4 outline-none focus:border-primary transition-colors placeholder:text-text-main/40"
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`p-3 rounded-full border transition-colors flex items-center justify-center relative ${showFilters || activeFilterCount > 0 ? 'bg-primary text-white border-primary' : 'bg-surface border-border-main text-text-main/70 hover:border-primary/50'}`}
          >
            <Filter size={20} />
            {activeFilterCount > 0 && !showFilters && (
               <span className="absolute -top-1 -right-1 bg-warning text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                 {activeFilterCount}
               </span>
            )}
          </button>
        </div>

        {/* Filters Drawer (inline) */}
        {showFilters && (
          <div className="bg-surface border border-border-main rounded-2xl p-4 space-y-4 animate-in slide-in-from-top-2 fade-in max-w-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Filters & Sorting</h3>
              <button onClick={clearFilters} className="text-xs font-bold text-primary hover:underline">Clear All</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-bold text-text-main/50 uppercase mb-2">Sort By</div>
                <select 
                  value={sortOrder} 
                  onChange={e => setSortOrder(e.target.value as any)}
                  className="w-full bg-background border border-border-main rounded-xl p-2 outline-none focus:border-primary"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="highest-bristol">Highest Bristol Type</option>
                  <option value="lowest-bristol">Lowest Bristol Type</option>
                  <option value="most-pain">Most Pain</option>
                  <option value="least-pain">Least Pain</option>
                </select>
              </div>

              <div>
                <div className="text-xs font-bold text-text-main/50 uppercase mb-2">Bristol Type</div>
                <div className="flex flex-wrap gap-2">
                  {[1,2,3,4,5,6,7].map(t => (
                    <Chip 
                      key={t} 
                      label={`Type ${t}`} 
                      selected={bristolTypes.includes(t)}
                      onClick={() => toggleBristolType(t)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {allSymptoms.length > 0 && (
              <div>
                <div className="text-xs font-bold text-text-main/50 uppercase mb-2">Symptoms</div>
                <div className="flex flex-wrap gap-2">
                  {allSymptoms.map(s => (
                    <Chip 
                      key={s} 
                      label={s} 
                      selected={symptoms.includes(s)}
                      onClick={() => toggleSymptom(s)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {historyPoopLogs.length === 0 ? (
        <SectionCard className="flex-1 flex flex-col items-center justify-center mt-4 max-w-2xl mx-auto w-full">
          <EmptyState 
            icon={<History size={48} />}
            title="Log History"
            description="You haven't logged any bowel movements yet."
          />
        </SectionCard>
      ) : filteredLogs.length === 0 ? (
         <SectionCard className="flex-1 flex flex-col items-center justify-center mt-4 max-w-2xl mx-auto w-full">
          <EmptyState 
            icon={<Search size={48} />}
            title="No Results"
            description="No logs match your current search or filters."
          />
        </SectionCard>
      ) : (
        <div className="space-y-8 pb-12 px-2">
          {groupKeys.map(group => {
            const logs = groupedLogs[group];
            if (!logs || logs.length === 0) return null;
            return (
              <div key={group} className="space-y-3">
                <h3 className="text-sm font-bold text-text-main/50 uppercase tracking-widest pl-2">{group}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {logs.map(log => (
                    <button 
                      key={log.id} 
                      onClick={() => navigate(APP_CONSTANTS.ROUTES.LOG_DETAIL(log.id!))}
                      className="w-full text-left bg-surface border border-border-main p-5 rounded-[24px] hover:border-primary/50 transition-colors flex items-center justify-between group shadow-sm h-full"
                    >
                      <div className="flex flex-col h-full justify-center">
                        <div className="text-xs font-bold text-text-main/50 uppercase tracking-wider mb-1">{formatDateDisplay(log.date)}</div>
                        
                        {log.hasBowelMovement === false ? (
                          <>
                            <div className="font-bold text-xl text-text-main/60 flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full bg-border-main"></span>
                              No bowel movement
                            </div>
                            <div className="text-sm text-text-main/60 mt-1 font-medium">Logged for the day</div>
                          </>
                        ) : (
                          <>
                            <div className="font-bold text-2xl text-primary">{log.timeType === 'approximate' ? `${log.timeLabel} (Approx.)` : log.time}</div>
                            <div className="text-sm text-text-main/80 mt-2 font-medium">Type {log.bristolType} • {log.amount === 'Not Sure' ? '≈' : log.amount} • {log.difficulty === 'Not Sure' ? '≈' : log.difficulty} • {log.color === 'Not Sure' ? '≈' : log.color}</div>
                          </>
                        )}
                        
                        {/* Tags Preview */}
                        {(log.symptoms?.length || log.foods?.length) ? (
                           <div className="flex flex-wrap gap-2 mt-3 overflow-hidden max-w-full">
                             {log.symptoms?.slice(0,2).map(s => <span key={s} className="text-[10px] bg-danger/10 text-danger px-2 py-1 rounded-md whitespace-nowrap">{s}</span>)}
                             {log.foods?.slice(0,2).map(f => <span key={f} className="text-[10px] bg-warning/10 text-warning px-2 py-1 rounded-md whitespace-nowrap">{f}</span>)}
                           </div>
                        ) : null}
                      </div>
                      <ArrowRight className="text-border-main group-hover:text-primary transition-colors shrink-0 ml-4" />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
