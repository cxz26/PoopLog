import React, { useEffect, useMemo } from 'react';
import { useStatsStore } from '@/src/core/stores/useStatsStore';
import { SectionCard } from '@/src/shared/components/SectionCard';
import { Chip } from '@/src/shared/components/Chip';
import { 
  TimeFilter, filterLogsByTime, getTimeFilterDayCount, calculateStreaks, calculateAverageBristol, 
  calculateAverageDailyFrequency, calculateMostCommon, calculateMostCommonTime, calculateDistribution 
} from '@/src/core/utils/analytics';
import { differenceInCalendarDays, parseISO, format, subDays } from 'date-fns';
import { cn } from '@/src/core/utils/cn';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, CartesianGrid
} from 'recharts';
import { Activity, Flame } from 'lucide-react';
import { useSettingsStore } from '@/src/core/stores/useSettingsStore';

const TIME_FILTERS: { label: string, value: TimeFilter }[] = [
  { label: '7 Days', value: '7days' },
  { label: '30 Days', value: '30days' },
  { label: '90 Days', value: '90days' },
  { label: '1 Year', value: '1year' },
  { label: 'All', value: 'all' },
];

const COLORS = ['#8E7D6B', '#A7C9A0', '#E6B980', '#D97B7B', '#9B9B9B', '#487c3b', '#b03030'];

export const StatisticsPage: React.FC = () => {
  const { allPoopLogs, timeFilter, setTimeFilter, loadStatsData } = useStatsStore();
  const { preferredWaterUnit } = useSettingsStore();

  useEffect(() => {
    loadStatsData();
  }, [loadStatsData]);
  const { filteredLogs, daysCount, streaks } = useMemo(() => {
    const filtered = filterLogsByTime(allPoopLogs, timeFilter);
    let d = timeFilter === 'all' ? 1 : getTimeFilterDayCount(timeFilter);
    if (timeFilter === 'all' && filtered.length > 0) {
      const earliestDate = filtered.reduce(
        (earliest, log) => log.date < earliest ? log.date : earliest,
        filtered[0].date,
      );
      d = Math.max(1, differenceInCalendarDays(new Date(), parseISO(earliestDate)) + 1);
    }
    const streaks = calculateStreaks(allPoopLogs);
    return { filteredLogs: filtered, daysCount: d, streaks };
  }, [allPoopLogs, timeFilter]);

  const bmLogs = useMemo(() => filteredLogs.filter(l => l.hasBowelMovement !== false), [filteredLogs]);

  const overview = useMemo(() => {
    const uniqueDaysLogged = new Set(filteredLogs.map(l => l.date)).size;
    const daysWithBM = new Set(bmLogs.map(l => l.date)).size;
    const daysWithoutBM = uniqueDaysLogged - daysWithBM;
    
    return {
      daysLogged: uniqueDaysLogged,
      daysWithBM,
      daysWithoutBM,
      completionRate: daysCount > 0 ? Math.round((uniqueDaysLogged / daysCount) * 100) : 0,
      totalBMs: bmLogs.length,
      avgDaily: calculateAverageDailyFrequency(filteredLogs, daysCount),
      avgBristol: calculateAverageBristol(filteredLogs),
      mostCommonType: calculateMostCommon(bmLogs.map(l => l.bristolType as number)),
      mostCommonTime: calculateMostCommonTime(filteredLogs),
    };
  }, [filteredLogs, bmLogs, daysCount]);
  const weeklyFreqData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    bmLogs.forEach(l => {
      const day = parseISO(l.date).getDay();
      counts[day]++;
    });
    return days.map((d, i) => ({ name: d, value: counts[i] }));
  }, [bmLogs]);

  const bristolTrendData = useMemo(() => {
    const map = new Map<string, { sum: number, count: number }>();
    [...bmLogs].reverse().forEach(l => {
      if (l.bristolType === undefined) return;
      const d = l.date;
      const cur = map.get(d) || { sum: 0, count: 0 };
      cur.sum += l.bristolType;
      cur.count += 1;
      map.set(d, cur);
    });
    return Array.from(map.entries()).map(([date, {sum, count}]) => ({
      date: format(parseISO(date), 'MMM dd, yyyy'),
      avg: sum / count,
    }));
  }, [bmLogs]);

  const stoolDistData = useMemo(() => {
    const dist = calculateDistribution(bmLogs.map(l => l.bristolType as number));
    return dist.map(d => ({ name: `Type ${d.name}`, value: d.value }));
  }, [bmLogs]);

  const symptomsData = useMemo(() => {
    const allSymp = filteredLogs.flatMap(l => l.symptoms || []);
    return calculateDistribution(allSymp).slice(0, 7);
  }, [filteredLogs]);
  
  const foodsData = useMemo(() => {
    const allFoods = filteredLogs.flatMap(l => l.foods || []);
    return calculateDistribution(allFoods);
  }, [filteredLogs]);

  const exerciseData = useMemo(() => {
    const allEx = filteredLogs.flatMap(l => l.exercise || []);
    return calculateDistribution(allEx).slice(0, 7);
  }, [filteredLogs]);

  const wellnessData = useMemo(() => {
    const map = new Map<string, { wSum: number, sSum: number, count: number }>();
    [...filteredLogs].reverse().forEach(l => {
      let w = 0;
      if (typeof l.waterML === 'number') {
        if (preferredWaterUnit === 'mL') w = l.waterML;
        else if (preferredWaterUnit === 'L') w = l.waterML / 1000;
        else w = l.waterML / 250;
      } else if (typeof l.water === 'number') {
        if (preferredWaterUnit === 'mL') w = l.water * 250;
        else if (preferredWaterUnit === 'L') w = (l.water * 250) / 1000;
        else w = l.water;
      }

      let s = 0;
      if (typeof l.sleepDurationMinutes === 'number' && l.sleepDurationMinutes > 0) {
        s = l.sleepDurationMinutes / 60;
      } else if (typeof l.sleepHours === 'number') {
        s = l.sleepHours;
      }

      if (w === 0 && s === 0) return;
      
      const d = l.date;
      const cur = map.get(d) || { wSum: 0, sSum: 0, count: 0 };
      cur.wSum += w;
      cur.sSum += s;
      cur.count += 1;
      map.set(d, cur);
    });
    return Array.from(map.entries()).map(([date, {wSum, sSum, count}]) => ({ 
      date: format(parseISO(date), 'MMM dd, yyyy'), 
      water: wSum / count,
      sleep: sSum / count
    }));
  }, [filteredLogs, preferredWaterUnit]);
  const heatmapDays = useMemo(() => {
    const end = new Date();
    const start = subDays(end, Math.max(daysCount - 1, 6)); 
    const map = new Map<string, 'none' | 'no-bm' | 'bm'>();
    
    filteredLogs.forEach(l => {
      const d = l.date;
      if (l.hasBowelMovement === false) {
         if (map.get(d) !== 'bm') map.set(d, 'no-bm');
      } else {
         map.set(d, 'bm');
      }
    });

    const days = [];
    let curr = new Date(start);
    while (curr <= end) {
      const dStr = format(curr, 'yyyy-MM-dd');
      days.push({ date: dStr, status: map.get(dStr) || 'none' });
      curr.setDate(curr.getDate() + 1);
    }
    return days;
  }, [filteredLogs, daysCount]);


  return (
    <div className="flex flex-col pt-2 min-h-0 space-y-6 w-full">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 pb-2">
        {TIME_FILTERS.map(f => (
          <Chip 
            key={f.value} 
            label={f.label} 
            selected={timeFilter === f.value} 
            onClick={() => setTimeFilter(f.value)} 
            className="whitespace-nowrap px-2.5 text-xs sm:px-4 sm:text-sm"
          />
        ))}
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface border border-border-main p-5 rounded-[24px]">
          <div className="text-sm font-semibold text-text-main/50 uppercase mb-1">Logging Streak</div>
          <div className="flex items-center gap-2">
             <span className="text-3xl font-bold text-primary">{streaks.current}</span>
             <Flame className="text-warning" size={24} />
          </div>
          <div className="text-xs font-medium text-text-main/70 mt-1">Best: {streaks.longest} days</div>
        </div>
        
        <div className="bg-surface border border-border-main p-5 rounded-[24px]">
          <div className="text-sm font-semibold text-text-main/50 uppercase mb-1">Days Logged</div>
          <div className="text-3xl font-bold text-primary">{overview.daysLogged} <span className="text-lg text-text-main/40">/ {daysCount}</span></div>
          <div className="text-xs font-medium text-text-main/70 mt-1">{overview.completionRate}% completion</div>
        </div>

        <div className="bg-surface border border-border-main p-5 rounded-[24px]">
          <div className="text-sm font-semibold text-text-main/50 uppercase mb-1">Bowel Movements</div>
          <div className="text-3xl font-bold text-primary">{overview.totalBMs}</div>
          <div className="text-xs font-medium text-text-main/70 mt-1">{overview.daysWithoutBM} days without</div>
        </div>
        
        <div className="bg-surface border border-border-main p-5 rounded-[24px]">
          <div className="text-sm font-semibold text-text-main/50 uppercase mb-1">Avg Bristol</div>
          <div className="text-3xl font-bold text-primary">{overview.avgBristol || '-'}</div>
          <div className="text-xs font-medium text-text-main/70 mt-1">Most: {overview.mostCommonType ? `Type ${overview.mostCommonType}` : '-'}</div>
        </div>
      </div>

      {filteredLogs.length === 0 ? (
        <SectionCard className="flex flex-col items-center justify-center p-12">
          <Activity size={48} className="text-primary/20 mb-4" />
          <h3 className="text-xl font-bold mb-2">No Data Available</h3>
          <p className="text-text-main/60 text-center">Try changing the time filter or logging some data first.</p>
        </SectionCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 items-start">
          
          {/* Activity Heatmap */}
          <SectionCard title="Activity Calendar" className="md:col-span-2 lg:col-span-3">
            <div className="flex justify-between items-center w-full gap-[1px] md:gap-[2px] pt-4">
              {heatmapDays.map((d, i) => {
                let bg = 'bg-border-main/30'; // empty
                let ring = 'ring-primary/50';
                
                if (d.status === 'no-bm') {
                  bg = 'bg-text-main/20'; // Gray for logged but no BM
                  ring = 'ring-text-main/50';
                } else if (d.status === 'bm') {
                  bg = 'bg-primary'; // Green/Primary for BM
                }
                
                return (
                  <div 
                    key={`${d.date}-${i}`}
                    title={`${d.date}: ${d.status === 'bm' ? 'Had bowel movement' : d.status === 'no-bm' ? 'No bowel movement' : 'No record'}`}
                    className={`flex-1 h-8 md:h-12 rounded-[1px] md:rounded-sm ${bg} transition-colors hover:ring-1 md:hover:ring-2 ${ring} cursor-pointer min-w-[1px]`}
                  />
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-4 text-xs font-medium text-text-main/60 justify-end">
               <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-border-main/30"></div> No record</div>
               <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-text-main/20"></div> No BM</div>
               <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-primary"></div> Had BM</div>
            </div>
          </SectionCard>

          {/* Bristol Trend */}
          <SectionCard title="Bristol Trend" className="md:col-span-2 lg:col-span-3">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={bristolTrendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8E2D8" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9B9B9B' }} />
                <YAxis domain={[1, 7]} ticks={[1, 2, 3, 4, 5, 6, 7]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9B9B9B' }} />
                <Tooltip cursor={{ fill: '#f8f5f1' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                <Line type="monotone" dataKey="avg" stroke="#8E7D6B" strokeWidth={3} dot={{ fill: '#8E7D6B', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </SectionCard>

          {/* Weekly Frequency */}
          <SectionCard title="Weekly Frequency">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={weeklyFreqData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8E2D8" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9B9B9B' }} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9B9B9B' }} />
                <Tooltip cursor={{ fill: '#f8f5f1' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="value" fill="#A7C9A0" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>

          {/* Stool Distribution */}
          <SectionCard title="Stool Types" className="flex flex-col">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={stoolDistData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {stoolDistData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
          </SectionCard>

          {/* Symptoms Distribution */}
          {symptomsData.length > 0 && (
            <SectionCard title="Top Symptoms">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={symptomsData} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E8E2D8" />
                  <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9B9B9B' }} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#383838', fontWeight: 500 }} />
                  <Tooltip cursor={{ fill: '#f8f5f1' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="value" fill="#D97B7B" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          )}

          {/* Exercise Distribution */}
          {exerciseData.length > 0 && (
            <SectionCard title="Top Exercises">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={exerciseData} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E8E2D8" />
                  <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9B9B9B' }} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#383838', fontWeight: 500 }} />
                  <Tooltip cursor={{ fill: '#f8f5f1' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="value" fill="#E6B980" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          )}

          {/* Food Tags Cloud */}
          {foodsData.length > 0 && (
            <SectionCard title="Frequent Foods" className={cn(exerciseData.length > 0 && symptomsData.length > 0 ? "md:col-span-2 lg:col-span-3" : "")}>
              <div className="flex flex-wrap gap-2 mt-4">
                {foodsData.map((f, i) => (
                  <div key={f.name} className="bg-primary/10 text-primary px-4 py-2 rounded-full font-medium" style={{ opacity: Math.max(0.4, 1 - i * 0.1) }}>
                    {f.name} <span className="opacity-50 text-xs ml-1">{f.value}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Wellness (Water / Sleep) */}
          {wellnessData.length > 0 && (
             <SectionCard title="Water & Sleep Trend" className="md:col-span-2 lg:col-span-3">
               <ResponsiveContainer width="100%" height={300}>
                 <LineChart data={wellnessData}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8E2D8" />
                   <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9B9B9B' }} />
                   <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9B9B9B' }} />
                   <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9B9B9B' }} />
                   <Tooltip cursor={{ fill: '#f8f5f1' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} formatter={(value: number) => value.toFixed(1)} />
                   <Line yAxisId="left" type="monotone" name={`Water (${preferredWaterUnit})`} dataKey="water" stroke="#7BA8D9" strokeWidth={3} dot={{ fill: '#7BA8D9', strokeWidth: 2, r: 4 }} />
                   <Line yAxisId="right" type="monotone" name="Sleep (Hours)" dataKey="sleep" stroke="#9B8EAD" strokeWidth={3} dot={{ fill: '#9B8EAD', strokeWidth: 2, r: 4 }} />
                 </LineChart>
               </ResponsiveContainer>
             </SectionCard>
          )}
        </div>
      )}
    </div>
  );
};
