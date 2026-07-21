import React, { useEffect, useState, useMemo } from 'react';
import { Plus, Flame, ArrowRight, CheckCircle2, Activity, Hash, Calendar } from 'lucide-react';
import { SectionCard } from '@/src/shared/components/SectionCard';
import { Button } from '@/src/shared/components/Button';
import { useLogStore } from '@/src/core/stores/useLogStore';
import { getTodayDateString, formatDateDisplay } from '@/src/core/utils/date';
import { APP_CONSTANTS } from '@/src/core/constants';
import { useNavigate } from 'react-router-dom';
import { differenceInDays, parseISO, isThisWeek } from 'date-fns';

const REMINDERS = [
  "Stay hydrated 💧",
  "Eat more fiber 🌿",
  "Take a short walk 🚶"
];

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { todayPoopLogs, historyPoopLogs, streak, loadTodayData, checkInNo, loadHistory } = useLogStore();
  const [reminder] = useState(() => REMINDERS[Math.floor(Math.random() * REMINDERS.length)]);
  
  const todayStr = getTodayDateString();

  useEffect(() => {
    loadTodayData(todayStr);
    loadHistory();
  }, [loadTodayData, loadHistory, todayStr]);

  const handleCheckInNo = async () => {
    await checkInNo(todayStr);
  };

  const handleLogYes = () => {
    navigate(APP_CONSTANTS.ROUTES.LOG_NEW);
  };

  // Dashboard Stats
  const dashboardStats = useMemo(() => {
    const bowelMovements = historyPoopLogs.filter(l => l.hasBowelMovement !== false);
    const thisWeekLogs = bowelMovements.filter(l => isThisWeek(parseISO(l.date)));
    
    // avg freq: total logs / total days since first log
    let avgFreq = 0;
    if (bowelMovements.length > 0) {
      const firstLogDate = parseISO(bowelMovements[bowelMovements.length - 1].date);
      const days = Math.max(1, differenceInDays(new Date(), firstLogDate) + 1);
      avgFreq = Math.round((bowelMovements.length / days) * 10) / 10;
    }

    const mostRecentBristol = bowelMovements[0]?.bristolType || '-';

    return {
      thisWeek: thisWeekLogs.length,
      avgFreq,
      mostRecentBristol
    };
  }, [historyPoopLogs]);
  
  const isCompleted = todayPoopLogs.length > 0;
  const todaysBowelMovements = todayPoopLogs.filter(log => log.hasBowelMovement !== false);
  const hasNoBowelMovementRecord = todayPoopLogs.some(log => log.hasBowelMovement === false);

  return (
    <div className="flex flex-col pt-2 min-h-0 space-y-6 w-full">
      {/* Header Info */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-2xl font-bold text-text-main tracking-tight">Overview</h2>
          <p className="text-sm font-medium text-text-main/70 uppercase tracking-widest mt-1">{formatDateDisplay(todayStr)}</p>
        </div>
        <div className="flex items-center gap-1.5 bg-warning/20 text-warning px-4 py-2 rounded-full font-bold text-sm border border-warning/30 shadow-sm">
          <Flame size={16} className="fill-warning" />
          {streak} Day Streak
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 items-start">
        
        {/* Main Content Area: Status/Question (Priority on Mobile) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4 md:space-y-6 flex flex-col order-1 lg:order-none">
          {!isCompleted ? (
            <SectionCard className="flex flex-col items-center justify-center p-6 md:p-12 border-2 border-primary/20 shadow-md">
              <h3 className="text-xl md:text-2xl font-bold text-center mb-6">Have you had a bowel movement today?</h3>
              <div className="flex w-full gap-3 md:gap-4">
                 <Button variant="secondary" className="flex-1 py-4 md:py-6 text-lg rounded-2xl" onClick={handleCheckInNo}>
                   NO
                 </Button>
                 <Button variant="primary" className="flex-1 py-4 md:py-6 text-lg rounded-2xl" onClick={handleLogYes}>
                   YES
                 </Button>
              </div>
            </SectionCard>
          ) : (
            <div className="space-y-4">
               <div className="flex flex-col sm:flex-row items-center justify-center gap-3 p-4 md:p-6 bg-surface rounded-2xl border border-border-main shadow-sm text-center sm:text-left">
                  {hasNoBowelMovementRecord ? (
                    <>
                      <div className="bg-warning/20 text-warning p-2 rounded-full">
                        <CheckCircle2 size={24} />
                      </div>
                      <div>
                        <div className="font-bold text-lg">Today's Log Completed</div>
                        <div className="text-sm text-text-main/70 font-medium mt-0.5">No bowel movement today.</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-success/20 text-success p-2 rounded-full">
                        <CheckCircle2 size={24} />
                      </div>
                      <div>
                        <div className="font-bold text-lg">Today's Log Completed</div>
                        <div className="text-sm text-text-main/70 font-medium mt-0.5">{todaysBowelMovements.length} bowel movement{todaysBowelMovements.length > 1 ? 's' : ''} recorded.</div>
                      </div>
                    </>
                  )}
               </div>

               {todaysBowelMovements.length > 0 && (
                 <div className="space-y-3 md:space-y-4">
                    <h3 className="text-xs md:text-sm font-bold text-text-main/50 uppercase tracking-widest pl-2">Today's Records</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                      {todaysBowelMovements.map(log => (
                        <button 
                          key={log.id} 
                          onClick={() => navigate(APP_CONSTANTS.ROUTES.LOG_DETAIL(log.id!))}
                          className="w-full text-left bg-surface border border-border-main p-4 md:p-5 rounded-[20px] hover:border-primary/50 transition-colors flex items-center justify-between group shadow-sm h-full"
                        >
                           <div className="flex flex-col justify-center h-full">
                             <div className="font-bold text-xl md:text-2xl text-primary">{log.timeType === 'approximate' ? `${log.timeLabel} (Approx.)` : log.time}</div>
                             <div className="text-xs md:text-sm text-text-main/80 mt-1 font-medium">Type {log.bristolType} • {log.amount === 'Not Sure' ? '≈' : log.amount} • {log.difficulty === 'Not Sure' ? '≈' : log.difficulty}</div>
                           </div>
                           <ArrowRight className="text-border-main group-hover:text-primary transition-colors shrink-0 ml-4" />
                        </button>
                      ))}
                    </div>
                 </div>
               )}

               <Button variant="outlined" className="w-full md:w-auto mt-2 bg-surface px-8" leftIcon={<Plus size={18} />} onClick={handleLogYes}>
                 Log Another
               </Button>
            </div>
          )}
        </div>

        {/* Secondary Area: Stats & Reminders */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4 md:space-y-6 order-2 lg:order-none">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            <div className="bg-surface p-3 md:p-4 rounded-2xl border border-border-main flex flex-col items-center justify-center text-center shadow-sm h-full">
              <div className="text-primary/50 mb-1.5 md:mb-2"><Calendar size={18} className="md:w-5 md:h-5"/></div>
              <div className="font-bold text-xl md:text-2xl">{dashboardStats.thisWeek}</div>
              <div className="text-[9px] md:text-[10px] font-bold uppercase text-text-main/50 mt-1">This Week</div>
            </div>
            <div className="bg-surface p-3 md:p-4 rounded-2xl border border-border-main flex flex-col items-center justify-center text-center shadow-sm h-full">
              <div className="text-primary/50 mb-1.5 md:mb-2"><Activity size={18} className="md:w-5 md:h-5"/></div>
              <div className="font-bold text-xl md:text-2xl">{dashboardStats.avgFreq}</div>
              <div className="text-[9px] md:text-[10px] font-bold uppercase text-text-main/50 mt-1">Daily Avg</div>
            </div>
            <div className="bg-surface p-3 md:p-4 rounded-2xl border border-border-main flex flex-col items-center justify-center text-center shadow-sm h-full">
              <div className="text-primary/50 mb-1.5 md:mb-2"><Hash size={18} className="md:w-5 md:h-5"/></div>
              <div className="font-bold text-xl md:text-2xl">{dashboardStats.mostRecentBristol}</div>
              <div className="text-[9px] md:text-[10px] font-bold uppercase text-text-main/50 mt-1">Last Type</div>
            </div>
          </div>
          
          {/* Reminder Card */}
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3 md:p-4 flex items-center justify-center text-primary font-medium text-xs md:text-sm shadow-sm">
            {reminder}
          </div>
        </div>

      </div>
    </div>
  );
};
